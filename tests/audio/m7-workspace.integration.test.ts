import {
    createPinia,
    setActivePinia,
} from 'pinia';
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
    test('updates memory before persistence and stores cards/viewport', async () => {
        const harness = createHarness();
        const promise = harness.service.updateAnalysisWorkspace({
            activeCards: [
                { slot: 0, featureId: 'rms' },
                { slot: 1, featureId: 'amplitudeSpectrum' },
                { slot: 2, featureId: 'chroma' },
                { slot: 3, featureId: 'spectralFlux' },
            ],
            viewport: {
                startSeconds: 2,
                endSeconds: 6,
                zoom: 4,
            },
        });

        expect(harness.store.analysisWorkspace).toMatchObject({
            initialized: true,
            activeCards: [
                { slot: 0, featureId: 'rms' },
                { slot: 1, featureId: 'amplitudeSpectrum' },
                { slot: 2, featureId: 'chroma' },
                { slot: 3, featureId: 'spectralFlux' },
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
            activeCards: [{ slot: 3, featureId: 'chroma' }],
            viewport: null,
        });

        expect(harness.store.analysisWorkspace.activeCards).toEqual([
            { slot: 3, featureId: 'chroma' },
        ]);
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
            activeCards: [],
            viewport: null,
        });
    });

    test('persists four unique cumulative M10 cards without a schema bump', async () => {
        const repository = new WorkspaceRepository();
        const harness = createHarness(repository);
        const activeCards = [
            { slot: 0 as const, featureId: 'loudness' as const },
            { slot: 1 as const, featureId: 'complexSpectrum' as const },
            { slot: 2 as const, featureId: 'buffer' as const },
            { slot: 3 as const, featureId: 'spectralFlux' as const },
        ];

        await harness.service.updateAnalysisWorkspace({
            activeCards,
            viewport: { startSeconds: 1, endSeconds: 3, zoom: 2 },
        });

        expect(harness.repository.saves.at(-1)?.session).toMatchObject({
            schemaVersion: 1,
            activeCards,
            viewport: { startSeconds: 1, endSeconds: 3, zoom: 2 },
        });
    });
});
