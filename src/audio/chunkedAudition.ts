import type { AuditionSnapshot, AuditionSource } from './auditionTypes';
import { AUDITION_BLOCK_SECONDS, AUDITION_LOOKAHEAD_SECONDS } from './auditionTypes';
import { assertPlaybackRate } from './playbackRate';

interface ScheduledGroup {
    endFrame: number;
    nodes: AudioBufferSourceNode[];
}

// Owns only bounded audition reads, scheduled buffers and a preparation timer.
// The parent AudioEngine owns the context, output graph and public clock/RAF.
export class ChunkedAudition {
    private readonly context: AudioContext;
    private readonly source: AuditionSource;
    private readonly notify: (snapshot: AuditionSnapshot) => void;
    private readonly gains = new Map<string, GainNode>();
    private groups: ScheduledGroup[] = [];
    private readonly muted = new Set<string>();
    private state: AuditionSnapshot['state'] = 'paused';
    private offsetFrame = 0;
    private nextFrame = 0;
    private scheduledEndFrame = 0;
    private anchorTime: number | null = null;
    private requested = false;
    private generation = 0;
    private abort = new AbortController();
    private pending: Promise<void> | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private disposed = false;
    private error: string | undefined;
    private playbackRate: number;
    constructor(
        context: AudioContext,
        destination: AudioNode,
        source: AuditionSource,
        notify: (snapshot: AuditionSnapshot) => void,
        playbackRate = 1,
    ) {
        assertPlaybackRate(playbackRate);
        this.playbackRate = playbackRate;
        if (
            !Number.isSafeInteger(source.frames) ||
            source.frames <= 0 ||
            !Number.isSafeInteger(source.sampleRate) ||
            source.sampleRate < 8000 ||
            source.sampleRate > 192000 ||
            !source.roles.length ||
            source.roles.length > 4 ||
            new Set(source.roles).size !== source.roles.length ||
            source.mutedRoles.some(role => !source.roles.includes(role))
        )
            throw Error('Invalid audition source.');
        this.context = context;
        this.source = source;
        this.notify = notify;
        try {
            for (const role of source.roles) {
                const gain = context.createGain();
                this.gains.set(role, gain);
                if (source.mutedRoles.includes(role)) {
                    this.muted.add(role);
                    gain.gain.value = 0;
                }
                gain.connect(destination);
            }
        } catch (error) {
            for (const gain of this.gains.values()) gain.disconnect();
            throw error;
        }
    }
    getSnapshot(): AuditionSnapshot {
        return {
            state: this.state,
            currentTimeSeconds: this.getCurrentTime(),
            mutedRoles: [...this.muted],
            error: this.error,
        };
    }
    private getCurrentTime(): number {
        const seconds = this.offsetFrame / this.source.sampleRate;
        if (this.anchorTime === null) return seconds;
        return Math.max(
            seconds,
            Math.min(
                this.scheduledEndFrame / this.source.sampleRate,
                seconds + (this.context.currentTime - this.anchorTime) * this.playbackRate,
            ),
        );
    }
    private publish(): void {
        if (!this.disposed) this.notify(this.getSnapshot());
    }
    setMuted(role: string, muted: boolean): void {
        const gain = this.gains.get(role);
        if (!gain) throw Error('Unknown audition role.');
        if (muted) this.muted.add(role);
        else this.muted.delete(role);
        gain.gain.value = muted ? 0 : 1;
        this.publish();
    }
    private cancelTimer(): void {
        if (this.timer !== null) clearTimeout(this.timer);
        this.timer = null;
    }
    private stopNodes(): void {
        for (const group of this.groups)
            for (const node of group.nodes) {
                node.onended = null;
                try {
                    node.stop();
                } catch {
                    /* Already ended or never started. */
                }
                node.disconnect();
                node.buffer = null;
            }
        this.groups = [];
    }
    pause(): void {
        if (this.disposed) return;
        const position = this.getCurrentTime();
        this.requested = false;
        ++this.generation;
        this.abort.abort();
        this.abort = new AbortController();
        this.cancelTimer();
        this.stopNodes();
        this.anchorTime = null;
        this.offsetFrame = Math.min(this.source.frames, Math.round(position * this.source.sampleRate));
        this.nextFrame = this.offsetFrame;
        this.scheduledEndFrame = this.offsetFrame;
        this.state = 'paused';
        this.error = undefined;
        this.publish();
    }
    async seek(seconds: number): Promise<void> {
        const resume = this.requested;
        this.pause();
        this.offsetFrame = Math.round(
            Math.max(0, Math.min(this.source.frames / this.source.sampleRate, Number.isFinite(seconds) ? seconds : 0)) *
                this.source.sampleRate,
        );
        this.nextFrame = this.offsetFrame;
        this.scheduledEndFrame = this.offsetFrame;
        this.publish();
        if (resume) await this.play();
    }
    async setPlaybackRate(rate: number): Promise<void> {
        assertPlaybackRate(rate);
        if (rate === this.playbackRate || this.disposed) return;
        const resume = this.requested;
        if (resume) this.pause();
        this.playbackRate = rate;
        if (resume) await this.play();
        else this.publish();
    }
    async play(): Promise<void> {
        if (this.disposed || this.requested) return;
        if (this.offsetFrame >= this.source.frames) {
            this.offsetFrame = 0;
            this.nextFrame = 0;
            this.scheduledEndFrame = 0;
        }
        this.requested = true;
        this.error = undefined;
        this.state = 'buffering';
        this.publish();
        const generation = this.generation;
        await this.pending;
        if (this.disposed || generation !== this.generation || !this.requested) return;
        await this.prepare(true);
    }
    private arm(): void {
        this.cancelTimer();
        if (!this.requested || this.disposed) return;
        this.timer = setTimeout(() => {
            this.timer = null;
            this.poll();
        }, 100);
    }
    private poll(): void {
        if (!this.requested || this.disposed) return;
        const currentFrame = Math.round(this.getCurrentTime() * this.source.sampleRate);
        if (this.anchorTime !== null && currentFrame >= this.scheduledEndFrame) {
            if (this.nextFrame >= this.source.frames) {
                this.offsetFrame = this.source.frames;
                this.anchorTime = null;
                this.requested = false;
                this.stopNodes();
                this.state = 'ended';
                this.publish();
                return;
            }
            // Freeze exactly at the last scheduled audio sample. A late read
            // can resume from this boundary; no visual clock advances silently.
            this.offsetFrame = this.scheduledEndFrame;
            this.anchorTime = null;
            this.stopNodes();
            this.state = 'buffering';
            this.publish();
        }
        if (
            !this.pending &&
            this.nextFrame < this.source.frames &&
            (this.nextFrame - currentFrame) / this.source.sampleRate < AUDITION_LOOKAHEAD_SECONDS
        ) {
            void this.prepare(false);
        }
        this.arm();
    }
    private async readBlock(start: number, count: number, signal: AbortSignal): Promise<AudioBuffer[]> {
        const buffers: AudioBuffer[] = [];
        // A single block operation is in flight. Channels are short reads;
        // allocate each AudioBuffer only after its finite PCM has been checked.
        for (const role of this.source.roles) {
            if (signal.aborted) throw Error('Audition read cancelled.');
            const left = await this.source.read(role, 0, start, count, signal);
            if (signal.aborted) throw Error('Audition read cancelled.');
            const right = await this.source.read(role, 1, start, count, signal);
            if (signal.aborted) throw Error('Audition read cancelled.');
            if (
                left.length !== count ||
                right.length !== count ||
                left.some(value => !Number.isFinite(value)) ||
                right.some(value => !Number.isFinite(value))
            ) {
                throw Error('Audition PCM is incomplete or corrupt.');
            }
            const buffer = this.context.createBuffer(2, count, this.source.sampleRate);
            buffer.copyToChannel(new Float32Array(left), 0);
            buffer.copyToChannel(new Float32Array(right), 1);
            buffers.push(buffer);
        }
        return buffers;
    }
    private schedule(start: number, buffers: AudioBuffer[]): void {
        if (this.anchorTime === null) this.anchorTime = this.context.currentTime + 0.02;
        const when = this.anchorTime + (start - this.offsetFrame) / this.source.sampleRate / this.playbackRate;
        const nodes: AudioBufferSourceNode[] = [];
        const group: ScheduledGroup = { endFrame: start + buffers[0]!.length, nodes };
        try {
            for (const [index, role] of this.source.roles.entries()) {
                const node = this.context.createBufferSource();
                nodes.push(node);
                node.buffer = buffers[index]!;
                node.playbackRate.value = this.playbackRate;
                node.connect(this.gains.get(role)!);
                node.onended = () => {
                    node.onended = null;
                    node.disconnect();
                    node.buffer = null;
                    const at = group.nodes.indexOf(node);
                    if (at >= 0) group.nodes.splice(at, 1);
                    if (!group.nodes.length) this.groups = this.groups.filter(value => value !== group);
                    this.poll();
                };
                node.start(when);
            }
            this.groups.push(group);
            this.scheduledEndFrame = group.endFrame;
            this.nextFrame = group.endFrame;
            this.state = 'playing';
        } catch (error) {
            for (const node of nodes) {
                node.onended = null;
                try {
                    node.stop();
                } catch {}
                node.disconnect();
                node.buffer = null;
            }
            throw error;
        }
    }
    private prepare(initial: boolean): Promise<void> {
        const generation = this.generation,
            signal = this.abort.signal;
        const work = (async () => {
            try {
                const blocks = initial ? Math.ceil(AUDITION_LOOKAHEAD_SECONDS / AUDITION_BLOCK_SECONDS) : 1;
                const ready: Array<{ start: number; buffers: AudioBuffer[] }> = [];
                let start = this.nextFrame;
                for (let block = 0; block < blocks && start < this.source.frames; block++) {
                    const count = Math.min(this.source.sampleRate * AUDITION_BLOCK_SECONDS, this.source.frames - start);
                    const buffers = await this.readBlock(start, count, signal);
                    if (this.disposed || generation !== this.generation || signal.aborted || !this.requested) return;
                    ready.push({ start, buffers });
                    start += count;
                }
                for (const block of ready) {
                    if (
                        this.anchorTime !== null &&
                        this.context.currentTime >=
                            this.anchorTime +
                                (this.scheduledEndFrame - this.offsetFrame) / this.source.sampleRate / this.playbackRate
                    ) {
                        this.offsetFrame = this.scheduledEndFrame;
                        this.anchorTime = null;
                        this.stopNodes();
                        this.state = 'buffering';
                        this.publish();
                    }
                    this.schedule(block.start, block.buffers);
                }
                this.publish();
                this.arm();
            } catch (error) {
                if (this.disposed || generation !== this.generation || signal.aborted || !this.requested) return;
                const position = this.getCurrentTime();
                this.requested = false;
                this.cancelTimer();
                this.stopNodes();
                this.anchorTime = null;
                this.offsetFrame = Math.round(position * this.source.sampleRate);
                this.nextFrame = this.offsetFrame;
                this.scheduledEndFrame = this.offsetFrame;
                this.state = 'error';
                this.error = error instanceof Error ? error.message : 'Audition PCM read failed.';
                this.publish();
            }
        })();
        this.pending = work;
        void work.finally(() => {
            if (this.pending === work) this.pending = null;
        });
        return work;
    }
    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.pause();
        this.disposed = true;
        await this.pending;
        for (const gain of this.gains.values()) gain.disconnect();
        this.gains.clear();
        await this.source.close();
    }
}
