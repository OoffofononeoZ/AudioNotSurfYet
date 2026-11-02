import { describe, expect, it } from 'vitest';
import {
    buildThreeDGrid,
    componentCount,
    componentLabel,
    componentPosition,
    componentValue,
    exactComponent,
} from '../../src/analysis/threeDData';
import type { AnalysisSeries, CompactPayload, AnalysisCursorValueResult } from '../../src/analysis/types';

const series = (payload: CompactPayload, featureId: AnalysisSeries['featureId'], sampleCount = 2): AnalysisSeries => ({
    schemaVersion: 1,
    trackHash: 'track',
    configHash: 'config',
    featureId,
    startTimeSeconds: 0,
    sampleStepSeconds: 1,
    sampleCount,
    dimensions: [payload.kind === 'complex-derived' ? payload.bins : 512],
    payload,
});
const viewport = { startSeconds: 0, endSeconds: 2, zoom: 1 };
const options = { view: 'magnitude' as const, selected: null, cancelled: () => false, yieldControl: async () => {} };

describe('3D display adapters', () => {
    it('preserves stereo ordering and values beyond one', () => {
        const values = new Float32Array(256);
        values[0] = 1.5;
        values[64] = 2.5;
        values[255] = 4;
        const data = series({ kind: 'stereo-spectrum-f32', width: 128, values }, 'wallpaperEngineSpectrum');
        expect(componentCount(data)).toBe(128);
        expect(componentValue(data, 0, 64, 'magnitude')).toBe(2.5);
        expect(componentValue(data, 1, 127, 'magnitude')).toBe(4);
        expect(componentLabel(data, 64, 44100)).toBe('右 R / 0');
        expect(values[64]).toBe(2.5);
    });
    it('decodes signed MFCC and retains real indices after overview grouping', async () => {
        const values = new Uint16Array(1024);
        values[1023] = 100;
        const data = series({ kind: 'category-u16', width: 1024, values, offset: -5, scale: 0.1 }, 'mfcc', 1);
        const grid = (await buildThreeDGrid(data, viewport, options))!;
        expect(grid.components).toHaveLength(256);
        expect(grid.min).toBe(-5);
        expect(grid.max).toBe(5);
        const slice = (await buildThreeDGrid(data, viewport, { ...options, selected: 1023 }))!;
        expect(slice.components).toEqual([1023]);
        expect(slice.values[0]).toBe(5);
    });
    it('separates total loudness and uses meaningful labels and frequencies', async () => {
        const data = series(
            {
                kind: 'loudness',
                bands: 24,
                total: new Float32Array([10, 20]),
                specific: new Uint16Array(48).fill(2),
                scale: 0.5,
                offset: 0,
            },
            'loudness',
        );
        const grid = (await buildThreeDGrid(data, viewport, options))!;
        expect(componentCount(data)).toBe(25);
        expect(componentValue(data, 1, 24, 'magnitude')).toBe(20);
        expect(componentPosition(24, 25, true) - componentPosition(23, 25, true)).toBeCloseTo(0.6);
        expect(grid.max).toBe(20);
        expect(componentLabel(data, 24, 44100)).toBe('总响度');
        expect(componentLabel({ ...data, featureId: 'chroma' }, 1, 44100)).toBe('C♯');
        expect(
            componentLabel(
                series(
                    { kind: 'frequency-u16', width: 512, values: new Uint16Array(1024), scale: 1, offset: 0 },
                    'amplitudeSpectrum',
                ),
                256,
                48000,
            ),
        ).toBe('256 · 12000 Hz');
    });
    it('keeps phase in radians and derives exact values from original real/imag', async () => {
        const data = series(
            {
                kind: 'complex-derived',
                bins: 4,
                magnitude: new Uint16Array(8).fill(5),
                phase: new Int16Array(8).fill(-32767),
                magnitudeScale: 2,
            },
            'complexSpectrum',
        );
        expect(componentValue(data, 0, 0, 'magnitude')).toBe(10);
        const grid = (await buildThreeDGrid(data, viewport, { ...options, view: 'phase' }))!;
        expect(grid.min).toBe(-Math.PI);
        expect(grid.max).toBe(Math.PI);
        expect(componentLabel(data, 3, 48000)).toBe('3 · -12000 Hz');
        const exact = { value: { real: [3], imag: [4] } } as AnalysisCursorValueResult;
        expect(exactComponent(exact, 0, 'magnitude')).toBe(5);
        expect(exactComponent(exact, 0, 'phase')).toBeCloseTo(Math.atan2(4, 3));
        expect(exactComponent(null, 0, 'magnitude')).toBeNull();
    });
    it('preserves both peaks and bounds a long visible interval without changing payload', async () => {
        const values = new Uint16Array(2000).fill(50);
        values[0] = 0;
        values[1] = 100;
        const data = series({ kind: 'category-u16', width: 1, values, offset: -5, scale: 0.1 }, 'mfcc', 2000);
        const grid = (await buildThreeDGrid(
            data,
            { startSeconds: 0, endSeconds: 2000, zoom: 1 },
            { ...options, selected: 0 },
        ))!;
        expect(grid.times.length).toBeLessThanOrEqual(512);
        expect(grid.minimums[0]).toBe(-5);
        expect(grid.maximums[0]).toBe(5);
        expect(values[0]).toBe(0);
        expect(values[1]).toBe(100);
        expect(await buildThreeDGrid(data, viewport, { ...options, cancelled: () => true })).toBeNull();
        expect(await buildThreeDGrid({ ...data, sampleCount: 0 }, viewport, options)).toBeNull();
    });
});
