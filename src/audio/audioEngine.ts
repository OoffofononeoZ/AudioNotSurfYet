import type {
    DecodedAudioDescriptor,
    PlaybackError,
    PlaybackErrorCode,
    PlaybackSnapshot,
} from '../types/audio';

type AudioContextFactory = () => AudioContext;
type SnapshotListener = (snapshot: PlaybackSnapshot) => void;

export interface AudioEngineOptions {
    audioContextFactory?: AudioContextFactory;
}

const clamp = (value: number, minimum: number, maximum: number) =>
    Math.min(maximum, Math.max(minimum, value));

const emptySnapshot = (volume: number): PlaybackSnapshot => ({
    trackId: null,
    state: 'empty',
    currentTimeSeconds: 0,
    durationSeconds: 0,
    volume,
});

export class AudioEngine {
    private readonly audioContextFactory: AudioContextFactory;
    private readonly listeners = new Set<SnapshotListener>();
    private audioContext: AudioContext | null = null;
    private gainNode: GainNode | null = null;
    private analyserNode: AnalyserNode | null = null;
    private timeDomainData: Float32Array<ArrayBuffer> | null = null;
    private buffer: AudioBuffer | null = null;
    private source: AudioBufferSourceNode | null = null;
    private playbackOffsetSeconds = 0;
    private playbackStartContextTime: number | null = null;
    private volume = 1;
    private loadGeneration = 0;
    private decodedRevision = 0;
    private snapshot: PlaybackSnapshot = emptySnapshot(this.volume);

    constructor(options: AudioEngineOptions = {}) {
        this.audioContextFactory =
            options.audioContextFactory ?? (() => new AudioContext());
    }

    async load(input: {
        trackId: string;
        encodedAudio: ArrayBuffer;
    }): Promise<'loaded' | 'stale'> {
        const generation = ++this.loadGeneration;
        ++this.decodedRevision;
        this.stopSource();
        this.buffer = null;
        this.playbackOffsetSeconds = 0;
        this.playbackStartContextTime = null;
        this.publish({
            trackId: input.trackId,
            state: 'loading',
            currentTimeSeconds: 0,
            durationSeconds: 0,
            volume: this.volume,
        });

        let context: AudioContext;
        try {
            context = this.ensureGraph();
        } catch (error) {
            if (generation !== this.loadGeneration) return 'stale';
            this.publishError('context', error, input.trackId);
            throw error;
        }

        try {
            const decoded = await context.decodeAudioData(
                input.encodedAudio.slice(0),
            );
            if (generation !== this.loadGeneration) return 'stale';

            this.buffer = decoded;
            this.playbackOffsetSeconds = 0;
            this.playbackStartContextTime = null;
            this.publish({
                trackId: input.trackId,
                state: 'paused',
                currentTimeSeconds: 0,
                durationSeconds: decoded.duration,
                volume: this.volume,
            });
            return 'loaded';
        } catch (error) {
            if (generation !== this.loadGeneration) return 'stale';
            const code = this.isUnsupportedError(error)
                ? 'unsupported'
                : 'decode';
            this.publishError(code, error, input.trackId);
            throw error;
        }
    }

    async play(): Promise<void> {
        if (this.snapshot.state === 'playing' || !this.buffer) return;

        const generation = this.loadGeneration;
        if (this.playbackOffsetSeconds >= this.buffer.duration) {
            this.playbackOffsetSeconds = 0;
        }

        let context: AudioContext;
        try {
            context = this.ensureGraph();
            if (context.state === 'suspended') {
                await context.resume();
            }
        } catch (error) {
            if (generation !== this.loadGeneration) return;
            this.publishError('context', error, this.snapshot.trackId);
            throw error;
        }

        if (generation !== this.loadGeneration || !this.buffer) return;

        try {
            this.startSource(context);
        } catch (error) {
            this.publishError('source', error, this.snapshot.trackId);
            throw error;
        }
    }

    pause(): void {
        if (
            !this.source
            || this.playbackStartContextTime === null
            || !this.buffer
        ) {
            return;
        }

        this.playbackOffsetSeconds = this.getCurrentTimeSeconds();
        this.stopSource();
        this.publish({
            trackId: this.snapshot.trackId,
            state: 'paused',
            currentTimeSeconds: this.playbackOffsetSeconds,
            durationSeconds: this.buffer.duration,
            volume: this.volume,
        });
    }

