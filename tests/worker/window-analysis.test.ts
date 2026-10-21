import { expect, test } from 'vitest';
import { createAnalysisConfig } from '../../src/analysis/config';
import { extractWindowSeries } from '../../src/analysis/windowAnalysis';
import { extractCursorValue, type RetainedAnalysisPcm } from '../../src/analysis/workerCore';
import { FEATURE_IDS, type FeatureId } from '../../src/analysis/types';
import {
    vectorAt,
    loudnessAt,
    complexAt,
    cursorSampleIndex,
    visibleSampleRange,
} from '../../src/analysis/rendererData';
import { plotColumns } from '../../src/analysis/renderGeometry';
import type { AnalysisWindowRequest } from '../../src/analysis/windowTypes';

async function source(sampleRate = 48000): Promise<RetainedAnalysisPcm> {
    const pcm = Float32Array.from(
        { length: sampleRate * 2 },
        (_, i) => Math.sin((i * 440 * Math.PI * 2) / sampleRate) * (i < sampleRate ? 0.1 : 0.8),
    );
    return {
        generation: 3,
        trackHash: 'track',
        config: await createAnalysisConfig(sampleRate),
        pcm,
        durationSeconds: 2,
        featureIds: FEATURE_IDS,
    };
}
function request(retained: RetainedAnalysisPcm, featureId: FeatureId): AnalysisWindowRequest {
    return {
        kind: 'window-series',
        requestId: 'window',
        generation: retained.generation,
        trackHash: retained.trackHash,
        configHash: retained.config.configHash,
        featureId,
        startSeconds: 1.1,
        endSeconds: 1.3,
        waveformBucketSamples: 16,
    };
}
const hooks = { yieldControl: async () => {} };

test.each([44100, 48000, 96000])('window features retain the native frame clock at %i Hz', async rate => {
    const retained = await source(rate),
        input = request(retained, 'rms');
    const series = (await extractWindowSeries(retained, input, hooks))!;
    expect(series.sampleStepSeconds).toBe(512 / rate);
    expect(series.startTimeSeconds).toBeGreaterThan(1);
    expect(series.sampleCount).toBeGreaterThan(10);
    const index = 2;
    const exact = extractCursorValue(retained, {
        ...input,
        kind: 'cursor-value',
        config: retained.config,
        timeSeconds: series.startTimeSeconds + (index + 0.1) * series.sampleStepSeconds,
    });
    expect(series.payload.kind).toBe('scalar-f32');
    if (series.payload.kind === 'scalar-f32')
        expect(series.payload.values[index]).toBeCloseTo(exact!.value as number, 6);
    expect(cursorSampleIndex(series, series.startTimeSeconds + index * series.sampleStepSeconds + 1e-8)).toBe(index);
    const viewport = { startSeconds: series.startTimeSeconds, endSeconds: series.startTimeSeconds + 0.1, zoom: 1 };
    expect(visibleSampleRange(series, viewport).startIndex).toBe(0);
    expect(plotColumns(series, viewport, 1000)[0]!.left).toBe(0);
});

test.each(['spectralFlux', 'amplitudeSpectrum', 'chroma', 'mfcc', 'loudness', 'complexSpectrum'] as const)(
    '%s window agrees with exact extraction including previous-frame dependencies',
    async feature => {
        const retained = await source(),
            input = request(retained, feature);
        const series = (await extractWindowSeries(retained, input, hooks))!;
        const index = 3;
        const exact = extractCursorValue(retained, {
            ...input,
            kind: 'cursor-value',
            config: retained.config,
            timeSeconds: series.startTimeSeconds + (index + 0.1) * series.sampleStepSeconds,
        })!.value;
        const payload = series.payload;
        if (payload.kind === 'scalar-f32') expect(payload.values[index]).toBeCloseTo(exact as number, 5);
        else if (payload.kind === 'frequency-u16' || payload.kind === 'category-u16') {
            const actual = vectorAt(payload, index),
                expected = exact as number[];
            actual.forEach((value, i) =>
                expect(Math.abs(value - expected[i]!)).toBeLessThanOrEqual(payload.scale + 1e-6),
            );
        } else if (
            payload.kind === 'loudness' &&
            typeof exact === 'object' &&
            !Array.isArray(exact) &&
            'specific' in exact
        ) {
            const actual = loudnessAt(payload, index);
            expect(actual.total).toBeCloseTo(exact.total, 5);
            actual.specific.forEach((value, i) =>
                expect(Math.abs(value - exact.specific[i]!)).toBeLessThanOrEqual(payload.scale + 1e-6),
            );
        } else if (
            payload.kind === 'complex-derived' &&
            typeof exact === 'object' &&
            !Array.isArray(exact) &&
            'real' in exact
        ) {
            const actual = complexAt(payload, index);
            let peak = 0;
            exact.real.forEach((real, i) => {
                if (Math.hypot(real, exact.imag[i]!) > Math.hypot(exact.real[peak]!, exact.imag[peak]!)) peak = i;
            });
            expect(
                Math.abs(actual.magnitude[peak]! - Math.hypot(exact.real[peak]!, exact.imag[peak]!)),
            ).toBeLessThanOrEqual(payload.magnitudeScale + 1e-5);
            expect(actual.phase[peak]).toBeCloseTo(Math.atan2(exact.imag[peak]!, exact.real[peak]!), 3);
        } else throw Error('unexpected payload');
    },
);

test('PCM envelopes preserve impulses and refine to individual source samples without a 1024-sample blur', async () => {
    const retained = await source();
    retained.pcm.fill(0);
    retained.pcm[48003] = 1;
    retained.pcm[48006] = -0.5;
    const input = { ...request(retained, 'buffer'), startSeconds: 1, endSeconds: 1.02 };
    const wide = (await extractWindowSeries(retained, input, hooks))!;
    const fine = (await extractWindowSeries(retained, { ...input, waveformBucketSamples: 1 }, hooks))!;
    expect(fine.sampleCount).toBe(wide.sampleCount * 16);
    if (wide.payload.kind !== 'waveform-envelope' || fine.payload.kind !== 'waveform-envelope') throw Error();
    expect(wide.payload.max[0]! * wide.payload.scale).toBe(1);
    expect(fine.payload.max[3]! * fine.payload.scale).toBe(1);
    expect(fine.payload.min[6]! * fine.payload.scale).toBeCloseTo(-0.5, 4);
    expect(fine.payload.max[2]).toBe(0);
    expect(fine.sampleStepSeconds).toBe(1 / 48000);
});

test('invalid identities, native Wallpaper data, and cancelled work return no window', async () => {
    const retained = await source(),
        input = request(retained, 'rms');
    for (const invalid of [
        { generation: 2 },
        { trackHash: 'old' },
        { configHash: 'old' },
        { startSeconds: Infinity },
        { waveformBucketSamples: 0 },
        { featureId: 'wallpaperEngineSpectrum' as const },
    ]) {
        expect(await extractWindowSeries(retained, { ...input, ...invalid }, hooks)).toBeNull();
    }
    let cancelled = false;
    expect(
        await extractWindowSeries(
            retained,
            { ...input, endSeconds: 2 },
            {
                isCancelled: () => cancelled,
                yieldControl: async () => {
                    cancelled = true;
                },
            },
        ),
    ).toBeNull();
});
