import { describe, expect, test } from 'vitest';
import { OrthogonalLinesFrameStateResolver } from '../../src/visualizer/orthogonalLinesState';
import type { VisualizerResolvedParameterMap } from '../../src/visualizer/rendererTypes';

const parameterMap = (input: {
    horizontal?: number;
    vertical?: number;
    horizontalDecay?: number;
    verticalDecay?: number;
    horizontalBrightness?: number;
    horizontalThickness?: number;
    horizontalEnabled?: boolean;
} = {}): VisualizerResolvedParameterMap => new Map([
    ['horizontalEnabled', { parameterId: 'horizontalEnabled', state: 'ready', value: input.horizontalEnabled ?? true }],
    ['horizontalIntensity', { parameterId: 'horizontalIntensity', state: 'ready', value: input.horizontal ?? 0 }],
    ['horizontalColor', { parameterId: 'horizontalColor', state: 'ready', value: '#123456' }],
    ['horizontalThickness', { parameterId: 'horizontalThickness', state: 'ready', value: input.horizontalThickness ?? 2 }],
    ['horizontalBrightness', { parameterId: 'horizontalBrightness', state: 'ready', value: input.horizontalBrightness ?? 1 }],
    ['horizontalDecay', { parameterId: 'horizontalDecay', state: 'ready', value: input.horizontalDecay ?? 1 }],
    ['verticalEnabled', { parameterId: 'verticalEnabled', state: 'ready', value: true }],
    ['verticalIntensity', { parameterId: 'verticalIntensity', state: 'ready', value: input.vertical ?? 0 }],
    ['verticalColor', { parameterId: 'verticalColor', state: 'ready', value: '#abcdef' }],
    ['verticalThickness', { parameterId: 'verticalThickness', state: 'ready', value: 3 }],
    ['verticalBrightness', { parameterId: 'verticalBrightness', state: 'ready', value: 1 }],
    ['verticalDecay', { parameterId: 'verticalDecay', state: 'ready', value: input.verticalDecay ?? 1 }],
]);

describe('Visualizer V3 orthogonal line frame state', () => {
    test('clamps intensity and maps length, alpha, CSS thickness, and bright halo', () => {
        const resolver = new OrthogonalLinesFrameStateResolver();
        const state = resolver.resolve(0, 1, parameterMap({
            horizontal: 2,
            horizontalBrightness: 2,
            horizontalThickness: 4,
        }), () => parameterMap());
        expect(state.horizontal).toMatchObject({
            sourceIntensity: 1,
            displayIntensity: 1,
            lengthRatio: 1,
            mainAlpha: 1,
            thicknessCssPx: 4,
            color: '#123456',
        });
        expect(state.horizontal.haloAlpha).toBeGreaterThan(0.24);
        expect(state.horizontal.haloWidthCssPx).toBeGreaterThan(12);
    });

    test('applies decay independently and decay zero follows current intensity', () => {
        const resolver = new OrthogonalLinesFrameStateResolver();
        const provider = (time: number) => parameterMap({
            horizontal: time === 0 ? 1 : 0,
            vertical: time === 0 ? 0.5 : 0,
            horizontalDecay: 1,
            verticalDecay: 0,
        });
        const state = resolver.resolve(1, 4, provider(1), provider);
        expect(state.horizontal.displayIntensity).toBeCloseTo(Math.exp(-4), 8);
        expect(state.vertical.displayIntensity).toBe(0);
    });

    test('resets checkpoints on binding revision and keeps same-time hashes stable', () => {
        const resolver = new OrthogonalLinesFrameStateResolver();
        const pulseProvider = (time: number) => parameterMap({ horizontal: time === 0 ? 1 : 0 });
        const first = resolver.resolve(0.5, 1, pulseProvider(0.5), pulseProvider);
        const repeated = resolver.resolve(0.5, 1, pulseProvider(0.5), pulseProvider);
        expect(repeated.hash).toBe(first.hash);
        const revised = resolver.resolve(0.5, 2, parameterMap({ horizontal: 0.7 }), () => parameterMap({ horizontal: 0.7 }));
        expect(revised.horizontal.displayIntensity).toBeCloseTo(0.7);
        expect(revised.hash).not.toBe(first.hash);
    });

    test('disabled directions remain invisible without mutating the other direction', () => {
        const resolver = new OrthogonalLinesFrameStateResolver();
        const state = resolver.resolve(0, 1, parameterMap({
            horizontal: 1,
            vertical: 0.4,
            horizontalEnabled: false,
        }), () => parameterMap());
        expect(state.horizontal.displayIntensity).toBe(0);
        expect(state.vertical.displayIntensity).toBeCloseTo(0.4);
    });
});
