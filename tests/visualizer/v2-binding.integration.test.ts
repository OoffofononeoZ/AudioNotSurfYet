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
import type { EditorDraftRepositoryPort } from '../../src/editor/editorDraftRepository';
import type { EditorFileGateway } from '../../src/editor/fileIO';
import {
    createInitialEditorProject,
    encodeEditorProjectV1,
} from '../../src/editor/projectCodec';
import type { EditorDraftEnvelopeV1, EditorProjectV1 } from '../../src/editor/types';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type { DecodedAudioDescriptor, TrackRecord } from '../../src/types/audio';
import { createDefaultAnalysisBinding, createDefaultEditorBinding } from '../../src/visualizer/bindingDefaults';
import type { VisualizerFileGateway } from '../../src/visualizer/fileIO';
import { SceneRegistry, type SceneTemplateDescriptor } from '../../src/visualizer/sceneRegistry';
import type { VisualizerDraftRepositoryPort } from '../../src/visualizer/visualizerDraftRepository';
import { VisualizerSessionController } from '../../src/visualizer/visualizerSessionController';
import type { VisualizerDraftEnvelopeV1 } from '../../src/visualizer/types';

const HASH = '3'.repeat(64);
const OTHER_HASH = '4'.repeat(64);
const NOW = new Date('2026-09-02T09:00:00.000Z');
const TRACK_ID = 'visualizer-v2-track';

const track = (): TrackRecord => ({
    id: TRACK_ID,
    name: 'visualizer-v2.wav',
    mimeType: 'audio/wav',
    byteSize: 4096,
    lastModified: 1,
    durationSeconds: 4,
    encodedSampleRate: 48_000,
    metadata: { title: 'V2 fixture', artist: 'AudioNotSurfYet' },
    trackHash: HASH,
    restoreState: 'available',
});

class VisualizerMemoryRepository implements VisualizerDraftRepositoryPort {
    envelope: VisualizerDraftEnvelopeV1 | null = null;
    async restore() { return this.envelope ? structuredClone(this.envelope) : null; }
    async replace(value: VisualizerDraftEnvelopeV1) { this.envelope = structuredClone(value); }
    async clear() { this.envelope = null; }
    close() {}
}

class EditorMemoryRepository implements EditorDraftRepositoryPort {
    envelope: EditorDraftEnvelopeV1 | null = null;
    async restore() { return this.envelope ? structuredClone(this.envelope) : null; }
    async replace(value: EditorDraftEnvelopeV1) { this.envelope = structuredClone(value); }
    async clear() { this.envelope = null; }
    async getLeaveWarningEnabled() { return true; }
    async setLeaveWarningEnabled() {}
    async getOverlayVisibility() { return null; }
    async setOverlayVisibility() {}
    close() {}
}

const idleSnapshot = (): AnalysisCoordinatorSnapshot => ({
    state: 'idle',
    generation: 1,
    trackId: TRACK_ID,
    trackHash: HASH,
    configHash: 'config',
    sampleRate: 48_000,
    activeFeatureIds: [],
    readyFeatureIds: [],
    completedFrames: 0,
    totalFrames: 0,
    progress: 0,
    cacheState: 'idle',
    staleMessageCount: 0,
});

class FakeAnalysisCoordinator {
    readonly activeCalls: FeatureId[][] = [];
    readonly consumers: string[] = [];
    releaseCount = 0;
    private snapshot = idleSnapshot();
    private listeners = new Set<AnalysisListener>();
    private readonly series = new Map<FeatureId, AnalysisSeries>();

