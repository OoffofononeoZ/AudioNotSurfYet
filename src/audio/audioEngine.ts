import type {
    DecodedAudioDescriptor,
    PlaybackError,
    PlaybackErrorCode,
    PlaybackSnapshot,
} from '../types/audio';
import { ChunkedAudition } from './chunkedAudition';
import type { AuditionSource } from './auditionTypes';

type AudioContextFactory = () => AudioContext;
type SnapshotListener = (snapshot: PlaybackSnapshot) => void;

export interface AudioEngineOptions {
    audioContextFactory?: AudioContextFactory;
}

export interface AudioPlaybackCheckpoint {
    readonly trackId: string;
    readonly state: 'paused' | 'playing' | 'ended';
    readonly currentTimeSeconds: number;
}

export class AudioTransportError extends Error {
    readonly code: 'transport-busy' | 'transport-unavailable';

    constructor(code: AudioTransportError['code'], message: string) {
        super(message);
        this.name = 'AudioTransportError';
        this.code = code;
    }
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
    private audition:ChunkedAudition|null = null;
    private auditionSource:AuditionSource|null = null;
    private auditionGeneration = 0;
    private auditionSelectionPending = false;
    private readonly auditionReleases = new Set<Promise<void>>();
    private playbackRequested = false;
    private playbackCommandGeneration = 0;

    constructor(options: AudioEngineOptions = {}) {
        this.audioContextFactory =
            options.audioContextFactory ?? (() => new AudioContext());
    }

    async load(input: {
        trackId: string;
        encodedAudio: ArrayBuffer;
    }): Promise<'loaded' | 'stale'> {
        const generation = ++this.loadGeneration;
        ++this.auditionGeneration; ++this.playbackCommandGeneration;
        this.playbackRequested = false; this.auditionSelectionPending = false;
        const auditionRelease = this.detachAudition();
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
            if (auditionRelease) await auditionRelease;
            if (generation !== this.loadGeneration) return 'stale';
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
        this.playbackRequested = true;
        const command = ++this.playbackCommandGeneration;
        if (this.auditionSelectionPending) {
            this.publish({...this.getSnapshot(),state:'buffering',error:undefined}); return;
        }
        const selectedAudition = this.audition;

        const generation = this.loadGeneration;
        if (!selectedAudition && this.playbackOffsetSeconds >= this.buffer.duration) {
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

        if (generation !== this.loadGeneration || !this.buffer || command !== this.playbackCommandGeneration
            || !this.playbackRequested || selectedAudition !== this.audition) return;

        try {
            if (selectedAudition) { await selectedAudition.play(); return; }
            this.startSource(context);
        } catch (error) {
            this.publishError('source', error, this.snapshot.trackId);
            throw error;
        }
    }

    pause(): void {
        this.playbackRequested = false; ++this.playbackCommandGeneration;
        if (this.audition) { this.audition.pause(); return; }
        if (this.auditionSelectionPending) { this.publish({...this.getSnapshot(),state:'paused'}); return; }
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
        if (this.auditionSelectionPending) {
            this.playbackOffsetSeconds = target;
            this.publish({...this.getSnapshot(),currentTimeSeconds:target,state:this.playbackRequested?'buffering':'paused'}); return;
        }
        if (this.audition) { await this.audition.seek(target); return; }
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
            audition:this.auditionSource ? {kind:this.auditionSource.kind,label:this.auditionSource.label,
                resultId:this.auditionSource.resultId,roles:[...this.auditionSource.roles],mutedRoles:this.audition?.getSnapshot().mutedRoles ?? []}
                : {kind:'original',label:'原曲',roles:[],mutedRoles:[]},
            error: this.snapshot.error
                ? { ...this.snapshot.error }
                : undefined,
        };
    }

    async setAuditionSource(source:AuditionSource|null,options?:{play?:boolean}):Promise<void> {
        if (!source && !this.audition && !this.auditionSelectionPending && !this.auditionReleases.size) return;
        if (!source && !this.buffer) {
            ++this.auditionGeneration; this.auditionSelectionPending = false; this.playbackRequested = false;
            const release = this.detachAudition(); if (release) await release; return;
        }
        if (source && (!this.buffer || source.trackId !== this.snapshot.trackId
            || Math.abs(source.frames / source.sampleRate - this.buffer.duration) > 1 / source.sampleRate)) {
            await source.close(); throw new Error('Audition source does not match the current song.');
        }
        const generation = ++this.auditionGeneration;
        const loadGeneration = this.loadGeneration;
        const position = this.getCurrentTimeSeconds();
        const requested = options?.play ?? (this.playbackRequested || this.snapshot.state === 'playing' || this.snapshot.state === 'buffering');
        this.stopSource();
        const release = this.detachAudition();
        this.playbackOffsetSeconds = position; this.playbackStartContextTime = null;
        this.playbackRequested = requested; this.auditionSelectionPending = true;
        this.publish({...this.getSnapshot(),state:requested?'buffering':'paused',currentTimeSeconds:position,error:undefined});
        try {
            if (release) await release;
            if (generation !== this.auditionGeneration || loadGeneration !== this.loadGeneration) { if (source) await source.close(); return; }
            if (source) {
                const context = this.ensureGraph();
                const audition = new ChunkedAudition(context,this.analyserNode!,source,snapshot => {
                    if (this.audition !== audition) return;
                    this.playbackOffsetSeconds = snapshot.currentTimeSeconds;
                    if (snapshot.state === 'ended' || snapshot.state === 'error') this.playbackRequested = false;
                    this.publish({trackId:source.trackId,state:snapshot.state,currentTimeSeconds:snapshot.currentTimeSeconds,
                        durationSeconds:this.buffer?.duration ?? 0,volume:this.volume,
                        error:snapshot.error ? {code:'audition-read',message:snapshot.error} : undefined});
                });
                this.audition = audition; this.auditionSource = source;
                await audition.seek(this.playbackOffsetSeconds);
            }
            if (generation !== this.auditionGeneration || loadGeneration !== this.loadGeneration) return;
            this.auditionSelectionPending = false;
            this.publish({...this.getSnapshot(),state:'paused',error:undefined});
            if (this.playbackRequested && this.buffer) await this.play();
        } catch (error) {
            if (generation !== this.auditionGeneration || loadGeneration !== this.loadGeneration) return;
            this.auditionSelectionPending = false;
            if (source && this.auditionSource !== source) await source.close();
            this.publishError('audition-read',error,this.snapshot.trackId); throw error;
        }
    }

