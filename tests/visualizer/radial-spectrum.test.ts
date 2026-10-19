import { sourceModule } from '../support/visualizer-assets.mjs';
const { createRadialSpectrumSampler, GeometricBatch, buildGeometricElement } = await import(
    /* @vite-ignore */ sourceModule('radial-spectrum', 'shared/geometry.js')
);
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { expect, test } from 'vitest';

import { createPresetElements } from '../../src/visualizer/compositionPresets';
import { parameterKey } from '../../src/visualizer/compositionEffects';
import type { VisualizerResolvedParameterMap } from '../../src/visualizer/rendererTypes';

test('silent and constant spectra remain exact, including circular closure', () => {
    for (const value of [0, 0.2, 0.6]) {
        const sample = createRadialSpectrumSampler(new Float32Array(128).fill(value));
        for (let i = -2; i <= 258; i++) expect(sample(i)).toBeCloseTo(value, 7);
        expect(sample(128)).toBe(sample(0));
        expect(sample(-1)).toBe(sample(127));
    }
});

test('long and short zero tails repeat exactly, including the original channel seam', () => {
    for (const length of [1, 4, 8, 24]) {
        const levels = Float32Array.from({ length: 128 }, (_, i) =>
                i % 64 >= 64 - length ? 0 : (64 - (i % 64)) / 128,
            ),
            sample = createRadialSpectrumSampler(levels);
        for (let i = -128; i < 384; i++) expect(sample(i)).toBe(levels[(i + 128) % 128]);
    }
});

test('interior silent ranges survive and separate channels are not replaced with invented energy', () => {
    const levels = Float32Array.from({ length: 128 }, (_, i) => (i < 64 && (i < 20 || i >= 45) ? 0.4 : 0)),
        sample = createRadialSpectrumSampler(levels);
    for (let i = 0; i < 128; i++) expect(sample(i)).toBe(levels[i]);
    expect(sample(24)).toBe(0);
    expect(sample(40)).toBe(0);
    expect(sample(96)).toBe(0);
    expect(sample(2)).toBeGreaterThan(0);
});

test('both preset rings close directly without changing their global expansion or determinism', () => {
    for (const e of createPresetElements('geometric-0.6', 10).filter(e => e.resource.id === 'radial-spectrum')) {
        e.bindings.find(b => b.parameterId === 'spectrum')!.source = {
            kind: 'constant',
            value: Array.from({ length: 512 }, (_, i) => (i < 320 ? 128 * Math.exp(-i / 80) : 0)),
        };
        const values: VisualizerResolvedParameterMap = new Map(
            e.bindings.map(b => [
                parameterKey(e.id, b.parameterId),
                {
                    parameterId: b.parameterId,
                    state: 'ready',
                    value: b.source.kind === 'constant' ? b.source.value : [],
                },
            ]),
        );
        const batch = new GeometricBatch(),
            levels = new Float32Array(128);
        const draw = () => {
            buildGeometricElement(
                batch,
                { ...e, type: elementRegistry.get(e.resource).algorithm.id },
                values,
                1,
                123,
                16 / 9,
                levels,
            );
            return batch.positions.slice(0, batch.count * 3);
        };
        const first = draw();
        expect([...first].every(Number.isFinite)).toBe(true);
        expect(draw()).toEqual(first);
        const a = [(first[0]! + first[15]!) / 2, (first[1]! + first[16]!) / 2];
        const last = batch.count * 3 - 18,
            b = [(first[last + 3]! + first[last + 6]!) / 2, (first[last + 4]! + first[last + 7]!) / 2];
        expect(b[0]).toBeCloseTo(a[0]!, 7);
        expect(b[1]).toBeCloseTo(a[1]!, 7);
        expect(Math.max(...levels)).toBeCloseTo(0.6);
    }
});
