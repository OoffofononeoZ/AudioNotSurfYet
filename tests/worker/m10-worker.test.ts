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
import type {
    AnalysisJobRequest,
    ExactFeatureValue,
} from '../../src/analysis/types';
import {
    createSilence,
    createSine,
    SAMPLE_RATE,
} from '../support/audio-fixtures';

const request = async (
    featureIds: AnalysisJobRequest['featureIds'],
    pcm: Float32Array<ArrayBufferLike> = Float32Array.from([
        ...createSilence(1024),
        ...createSine(440, 2048, 0.35),
    ]),
): Promise<AnalysisJobRequest> => ({
    kind: 'analyze',
    jobId: 'm10-job',
    generation: 10,
    trackHash: 'm10-track',
    config: await createAnalysisConfig(SAMPLE_RATE),
    featureIds,
    cursorFeatureIds: featureIds,
    pcm: pcm.buffer.slice(0) as ArrayBuffer,
    durationSeconds: pcm.length / SAMPLE_RATE,
});

describe('M10 Worker and compact payload integration', () => {
    test('builds four mixed-shape series and round-trips both structured codecs', async () => {
        const featureIds = ['loudness', 'complexSpectrum', 'rms', 'buffer'] as const;
        const output = await runAnalysisJob(await request(featureIds), {
            yieldControl: async () => undefined,
        });
        expect(output.result.series.map((series) => series.featureId))
            .toEqual(featureIds);
        expect(output.result.series.map((series) => series.payload.kind))
            .toEqual([
                'loudness',
                'complex-derived',
                'scalar-f32',
                'waveform-envelope',
            ]);
        expect(output.result.series[0]?.dimensions).toEqual([24, 1]);
        expect(output.result.series[1]?.dimensions).toEqual([1024, 2]);
        for (const series of output.result.series) {
            expect(decodeAnalysisSeries(encodeAnalysisSeries(series)))
                .toEqual(series);
        }
    });

    test('returns unquantized exact structures and rejects stale requests', async () => {
        const analysisRequest = await request(['loudness', 'complexSpectrum']);
        const { retained } = await runAnalysisJob(analysisRequest, {
            yieldControl: async () => undefined,
        });
        const exact = (featureId: 'loudness' | 'complexSpectrum') =>
            extractCursorValue(retained, {
                kind: 'cursor-value',
                requestId: featureId,
                generation: 10,
                trackHash: 'm10-track',
                config: analysisRequest.config,
                featureId,
                timeSeconds: analysisRequest.durationSeconds,
            })?.value as ExactFeatureValue;
        const loudness = exact('loudness') as {
            total: number;
            specific: number[];
        };
        expect(Number.isFinite(loudness.total)).toBe(true);
        expect(loudness.specific).toHaveLength(24);
        const complex = exact('complexSpectrum') as {
            real: number[];
            imag: number[];
        };
        expect(complex.real).toHaveLength(1024);
        expect(complex.imag).toHaveLength(1024);
        expect([...complex.real, ...complex.imag].every(Number.isFinite)).toBe(true);

        expect(extractCursorValue(retained, {
            kind: 'cursor-value',
            requestId: 'stale',
            generation: 9,
            trackHash: 'm10-track',
            config: analysisRequest.config,
            featureId: 'loudness',
            timeSeconds: 0,
        })).toBeNull();
    });

    test('keeps silence deterministic and cancellation recoverable', async () => {
        const silenceRequest = await request(
            ['loudness', 'complexSpectrum'],
            createSilence(2048),
        );
        const { retained } = await runAnalysisJob(silenceRequest, {
            yieldControl: async () => undefined,
        });
        const cursorRequest = {
            kind: 'cursor-value' as const,
            requestId: 'silence',
            generation: 10,
            trackHash: 'm10-track',
            config: silenceRequest.config,
            timeSeconds: 0,
        };
        expect(extractCursorValue(retained, {
            ...cursorRequest,
            featureId: 'loudness',
        })?.value).toEqual({ total: 0, specific: Array(24).fill(0) });
        expect(extractCursorValue(retained, {
            ...cursorRequest,
            featureId: 'complexSpectrum',
        })?.value).toEqual({
            real: Array(1024).fill(0),
            imag: Array(1024).fill(0),
        });

        await expect(runAnalysisJob(await request(['complexSpectrum']), {
            isCancelled: () => true,
        })).rejects.toMatchObject({ code: 'cancelled', recoverable: true });
    });
});
