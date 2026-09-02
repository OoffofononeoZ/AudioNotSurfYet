import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import type {
    AnalysisConsumerLease,
    AnalysisCoordinator,
} from '../../src/analysis/analysisCoordinator';
import type {
    AnalysisCoordinatorSnapshot,
    AnalysisListener,
    AnalysisSeries,
    FeatureId,
} from '../../src/analysis/types';
import type {
    AudioSessionService,
    RoutePlaybackLease,
} from '../../src/audio/audioSessionService';
import {
    createEditorDraftEnvelope,
    type EditorDraftRepositoryPort,
} from '../../src/editor/editorDraftRepository';
import { EditorSessionController } from '../../src/editor/editorSessionController';
import type { EditorFileGateway } from '../../src/editor/fileIO';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import type {
    EditorDraftEnvelopeV1,
    EditorProjectV1,
} from '../../src/editor/types';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type { TrackRecord } from '../../src/types/audio';

const TRACK_HASH = '4'.repeat(64);
const NOW = new Date('2026-08-27T04:00:00.000Z');

const track: TrackRecord = {
    id: 'e4-track',
    name: 'editor-e4-overlay-v1.wav',
    mimeType: 'audio/wav',
    byteSize: 4096,
    lastModified: 1,
    durationSeconds: 12,
    encodedSampleRate: 48_000,
    metadata: { title: 'E4 Overlay', artist: 'Fixture' },
    trackHash: TRACK_HASH,
    restoreState: 'available',
};

const bufferSeries: AnalysisSeries = {
    schemaVersion: 1,
    trackHash: TRACK_HASH,
    configHash: 'e4-config',
    featureId: 'buffer',
    startTimeSeconds: 0,
    sampleStepSeconds: 0.5,
    sampleCount: 2,
    dimensions: [1024],
    payload: {
        kind: 'waveform-envelope',
        min: new Int16Array([0, 0]),
        max: new Int16Array([0, 0]),
        scale: 1,
    },
};

class MemoryRepository implements EditorDraftRepositoryPort {
    envelope: EditorDraftEnvelopeV1 | null = null;
    overlayVisibility: { contentHash: string; enabled: boolean } | null = null;
    async restore() { return this.envelope; }
    async replace(value: EditorDraftEnvelopeV1) { this.envelope = structuredClone(value); }
    async clear() { this.envelope = null; }
    async getLeaveWarningEnabled() { return true; }
    async setLeaveWarningEnabled() {}
    async getOverlayVisibility(contentHash: string) {
        return this.overlayVisibility?.contentHash === contentHash
            ? this.overlayVisibility.enabled
            : null;
    }
    async setOverlayVisibility(contentHash: string, enabled: boolean) {
        this.overlayVisibility = { contentHash, enabled };
    }
    close() {}
}

class AnalysisHarness {
    readonly featureSets: FeatureId[][] = [];
    readonly listeners = new Set<AnalysisListener>();
    readonly series = new Map<FeatureId, AnalysisSeries>([['buffer', bufferSeries]]);
    snapshot: AnalysisCoordinatorSnapshot = {
        state: 'idle',
        generation: 0,
        trackId: null,
        trackHash: null,
        configHash: null,
        sampleRate: null,
        activeFeatureIds: [],
        readyFeatureIds: [],
        completedFrames: 0,
        totalFrames: 0,
        progress: 0,
        cacheState: 'idle',
        staleMessageCount: 0,
    };

    readonly lease: AnalysisConsumerLease = {
        token: 'e4-lease',
        consumer: 'editor',
        setActiveFeatures: async (ids) => {
            this.featureSets.push([...ids]);
        },
        requestCursorValue: async () => null,
        requestTempoEstimate: async () => null,
        getSeries: (featureId) => this.series.get(featureId) ?? null,
        subscribe: (listener) => {
            this.listeners.add(listener);
            listener(this.snapshot);
            return () => this.listeners.delete(listener);
        },
        release: () => undefined,
    };

    emit(snapshot: Partial<AnalysisCoordinatorSnapshot>) {
        this.snapshot = { ...this.snapshot, ...snapshot };
        for (const listener of this.listeners) listener(this.snapshot);
    }
}

