import Meyda from 'meyda';
import { expect, test, vi } from 'vitest';
import { createAnalysisConfig } from '../../src/analysis/config';
import { analysisFrameCount, createAnalysisFrame } from '../../src/analysis/frames';
import { getFeatureDefinition } from '../../src/analysis/featureRegistry';
import {
    complexMeydaValue,
    extractM10Frame,
    loudnessMeydaValue,
    scalarMeydaValue,
    vectorMeydaValue,
} from '../../src/analysis/meydaAdapter';
import { buildSeries } from '../../src/analysis/seriesBuilder';
import { SeriesAccumulator } from '../../src/analysis/seriesAccumulator';
import { runAnalysisJob } from '../../src/analysis/workerCore';
import type { FeatureId, M10FeatureId } from '../../src/analysis/types';

test('publishes the waveform before the remaining mixed-feature result and preserves cancellation', async () => {
    const config = await createAnalysisConfig(48000),
        pcm = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(i * 0.02));
    const input = {
        kind: 'analyze' as const,
        jobId: 'partial',
        generation: 1,
        trackHash: 'song',
        config,
        pcm: pcm.buffer,
        durationSeconds: 1,
        featureIds: ['buffer', 'mfcc'] as const,
        cursorFeatureIds: ['buffer', 'mfcc'] as const,
    };
    let partial: import('../../src/analysis/types').AnalysisSeries[] = [];
    const result = await runAnalysisJob(input, {
        onSeries: series => {
            partial = series;
        },
        yieldControl: async () => {},
    });
    expect(partial.map(s => s.featureId)).toEqual(['buffer']);
    expect(result.result.series[0]).toBe(partial[0]);
    let cancelled = false;
    await expect(
        runAnalysisJob(input, {
            onSeries: () => {
                cancelled = true;
            },
            isCancelled: () => cancelled,
            yieldControl: async () => {},
        }),
    ).rejects.toMatchObject({ code: 'cancelled' });
});

test.each([
    ['buffer', 'rms', 'energy', 'zcr'],
    ['amplitudeSpectrum', 'chroma', 'mfcc', 'powerSpectrum'],
    ['loudness', 'complexSpectrum', 'spectralFlux'],
])('streaming %j matches whole-song aggregation including the partial tail bucket', async (...names) => {
    const ids = names as M10FeatureId[],
        config = await createAnalysisConfig(48000);
    const pcm = Float32Array.from({ length: 6789 }, (_, i) => (i < 1024 ? 0 : Math.sin(i * 0.0576) * 0.3));
    const frames = analysisFrameCount(pcm.length),
        accumulators = ids.map(id => new SeriesAccumulator(id, config, frames));
    const scalars = new Map<FeatureId, number[]>(),
        vectors = new Map<FeatureId, number[][]>();
    const loudness: Array<{ total: number; specific: number[] }> = [],
        complex: Array<{ real: number[]; imag: number[] }> = [];
    let previous: number[] | undefined;
    for (let i = 0; i < frames; i++) {
        const extracted = extractM10Frame(ids, createAnalysisFrame(pcm, i, config), config, previous);
        previous = extracted.amplitudeSpectrum;
        for (const accumulator of accumulators) accumulator.push(extracted.values);
        for (const id of ids) {
            const def = getFeatureDefinition(id);
            if (def.outputShape === 'scalar') {
                const values = scalars.get(id) ?? [];
                values.push(scalarMeydaValue(extracted.values, id));
                scalars.set(id, values);
            } else if (id === 'loudness') loudness.push(loudnessMeydaValue(extracted.values));
            else if (id === 'complexSpectrum') complex.push(complexMeydaValue(extracted.values, 1024));
            else {
                const values = vectors.get(id) ?? [];
                values.push(vectorMeydaValue(extracted.values, id as 'buffer', def.dimensions(config)[0]!));
                vectors.set(id, values);
            }
        }
    }
    expect(accumulators.map(a => a.finish('song'))).toEqual(
        buildSeries({ trackHash: 'song', config }, ids, scalars, vectors, loudness, complex),
    );
});

test('time-domain-only requests avoid FFT and preserve direct Meyda values', async () => {
    const config = await createAnalysisConfig(48000),
        ids = ['buffer', 'rms', 'energy', 'zcr'] as const;
    Meyda.bufferSize = 1024;
    Meyda.sampleRate = 48000;
    Meyda.windowingFunction = 'hanning';
    for (const frame of [
        new Float32Array(1024),
        Float32Array.from({ length: 1024 }, (_, i) => Math.sin(i * 0.08) * 0.7),
    ]) {
        const direct = Meyda.extract([...ids], frame);
        const spy = vi.spyOn(Meyda, 'extract');
        try {
            expect(extractM10Frame(ids, frame, config).values).toEqual(direct);
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    }
});
