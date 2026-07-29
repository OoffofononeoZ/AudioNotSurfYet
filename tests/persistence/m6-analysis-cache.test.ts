import 'fake-indexeddb/auto';
import {
    afterEach,
    describe,
    expect,
    test,
} from 'vitest';
import { encodeAnalysisSeries } from '../../src/analysis/compactCodec';
import {
    createAnalysisCacheKey,
    createAnalysisConfig,
} from '../../src/analysis/config';
import type { AnalysisSeries } from '../../src/analysis/types';
import { SessionRepository } from '../../src/persistence/sessionRepository';
import {
    DEFAULT_PERSISTED_ANALYSIS_CONFIG,
    type PersistedSessionV1,
} from '../../src/types/session';

const databaseNames: string[] = [];

const databaseName = () => {
    const name = `audionotsurfyet-m6-${crypto.randomUUID()}`;
    databaseNames.push(name);
    return name;
};

const session = (): PersistedSessionV1 => ({
    schemaVersion: 1,
    savedAt: '2026-07-29T00:00:00.000Z',
    queue: [{
        id: 'track-1',
        name: 'fixture.wav',
        mimeType: 'audio/wav',
        byteSize: 4,
        lastModified: 1,
        metadata: { title: 'fixture' },
        trackHash: 'track-hash',
        restoreState: 'available',
    }],
    currentTrackId: 'track-1',
    activeCards: [],
    analysisConfig: { ...DEFAULT_PERSISTED_ANALYSIS_CONFIG },
    viewport: null,
    handles: [],
    currentBlob: {
        trackId: 'track-1',
        blobKey: 'current',
        trackHash: 'track-hash',
    },
});

const scalarSeries = (
    featureId: 'rms' | 'energy',
    configHash: string,
    value: number,
): AnalysisSeries => ({
    schemaVersion: 1,
    trackHash: 'track-hash',
    configHash,
    featureId,
    startTimeSeconds: 0,
    sampleStepSeconds: 1 / 30,
    sampleCount: 1,
    dimensions: [],
    payload: {
        kind: 'scalar-f32',
        values: new Float32Array([value]),
    },
});

afterEach(async () => {
    await Promise.all(databaseNames.splice(0).map((name) =>
        new Promise<void>((resolve, reject) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        })));
});

describe('M6 current analysis cache transaction', () => {
    test('atomically updates the manifest/payload while preserving current Blob', async () => {
        const repository = new SessionRepository(
            indexedDB,
            databaseName(),
        );
        await repository.replaceCurrent({
            session: session(),
            handles: [],
            currentBlob: {
                trackId: 'track-1',
                blobKey: 'current',
                trackHash: 'track-hash',
                blob: new Blob(['keep-current-blob']),
            },
        });
        const config = await createAnalysisConfig(48_000);
        const rms = scalarSeries('rms', config.configHash, 0.25);
        const cacheKey = createAnalysisCacheKey(
            'track-hash',
            config.configHash,
            'rms',
        );
        await expect(repository.replaceCurrentAnalysisCache({
            trackId: 'track-1',
            trackHash: 'track-hash',
            configHash: config.configHash,
            payloads: [{
                featureId: 'rms',
                cacheKey,
                payload: encodeAnalysisSeries(rms),
            }],
        })).resolves.toBe('stored');

        const restored = await repository.restore();
        expect(await restored?.currentBlob?.blob.text())
            .toBe('keep-current-blob');
        expect(restored?.session.currentAnalysisCache).toEqual({
            trackId: 'track-1',
            trackHash: 'track-hash',
            configHash: config.configHash,
            featureIds: ['rms'],
            cacheKeys: [cacheKey],
        });
        expect(restored?.currentAnalysisCache?.payloads)
            .toHaveLength(1);
    });

    test('returns stale without overwriting another track identity', async () => {
        const repository = new SessionRepository(
            indexedDB,
            databaseName(),
        );
        await repository.replaceCurrent({
            session: session(),
            handles: [],
            currentBlob: {
                trackId: 'track-1',
                blobKey: 'current',
                trackHash: 'track-hash',
                blob: new Blob(['stable']),
            },
        });
        const config = await createAnalysisConfig(48_000);
        await expect(repository.replaceCurrentAnalysisCache({
            trackId: 'track-2',
            trackHash: 'other-hash',
            configHash: config.configHash,
            payloads: [],
        })).resolves.toBe('stale');
        const restored = await repository.restore();
        expect(restored?.session.currentTrackId).toBe('track-1');
        expect(await restored?.currentBlob?.blob.text()).toBe('stable');
    });

    test('keeps the old cache when quota/abort interrupts replacement', async () => {
        const name = databaseName();
        const stable = new SessionRepository(indexedDB, name);
        await stable.replaceCurrent({
            session: session(),
            handles: [],
            currentBlob: {
                trackId: 'track-1',
                blobKey: 'current',
                trackHash: 'track-hash',
                blob: new Blob(['stable']),
            },
        });
        const config = await createAnalysisConfig(48_000);
        const rmsKey = createAnalysisCacheKey(
            'track-hash',
            config.configHash,
            'rms',
        );
        await stable.replaceCurrentAnalysisCache({
            trackId: 'track-1',
            trackHash: 'track-hash',
            configHash: config.configHash,
            payloads: [{
                featureId: 'rms',
                cacheKey: rmsKey,
                payload: encodeAnalysisSeries(
                    scalarSeries('rms', config.configHash, 1),
                ),
            }],
        });

        const failing = new SessionRepository(
            indexedDB,
            name,
            (operation) => {
                if (operation === 'replaceCurrentAnalysisCache') {
                    throw new DOMException(
                        'quota',
                        'QuotaExceededError',
                    );
                }
            },
        );
        const energyKey = createAnalysisCacheKey(
            'track-hash',
            config.configHash,
            'energy',
        );
        await expect(failing.replaceCurrentAnalysisCache({
            trackId: 'track-1',
            trackHash: 'track-hash',
            configHash: config.configHash,
            payloads: [{
                featureId: 'energy',
                cacheKey: energyKey,
                payload: encodeAnalysisSeries(
                    scalarSeries('energy', config.configHash, 2),
                ),
            }],
        })).rejects.toThrow();

        const restored = await stable.restore();
        expect(restored?.session.currentAnalysisCache?.featureIds)
            .toEqual(['rms']);
        expect(restored?.currentAnalysisCache?.payloads[0]?.cacheKey)
            .toBe(rmsKey);
    });
});