    async seek(seconds: number): Promise<void> {
        if (!this.buffer) return;

        const duration = this.buffer.duration;
        const target = clamp(
            Number.isFinite(seconds) ? seconds : 0,
            0,
            duration,
        );
        const wasPlaying = this.snapshot.state === 'playing';
        this.stopSource();
        this.playbackOffsetSeconds = target;

        if (!wasPlaying) {
            this.publish({
                trackId: this.snapshot.trackId,
                state: 'paused',
                currentTimeSeconds: target,
                durationSeconds: duration,
                volume: this.volume,
            });
            return;
        }

        this.publish({
            trackId: this.snapshot.trackId,
            state: 'paused',
            currentTimeSeconds: target,
            durationSeconds: duration,
            volume: this.volume,
        });
        await this.play();
    }

    setVolume(volume: number): void {
        this.volume = clamp(Number.isFinite(volume) ? volume : 0, 0, 1);
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
        this.publish({
            ...this.getSnapshot(),
            volume: this.volume,
        });
    }

    getSnapshot(): PlaybackSnapshot {
        const currentTimeSeconds = this.getCurrentTimeSeconds();
        return {
            ...this.snapshot,
            currentTimeSeconds,
            error: this.snapshot.error
                ? { ...this.snapshot.error }
                : undefined,
        };
    }

    getTimeDomainFloatData(): Float32Array | null {
        if (!this.analyserNode || this.snapshot.state !== 'playing') {
            return null;
        }

        if (
            !this.timeDomainData
            || this.timeDomainData.length !== this.analyserNode.fftSize
        ) {
            this.timeDomainData = new Float32Array(
                new ArrayBuffer(
                    this.analyserNode.fftSize
                    * Float32Array.BYTES_PER_ELEMENT,
                ),
            );
        }
        this.analyserNode.getFloatTimeDomainData(this.timeDomainData);
        return this.timeDomainData;
    }

    getDecodedAudioDescriptor(): DecodedAudioDescriptor | null {
        if (!this.buffer || !this.snapshot.trackId) return null;
        return {
            trackId: this.snapshot.trackId,
            revision: this.decodedRevision,
            sampleRate: this.buffer.sampleRate,
            length: this.buffer.length,
            channelCount: this.buffer.numberOfChannels,
            durationSeconds: this.buffer.duration,
        };
    }

    copyDecodedChannelRange(input: {
        revision: number;
        channel: number;
        start: number;
        length: number;
    }): Float32Array | null {
        const buffer = this.buffer;
        if (
            !buffer
            || input.revision !== this.decodedRevision
            || !Number.isInteger(input.channel)
            || input.channel < 0
            || input.channel >= buffer.numberOfChannels
            || !Number.isInteger(input.start)
            || input.start < 0
            || !Number.isInteger(input.length)
            || input.length < 0
            || input.start + input.length > buffer.length
        ) {
            return null;
        }
        const copy = new Float32Array(input.length);
        buffer.copyFromChannel(copy, input.channel, input.start);
        return input.revision === this.decodedRevision ? copy : null;
    }

    subscribe(listener: SnapshotListener): () => void {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => {
            this.listeners.delete(listener);
        };
    }

    unload(): void {
        ++this.loadGeneration;
        ++this.decodedRevision;
        this.stopSource();
        this.buffer = null;
        this.playbackOffsetSeconds = 0;
        this.playbackStartContextTime = null;
        this.publish(emptySnapshot(this.volume));
    }

    async dispose(): Promise<void> {
        ++this.loadGeneration;
        ++this.decodedRevision;
        this.stopSource();
        this.buffer = null;
        this.playbackOffsetSeconds = 0;
        this.playbackStartContextTime = null;

        this.analyserNode?.disconnect();
        this.gainNode?.disconnect();
        this.analyserNode = null;
        this.timeDomainData = null;
        this.gainNode = null;

        const context = this.audioContext;
        this.audioContext = null;
        let closeError: unknown;
        if (context && context.state !== 'closed') {
            try {
                await context.close();
            } catch (error) {
                closeError = error;
            }
        }

        if (closeError) {
            this.publishError('context', closeError, null);
        } else {
            this.publish(emptySnapshot(this.volume));
        }
        this.listeners.clear();
        if (closeError) throw closeError;
    }

