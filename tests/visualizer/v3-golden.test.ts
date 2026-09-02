import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
    ORTHOGONAL_LINES_CHECKPOINT_SECONDS,
    ORTHOGONAL_LINES_STEP_SECONDS,
    OrthogonalLinesFrameStateResolver,
} from '../../src/visualizer/orthogonalLinesState';
import type { VisualizerResolvedParameterMap } from '../../src/visualizer/rendererTypes';

const golden = JSON.parse(readFileSync(
    new URL('../analysis/golden/visualizer-v3-lines.v1.json', import.meta.url),
    'utf8',
)) as {
    schemaVersion: number;
    fixture: string;
    stepSeconds: number;
    checkpointSeconds: number;
    decay: {
        decaySeconds: number;
        sampleTimesSeconds: number[];
        expected: number[];
    };
    scenarios: {
        mainToneRange: Array<{ start: number; end: number }>;
        drumPoints: number[];
        adjacentRanges: Array<{ start: number; end: number }>;
        multipleInnerClasses: string[];
        beginningAndEnd: number[];
        simultaneousPointAndRange: number;
        invalidReferences: string[];
    };
};

const values = (intensity: number, decay = 1): VisualizerResolvedParameterMap => new Map([
    ['horizontalEnabled', { parameterId: 'horizontalEnabled', state: 'ready', value: true }],
    ['horizontalIntensity', { parameterId: 'horizontalIntensity', state: 'ready', value: intensity }],
    ['horizontalColor', { parameterId: 'horizontalColor', state: 'ready', value: '#64f6b5' }],
    ['horizontalThickness', { parameterId: 'horizontalThickness', state: 'ready', value: 2 }],
    ['horizontalBrightness', { parameterId: 'horizontalBrightness', state: 'ready', value: 1 }],
    ['horizontalDecay', { parameterId: 'horizontalDecay', state: 'ready', value: decay }],
    ['verticalEnabled', { parameterId: 'verticalEnabled', state: 'ready', value: true }],
    ['verticalIntensity', { parameterId: 'verticalIntensity', state: 'ready', value: 0 }],
    ['verticalColor', { parameterId: 'verticalColor', state: 'ready', value: '#f4f7f5' }],
    ['verticalThickness', { parameterId: 'verticalThickness', state: 'ready', value: 2 }],
    ['verticalBrightness', { parameterId: 'verticalBrightness', state: 'ready', value: 1 }],
    ['verticalDecay', { parameterId: 'verticalDecay', state: 'ready', value: decay }],
]);

describe('Visualizer V3 versioned scene golden', () => {
    test('locks fixture coverage and deterministic step contract', () => {
        expect(golden.schemaVersion).toBe(1);
        expect(golden.fixture).toBe('tests/fixtures/audio/visualizer-v3-lines-v1.wav');
        expect(golden.stepSeconds).toBe(ORTHOGONAL_LINES_STEP_SECONDS);
        expect(golden.checkpointSeconds).toBe(ORTHOGONAL_LINES_CHECKPOINT_SECONDS);
        expect(golden.scenarios.mainToneRange).toHaveLength(1);
        expect(golden.scenarios.drumPoints.length).toBeGreaterThanOrEqual(6);
        expect(golden.scenarios.adjacentRanges[0]?.end)
            .toBe(golden.scenarios.adjacentRanges[1]?.start);
        expect(golden.scenarios.multipleInnerClasses).toEqual([
            'main-tone', 'secondary-tone', 'kick', 'snare',
        ]);
        expect(golden.scenarios.beginningAndEnd).toEqual([0.02, 5.98]);
        expect(golden.scenarios.simultaneousPointAndRange).toBe(4);
        expect(golden.scenarios.invalidReferences).toEqual([
            'missing-lane', 'missing-inner-class',
        ]);
    });

    test('matches one-decay-second checkpoints regardless of seek order', () => {
        for (const timeSeconds of [...golden.decay.sampleTimesSeconds].reverse()) {
            const resolver = new OrthogonalLinesFrameStateResolver();
            const current = timeSeconds === 0 ? values(1) : values(0);
            const state = resolver.resolve(
                timeSeconds,
                1,
                current,
                (sampleTime) => sampleTime === 0 ? values(1) : values(0),
            );
            const index = golden.decay.sampleTimesSeconds.indexOf(timeSeconds);
            expect(state.horizontal.displayIntensity)
                .toBeCloseTo(golden.decay.expected[index]!, 8);
        }
    });
});
