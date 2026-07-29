import 'fake-indexeddb/auto';
import {
    afterEach,
    describe,
    expect,
    test,
} from 'vitest';
import {
    InvalidPersistedSessionError,
    SessionRepository,
    UnsupportedSessionSchemaError,
    validatePersistedSessionV1,
} from '../../src/persistence/sessionRepository';
import { sha256Blob } from '../../src/audio/audioSessionService';
import type {
    PersistedSessionV1,
    StoredHandle,
} from '../../src/types/session';
import { DEFAULT_PERSISTED_ANALYSIS_CONFIG } from '../../src/types/session';

const databaseNames: string[] = [];

const databaseName = () => {
    const name = `audionotsurfyet-m5-${crypto.randomUUID()}`;
    databaseNames.push(name);
    return name;
};

const track = (id: string) => ({
    id,
    name: `${id}.wav`,
    mimeType: 'audio/wav',
    byteSize: 4,
    lastModified: 100,
    metadata: {
        title: id,
    },
    trackHash: `hash-${id}`,
    handleKey: `handle:${id}`,
    restoreState: 'available' as const,
});

const session = (
    currentTrackId: string,
    ids = ['track-1', 'track-2'],
): PersistedSessionV1 => ({
    schemaVersion: 1,
    savedAt: '2026-07-29T00:00:00.000Z',
    queue: ids.map(track),
    currentTrackId,
    activeCards: [],
    analysisConfig: {
        ...DEFAULT_PERSISTED_ANALYSIS_CONFIG,
    },
    viewport: null,
    handles: ids.map((trackId) => ({
        trackId,
        handleKey: `handle:${trackId}`,
    })),
    currentBlob: {
        trackId: currentTrackId,
        blobKey: 'current',
        trackHash: `hash-${currentTrackId}`,
    },
});

const storedHandles = (ids: string[]): StoredHandle[] =>
    ids.map((trackId) => ({
        trackId,
        handleKey: `handle:${trackId}`,
        handle: {
            kind: 'file',
            name: `${trackId}.wav`,
        } as FileSystemFileHandle,
    }));

afterEach(async () => {
    await Promise.all(databaseNames.splice(0).map((name) =>
        new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        })));
});

describe('PersistedSessionV1 validation', () => {
    test('accepts V1 and rejects unknown or malformed records', () => {
        expect(validatePersistedSessionV1(session('track-1')).schemaVersion)
            .toBe(1);
        expect(() => validatePersistedSessionV1({
            ...session('track-1'),
            schemaVersion: 2,
        })).toThrow(UnsupportedSessionSchemaError);
        expect(() => validatePersistedSessionV1({
            ...session('track-1'),
            queue: [{ id: 'broken' }],
        })).toThrow(InvalidPersistedSessionError);
    });

    test('computes deterministic SHA-256 content identity', async () => {
        const blob = new Blob(['m5-fixture']);
        expect(await sha256Blob(blob)).toBe(
            '14a5a5475c293d9092c1d7caf7c1c7038f687fb79ac92ba64a22bddc64e38034',
        );
        expect(await sha256Blob(blob)).toBe(await sha256Blob(blob));
    });
});

describe('SessionRepository', () => {
    test('restores V1 handles and atomically keeps only current Blob/cache', async () => {
        const repository = new SessionRepository(
            indexedDB,
            databaseName(),
        );
        const firstSession = session('track-1');
        const handles = storedHandles(['track-1', 'track-2']);
        await repository.replaceCurrent({
            session: {
                ...firstSession,
                currentAnalysisCache: {
                    trackId: 'track-1',
                    trackHash: 'hash-track-1',
                    configHash: 'config-1',
                    featureIds: ['rms'],
                    cacheKeys: ['hash-track-1:config-1:rms'],
                },
            },
            handles,
            currentBlob: {
                trackId: 'track-1',
                blobKey: 'current',
                trackHash: 'hash-track-1',
                blob: new Blob(['first']),
            },
            currentAnalysisCache: {
                manifest: {
                    trackId: 'track-1',
                    trackHash: 'hash-track-1',
                    configHash: 'config-1',
                    featureIds: ['rms'],
                    cacheKeys: ['hash-track-1:config-1:rms'],
                },
                payloads: [{
                    cacheKey: 'hash-track-1:config-1:rms',
                    payload: new Uint8Array([1, 2]).buffer,
                }],
            },
        });

        const secondSession = session('track-2');
        await repository.replaceCurrent({
            session: secondSession,
            handles,
            currentBlob: {
                trackId: 'track-2',
                blobKey: 'current',
                trackHash: 'hash-track-2',
                blob: new Blob(['second']),
            },
        });

        const restored = await repository.restore();
        expect(restored?.session.currentTrackId).toBe('track-2');
        expect(restored?.handles.map(({ trackId }) => trackId).sort())
            .toEqual(['track-1', 'track-2']);
        expect(await restored?.currentBlob?.blob.text()).toBe('second');
        expect(restored?.currentAnalysisCache).toBeUndefined();
    });

    test('preserves the previous current record when replacement aborts', async () => {
        const name = databaseName();
        const stable = new SessionRepository(indexedDB, name);
        await stable.replaceCurrent({
            session: session('track-1'),
            handles: storedHandles(['track-1', 'track-2']),
            currentBlob: {
                trackId: 'track-1',
                blobKey: 'current',
                trackHash: 'hash-track-1',
                blob: new Blob(['stable']),
            },
        });

        const failing = new SessionRepository(
            indexedDB,
            name,
            (operation) => {
                if (operation === 'replaceCurrent') {
                    throw new DOMException(
                        'quota',
                        'QuotaExceededError',
                    );
                }
            },
        );
        await expect(failing.replaceCurrent({
            session: session('track-2'),
            handles: storedHandles(['track-1', 'track-2']),
            currentBlob: {
                trackId: 'track-2',
                blobKey: 'current',
                trackHash: 'hash-track-2',
                blob: new Blob(['partial']),
            },
        })).rejects.toThrow();

        const restored = await stable.restore();
        expect(restored?.session.currentTrackId).toBe('track-1');
        expect(await restored?.currentBlob?.blob.text()).toBe('stable');
    });

    test('removes handles and clears every store', async () => {
        const repository = new SessionRepository(
            indexedDB,
            databaseName(),
        );
        await repository.replaceCurrent({
            session: session('track-1'),
            handles: storedHandles(['track-1', 'track-2']),
            currentBlob: {
                trackId: 'track-1',
                blobKey: 'current',
                trackHash: 'hash-track-1',
                blob: new Blob(['first']),
            },
        });
        await repository.removeTrack('track-2');
        const afterRemove = await repository.restore();
        expect(afterRemove?.handles).toHaveLength(1);
        expect(afterRemove?.session.queue.map(({ id }) => id))
            .toEqual(['track-1']);

        await repository.clear();
        expect(await repository.restore()).toBeNull();
    });
});
