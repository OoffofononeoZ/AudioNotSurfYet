import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import type { AnalysisConsumerLease, AnalysisCoordinator } from '../../src/analysis/analysisCoordinator';
import type {
    AnalysisCoordinatorSnapshot,
    AnalysisListener,
    AnalysisSeries,
    FeatureId,
} from '../../src/analysis/types';
import type { AudioSessionService, RoutePlaybackLease } from '../../src/audio/audioSessionService';
import {
    EditorDraftRepository,
    createEditorDraftEnvelope,
    type EditorDraftRepositoryPort,
} from '../../src/editor/editorDraftRepository';
import { EditorSessionController } from '../../src/editor/editorSessionController';
import type { EditorFileGateway } from '../../src/editor/fileIO';
import { createInitialEditorProject, encodeEditorProjectV2 } from '../../src/editor/projectCodec';
import type { EditorDraftEnvelopeV2, EditorProjectV2 } from '../../src/editor/types';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type { TrackRecord } from '../../src/types/audio';

const TRACK_HASH = '7'.repeat(64);
const OTHER_HASH = '8'.repeat(64);
const NOW = new Date('2026-08-29T03:00:00.000Z');

const track: TrackRecord = {
    id: 'e7-track',
    name: 'editor-e7-overlay.wav',
    mimeType: 'audio/wav',
    byteSize: 4096,
    lastModified: 1,
    durationSeconds: 12,
    encodedSampleRate: 48_000,
    metadata: { title: 'E7 Overlay', artist: 'Fixture' },
    trackHash: TRACK_HASH,
    restoreState: 'available',
};

