import { createPinia, setActivePinia } from 'pinia';
import {
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';
import {
    AudioSessionService,
    type AudioEnginePort,
} from '../../src/audio/audioSessionService';
import type { SessionRepositoryPort } from '../../src/persistence/sessionRepository';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type { PlaybackSnapshot } from '../../src/types/audio';

class FakeEngine implements AudioEnginePort {
    async setAuditionSource() {}
    setAuditionMuted() {}
    snapshot: PlaybackSnapshot = {
        trackId: null,
        state: 'empty',
        currentTimeSeconds: 0,
        durationSeconds: 0,
        volume: 1,
    };
    listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
    loadIds: string[] = [];
    playCount = 0;
    pauseCount = 0;
    seekValues: number[] = [];
    unloadCount = 0;
    disposeCount = 0;

    async load(input: {
        trackId: string;
        encodedAudio: ArrayBuffer;
    }): Promise<'loaded'> {
        this.loadIds.push(input.trackId);
        this.emit({
            trackId: input.trackId,
            state: 'paused',
            currentTimeSeconds: 0,
            durationSeconds: 4,
            volume: this.snapshot.volume,
        });
        return 'loaded';
    }

    async play() {
        this.playCount += 1;
        if (!this.snapshot.trackId) return;
        this.emit({
            ...this.snapshot,
            state: 'playing',
        });
    }

    pause() {
        this.pauseCount += 1;
        this.emit({
            ...this.snapshot,
            state: 'paused',
        });
    }

    async seek(seconds: number) {
        this.seekValues.push(seconds);
        this.emit({
            ...this.snapshot,
            currentTimeSeconds: seconds,
        });
    }

    setVolume(volume: number) {
        this.emit({
            ...this.snapshot,
            volume,
        });
    }

    getSnapshot() {
        return {
            ...this.snapshot,
            error: this.snapshot.error
                ? { ...this.snapshot.error }
                : undefined,
        };
    }

    getTimeDomainFloatData() {
        return new Float32Array(1024);
    }

    getDecodedAudioDescriptor() {
        return null;
    }

    capturePlaybackCheckpoint() { return null; }
    async restorePlaybackCheckpoint(): Promise<void> {}
    acquireRecordingTap(): never { throw new Error('not implemented'); }
    copyDecodedChannelRange() {
        return null;
    }

    subscribe(listener: (snapshot: PlaybackSnapshot) => void) {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }

    unload() {
        this.unloadCount += 1;
        this.emit({
            trackId: null,
            state: 'empty',
            currentTimeSeconds: 0,
            durationSeconds: 0,
            volume: this.snapshot.volume,
        });
    }

    async dispose() {
        this.disposeCount += 1;
        this.unload();
    }

    finish() {
        this.emit({
            ...this.snapshot,
            state: 'ended',
            currentTimeSeconds: this.snapshot.durationSeconds,
        });
    }

    private emit(snapshot: PlaybackSnapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners) {
            listener(this.getSnapshot());
        }
    }
}

interface ControlledFile extends File {
    resolveRead: () => void;
}

function createFile(
    name: string,
    options: { controlled?: boolean } = {},
): File | ControlledFile {
    if (!options.controlled) {
        return new File([new Uint8Array([1, 2, 3])], name, {
            type: 'audio/wav',
            lastModified: 100,
        });
    }

    let resolveRead!: () => void;
    const read = new Promise<ArrayBuffer>((resolve) => {
        resolveRead = () => resolve(new Uint8Array([1, 2, 3]).buffer);
    });
    return {
        name,
        type: 'audio/wav',
        size: 3,
        lastModified: 100,
        arrayBuffer: () => read,
        resolveRead,
    } as unknown as ControlledFile;
}

const inputs = (...files: File[]) => files.map((file) => ({ file }));

function createHarness(
    options: {
        parseMetadata?: () => Promise<{
            common: {
                title?: string;
                artist?: string;
                picture?: Array<{ data: Uint8Array; format: string }>;
            };
            format: { duration?: number; sampleRate?: number };
        }>;
        repository?: SessionRepositoryPort;
    } = {},
) {
    const store = useAudioSessionStore();
    const engine = new FakeEngine();
    let id = 0;
    let nextFrame = 0;
    const frames = new Map<number, FrameRequestCallback>();
    const revoked: string[] = [];
    const repository: SessionRepositoryPort = options.repository ?? {
        restore: async () => null,
        saveQueue: async () => undefined,
        replaceCurrent: async () => undefined,
        replaceCurrentAnalysisCache: async () => 'stored',
        removeTrack: async () => undefined,
        clear: async () => undefined,
    };
    const service = new AudioSessionService(store, {
        engine,
        repository,
        parseMetadata:
            options.parseMetadata
            ?? (async () => ({
                common: { title: 'Fixture', artist: 'CC0' },
                format: { duration: 4, sampleRate: 48_000 },
            })),
        createTrackId: () => `track-${++id}`,
        hashFile: async (file) => (file as File).name,
        createObjectURL: () => `blob:artwork-${id}`,
        revokeObjectURL: (url) => revoked.push(url),
        requestFrame: (callback) => {
            const handle = ++nextFrame;
            frames.set(handle, callback);
            return handle;
        },
        cancelFrame: (handle) => {
            frames.delete(handle);
        },
    });
    return {
        store,
        engine,
        frames,
        revoked,
        service,
    };
}

beforeEach(() => {
    setActivePinia(createPinia());
});

