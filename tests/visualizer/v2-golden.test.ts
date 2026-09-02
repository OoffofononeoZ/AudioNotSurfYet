import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { AnalysisSeries } from '../../src/analysis/types';
import { projectAnalysisSeries } from '../../src/visualizer/analysisProjection';
import { planVisualizerFeatures } from '../../src/visualizer/bindingPlanner';
import { createInitialVisualizerProject } from '../../src/visualizer/projectCodec';

const golden = JSON.parse(readFileSync(
    new URL('../analysis/golden/visualizer-v2-bindings.v1.json', import.meta.url),
    'utf8',
)) as {
    scalarInterpolation: { values: number[]; timeSeconds: number; expected: number };
    vectorProjection: {
        quantizedFrames: number[][];
        scale: number;
        timeSeconds: number;
        expectedFull: number[];
        expectedBandMean: number;
        expectedMean: number;
        expectedMax: number;
        expectedPeak: number;
    };
    featurePlan: { requested: string[]; expectedStableOrder: string[] };
};

const base = (featureId: AnalysisSeries['featureId']): Omit<AnalysisSeries, 'payload'> => ({
    schemaVersion: 1,
    trackHash: '5'.repeat(64),
    configHash: 'golden-config',
    featureId,
    startTimeSeconds: 0,
    sampleStepSeconds: 1,
    sampleCount: 2,
    dimensions: [],
});

describe('Visualizer V2 versioned binding golden', () => {
    test('matches scalar and vector projections', () => {
        const scalar: AnalysisSeries = {
            ...base('rms'),
            payload: {
                kind: 'scalar-f32',
                values: Float32Array.from(golden.scalarInterpolation.values),
            },
        };
        expect(projectAnalysisSeries(
            scalar,
            'default',
            { kind: 'scalar' },
            golden.scalarInterpolation.timeSeconds,
        )).toBeCloseTo(golden.scalarInterpolation.expected);

        const vector: AnalysisSeries = {
            ...base('amplitudeSpectrum'),
            dimensions: [3],
            payload: {
                kind: 'frequency-u16',
                values: Uint16Array.from(golden.vectorProjection.quantizedFrames.flat()),
                width: 3,
                scale: golden.vectorProjection.scale,
                offset: 0,
            },
        };
        const time = golden.vectorProjection.timeSeconds;
        expect(projectAnalysisSeries(vector, 'default', { kind: 'full' }, time))
            .toEqual(golden.vectorProjection.expectedFull);
        expect(projectAnalysisSeries(vector, 'default', { kind: 'band', start: 0, end: 2 }, time))
            .toBe(golden.vectorProjection.expectedBandMean);
        expect(projectAnalysisSeries(vector, 'default', { kind: 'mean' }, time))
            .toBe(golden.vectorProjection.expectedMean);
        expect(projectAnalysisSeries(vector, 'default', { kind: 'max' }, time))
            .toBe(golden.vectorProjection.expectedMax);
        expect(projectAnalysisSeries(vector, 'default', { kind: 'peak' }, time))
            .toBe(golden.vectorProjection.expectedPeak);
    });

    test('matches stable four-feature planning order', () => {
        const project = createInitialVisualizerProject({
            track: {
                contentHash: '5'.repeat(64),
                fileName: 'v2-golden.wav',
                durationSeconds: 4,
                sampleRate: 48_000,
            },
            createId: () => '00000000-0000-4000-8000-000000000303',
            createSeed: () => 1,
            now: () => new Date('2026-09-02T10:00:00.000Z'),
        });
        project.scene.bindings = golden.featurePlan.requested.map((featureId, index) => ({
            parameterId: `fixture-${index}`,
            source: {
                kind: 'analysis' as const,
                featureId: featureId as AnalysisSeries['featureId'],
                projection: { kind: 'scalar' as const },
            },
        }));
        expect(planVisualizerFeatures(project)).toEqual(golden.featurePlan.expectedStableOrder);
    });
});
