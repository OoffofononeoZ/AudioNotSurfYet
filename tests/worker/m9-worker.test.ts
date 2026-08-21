import {
    describe,
    expect,
    test,
} from 'vitest';
import {
    decodeAnalysisSeries,
    encodeAnalysisSeries,
} from '../../src/analysis/compactCodec';
import { createAnalysisConfig } from '../../src/analysis/config';
import {
    extractCursorValue,
    runAnalysisJob,
} from '../../src/analysis/workerCore';
import type { AnalysisJobRequest } from '../../src/analysis/types';
import {
    createM9VectorPcm,
} from '../support/m9-vector-fixture';
import { SAMPLE_RATE } from '../support/audio-fixtures';

const request = async (
    featureIds: AnalysisJobRequest['featureIds'],
    pcm = createM9VectorPcm(),
): Promise<AnalysisJobRequest> => ({
    kind: 'analyze',
    jobId: 'm9-job',
    generation: 9,
    trackHash: 'm9-track',
    config: await createAnalysisConfig(SAMPLE_RATE),
    featureIds,
    cursorFeatureIds: featureIds,
    pcm: pcm.buffer.slice(0) as ArrayBuffer,
    durationSeconds: pcm.length / SAMPLE_RATE,
});

describe('M9 Worker and compact payload integration', () => {
    test('builds four mixed-shape series and round-trips the cache codec', async () => {
        const featureIds = ['powerSpectrum', 'mfcc', 'buffer', 'rms'] as const;
        const output = await runAnalysisJob(await request(featureIds), {
            yieldControl: async () => undefined,
        });
        expect(output.result.series.map((series) => series.featureId))
            .toEqual(featureIds);
        expect(output.result.series.map((series) => series.payload.kind))
            .toEqual([
                'frequency-u16',
                'category-u16',
                'waveform-envelope',
                'scalar-f32',
            ]);
        for (const series of output.result.series) {
            expect(decodeAnalysisSeries(encodeAnalysisSeries(series)))
                .toEqual(series);
        }
    });

    test('returns exact Power Spectrum, MFCC and zero-padded Buffer frames', async () => {
        const pcm = new Float32Array(1024 + 137);
        pcm[1024] = 0.8;
        pcm[1100] = -0.7;
        const analysisRequest = await request([
            'powerSpectrum',
            'mfcc',
            'buffer',
        ], pcm);
        const { retained } = await runAnalysisJob(analysisRequest, {
            yieldControl: async () => undefined,
        });
        const exact = (featureId: 'powerSpectrum' | 'mfcc' | 'buffer') =>
            extractCursorValue(retained, {
                kind: 'cursor-value',
                requestId: featureId,
                generation: 9,
                trackHash: 'm9-track',
                config: analysisRequest.config,
                featureId,
                timeSeconds: analysisRequest.durationSeconds,
            });
        expect(exact('powerSpectrum')?.value).toHaveLength(512);
        expect(exact('mfcc')?.value).toHaveLength(13);
        const buffer = exact('buffer')?.value as number[];
        expect(buffer).toHaveLength(1024);
        expect(buffer.filter((value) => value === 0).length).toBeGreaterThan(800);
        expect(extractCursorValue(retained, {
            kind: 'cursor-value',
            requestId: 'stale',
            generation: 8,
            trackHash: 'm9-track',
            config: analysisRequest.config,
            featureId: 'buffer',
            timeSeconds: 0,
        })).toBeNull();
    });

    test('keeps cancellation recoverable and M10 features closed', async () => {
        await expect(runAnalysisJob(await request(['buffer']), {
            isCancelled: () => true,
        })).rejects.toMatchObject({ code: 'cancelled', recoverable: true });
        await expect(runAnalysisJob(await request(['loudness'])))
            .rejects.toMatchObject({ code: 'unsupported-feature' });
        await expect(runAnalysisJob(await request(['complexSpectrum'])))
            .rejects.toMatchObject({ code: 'unsupported-feature' });
    });
});
