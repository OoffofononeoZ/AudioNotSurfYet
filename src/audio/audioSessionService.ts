import type { InjectionKey } from 'vue';
import { inject, shallowReactive } from 'vue';
import Meyda from 'meyda';
import { parseBlob } from 'music-metadata';
import { AudioEngine } from './audioEngine';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type {
    PlaybackSnapshot,
    TrackRecord,
} from '../types/audio';

type AudioSessionStore = ReturnType<typeof useAudioSessionStore>;
type AnimationFrameCallback = (timestamp: number) => void;
type RequestFrame = (callback: AnimationFrameCallback) => number;
type CancelFrame = (handle: number) => void;

interface ParsedMetadata {
    common: {
        title?: string;
        artist?: string;
        album?: string;
        picture?: Array<{
            data: Uint8Array;
            format: string;
        }>;
    };
    format: {
        duration?: number;
        sampleRate?: number;
    };
}

type MetadataParser = (file: File) => Promise<ParsedMetadata>;

interface RuntimeTrack {
    file: File;
    artworkUrl?: string;
}

export interface AudioSessionServiceOptions {
    engine?: AudioEnginePort;
    parseMetadata?: MetadataParser;
    createObjectURL?: (blob: Blob) => string;
    revokeObjectURL?: (url: string) => void;
    requestFrame?: RequestFrame;
    cancelFrame?: CancelFrame;
    createTrackId?: () => string;
}

export interface AudioEnginePort {
    load(input: {
        trackId: string;
        encodedAudio: ArrayBuffer;
    }): Promise<'loaded' | 'stale'>;
    play(): Promise<void>;
    pause(): void;
    seek(seconds: number): Promise<void>;
    setVolume(volume: number): void;
    getSnapshot(): PlaybackSnapshot;
    getTimeDomainFloatData(): Float32Array | null;
    subscribe(
        listener: (snapshot: PlaybackSnapshot) => void,
    ): () => void;
    unload(): void;
    dispose(): Promise<void>;
}

const defaultRequestFrame: RequestFrame = (callback) =>
    requestAnimationFrame(callback);
const defaultCancelFrame: CancelFrame = (handle) =>
    cancelAnimationFrame(handle);

export class AudioSessionService {
    private readonly store: AudioSessionStore;
    private readonly engine: AudioEnginePort;
    private readonly parseMetadata: MetadataParser;
    private readonly createObjectURL: (blob: Blob) => string;
    private readonly revokeObjectURL: (url: string) => void;
    private readonly requestFrame: RequestFrame;
    private readonly cancelFrame: CancelFrame;
    private readonly createTrackId: () => string;
    private readonly runtimeTracks = shallowReactive(
        new Map<string, RuntimeTrack>(),
    );
    private readonly unsubscribeEngine: () => void;
    private commandGeneration = 0;
    private importGeneration = 0;
    private frameHandle: number | null = null;
    private disposed = false;