describe('AudioSessionService', () => {
    test('autoplays the first empty-queue import and appends later files without interruption', async () => {
        const { engine, service, store } = createHarness();

        await service.importFiles(inputs(createFile('first.wav')));
        expect(store.queue).toHaveLength(1);
        expect(store.currentTrackId).toBe('track-1');
        expect(engine.loadIds).toEqual(['track-1']);
        expect(engine.playCount).toBe(1);

        await service.importFiles(inputs(createFile('second.wav')));
        expect(store.queue).toHaveLength(2);
        expect(store.currentTrackId).toBe('track-1');
        expect(engine.loadIds).toEqual(['track-1']);
        expect(engine.playCount).toBe(1);
    });

    test('lets only the latest rapid track selection reach decode and play', async () => {
        const { engine, service, store } = createHarness();
        await service.importFiles(inputs(
            createFile('seed.wav'),
        ));

        const first = createFile(
            'first-controlled.wav',
            { controlled: true },
        ) as ControlledFile;
        const second = createFile(
            'second-controlled.wav',
            { controlled: true },
        ) as ControlledFile;
        await service.importFiles(inputs(first, second));
        engine.loadIds.length = 0;
        engine.playCount = 0;

        const firstCommand = service.playTrack(store.queue[1]?.id ?? '');
        const secondCommand = service.playTrack(store.queue[2]?.id ?? '');
        second.resolveRead();
        await secondCommand;
        first.resolveRead();
        await firstCommand;

        expect(engine.loadIds).toEqual(['track-3']);
        expect(store.currentTrackId).toBe('track-3');
        expect(engine.playCount).toBe(1);
    });

    test('publishes saving until the selected current track is durable', async () => {
        let blockCurrentWrite = false;
        let releaseCurrentWrite: () => void = () => {
            throw new Error('Current-track write was not blocked.');
        };
        const repository: SessionRepositoryPort = {
            restore: async () => null,
            saveQueue: async () => undefined,
            replaceCurrent: async () => {
                if (!blockCurrentWrite) return;
                await new Promise<void>((resolve) => {
                    releaseCurrentWrite = resolve;
                });
            },
            replaceCurrentAnalysisCache: async () => 'stored',
            removeTrack: async () => undefined,
            clear: async () => undefined,
        };
        const { service, store } = createHarness({ repository });
        await service.importFiles(inputs(
            createFile('first.wav'),
            createFile('second.wav'),
        ));

        blockCurrentWrite = true;
        const switchCommand = service.next();
        await vi.waitFor(() => {
            expect(store.currentTrackId).toBe('track-2');
            expect(store.playback.state).toBe('playing');
            expect(store.persistence.state).toBe('saving');
        });
        releaseCurrentWrite();
        await switchCommand;
        expect(store.persistence.state).toBe('ready');
    });

    test('loops on ended and preserves deletion semantics', async () => {
        const { engine, service, store } = createHarness();
        await service.importFiles(inputs(
            createFile('first.wav'),
            createFile('second.wav'),
            createFile('third.wav'),
        ));

        engine.finish();
        await vi.waitFor(() => {
            expect(store.currentTrackId).toBe('track-2');
        });

        await service.deleteTrack('track-3');
        expect(store.currentTrackId).toBe('track-2');
        const loadsBeforeCurrentDelete = engine.loadIds.length;

        await service.deleteTrack('track-2');
        expect(store.currentTrackId).toBe('track-1');
        expect(engine.loadIds).toHaveLength(loadsBeforeCurrentDelete + 1);

        await service.deleteTrack('track-1');
        expect(store.queue).toHaveLength(0);
        expect(store.playback.state).toBe('empty');
        expect(store.currentEnergy).toBe(0);
    });

    test('uses metadata fallback and revokes every cover URL on clear and dispose', async () => {
        const parseMetadata = vi
            .fn()
            .mockRejectedValueOnce(new Error('missing tags'))
            .mockResolvedValueOnce({
                common: {
                    picture: [{
                        data: new Uint8Array([1, 2]),
                        format: 'image/png',
                    }],
                },
                format: { duration: 4 },
            });
        const {
            revoked,
            service,
            store,
        } = createHarness({ parseMetadata });

        await service.importFiles(inputs(createFile('fallback.wav')));
        expect(store.queue[0]?.metadata.title).toBe('fallback.wav');
        expect(service.getArtworkUrl('track-1')).toBeUndefined();

        await service.importFiles(inputs(createFile('artwork.wav')));
        expect(service.getArtworkUrl('track-2')).toBe('blob:artwork-2');
        await service.clear();
        expect(revoked).toEqual(['blob:artwork-2']);

        await service.dispose();
        expect(revoked).toEqual(['blob:artwork-2']);
    });

    test('keeps Pinia state serializable and owns only one animation frame', async () => {
        const {
            engine,
            frames,
            service,
            store,
        } = createHarness();
        await service.importFiles(inputs(createFile('first.wav')));

        expect(frames.size).toBe(1);
        await service.togglePlayback();
        expect(engine.pauseCount).toBe(1);
        expect(frames.size).toBe(0);
        await service.togglePlayback();
        expect(frames.size).toBe(1);

        service.setVolume(35);
        expect(store.playback.volume).toBe(0.35);
        const serialized = JSON.stringify(store.$state);
        expect(serialized).toContain('first.wav');
        expect(serialized).not.toContain('ArrayBuffer');
        expect(serialized).not.toContain('AudioBuffer');
        expect(serialized).not.toContain('blob:');

        await service.dispose();
        expect(frames.size).toBe(0);
        expect(engine.disposeCount).toBe(1);
    });
});