    acquireConsumer(consumer: 'visualizer'): AnalysisConsumerLease {
        this.consumers.push(consumer);
        const token = `lease-${this.consumers.length}`;
        let released = false;
        return {
            token,
            consumer,
            setActiveFeatures: async (ids) => {
                if (released) return;
                this.activeCalls.push([...ids]);
                this.snapshot = {
                    ...this.snapshot,
                    state: ids.length === 0 ? 'idle' : 'ready',
                    generation: this.snapshot.generation + 1,
                    activeFeatureIds: [...ids],
                    readyFeatureIds: [...ids],
                    progress: ids.length === 0 ? 0 : 1,
                    cacheState: ids.length === 0 ? 'idle' : 'hit',
                };
                for (const listener of this.listeners) listener(this.snapshot);
            },
            requestCursorValue: async () => null,
            requestTempoEstimate: async () => null,
            getSeries: (featureId) => released ? null : this.series.get(featureId) ?? null,
            subscribe: (listener) => {
                this.listeners.add(listener);
                listener(this.snapshot);
                return () => this.listeners.delete(listener);
            },
            release: () => {
                if (released) return;
                released = true;
                this.releaseCount += 1;
            },
        };
    }
}

const makeEditorProject = (hash = HASH): EditorProjectV1 => {
    let sequence = 0;
    const project = createInitialEditorProject({
        track: {
            contentHash: hash,
            fileName: 'visualizer-v2.wav',
            durationSeconds: 4,
            sampleRate: 48_000,
        },
        createId: () => `editor-v2-${++sequence}`,
        now: () => NOW,
    });
    project.lanes = [{
        id: 'drum-lane',
        name: 'drum',
        eventKind: 'point',
        innerClasses: [{ id: 'kick', label: 'kick' }],
        events: [{ id: 'kick-1', innerClassId: 'kick', atSeconds: 1 }],
    }];
    return project;
};

const FIVE_PARAMETERS: SceneTemplateDescriptor = {
    id: 'orthogonal-lines',
    version: 1,
    title: 'Five parameter integration fixture',
    description: 'Feature limit integration fixture',
    parameters: Array.from({ length: 5 }, (_, index) => ({
        id: `parameter${index}`,
        label: `Parameter ${index}`,
        valueKind: 'number' as const,
        defaultValue: 0,
        allowedSourceKinds: ['constant', 'analysis'] as const,
        range: { min: 0, max: 1 },
        allowedAnalysisComponents: ['default'] as const,
        allowedAnalysisProjections: ['scalar'] as const,
    })),
};

const createHarness = (options: {
    editorDraft?: EditorProjectV1;
    editorImport?: EditorProjectV1;
    registry?: SceneRegistry;
} = {}) => {
    const store = useAudioSessionStore();
    store.appendTracks([track()]);
    const repository = new VisualizerMemoryRepository();
    const editorRepository = new EditorMemoryRepository();
    if (options.editorDraft) {
        editorRepository.envelope = {
            schemaVersion: 1,
            savedAt: NOW.toISOString(),
            project: options.editorDraft,
        };
    }
    const coordinator = new FakeAnalysisCoordinator();
    const audioSession = {
        acquireRoutePlayback: async (): Promise<RoutePlaybackLease> => ({
            token: 'visualizer-v2-playback',
            consumer: 'visualizer',
            trackId: TRACK_ID,
            endedPolicy: 'pause-at-end',
            release() {},
        }),
        getDecodedTrackDescriptor: (): DecodedAudioDescriptor => ({
            trackId: TRACK_ID,
            revision: 1,
            sampleRate: 48_000,
            length: 192_000,
            channelCount: 1,
            durationSeconds: 4,
        }),
    };
    const fileGateway: VisualizerFileGateway = {
        open: async () => null,
        save: async () => 'saved',
    };
    const editorFileGateway: EditorFileGateway = {
        open: async () => {
            if (!options.editorImport) return null;
            const bytes = encodeEditorProjectV1(options.editorImport);
            return {
                name: 'editor.audiosurf-editor.json',
                bytes: bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength,
                ) as ArrayBuffer,
            };
        },
        save: async () => 'saved',
    };
    const controller = new VisualizerSessionController({
        audioSession: audioSession as unknown as AudioSessionService,
        store,
        repository,
        fileGateway,
        analysisCoordinator: coordinator as unknown as AnalysisCoordinator,
        editorRepository,
        editorFileGateway,
        registry: options.registry,
        createId: () => '00000000-0000-4000-8000-000000000302',
        createSeed: () => 18,
        now: () => NOW,
    });
    return { controller, coordinator, repository, editorRepository };
};

