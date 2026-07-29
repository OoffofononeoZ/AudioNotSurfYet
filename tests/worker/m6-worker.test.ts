import {
    describe,
    expect,
    test,
} from 'vitest';
import { createAnalysisConfig } from '../../src/analysis/config';
import {
    AnalysisWorkerCoreError,
    extractCursorValue,
    runAnalysisJob,
    validateAnalysisJobRequest,
} from '../../src/analysis/workerCore';
import type {
    AnalysisJobRequest,
    FeatureId,
} from '../../src/analysis/types';
import {
    createImpulse,
    createSine,
    SAMPLE_RATE,
} from '../support/audio-fixtures';

const request = async (
    featureIds: readonly FeatureId[],
    pcm = createSine(440, 4_096),
    generation = 1,
): Promise<AnalysisJobRequest> => ({
    kind: 'analyze',
    jobId: `job-${generation}`,
    generation,
    trackHash: 'track-hash',
    config: await createAnalysisConfig(SAMPLE_RATE),
    featureIds,
    cursorFeatureIds: featureIds,
    pcm: pcm.buffer.slice(
        pcm.byteOffset,
        pcm.byteOffset + pcm.byteLength,
    ) as ArrayBuffer,
    durationSeconds: pcm.length / SAMPLE_RATE,
});

describe('M6 Worker request contract', () => {
    test.each([
        { featureIds: [] as FeatureId[] },
        { featureIds: ['rms'] as FeatureId[] },
        {
            featureIds: [
                'rms',
                'energy',
                'amplitudeSpectrum',
                'chroma',
            ] as FeatureId[],
        },
    ])(
        'accepts $featureIds active features and returns finite compact series',
        async ({ featureIds }) => {
            const progress: Array<[number, number]> = [];
            const output = await runAnalysisJob(
                await request(featureIds),
                {
                    onProgress: (completed, total) => {
                        progress.push([completed, total]);
                    },
                    yieldControl: async () => undefined,
                },
            );
            expect(output.result.series.map(({ featureId }) => featureId))
                .toEqual(featureIds);
            expect(progress.at(-1)?.[0]).toBe(progress.at(-1)?.[1]);
            for (const series of output.result.series) {
                expect(series.sampleCount).toBeGreaterThan(0);
                expect(
                    series.sampleCount * series.sampleStepSeconds,
                ).toBeLessThanOrEqual(
                    4_096 / SAMPLE_RATE + series.sampleStepSeconds,
                );
            }
        },
    );

    test('rejects duplicate, five-item, unsupported and identity-invalid jobs', async () => {
        await expect(validateAnalysisJobRequest(
            await request(['rms', 'rms']),
        )).rejects.toMatchObject({ code: 'invalid-request' });
        await expect(validateAnalysisJobRequest(
            await request([
                'rms',
                'energy',
                'amplitudeSpectrum',
                'chroma',
                'zcr',
            ]),
        )).rejects.toMatchObject({ code: 'invalid-request' });
        await expect(validateAnalysisJobRequest(
            await request(['zcr']),
        )).rejects.toMatchObject({ code: 'unsupported-feature' });
        const missingCursorFeature = await request(['rms']);
        missingCursorFeature.cursorFeatureIds = [];
        await expect(validateAnalysisJobRequest(missingCursorFeature))
            .rejects.toMatchObject({ code: 'invalid-request' });

        const invalidHash = await request(['rms']);
        invalidHash.config = {
            ...invalidHash.config,
            configHash: 'wrong',
        };
        await expect(validateAnalysisJobRequest(invalidHash))
            .rejects.toMatchObject({ code: 'invalid-request' });

        const invalidDuration = await request(['rms']);
        invalidDuration.durationSeconds += 1;
        await expect(validateAnalysisJobRequest(invalidDuration))
            .rejects.toMatchObject({ code: 'invalid-request' });
    });

    test('reports monotonic progress, yields in bounded batches, and cancels cooperatively', async () => {
        const pcm = createSine(440, 1024 + 512 * 100);
        const progress: number[] = [];
        let yields = 0;
        await runAnalysisJob(await request(['rms'], pcm), {
            onProgress: (completed) => progress.push(completed),
            yieldControl: async () => {
                yields += 1;
            },
            now: () => 0,
        });
        expect(yields).toBeGreaterThanOrEqual(3);
        expect(progress).toEqual([...progress].sort((a, b) => a - b));
        expect(progress.at(-1)).toBe(101);

        let cancellationChecks = 0;
        await expect(runAnalysisJob(
            await request(['rms'], pcm),
            {
                isCancelled: () => ++cancellationChecks > 3,
                yieldControl: async () => undefined,
            },
        )).rejects.toEqual(expect.objectContaining({
            code: 'cancelled',
        } satisfies Partial<AnalysisWorkerCoreError>));
    });

    test('surfaces extract failures without returning a partial cache result', async () => {
        const pcm = createImpulse(1024, 0);
        pcm[10] = Number.NaN;
        await expect(runAnalysisJob(await request(['rms'], pcm)))
            .rejects.toMatchObject({ code: 'extract-failed' });
    });
});

describe('M6 exact cursor contract', () => {
    test('uses the last legal frame at duration and isolates stale identity', async () => {
        const pcm = createSine(440, 2_049);
        const analysisRequest = await request(
            ['rms', 'amplitudeSpectrum'],
            pcm,
            8,
        );
        const { retained } = await runAnalysisJob(analysisRequest, {
            yieldControl: async () => undefined,
        });
        const atDuration = extractCursorValue(retained, {
            kind: 'cursor-value',
            requestId: 'cursor-1',
            generation: 8,
            trackHash: 'track-hash',
            config: analysisRequest.config,
            featureId: 'rms',
            timeSeconds: analysisRequest.durationSeconds,
        });
        expect(atDuration?.frameStartSeconds).toBeCloseTo(
            3 * 512 / SAMPLE_RATE,
        );
        expect(typeof atDuration?.value).toBe('number');

        expect(extractCursorValue(retained, {
            kind: 'cursor-value',
            requestId: 'cursor-stale',
            generation: 9,
            trackHash: 'track-hash',
            config: analysisRequest.config,
            featureId: 'rms',
            timeSeconds: 0,
        })).toBeNull();
    });

    test('retains cursor features without recalculating cache hits', async () => {
        const pcm = createSine(440, 2_049);
        const analysisRequest = await request([], pcm, 9);
        analysisRequest.cursorFeatureIds = ['rms'];
        const { result, retained } = await runAnalysisJob(
            analysisRequest,
        );
        expect(result.series).toEqual([]);
        expect(extractCursorValue(retained, {
            kind: 'cursor-value',
            requestId: 'cursor-cache-hit',
            generation: 9,
            trackHash: 'track-hash',
            config: analysisRequest.config,
            featureId: 'rms',
            timeSeconds: 1,
        })?.featureId).toBe('rms');
    });
});