    setAuditionMuted(role:string,muted:boolean):void {
        if (!this.audition) throw new Error('No audition source is selected.');
        this.audition.setMuted(role,muted);
    }

    private detachAudition():Promise<void>|null {
        const audition = this.audition;
        this.audition = null; this.auditionSource = null;
        if (audition) {
            const release = audition.dispose(); this.auditionReleases.add(release);
            void release.then(() => this.auditionReleases.delete(release),() => this.auditionReleases.delete(release));
        }
        if (!this.auditionReleases.size) return null;
        const pending = Promise.all([...this.auditionReleases]).then(() => undefined);
        void pending.catch(() => undefined);
        return pending;
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

    capturePlaybackCheckpoint(): AudioPlaybackCheckpoint | null {
        const snapshot = this.getSnapshot();
        if (
            !snapshot.trackId
            || !['paused', 'playing', 'buffering', 'ended'].includes(snapshot.state)
        ) return null;
        return {
            trackId: snapshot.trackId,
            state: snapshot.state === 'buffering' ? 'playing' : snapshot.state as AudioPlaybackCheckpoint['state'],
            currentTimeSeconds: snapshot.currentTimeSeconds,
        };
    }

    async restorePlaybackCheckpoint(checkpoint: AudioPlaybackCheckpoint): Promise<void> {
        if (!this.buffer || this.snapshot.trackId !== checkpoint.trackId) {
            throw new AudioTransportError(
                'transport-unavailable',
                '导出前的歌曲已不可恢复。',
            );
        }
        if (this.audition) {
            this.pause(); await this.audition.seek(checkpoint.currentTimeSeconds);
            if (checkpoint.state === 'playing') await this.play();
            else if (checkpoint.state === 'ended') this.publish({...this.getSnapshot(),state:'ended'});
            return;
        }
        this.stopSource();
        if (checkpoint.state === 'ended') {
            this.playbackOffsetSeconds = this.buffer.duration;
            this.publish({
                trackId: checkpoint.trackId,
                state: 'ended',
                currentTimeSeconds: this.buffer.duration,
                durationSeconds: this.buffer.duration,
                volume: this.volume,
            });
            return;
        }
        this.playbackOffsetSeconds = clamp(
            checkpoint.currentTimeSeconds,
            0,
            this.buffer.duration,
        );
        this.publish({
            trackId: checkpoint.trackId,
            state: 'paused',
            currentTimeSeconds: this.playbackOffsetSeconds,
            durationSeconds: this.buffer.duration,
            volume: this.volume,
        });
        if (checkpoint.state === 'playing') await this.play();
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
        ++this.auditionGeneration; ++this.playbackCommandGeneration;
        this.playbackRequested = false; this.auditionSelectionPending = false;
        this.detachAudition();
        ++this.decodedRevision;
        this.stopSource();
        this.buffer = null;
        this.playbackOffsetSeconds = 0;
        this.playbackStartContextTime = null;
        this.publish(emptySnapshot(this.volume));
    }

    async dispose(): Promise<void> {
        ++this.loadGeneration;
        ++this.auditionGeneration; ++this.playbackCommandGeneration;
        this.playbackRequested = false; this.auditionSelectionPending = false;
        const auditionRelease = this.detachAudition();
        ++this.decodedRevision;
        this.stopSource();
        this.buffer = null;
        this.playbackOffsetSeconds = 0;
        this.playbackStartContextTime = null;
        let releaseError:unknown;
        try { if (auditionRelease) await auditionRelease; } catch (error) { releaseError = error; }

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
        } else if (releaseError) {
            this.publishError('audition-read',releaseError,null);
        } else {
            this.publish(emptySnapshot(this.volume));
        }
        this.listeners.clear();
        if (closeError || releaseError) throw closeError ?? releaseError;
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
                this.playbackRequested = false;
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
        if (this.audition) return Math.min(this.buffer.duration,this.audition.getSnapshot().currentTimeSeconds);
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
        this.playbackRequested = false;
        this.audition?.pause();
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
