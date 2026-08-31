import {
    createPinia,
    setActivePinia,
} from 'pinia';
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

class WorkspaceEngine implements AudioEnginePort {
    private readonly snapshot: PlaybackSnapshot = {
        trackId: null,
        state: 'empty',
        currentTimeSeconds: 0,
        durationSeconds: 0,
        volume: 1,
    };

    async load() {
        return 'loaded' as const;
    }
    async play() {}
    pause() {}
    async seek() {}
    setVolume() {}
    getSnapshot() {
        return { ...this.snapshot };
    }
    getTimeDomainFloatData() {
        return null;
    }
    getDecodedAudioDescriptor() {
        return null;
    }
    copyDecodedChannelRange() {
        return null;
    }
    subscribe(listener: (snapshot: PlaybackSnapshot) => void) {
        listener(this.getSnapshot());
        return () => undefined;
    }
    unload() {}
    async dispose() {}
}

class WorkspaceRepository implements SessionRepositoryPort {
    restored: RestoredSessionBundle | null = null;
    saveError: Error | null = null;
    saves: PersistedQueueInput[] = [];

    async restore() {
        return this.restored;
    }
    async saveQueue(input: PersistedQueueInput) {
        if (this.saveError) throw this.saveError;
        this.saves.push(structuredClone(input));
    }
    async replaceCurrent(_input: PersistedCurrentInput) {}
    async replaceCurrentAnalysisCache() {
        return 'stored' as const;
    }
    async removeTrack() {}
    async clear() {}
}

class DeferredWorkspaceRepository extends WorkspaceRepository {
    pending: Array<{
        input: PersistedQueueInput;
        resolve: () => void;
        reject: (error: Error) => void;
    }> = [];

    override async saveQueue(input: PersistedQueueInput) {
        await new Promise<void>((resolve, reject) => {
            this.pending.push({
                input: structuredClone(input),
                resolve,
                reject,
            });
        });
        this.saves.push(structuredClone(input));
    }
}

const createHarness = (repository = new WorkspaceRepository()) => {
    const store = useAudioSessionStore();
    const service = new AudioSessionService(store, {
        engine: new WorkspaceEngine(),
        repository,
        requestFrame: () => 1,
        cancelFrame: () => undefined,
    });
    return { repository, service, store };
};

beforeEach(() => {
    setActivePinia(createPinia());
});

describe('M7 analysis workspace integration', () => {
    test('updates memory before persistence and stores FIFO cards/viewport', async () => {
        const harness = createHarness();
        const promise = harness.service.updateAnalysisWorkspace({
            activeFeatureQueue: [
                'rms', 'amplitudeSpectrum', 'chroma', 'spectralFlux',
            ],
            viewport: {
                startSeconds: 2,
                endSeconds: 6,
                zoom: 4,
            },
        });

        expect(harness.store.analysisWorkspace).toMatchObject({
            initialized: true,
            activeFeatureQueue: [
                'rms', 'amplitudeSpectrum', 'chroma', 'spectralFlux',
            ],
            viewport: {
                startSeconds: 2,
                endSeconds: 6,
                zoom: 4,
            },
        });
        await promise;
        expect(harness.repository.saves[0]?.session.activeCards)
            .toHaveLength(4);
        expect(harness.repository.saves[0]?.session.viewport).toEqual({
            startSeconds: 2,
            endSeconds: 6,
            zoom: 4,
        });
    });

    test('keeps current workspace usable when persistence fails', async () => {
        const repository = new WorkspaceRepository();
        repository.saveError = new DOMException(
            'quota',
            'QuotaExceededError',
        );
        const harness = createHarness(repository);

        await harness.service.updateAnalysisWorkspace({
            activeFeatureQueue: ['chroma'],
            viewport: null,
        });

        expect(harness.store.analysisWorkspace.activeFeatureQueue)
            .toEqual(['chroma']);
        expect(harness.store.persistence).toMatchObject({
            state: 'not-persisted',
        });
    });

    test('restores an explicitly saved empty workspace as initialized', async () => {
        const repository = new WorkspaceRepository();
        repository.restored = {
            session: {
                schemaVersion: 1,
                savedAt: '2026-07-30T00:00:00.000Z',
                queue: [],
                currentTrackId: null,
                activeCards: [],
                analysisConfig: {
                    ...DEFAULT_PERSISTED_ANALYSIS_CONFIG,
                },
                viewport: null,
                handles: [],
            },
            handles: [],
        };
        const harness = createHarness(repository);

        await harness.service.initialize();

        expect(harness.store.analysisWorkspace).toEqual({
            initialized: true,
            activeFeatureQueue: [],
            viewport: null,
        });
    });

    test('persists four unique cumulative M10 cards without a schema bump', async () => {
        const repository = new WorkspaceRepository();
        const harness = createHarness(repository);
        const activeFeatureQueue = [
            'loudness', 'complexSpectrum', 'buffer', 'spectralFlux',
        ] as const;

        await harness.service.updateAnalysisWorkspace({
            activeFeatureQueue: [...activeFeatureQueue],
            viewport: { startSeconds: 1, endSeconds: 3, zoom: 2 },
        });

        expect(harness.repository.saves.at(-1)?.session).toMatchObject({
            schemaVersion: 1,
            activeCards: activeFeatureQueue.map((featureId, slot) => ({
                slot,
                featureId,
            })),
            viewport: { startSeconds: 1, endSeconds: 3, zoom: 2 },
        });
    });

    test('serializes immutable workspace saves and lets only the latest revision set status', async () => {
        const repository = new DeferredWorkspaceRepository();
        const harness = createHarness(repository);
        const first = harness.service.updateAnalysisWorkspace({
            activeFeatureQueue: ['rms'],
            viewport: null,
        });
        const second = harness.service.updateAnalysisWorkspace({
            activeFeatureQueue: ['chroma', 'buffer'],
            viewport: null,
        });

        await vi.waitFor(() => {
            expect(repository.pending).toHaveLength(1);
        });
        expect(repository.pending[0]?.input.session.activeCards).toEqual([
            { slot: 0, featureId: 'rms' },
        ]);
        expect(harness.store.analysisWorkspace.activeFeatureQueue)
            .toEqual(['chroma', 'buffer']);
        repository.pending[0]?.reject(new Error('old save failed'));
        await vi.waitFor(() => {
            expect(repository.pending).toHaveLength(2);
        });
        expect(harness.store.persistence.state).toBe('saving');
        expect(repository.pending[1]?.input.session.activeCards).toEqual([
            { slot: 0, featureId: 'chroma' },
            { slot: 1, featureId: 'buffer' },
        ]);
        repository.pending[1]?.resolve();

        await Promise.all([first, second]);
        expect(harness.store.persistence.state).toBe('ready');
        expect(harness.store.analysisWorkspace.activeFeatureQueue)
            .toEqual(['chroma', 'buffer']);
    });
});
