import { createPinia, setActivePinia } from 'pinia';
import {
    beforeEach,
    describe,
    expect,
    test,
} from 'vitest';
import {
    AudioSessionService,
    type AudioEnginePort,
} from '../../src/audio/audioSessionService';
import type {
    PersistedCurrentInput,
    PersistedQueueInput,
    SessionRepositoryPort,
} from '../../src/persistence/sessionRepository';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type { PlaybackSnapshot } from '../../src/types/audio';
import {
    DEFAULT_PERSISTED_ANALYSIS_CONFIG,
    type RestoredSessionBundle,
} from '../../src/types/session';

class RecoveryEngine implements AudioEnginePort {
    snapshot: PlaybackSnapshot = {
        trackId: null,
        state: 'empty',
        currentTimeSeconds: 0,
        durationSeconds: 0,
        volume: 1,
    };
    listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
    playCount = 0;

    async load(input: { trackId: string }): Promise<'loaded'> {
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
        this.emit({ ...this.snapshot, state: 'playing' });
    }

    pause() {
        this.emit({ ...this.snapshot, state: 'paused' });
    }

    async seek(seconds: number) {
        this.emit({ ...this.snapshot, currentTimeSeconds: seconds });
    }

    setVolume(volume: number) {
        this.emit({ ...this.snapshot, volume });
    }

    getSnapshot() {
        return { ...this.snapshot };
    }

    getTimeDomainFloatData() {
        return null;
    }

    subscribe(listener: (snapshot: PlaybackSnapshot) => void) {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }

    unload() {
        this.emit({
            trackId: null,
            state: 'empty',
            currentTimeSeconds: 0,
            durationSeconds: 0,
            volume: this.snapshot.volume,
        });
    }

    async dispose() {
        this.unload();
    }

    private emit(snapshot: PlaybackSnapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners) listener(this.getSnapshot());
    }
}

class MemoryRepository implements SessionRepositoryPort {
    restored: RestoredSessionBundle | null = null;
    replaceError: Error | null = null;
    saveInputs: PersistedQueueInput[] = [];
    replaceInputs: PersistedCurrentInput[] = [];

    async restore() {
        return this.restored;
    }

    async saveQueue(input: PersistedQueueInput) {
        this.saveInputs.push(input);
    }

    async replaceCurrent(input: PersistedCurrentInput) {
        if (this.replaceError) throw this.replaceError;
        this.replaceInputs.push(input);
    }

    async removeTrack() {}

    async clear() {}
}

interface FakeHandleOptions {
    query?: PermissionState;
    request?: PermissionState;
    getFileError?: DOMException;
}

const fakeHandle = (
    file: File,
    log: string[],
    options: FakeHandleOptions = {},
): FileSystemFileHandle => ({
    kind: 'file',
    name: file.name,
    queryPermission: async () => {
        log.push(`query:${file.name}`);
        return options.query ?? 'granted';
    },
    requestPermission: async () => {
        log.push(`request:${file.name}`);
        return options.request ?? 'granted';
    },
    getFile: async () => {
        log.push(`file:${file.name}`);
        if (options.getFileError) throw options.getFileError;
        return file;
    },
    isSameEntry: async () => false,
} as unknown as FileSystemFileHandle);

const record = (id: string) => ({
    id,
    name: `${id}.wav`,
    mimeType: 'audio/wav',
    byteSize: 4,
    lastModified: 100,
    durationSeconds: 4,
    metadata: { title: id },
    trackHash: `${id}.wav`,
    handleKey: `handle:${id}`,
    restoreState: 'available' as const,
});

const restoredBundle = (
    handles: Array<{
        trackId: string;
        handle: FileSystemFileHandle;
    }>,
): RestoredSessionBundle => ({
    session: {
        schemaVersion: 1,
        savedAt: '2026-07-29T00:00:00.000Z',
        queue: ['track-1', 'track-2', 'track-3'].map(record),
        currentTrackId: 'track-2',
        activeCards: [],
        analysisConfig: { ...DEFAULT_PERSISTED_ANALYSIS_CONFIG },
        viewport: null,
        handles: handles.map(({ trackId }) => ({
            trackId,
            handleKey: `handle:${trackId}`,
        })),
        currentBlob: {
            trackId: 'track-2',
            blobKey: 'current',
            trackHash: 'track-2.wav',
        },
    },
    handles: handles.map(({ trackId, handle }) => ({
        trackId,
        handleKey: `handle:${trackId}`,
        handle,
    })),
    currentBlob: {
        trackId: 'track-2',
        blobKey: 'current',
        trackHash: 'track-2.wav',
        blob: new File(['two'], 'track-2.wav', {
            type: 'audio/wav',
            lastModified: 100,
        }),
    },
});

const createService = (
    repository: MemoryRepository,
    options: {
        pickFiles?: () => Promise<FileSystemFileHandle[]>;
    } = {},
) => {
    const store = useAudioSessionStore();
    const engine = new RecoveryEngine();
    const service = new AudioSessionService(store, {
        engine,
        repository,
        pickFiles: options.pickFiles,
        hashFile: async (file) => (file as File).name,
        parseMetadata: async () => ({
            common: {},
            format: { duration: 4, sampleRate: 48_000 },
        }),
        requestFrame: () => 1,
        cancelFrame: () => undefined,
    });
    return { engine, service, store };
};