const project = (featureId: FeatureId | null): EditorProjectV2 => {
    let id = 0;
    const value = createInitialEditorProject({
        track: {
            contentHash: TRACK_HASH,
            fileName: track.name,
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: () => `e7-${++id}`,
        now: () => NOW,
    });
    value.tempoMap[0] = {
        id: value.tempoMap[0]!.id,
        startSeconds: 0,
        mode: 'metered',
        beatOriginSeconds: 0,
        bpm: 100,
        bpmSource: 'user',
        meter: { numerator: 4, denominator: 4 },
    };
    value.workspace.overlay.featureId = featureId;
    return value;
};

class MemoryRepository implements EditorDraftRepositoryPort {
    envelope: EditorDraftEnvelopeV2 | null;
    overlayVisibility: { contentHash: string; enabled: boolean } | null = null;
    failVisibilityWrite = false;

    constructor(value: EditorProjectV2) {
        this.envelope = createEditorDraftEnvelope(value, () => NOW);
    }

    async restore() {
        return structuredClone(this.envelope);
    }
    async replace(value: EditorDraftEnvelopeV2) {
        this.envelope = structuredClone(value);
    }
    async clear() {
        this.envelope = null;
    }
    async getLeaveWarningEnabled() {
        return true;
    }
    async setLeaveWarningEnabled() {}
    async getOverlayVisibility(contentHash: string) {
        return this.overlayVisibility?.contentHash === contentHash ? this.overlayVisibility.enabled : null;
    }
    async setOverlayVisibility(contentHash: string, enabled: boolean) {
        if (this.failVisibilityWrite) throw new Error('preference quota');
        this.overlayVisibility = { contentHash, enabled };
    }
    close() {}
}

class AnalysisHarness {
    readonly featureSets: FeatureId[][] = [];
    readonly listeners = new Set<AnalysisListener>();
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
    readonly bufferSeries: AnalysisSeries = {
        schemaVersion: 1,
        trackHash: TRACK_HASH,
        configHash: 'e7-config',
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

    readonly lease: AnalysisConsumerLease = {
        token: 'e7-analysis',
        consumer: 'editor',
        readStemWaveform: () => null,
        prepareStemWaveform: async () => undefined,
        setActiveInputs: async inputs =>
            this.lease.setActiveFeatures(inputs.filter(i => !i.stemRole).map(i => i.featureId)),
        getSourceSnapshot: () => this.snapshot,
        setActiveFeatures: async featureIds => {
            this.featureSets.push([...featureIds]);
            this.snapshot = {
                ...this.snapshot,
                activeFeatureIds: [...featureIds],
            };
            for (const listener of this.listeners) listener(this.snapshot);
        },
        requestWindowSeries: async () => null,
        requestCursorValue: async () => null,
        requestTempoEstimate: async () => null,
        getSeries: featureId => (featureId === 'buffer' ? this.bufferSeries : null),
        subscribe: listener => {
            this.listeners.add(listener);
            listener(this.snapshot);
            return () => this.listeners.delete(listener);
        },
        release: () => undefined,
    };

    readyBuffer() {
        this.snapshot = {
            ...this.snapshot,
            state: 'ready',
            generation: 1,
            trackId: track.id,
            trackHash: TRACK_HASH,
            configHash: 'e7-config',
            sampleRate: 48_000,
            activeFeatureIds: ['buffer'],
            readyFeatureIds: ['buffer'],
            completedFrames: 1,
            totalFrames: 1,
            progress: 1,
        };
        for (const listener of this.listeners) listener(this.snapshot);
    }
}

const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

const createHarness = (value: EditorProjectV2) => {
    const store = useAudioSessionStore();
    store.appendTracks([track]);
    const repository = new MemoryRepository(value);
    const analysis = new AnalysisHarness();
    let openedBytes: ArrayBuffer | null = null;
    const fileGateway: EditorFileGateway = {
        open: async () => (openedBytes ? { name: 'editor-e7.audiosurf-editor.json', bytes: openedBytes } : null),
        save: async () => 'saved',
    };
    const controller = new EditorSessionController({
        audioSession: {
            acquireRoutePlayback: async (): Promise<RoutePlaybackLease> => ({
                token: 'e7-playback',
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
        } as unknown as AudioSessionService,
        analysisCoordinator: {
            getSnapshot: () => analysis.snapshot,
            acquireConsumer: () => analysis.lease,
        } as unknown as AnalysisCoordinator,
        store,
        repository,
        fileGateway,
        now: () => NOW,
    });
    return {
        analysis,
        controller,
        repository,
        setOpenedProject: (candidate: EditorProjectV2) => {
            const bytes = encodeEditorProjectV2(candidate);
            openedBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        },
    };
};

describe('Editor E7 fullscreen overlay integration', () => {
    beforeEach(() => setActivePinia(createPinia()));

    test('opens a legacy selected feature and stops it without erasing selection', async () => {
        const harness = createHarness(project('rms'));
        await harness.controller.enter(track.id);
        expect(harness.controller.getSnapshot().overlayOpen).toBe(true);
        harness.analysis.readyBuffer();
        await settle();
        expect(harness.analysis.featureSets.at(-1)).toEqual(['buffer', 'rms']);

        harness.controller.setOverlayOpen(false);
        await settle();
        expect(harness.controller.getSnapshot()).toMatchObject({
            overlayOpen: false,
            project: { workspace: { overlay: { featureId: 'rms' } } },
        });
        expect(harness.analysis.featureSets.at(-1)).toEqual(['buffer']);
        expect(harness.repository.overlayVisibility).toEqual({
            contentHash: TRACK_HASH,
            enabled: false,
        });

        harness.controller.setOverlayOpen(true);
        await settle();
        expect(harness.analysis.featureSets.at(-1)).toEqual(['buffer', 'rms']);
        await harness.controller.dispose();
    });

    test('isolates visibility by track hash and selects the first feature into an open overlay', async () => {
        const harness = createHarness(project(null));
        harness.repository.overlayVisibility = {
            contentHash: OTHER_HASH,
            enabled: true,
        };
        await harness.controller.enter(track.id);
        expect(harness.controller.getSnapshot().overlayOpen).toBe(false);
        harness.analysis.readyBuffer();
        await settle();
        expect(harness.analysis.featureSets.at(-1)).toEqual(['buffer']);

        harness.controller.selectOverlayFeature('chroma');
        await settle();
        expect(harness.controller.getSnapshot()).toMatchObject({
            overlayOpen: true,
            project: { workspace: { overlay: { featureId: 'chroma' } } },
        });
        expect(harness.analysis.featureSets.at(-1)).toEqual(['buffer', 'chroma']);
        expect(harness.repository.overlayVisibility).toEqual({
            contentHash: TRACK_HASH,
            enabled: true,
        });
        await harness.controller.dispose();
    });

    test('keeps local visibility when importing JSON and preserves memory on preference failure', async () => {
        const harness = createHarness(project('rms'));
        harness.repository.overlayVisibility = {
            contentHash: TRACK_HASH,
            enabled: false,
        };
        await harness.controller.enter(track.id);
        harness.analysis.readyBuffer();
        await settle();
        const imported = project('mfcc');
        harness.setOpenedProject(imported);
        await expect(harness.controller.importProject()).resolves.toBe('imported');
        expect(harness.controller.getSnapshot()).toMatchObject({
            overlayOpen: false,
            project: { workspace: { overlay: { featureId: 'mfcc' } } },
        });

        harness.repository.failVisibilityWrite = true;
        harness.controller.setOverlayOpen(true);
        await settle();
        expect(harness.controller.getSnapshot()).toMatchObject({
            overlayOpen: true,
            persistence: 'not-persisted',
        });
        await harness.controller.dispose();
    });

    test('round-trips visibility in the existing version-one preferences store', async () => {
        const repository = new EditorDraftRepository({
            indexedDB,
            databaseName: `editor-e7-${crypto.randomUUID()}`,
        });
        await repository.setOverlayVisibility(TRACK_HASH, false);
        expect(await repository.getOverlayVisibility(TRACK_HASH)).toBe(false);
        expect(await repository.getOverlayVisibility(OTHER_HASH)).toBeNull();
        await repository.setOverlayVisibility(TRACK_HASH, true);
        expect(await repository.getOverlayVisibility(TRACK_HASH)).toBe(true);
        repository.close();
    });
});