const project = (overlay: FeatureId | null): EditorProjectV1 => {
    let id = 0;
    const value = createInitialEditorProject({
        track: {
            contentHash: TRACK_HASH,
            fileName: track.name,
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: () => `e4-${++id}`,
        now: () => NOW,
    });
    value.tempoMap[0] = {
        id: value.tempoMap[0]!.id,
        startSeconds: 0,
        mode: 'metered',
        bpm: 100,
        bpmSource: 'user',
        meter: { numerator: 4, denominator: 4 },
    };
    value.workspace.overlay.featureId = overlay;
    return value;
};

const createHarness = (restored: EditorProjectV1) => {
    const store = useAudioSessionStore();
    store.appendTracks([track]);
    const repository = new MemoryRepository();
    repository.envelope = createEditorDraftEnvelope(restored, () => NOW);
    const analysis = new AnalysisHarness();
    const audioSession = {
        acquireRoutePlayback: async (): Promise<RoutePlaybackLease> => ({
            token: 'play',
            consumer: 'editor',
            trackId: track.id,
            endedPolicy: 'repeat-one',
            release: () => undefined,
        }),
        getDecodedTrackDescriptor: () => ({
            trackId: track.id,
            revision: 1,
            sampleRate: 48_000,
            length: 576_000,
            channelCount: 1,
            durationSeconds: 12,
        }),
    };
    const fileGateway: EditorFileGateway = {
        open: async () => null,
        save: async () => 'saved',
    };
    const controller = new EditorSessionController({
        audioSession: audioSession as unknown as AudioSessionService,
        analysisCoordinator: {
            getSnapshot: () => analysis.snapshot,
            acquireConsumer: () => analysis.lease,
        } as unknown as AnalysisCoordinator,
        store,
        repository,
        fileGateway,
        now: () => NOW,
    });
    return { controller, analysis, repository, store };
};

const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('Editor E4 overlay integration', () => {
    beforeEach(() => setActivePinia(createPinia()));

    test('activates Buffer first, then the restored single overlay feature', async () => {
        const harness = createHarness(project('chroma'));
        const analyzerWorkspace = JSON.parse(JSON.stringify(
            harness.store.analysisWorkspace,
        ));
        await harness.controller.enter(track.id);
        expect(harness.analysis.featureSets).toEqual([['buffer']]);
        harness.analysis.emit({
            state: 'ready',
            generation: 1,
            trackId: track.id,
            trackHash: TRACK_HASH,
            configHash: 'e4-config',
            sampleRate: 48_000,
            activeFeatureIds: ['buffer'],
            readyFeatureIds: ['buffer'],
            completedFrames: 1,
            totalFrames: 1,
            progress: 1,
        });
        await settle();
        expect(harness.analysis.featureSets.at(-1)).toEqual(['buffer', 'chroma']);
        expect(JSON.parse(JSON.stringify(harness.store.analysisWorkspace)))
            .toEqual(analyzerWorkspace);
        await harness.controller.dispose();
    });

    test('deduplicates Buffer, switches rapidly and preserves the last-ready waveform', async () => {
        const harness = createHarness(project(null));
        await harness.controller.enter(track.id);
        harness.analysis.emit({
            state: 'ready',
            generation: 1,
            activeFeatureIds: ['buffer'],
            readyFeatureIds: ['buffer'],
        });
        await settle();
        harness.controller.selectOverlayFeature('buffer');
        await settle();
        expect(harness.analysis.featureSets.at(-1)).toEqual(['buffer']);
        harness.controller.selectOverlayFeature('rms');
        harness.controller.selectOverlayFeature('mfcc');
        await settle();
        expect(harness.analysis.featureSets.slice(-2)).toEqual([
            ['buffer', 'rms'],
            ['buffer', 'mfcc'],
        ]);
        harness.analysis.series.delete('buffer');
        harness.analysis.emit({ state: 'error', readyFeatureIds: [] });
        expect(harness.controller.getAnalysisSeries('buffer')).toEqual(bufferSeries);
        await harness.controller.flush();
        expect(harness.repository.envelope?.project.workspace.overlay.featureId)
            .toBe('mfcc');
        await harness.controller.dispose();
    });

    test('reconciles the final selection after an in-flight job and retries an error', async () => {
        const harness = createHarness(project(null));
        await harness.controller.enter(track.id);
        harness.analysis.emit({
            state: 'ready',
            generation: 1,
            activeFeatureIds: ['buffer'],
            readyFeatureIds: ['buffer'],
        });
        await settle();
        harness.analysis.emit({
            state: 'analyzing',
            generation: 2,
            activeFeatureIds: ['buffer', 'rms'],
            readyFeatureIds: ['buffer'],
        });
        harness.controller.selectOverlayFeature('mfcc');
        await settle();
        expect(harness.analysis.featureSets.at(-1)).toEqual(['buffer', 'mfcc']);
        const switchCount = harness.analysis.featureSets.length;

        harness.analysis.emit({
            state: 'ready',
            generation: 2,
            activeFeatureIds: ['buffer', 'rms'],
            readyFeatureIds: ['buffer', 'rms'],
        });
        await settle();
        expect(harness.analysis.featureSets.at(-1)).toEqual(['buffer', 'mfcc']);
        expect(harness.analysis.featureSets.length).toBe(switchCount + 1);

        harness.analysis.emit({
            state: 'error',
            generation: 3,
            activeFeatureIds: ['buffer', 'mfcc'],
            readyFeatureIds: ['buffer'],
        });
        harness.controller.retryOverlayAnalysis();
        await settle();
        expect(harness.analysis.featureSets.at(-1)).toEqual(['buffer', 'mfcc']);
        await harness.controller.dispose();
    });
});
