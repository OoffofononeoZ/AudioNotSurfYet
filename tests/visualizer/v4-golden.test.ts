import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
    CUBE_SWARM_CHECKPOINT_SECONDS,
    CUBE_SWARM_STEP_SECONDS,
    CubeSwarmFrameStateResolver,
} from '../../src/visualizer/cubeSwarmState';
import type { VisualizerResolvedParameterMap } from '../../src/visualizer/rendererTypes';

const golden = JSON.parse(readFileSync(
    new URL('../analysis/golden/visualizer-v4-cube-swarm.v1.json', import.meta.url),
    'utf8',
)) as {
    schemaVersion: number;
    fixture: string;
    seed: number;
    stepSeconds: number;
    checkpointSeconds: number;
    editor: {
        drumPoints: number[];
        mainToneRanges: Array<{ start: number; end: number }>;
    };
    energyWindows: Record<'silence' | 'low' | 'high', [number, number]>;
    samples: Array<{
        timeSeconds: number;
        hash: string;
        integratedRise: number;
        integratedOrbit: number;
    }>;
};

const valuesAt = (timeSeconds: number): VisualizerResolvedParameterMap => new Map([
    ['centerSpectrum', { parameterId: 'centerSpectrum', state: 'ready', value: timeSeconds < 0.5 ? [] : timeSeconds < 2 ? [1, 4, 8, 16] : [8, 32, 64, 128] }],
    ['coreScale', { parameterId: 'coreScale', state: 'ready', value: golden.editor.drumPoints.some((point) => point <= timeSeconds && timeSeconds < point + 0.06) ? 2 : 1 }],
    ['riseSpeed', { parameterId: 'riseSpeed', state: 'ready', value: timeSeconds < 0.5 ? 0.25 : timeSeconds < 2 ? 0.5 : 3 }],
    ['orbitSpeed', { parameterId: 'orbitSpeed', state: 'ready', value: 0.3 }],
    ['cubeCount', { parameterId: 'cubeCount', state: 'ready', value: 48 }],
    ['coreColor', { parameterId: 'coreColor', state: 'ready', value: '#f3ebef' }],
    ['peripheralColor', { parameterId: 'peripheralColor', state: 'ready', value: '#d8c7d1' }],
    ['baseSize', { parameterId: 'baseSize', state: 'ready', value: 1 }],
    ['cameraDistance', { parameterId: 'cameraDistance', state: 'ready', value: 8 }],
    ['backgroundColor', { parameterId: 'backgroundColor', state: 'ready', value: '#020403' }],
]);

describe('Visualizer V4 versioned Cube Swarm golden', () => {
    test('locks the fixture, Editor scenarios, and deterministic stepping contract', () => {
        expect(golden.schemaVersion).toBe(1);
        expect(golden.fixture).toBe('tests/fixtures/audio/visualizer-v4-cube-swarm-v1.wav');
        expect(golden.stepSeconds).toBe(CUBE_SWARM_STEP_SECONDS);
        expect(golden.checkpointSeconds).toBe(CUBE_SWARM_CHECKPOINT_SECONDS);
        expect(golden.editor.drumPoints).toEqual([0.02, 1, 2.5, 4, 5.98]);
        expect(golden.editor.mainToneRanges[0]?.start).toBe(0.5);
        expect(golden.editor.mainToneRanges.at(-1)?.end).toBe(5.5);
        expect(golden.energyWindows.silence[1]).toBeLessThan(golden.energyWindows.low[0]);
        expect(golden.energyWindows.low[1]).toBeLessThan(golden.energyWindows.high[0]);
    });

    test('matches direct-seek hashes and integrated phases at song boundaries', () => {
        for (const sample of [...golden.samples].reverse()) {
            const state = new CubeSwarmFrameStateResolver(golden.seed).resolve(
                sample.timeSeconds,
                1,
                valuesAt(sample.timeSeconds),
                valuesAt,
            );
            expect(state.hash).toBe(sample.hash);
            expect(state.integratedRise).toBeCloseTo(sample.integratedRise, 12);
            expect(state.integratedOrbit).toBeCloseTo(sample.integratedOrbit, 12);
        }
    });
});
