import { describe, expect, test } from 'vitest';
import type { AnalysisSeries, FeatureId } from '../../src/analysis/types';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { projectAnalysisSeries } from '../../src/visualizer/analysisProjection';
import {
    analysisComponentsForFeature,
    analysisVectorLength,
    compatibleAnalysisFeatures,
    compatibleAnalysisProjections,
    createDefaultAnalysisBinding,
    createDefaultEditorBinding,
} from '../../src/visualizer/bindingDefaults';
import {
    planVisualizerFeatures,
    VisualizerBindingPlannerError,
} from '../../src/visualizer/bindingPlanner';
import { VisualizerBindingResolver } from '../../src/visualizer/bindingResolver';
import { createInitialVisualizerProject } from '../../src/visualizer/projectCodec';
import { SceneRegistry, type SceneTemplateDescriptor } from '../../src/visualizer/sceneRegistry';
import type { VisualizerProjectV1 } from '../../src/visualizer/types';

const HASH = '2'.repeat(64);
const NOW = new Date('2026-09-02T08:00:00.000Z');
const TRACK = {
    contentHash: HASH,
    fileName: 'visualizer-v2.wav',
    durationSeconds: 4,
    sampleRate: 48_000,
};

const project = (registry = new SceneRegistry()): VisualizerProjectV1 =>
    createInitialVisualizerProject({
        track: TRACK,
        registry,
        createId: () => '00000000-0000-4000-8000-000000000301',
        createSeed: () => 17,
        now: () => NOW,
    });

const scalarSeries = (values: number[]): AnalysisSeries => ({
    schemaVersion: 1,
    trackHash: HASH,
    configHash: 'config',
    featureId: 'rms',
    startTimeSeconds: 0,
    sampleStepSeconds: 1,
    sampleCount: values.length,
    dimensions: [],
    payload: { kind: 'scalar-f32', values: Float32Array.from(values) },
});

const vectorSeries = (): AnalysisSeries => ({
    schemaVersion: 1,
    trackHash: HASH,
    configHash: 'config',
    featureId: 'amplitudeSpectrum',
    startTimeSeconds: 0,
    sampleStepSeconds: 1,
    sampleCount: 2,
    dimensions: [3],
    payload: {
        kind: 'frequency-u16',
        width: 3,
        scale: 0.5,
        offset: 0,
        values: Uint16Array.from([2, 10, 6, 4, 6, 8]),
    },
});

const FIVE_PARAMETERS: SceneTemplateDescriptor = {
    id: 'orthogonal-lines',
    version: 1,
    title: 'Five feature fixture',
    description: 'Planner fixture',
    parameters: Array.from({ length: 5 }, (_, index) => ({
        id: `dynamic${index}`,
        label: `Dynamic ${index}`,
        valueKind: 'number' as const,
        defaultValue: 0,
        allowedSourceKinds: ['constant', 'analysis'] as const,
        range: { min: 0, max: 1 },
        allowedAnalysisComponents: ['default'] as const,
        allowedAnalysisProjections: ['scalar'] as const,
    })),
};

describe('Visualizer V2 binding planner and projection', () => {
    test('orders shared features by FEATURE_IDS and rejects the fifth unique feature', () => {
        const registry = new SceneRegistry([FIVE_PARAMETERS]);
        const value = project(registry);
        const ids: FeatureId[] = ['energy', 'rms', 'energy', 'zcr', 'spectralFlux'];
        value.scene.bindings = value.scene.bindings.map((binding, index) => ({
            parameterId: binding.parameterId,
            source: {
                kind: 'analysis',
                featureId: ids[index]!,
                projection: { kind: 'scalar' },
            },
        }));
        expect(planVisualizerFeatures(value)).toEqual([
            'rms', 'zcr', 'energy', 'spectralFlux',
        ]);
        value.scene.bindings[2]!.source = {
            kind: 'analysis',
            featureId: 'spectralCentroid',
            projection: { kind: 'scalar' },
        };
        expect(() => planVisualizerFeatures(value)).toThrow(
            VisualizerBindingPlannerError,
        );
    });

    test('projects scalar, bin, band, mean, max, peak and full vector deterministically', () => {
        expect(projectAnalysisSeries(scalarSeries([0, 1]), 'default', { kind: 'scalar' }, 0.5))
            .toBeCloseTo(0.5);
        const series = vectorSeries();
        expect(projectAnalysisSeries(series, 'default', { kind: 'full' }, 0))
            .toEqual([1, 5, 3]);
        expect(projectAnalysisSeries(series, 'default', { kind: 'bin', index: 1 }, 0.5))
            .toBeCloseTo(4);
        expect(projectAnalysisSeries(series, 'default', { kind: 'band', start: 0, end: 2 }, 0))
            .toBe(3);
        expect(projectAnalysisSeries(series, 'default', { kind: 'mean' }, 0))
            .toBe(3);
        expect(projectAnalysisSeries(series, 'default', { kind: 'max' }, 0))
            .toBe(5);
        expect(projectAnalysisSeries(series, 'default', { kind: 'peak' }, 0))
            .toBe(0.5);
        expect(() => projectAnalysisSeries(series, 'default', { kind: 'bin', index: 9 }, 0))
            .toThrow(/compact/);
    });

    test('maps all 21 registry entries to explicit compatible components and dimensions', () => {
        const registry = new SceneRegistry();
        const numeric = registry.get('cube-swarm').parameters.find(
            (entry) => entry.id === 'coreScale',
        )!;
        const vector = registry.get('cube-swarm').parameters.find(
            (entry) => entry.id === 'centerSpectrum',
        )!;
        const numericFeatures = compatibleAnalysisFeatures(numeric);
        const vectorFeatures = compatibleAnalysisFeatures(vector);
        expect(numericFeatures).toHaveLength(21);
        expect(vectorFeatures).toContain('mfcc');
        expect(vectorFeatures).not.toContain('rms');
        expect(analysisComponentsForFeature('loudness')).toEqual(['total', 'specific']);
        expect(analysisComponentsForFeature('complexSpectrum')).toEqual([
            'real', 'imag', 'magnitude', 'phase',
        ]);
        expect(analysisVectorLength('mfcc', 'default')).toBe(13);
        expect(analysisVectorLength('loudness', 'specific')).toBe(24);
        expect(analysisVectorLength('complexSpectrum', 'real')).toBe(1024);
        expect(analysisVectorLength('buffer', 'default')).toBe(2);
        expect(compatibleAnalysisProjections(numeric, 'rms', 'default')).toEqual(['scalar']);
        expect(compatibleAnalysisProjections(numeric, 'mfcc', 'default')).toEqual([
            'mean', 'max', 'peak', 'bin', 'band',
        ]);
        expect(compatibleAnalysisProjections(vector, 'mfcc', 'default')).toEqual(['full']);
    });
});