describe('Visualizer V2 binding integration', () => {
    beforeEach(() => setActivePinia(createPinia()));

    test('copies a same-song Editor draft once and resolves its point binding', async () => {
        const harness = createHarness({ editorDraft: makeEditorProject() });
        await harness.controller.enter(TRACK_ID);
        const snapshot = harness.controller.getSnapshot();
        expect(snapshot).toMatchObject({
            state: 'ready',
            bindingRuntime: { editorSnapshotSource: 'draft' },
            project: { editorSnapshot: { project: { lanes: [{ id: 'drum-lane' }] } } },
        });
        const descriptor = harness.controller.listTemplates()[0]!;
        const parameter = descriptor.parameters[1]!;
        harness.controller.updateBinding(
            createDefaultEditorBinding(parameter, 'drum-lane', 'kick', true),
        );
        const value = harness.controller.resolveParameters(1.05)[1]!;
        expect(value.state).toBe('ready');
        expect(value.value as number).toBeGreaterThan(0);
        await harness.controller.dispose();
    });

    test('deduplicates shared features and releases the final reference immediately', async () => {
        const harness = createHarness();
        await harness.controller.enter(TRACK_ID);
        harness.controller.switchTemplate('cube-swarm');
        const descriptor = harness.controller.listTemplates().find(
            (entry) => entry.id === 'cube-swarm',
        )!;
        const core = descriptor.parameters.find((entry) => entry.id === 'coreScale')!;
        const rise = descriptor.parameters.find((entry) => entry.id === 'riseSpeed')!;
        const center = descriptor.parameters.find((entry) => entry.id === 'centerSpectrum')!;
        expect(harness.coordinator.activeCalls).toEqual([['energy', 'amplitudeSpectrum']]);
        harness.controller.updateBinding(createDefaultAnalysisBinding(core, 'rms'));
        expect(harness.coordinator.activeCalls.at(-1)).toEqual([
            'rms', 'energy', 'amplitudeSpectrum',
        ]);
        harness.controller.updateBinding(createDefaultAnalysisBinding(rise, 'rms'));
        expect(harness.coordinator.activeCalls.at(-1)).toEqual(['rms', 'amplitudeSpectrum']);
        harness.controller.updateBinding(createDefaultAnalysisBinding(core, 'zcr'));
        expect(harness.coordinator.activeCalls.at(-1)).toEqual(['rms', 'zcr', 'amplitudeSpectrum']);
        harness.controller.updateBinding({
            parameterId: rise.id,
            source: { kind: 'constant', value: rise.defaultValue as number },
        });
        expect(harness.coordinator.activeCalls.at(-1)).toEqual(['zcr', 'amplitudeSpectrum']);
        harness.controller.updateBinding({
            parameterId: core.id,
            source: { kind: 'constant', value: core.defaultValue as number },
        });
        expect(harness.coordinator.activeCalls.at(-1)).toEqual(['amplitudeSpectrum']);
        harness.controller.updateBinding({
            parameterId: center.id,
            source: { kind: 'constant', value: [] },
        });
        expect(harness.coordinator.activeCalls.at(-1)).toEqual([]);
        await harness.controller.dispose();
    });

    test('releases four Cube references for Orthogonal and restores the exact Cube bindings', async () => {
        const harness = createHarness();
        await harness.controller.enter(TRACK_ID);
        harness.controller.switchTemplate('cube-swarm');
        const descriptor = harness.controller.listTemplates().find(
            (entry) => entry.id === 'cube-swarm',
        )!;
        const cases: Array<[string, FeatureId]> = [
            ['centerSpectrum', 'complexSpectrum'],
            ['coreScale', 'buffer'],
            ['riseSpeed', 'loudness'],
            ['orbitSpeed', 'amplitudeSpectrum'],
        ];
        for (const [parameterId, featureId] of cases) {
            const parameter = descriptor.parameters.find((entry) => entry.id === parameterId)!;
            const binding = createDefaultAnalysisBinding(parameter, featureId);
            if (featureId === 'complexSpectrum') {
                binding.source = {
                    kind: 'analysis',
                    featureId,
                    component: 'magnitude',
                    projection: { kind: 'full' },
                };
                delete binding.transform;
            } else if (featureId === 'loudness') {
                binding.source = {
                    kind: 'analysis',
                    featureId,
                    component: 'total',
                    projection: { kind: 'scalar' },
                };
            } else {
                binding.source = {
                    kind: 'analysis',
                    featureId,
                    projection: { kind: 'max' },
                };
            }
            harness.controller.updateBinding(binding);
        }
        const cubeBindings = harness.controller.getSnapshot().project!.scene.bindings;
        expect(harness.controller.getSnapshot().bindingRuntime.activeFeatureIds).toEqual([
            'amplitudeSpectrum', 'loudness', 'complexSpectrum', 'buffer',
        ]);

        harness.controller.switchTemplate('orthogonal-lines');
        const orthogonal = harness.controller.listTemplates().find(
            (entry) => entry.id === 'orthogonal-lines',
        )!;
        for (const [parameterId, featureId, component, projection] of [
            ['horizontalIntensity', 'loudness', 'total', 'scalar'],
            ['verticalIntensity', 'complexSpectrum', 'magnitude', 'mean'],
        ] as const) {
            const parameter = orthogonal.parameters.find((entry) => entry.id === parameterId)!;
            const binding = createDefaultAnalysisBinding(parameter, featureId);
            binding.source = {
                kind: 'analysis',
                featureId,
                component,
                projection: { kind: projection },
            };
            harness.controller.updateBinding(binding);
        }
        expect(harness.controller.getSnapshot().bindingRuntime.activeFeatureIds).toEqual([
            'loudness', 'complexSpectrum',
        ]);

        harness.controller.switchTemplate('cube-swarm');
        expect(harness.controller.getSnapshot().project!.scene.bindings).toEqual(cubeBindings);
        expect(harness.controller.getSnapshot().bindingRuntime.activeFeatureIds).toEqual([
            'amplitudeSpectrum', 'loudness', 'complexSpectrum', 'buffer',
        ]);
        await harness.controller.dispose();
    });

    test('rejects the fifth feature before mutating project or coordinator active set', async () => {
        const registry = new SceneRegistry([FIVE_PARAMETERS]);
        const harness = createHarness({ registry });
        await harness.controller.enter(TRACK_ID);
        const descriptor = harness.controller.listTemplates()[0]!;
        const ids: FeatureId[] = ['rms', 'zcr', 'energy', 'spectralCentroid', 'spectralFlux'];
        for (let index = 0; index < 4; index += 1) {
            harness.controller.updateBinding(createDefaultAnalysisBinding(
                descriptor.parameters[index]!,
                ids[index]!,
            ));
        }
        const before = harness.controller.getSnapshot().project;
        const callCount = harness.coordinator.activeCalls.length;
        expect(() => harness.controller.updateBinding(createDefaultAnalysisBinding(
            descriptor.parameters[4]!,
            ids[4]!,
        ))).toThrowError(expect.objectContaining({ code: 'analysis-feature-limit' }));
        expect(harness.controller.getSnapshot().project).toEqual(before);
        expect(harness.coordinator.activeCalls).toHaveLength(callCount);
        await harness.controller.dispose();
    });

    test('keeps the current project atomic when imported Editor JSON belongs to another song', async () => {
        const harness = createHarness({ editorImport: makeEditorProject(OTHER_HASH) });
        await harness.controller.enter(TRACK_ID);
        const before = harness.controller.getSnapshot().project;
        await expect(harness.controller.importEditorProject()).rejects.toThrowError(
            expect.objectContaining({ code: 'editor-snapshot-mismatch' }),
        );
        expect(harness.controller.getSnapshot().project).toEqual(before);
        await harness.controller.dispose();
    });

    test('releases the Visualizer analysis consumer on route leave', async () => {
        const harness = createHarness();
        await harness.controller.enter(TRACK_ID);
        expect(harness.coordinator.consumers).toEqual(['visualizer']);
        await harness.controller.leave();
        expect(harness.coordinator.releaseCount).toBe(1);
        expect(harness.controller.getSnapshot().bindingRuntime.activeFeatureIds).toEqual([]);
        await harness.controller.dispose();
    });
});