    private ensureGraph(): AudioContext {
        if (this.audioContext && this.gainNode && this.analyserNode) {
            return this.audioContext;
        }

        const context = this.audioContextFactory();
        let gainNode: GainNode | null = null;
        let analyserNode: AnalyserNode | null = null;
        try {
            gainNode = context.createGain();
            analyserNode = context.createAnalyser();
            analyserNode.fftSize = 1024;
            gainNode.gain.value = this.volume;
            analyserNode.connect(gainNode);
            gainNode.connect(context.destination);
        } catch (error) {
            analyserNode?.disconnect();
            gainNode?.disconnect();
            if (context.state !== 'closed') {
                void context.close().catch(() => undefined);
            }
            throw error;
        }

        this.audioContext = context;
        this.gainNode = gainNode;
        this.analyserNode = analyserNode;
        return context;
    }

    private startSource(context: AudioContext): void {
        if (!this.buffer || !this.analyserNode) {
            throw new Error('Audio buffer is not available.');
        }

        this.stopSource();
        const source = context.createBufferSource();
        source.buffer = this.buffer;
        const startContextTime = context.currentTime;
        try {
            source.connect(this.analyserNode);
            source.onended = () => {
                if (this.source !== source || !this.buffer) return;
                source.onended = null;
                source.disconnect();
                this.source = null;
                this.playbackStartContextTime = null;
                this.playbackOffsetSeconds = this.buffer.duration;
                this.publish({
                    trackId: this.snapshot.trackId,
                    state: 'ended',
                    currentTimeSeconds: this.buffer.duration,
                    durationSeconds: this.buffer.duration,
                    volume: this.volume,
                });
            };
            source.start(startContextTime, this.playbackOffsetSeconds);
        } catch (error) {
            source.onended = null;
            try {
                source.stop();
            } catch {
                // A source that never started cannot be stopped.
            }
            source.disconnect();
            throw error;
        }
        this.source = source;
        this.playbackStartContextTime = startContextTime;
        this.publish({
            trackId: this.snapshot.trackId,
            state: 'playing',
            currentTimeSeconds: this.playbackOffsetSeconds,
            durationSeconds: this.buffer.duration,
            volume: this.volume,
        });
    }

    private stopSource(): void {
        const source = this.source;
        if (!source) return;

        source.onended = null;
        try {
            source.stop();
        } catch {
            // The source may already have reached its natural end.
        }
        source.disconnect();
        this.source = null;
        this.playbackStartContextTime = null;
    }

    private getCurrentTimeSeconds(): number {
        if (!this.buffer) return 0;
        if (!this.source || this.playbackStartContextTime === null) {
            return clamp(
                this.playbackOffsetSeconds,
                0,
                this.buffer.duration,
            );
        }

        const elapsed =
            (this.audioContext?.currentTime ?? this.playbackStartContextTime)
            - this.playbackStartContextTime;
        return clamp(
            this.playbackOffsetSeconds + elapsed,
            0,
            this.buffer.duration,
        );
    }

    private publish(snapshot: PlaybackSnapshot): void {
        this.snapshot = {
            ...snapshot,
            currentTimeSeconds: clamp(
                snapshot.currentTimeSeconds,
                0,
                Math.max(0, snapshot.durationSeconds),
            ),
            volume: this.volume,
            error: snapshot.error ? { ...snapshot.error } : undefined,
        };
        const next = this.getSnapshot();
        for (const listener of this.listeners) {
            listener(next);
        }
    }

    private publishError(
        code: PlaybackErrorCode,
        error: unknown,
        trackId: string | null,
    ): void {
        const playbackError: PlaybackError = {
            code,
            message:
                error instanceof Error
                    ? error.message
                    : 'Unknown audio playback error.',
        };
        this.stopSource();
        this.publish({
            trackId,
            state: 'error',
            currentTimeSeconds: this.getCurrentTimeSeconds(),
            durationSeconds: this.buffer?.duration ?? 0,
            volume: this.volume,
            error: playbackError,
        });
    }

    private isUnsupportedError(error: unknown): boolean {
        return error instanceof DOMException && error.name === 'NotSupportedError';
    }
}