describe('Visualizer V2 deterministic Editor resolver', () => {
    const makeEditorProject = () => {
        let sequence = 0;
        const editor = createInitialEditorProject({
            track: TRACK,
            createId: () => `editor-${++sequence}`,
            now: () => NOW,
        });
        editor.lanes = [
            {
                id: 'point-lane',
                name: 'drum',
                eventKind: 'point',
                innerClasses: [
                    { id: 'kick', label: 'kick' },
                    { id: 'snare', label: 'snare' },
                ],
                events: [
                    { id: 'point-1', innerClassId: 'kick', atSeconds: 1 },
                    { id: 'point-2', innerClassId: 'snare', atSeconds: 2 },
                ],
            },
            {
                id: 'range-lane',
                name: 'tone',
                eventKind: 'range',
                innerClasses: [
                    { id: 'main', label: 'main' },
                    { id: 'detail', label: 'detail' },
                ],
                events: [
                    { id: 'range-1', innerClassId: 'main', startSeconds: 0.5, endSeconds: 1.5 },
                    { id: 'range-2', innerClassId: 'detail', startSeconds: 1.5, endSeconds: 2.5 },
                ],
            },
        ];
        return editor;
    };

    test('uses half-open range gates and whole-lane OR/max semantics', () => {
        const registry = new SceneRegistry();
        const value = project(registry);
        value.editorSnapshot = { capturedAt: NOW.toISOString(), project: makeEditorProject() };
        const parameter = registry.get('orthogonal-lines').parameters.find(
            (entry) => entry.id === 'horizontalIntensity',
        )!;
        value.scene.bindings[1] = createDefaultEditorBinding(parameter, 'range-lane');
        const resolver = new VisualizerBindingResolver(registry);
        const read = (time: number) => resolver.resolve(value, time, () => null)[1]!.value;
        expect(read(0.5)).toBe(1);
        expect(read(1.499)).toBe(1);
        expect(read(1.5)).toBe(1);
        expect(read(2.5)).toBe(0);
        value.scene.bindings[1] = createDefaultEditorBinding(parameter, 'range-lane', 'main');
        resolver.reset();
        expect(read(1.499)).toBe(1);
        expect(read(1.5)).toBe(0);
    });

    test('replays point smoothing from absolute time with the same hash after reset', () => {
        const registry = new SceneRegistry();
        const value = project(registry);
        value.editorSnapshot = { capturedAt: NOW.toISOString(), project: makeEditorProject() };
        const parameter = registry.get('orthogonal-lines').parameters.find(
            (entry) => entry.id === 'verticalIntensity',
        )!;
        value.scene.bindings[7] = createDefaultEditorBinding(parameter, 'point-lane', 'kick', true);
        const resolver = new VisualizerBindingResolver(registry);
        const first = resolver.resolve(value, 1.05, () => null)[7]!.value as number;
        resolver.resolve(value, 3, () => null);
        const seeked = resolver.resolve(value, 1.05, () => null)[7]!.value as number;
        resolver.reset();
        const refreshed = resolver.resolve(value, 1.05, () => null)[7]!.value as number;
        expect(first).toBeGreaterThan(0);
        expect(seeked).toBeCloseTo(first, 12);
        expect(refreshed).toBeCloseTo(first, 12);
    });

    test('applies normalize, clamp, invert, smoothing and output mapping in order', () => {
        const registry = new SceneRegistry();
        const value = project(registry);
        const parameter = registry.get('orthogonal-lines').parameters[1]!;
        value.scene.bindings[1] = createDefaultAnalysisBinding(parameter, 'rms');
        value.scene.bindings[1]!.transform = {
            inputMin: 0,
            inputMax: 2,
            outputMin: 0.2,
            outputMax: 1,
            clamp: true,
            invert: true,
            attackSeconds: 0,
            releaseSeconds: 0,
        };
        const resolver = new VisualizerBindingResolver(registry);
        const resolved = resolver.resolve(value, 0, () => scalarSeries([0.5]))[1]!;
        expect(resolved).toMatchObject({ state: 'ready' });
        expect(resolved.value as number).toBeCloseTo(0.8);
    });
});