    constructor(
        store: AudioSessionStore,
        options: AudioSessionServiceOptions = {},
    ) {
        this.store = store;
        this.engine = options.engine ?? new AudioEngine();
        this.parseMetadata =
            options.parseMetadata
            ?? ((file) => parseBlob(file) as Promise<ParsedMetadata>);
        this.createObjectURL =
            options.createObjectURL ?? ((blob) => URL.createObjectURL(blob));
        this.revokeObjectURL =
            options.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url));
        this.requestFrame = options.requestFrame ?? defaultRequestFrame;
        this.cancelFrame = options.cancelFrame ?? defaultCancelFrame;
        this.createTrackId =
            options.createTrackId ?? (() => crypto.randomUUID());
        this.unsubscribeEngine = this.engine.subscribe((snapshot) => {
            this.handleEngineSnapshot(snapshot);
        });
    }

    async importFiles(files: File[]): Promise<void> {
        if (this.disposed || files.length === 0) return;

        const importGeneration = this.importGeneration;
        const shouldAutoplay = this.store.queue.length === 0;
        const records: TrackRecord[] = [];

        for (const file of files) {
            const trackId = this.createTrackId();
            let metadata: ParsedMetadata | null = null;
            try {
                metadata = await this.parseMetadata(file);
            } catch {
                // Metadata is optional; decoding still gets a chance to succeed.
            }
            if (
                this.disposed
                || importGeneration !== this.importGeneration
            ) {
                return;
            }

            let artworkUrl: string | undefined;
            const picture = metadata?.common.picture?.[0];
            if (picture) {
                try {
                    const artwork = new Blob(
                        [picture.data as unknown as BlobPart],
                        { type: picture.format || 'image/png' },
                    );
                    artworkUrl = this.createObjectURL(artwork);
                } catch {
                    artworkUrl = undefined;
                }
            }

            const record: TrackRecord = {
                id: trackId,
                name: file.name || 'unknown',
                mimeType: file.type || 'application/octet-stream',
                byteSize: file.size,
                lastModified: file.lastModified,
                durationSeconds: metadata?.format.duration,
                encodedSampleRate: metadata?.format.sampleRate,
                metadata: {
                    title: metadata?.common.title || file.name || 'unknown',
                    artist: metadata?.common.artist,
                    album: metadata?.common.album,
                    artworkMimeType: picture?.format,
                },
                restoreState: 'available',
            };
            records.push(record);
            this.runtimeTracks.set(trackId, {
                file,
                artworkUrl,
            });
        }

        this.store.appendTracks(records);
        if (shouldAutoplay && records[0]) {
            await this.playTrack(records[0].id);
        }
    }

    async playTrack(trackId: string): Promise<void> {
        if (this.disposed) return;
        const runtimeTrack = this.runtimeTracks.get(trackId);
        const record = this.store.queue.find((track) => track.id === trackId);
        if (!runtimeTrack || !record) return;

        const generation = ++this.commandGeneration;
        this.engine.unload();
        this.store.setCurrentTrack(trackId);
        this.store.setEnergy(0);
        this.store.setPlayback({
            trackId,
            state: 'loading',
            currentTimeSeconds: 0,
            durationSeconds: record.durationSeconds ?? 0,
            volume: this.engine.getSnapshot().volume,
        });

        try {
            const encodedAudio = await runtimeTrack.file.arrayBuffer();
            if (
                generation !== this.commandGeneration
                || this.disposed
                || !this.runtimeTracks.has(trackId)
            ) {
                return;
            }

            const result = await this.engine.load({
                trackId,
                encodedAudio,
            });
            if (
                result === 'stale'
                || generation !== this.commandGeneration
                || this.disposed
            ) {
                return;
            }

            const snapshot = this.engine.getSnapshot();
            this.store.updateTrack(trackId, {
                durationSeconds: snapshot.durationSeconds,
            });
            await this.engine.play();
        } catch (error) {
            if (generation !== this.commandGeneration || this.disposed) return;
            this.store.updateTrack(trackId, {
                restoreState: 'decode-error',
            });
            if (this.engine.getSnapshot().state !== 'error') {
                this.store.setPlayback({
                    trackId,
                    state: 'error',
                    currentTimeSeconds: 0,
                    durationSeconds: record.durationSeconds ?? 0,
                    volume: this.engine.getSnapshot().volume,
                    error: {
                        code: 'decode',
                        message:
                            error instanceof Error
                                ? error.message
                                : 'Unable to read this audio file.',
                    },
                });
            }
            this.store.setEnergy(0);
        }
    }

    async togglePlayback(): Promise<void> {
        if (this.disposed || this.store.queue.length === 0) return;

        if (this.store.playback.state === 'playing') {
            this.engine.pause();
            return;
        }

        if (
            this.store.playback.state === 'paused'
            || this.store.playback.state === 'ended'
        ) {
            try {
                await this.engine.play();
            } catch {
                // The engine snapshot carries the typed error for the UI.
            }
            return;
        }

        const trackId =
            this.store.currentTrackId ?? this.store.queue[0]?.id ?? null;
        if (trackId) await this.playTrack(trackId);
    }

    async next(): Promise<void> {
        const target = this.getRelativeTrack(1);
        if (target) await this.playTrack(target.id);
    }

    async previous(): Promise<void> {
        const target = this.getRelativeTrack(-1);
        if (target) await this.playTrack(target.id);
    }

    async seek(seconds: number): Promise<void> {
        if (this.disposed) return;
        try {
            await this.engine.seek(seconds);
        } catch {
            // The engine snapshot carries the typed error for the UI.
        }
    }

    setVolume(percent: number): void {
        const normalized = Math.min(
            100,
            Math.max(0, Number.isFinite(percent) ? percent : 0),
        ) / 100;
        this.engine.setVolume(normalized);
    }

    async deleteTrack(trackId: string): Promise<void> {
        if (this.disposed) return;
        const index = this.store.queue.findIndex(
            (track) => track.id === trackId,
        );
        if (index < 0) return;

        const wasCurrent = this.store.currentTrackId === trackId;
        this.releaseRuntimeTrack(trackId);
        this.store.removeTrack(trackId);

        if (!wasCurrent) return;
        if (this.store.queue.length === 0) {
            ++this.commandGeneration;
            this.engine.unload();
            this.store.clearSession(this.engine.getSnapshot().volume);
            return;
        }

        const nextIndex = Math.min(index, this.store.queue.length - 1);
        const nextTrack = this.store.queue[nextIndex];
        if (nextTrack) await this.playTrack(nextTrack.id);
    }

    async clear(): Promise<void> {
        if (this.disposed) return;
        ++this.commandGeneration;
        ++this.importGeneration;
        this.stopFrameLoop();
        for (const trackId of [...this.runtimeTracks.keys()]) {
            this.releaseRuntimeTrack(trackId);
        }
        this.engine.unload();
        this.store.clearSession(this.engine.getSnapshot().volume);
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        ++this.commandGeneration;
        ++this.importGeneration;
        this.stopFrameLoop();
        this.unsubscribeEngine();
        for (const trackId of [...this.runtimeTracks.keys()]) {
            this.releaseRuntimeTrack(trackId);
        }
        try {
            await this.engine.dispose();
        } catch {
            // Disposal is best effort after the layout has left the page.
        } finally {
            this.store.clearSession(this.engine.getSnapshot().volume);
        }
    }

    getArtworkUrl(trackId: string): string | undefined {
        return this.runtimeTracks.get(trackId)?.artworkUrl;
    }

    private handleEngineSnapshot(snapshot: PlaybackSnapshot): void {
        if (this.disposed) return;
        this.store.setPlayback(snapshot);
        if (snapshot.trackId) {
            this.store.setCurrentTrack(snapshot.trackId);
        }

        if (snapshot.state === 'playing') {
            this.startFrameLoop();
            return;
        }

        this.stopFrameLoop();
        this.store.setEnergy(0);
        if (snapshot.state === 'ended' && this.store.queue.length > 0) {
            void this.next();
        }
    }

    private startFrameLoop(): void {
        if (this.frameHandle !== null || this.disposed) return;

        const tick = () => {
            this.frameHandle = null;
            if (this.disposed || this.engine.getSnapshot().state !== 'playing') {
                this.store.setEnergy(0);
                return;
            }

            this.store.setPlayback(this.engine.getSnapshot());
            const samples = this.engine.getTimeDomainFloatData();
            let extracted: ReturnType<typeof Meyda.extract> = null;
            try {
                extracted = samples
                    ? Meyda.extract('energy', samples)
                    : null;
            } catch {
                extracted = null;
            }
            const energy =
                typeof extracted === 'number' && Number.isFinite(extracted)
                    ? extracted
                    : 0;
            this.store.setEnergy(energy);
            this.frameHandle = this.requestFrame(tick);
        };

        this.frameHandle = this.requestFrame(tick);
    }

    private stopFrameLoop(): void {
        if (this.frameHandle !== null) {
            this.cancelFrame(this.frameHandle);
            this.frameHandle = null;
        }
    }

    private getRelativeTrack(delta: number): TrackRecord | null {
        const queue = this.store.queue;
        if (queue.length === 0) return null;
        const currentIndex = queue.findIndex(
            (track) => track.id === this.store.currentTrackId,
        );
        const baseIndex = currentIndex >= 0 ? currentIndex : 0;
        const targetIndex =
            (baseIndex + delta + queue.length) % queue.length;
        return queue[targetIndex] ?? null;
    }

    private releaseRuntimeTrack(trackId: string): void {
        const runtimeTrack = this.runtimeTracks.get(trackId);
        if (runtimeTrack?.artworkUrl) {
            this.revokeObjectURL(runtimeTrack.artworkUrl);
        }
        this.runtimeTracks.delete(trackId);
    }
}

export const audioSessionServiceKey: InjectionKey<AudioSessionService> =
    Symbol('audio-session-service');

export const useAudioSessionService = (): AudioSessionService => {
    const service = inject(audioSessionServiceKey);
    if (!service) {
        throw new Error('AudioSessionService has not been provided.');
    }
    return service;
};