beforeEach(() => {
    setActivePinia(createPinia());
});

describe('AudioSessionService recovery', () => {
    test('restores current Blob paused at zero and queries neighbours in order without requesting', async () => {
        const log: string[] = [];
        const repository = new MemoryRepository();
        repository.restored = restoredBundle([
            {
                trackId: 'track-1',
                handle: fakeHandle(
                    new File(['one'], 'track-1.wav'),
                    log,
                    { query: 'prompt' },
                ),
            },
            {
                trackId: 'track-2',
                handle: fakeHandle(
                    new File(['two'], 'track-2.wav'),
                    log,
                ),
            },
            {
                trackId: 'track-3',
                handle: fakeHandle(
                    new File(['three'], 'track-3.wav'),
                    log,
                    { query: 'denied' },
                ),
            },
        ]);
        const { engine, service, store } = createService(repository);

        await service.initialize();

        expect(store.currentTrackId).toBe('track-2');
        expect(store.playback.state).toBe('paused');
        expect(store.playback.currentTimeSeconds).toBe(0);
        expect(engine.playCount).toBe(0);
        expect(log.filter((entry) => entry.startsWith('query:'))).toEqual([
            'query:track-3.wav',
            'query:track-1.wav',
        ]);
        expect(log.some((entry) => entry.startsWith('request:'))).toBe(false);
        expect(store.queue[0]?.restoreState).toBe('permission-required');
        expect(store.queue[2]?.restoreState).toBe('permission-denied');
    });

    test('requests permission only after restoreAccess and restores the file', async () => {
        const log: string[] = [];
        const repository = new MemoryRepository();
        const handle = fakeHandle(
            new File(['one'], 'track-1.wav'),
            log,
            { query: 'prompt', request: 'granted' },
        );
        repository.restored = restoredBundle([
            { trackId: 'track-1', handle },
            {
                trackId: 'track-2',
                handle: fakeHandle(
                    new File(['two'], 'track-2.wav'),
                    log,
                ),
            },
            {
                trackId: 'track-3',
                handle: fakeHandle(
                    new File(['three'], 'track-3.wav'),
                    log,
                ),
            },
        ]);
        const { service, store } = createService(repository);
        await service.initialize();
        expect(store.queue[0]?.restoreState).toBe('permission-required');

        await service.restoreAccess('track-1');

        expect(log).toContain('request:track-1.wav');
        expect(store.queue[0]?.restoreState).toBe('available');
    });

    test('marks changed and missing files without affecting current Blob', async () => {
        const log: string[] = [];
        const repository = new MemoryRepository();
        const changed = fakeHandle(
            new File(['changed'], 'different.wav'),
            log,
        );
        const missing = fakeHandle(
            new File(['missing'], 'track-3.wav'),
            log,
            {
                getFileError: new DOMException(
                    'missing',
                    'NotFoundError',
                ),
            },
        );
        repository.restored = restoredBundle([
            { trackId: 'track-1', handle: changed },
            {
                trackId: 'track-2',
                handle: fakeHandle(
                    new File(['two'], 'track-2.wav'),
                    log,
                ),
            },
            { trackId: 'track-3', handle: missing },
        ]);
        const { service, store } = createService(repository);

        await service.initialize();

        expect(store.queue[0]?.restoreState).toBe('content-changed');
        expect(store.queue[2]?.restoreState).toBe('file-missing');
        expect(store.currentTrackId).toBe('track-2');
        expect(store.playback.state).toBe('paused');
    });

    test('rejects a current Blob whose content hash no longer matches', async () => {
        const repository = new MemoryRepository();
        const restored = restoredBundle([]);
        restored.currentBlob = {
            trackId: 'track-2',
            blobKey: 'current',
            trackHash: 'track-2.wav',
            blob: new File(['tampered'], 'changed.wav', {
                type: 'audio/wav',
                lastModified: 100,
            }),
        };
        repository.restored = restored;
        const { service, store } = createService(repository);

        await service.initialize();

        expect(store.queue[1]?.restoreState).toBe('content-changed');
        expect(store.playback.state).toBe('empty');
        expect(store.playback.currentTimeSeconds).toBe(0);
    });

    test('keeps playback usable when current Blob persistence fails', async () => {
        const repository = new MemoryRepository();
        repository.replaceError = new DOMException(
            'quota',
            'QuotaExceededError',
        );
        const file = new File(['audio'], 'fixture.wav', {
            type: 'audio/wav',
        });
        const handle = fakeHandle(file, []);
        const { engine, service, store } = createService(repository);

        await service.importFiles([{ file, handle }]);

        expect(engine.playCount).toBe(1);
        expect(store.playback.state).toBe('playing');
        expect(store.persistence.state).toBe('not-persisted');
        expect(store.queue[0]?.restoreState).toBe('not-persisted');
    });

    test('treats picker cancellation as a non-error result', async () => {
        const repository = new MemoryRepository();
        const { service, store } = createService(repository, {
            pickFiles: async () => {
                throw new DOMException('cancelled', 'AbortError');
            },
        });

        await expect(service.selectAndImportFiles()).resolves.toBe(
            'cancelled',
        );
        expect(store.queue).toHaveLength(0);
        expect(store.persistence.state).toBe('idle');
    });
});
