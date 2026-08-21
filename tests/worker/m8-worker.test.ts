import {
    describe,
    expect,
    test,
} from 'vitest';
import { createAnalysisConfig } from '../../src/analysis/config';
import {
    extractCursorValue,
    runAnalysisJob,
} from '../../src/analysis/workerCore';
import type { AnalysisJobRequest } from '../../src/analysis/types';
import {
    createM8ScalarPcm,
    M8_SCALAR_FEATURE_IDS,
} from '../support/m8-scalar-fixture';
import { SAMPLE_RATE } from '../support/audio-fixtures';

const request = async (
    featureIds: AnalysisJobRequest['featureIds'],
): Promise<AnalysisJobRequest> => {
    const pcm = createM8ScalarPcm();
    return {
        kind: 'analyze',
        jobId: 'm8-job',
        generation: 8,
        trackHash: 'm8-track',
        config: await createAnalysisConfig(SAMPLE_RATE),
        featureIds,
        cursorFeatureIds: featureIds,
        pcm: pcm.buffer.slice(0) as ArrayBuffer,
        durationSeconds: pcm.length / SAMPLE_RATE,
    };
};

describe('M8 Worker integration', () => {
    test('returns four unique compact scalar series in one job', async () => {
        const featureIds = [
            'energy',
            'zcr',
            'spectralFlux',
            'spectralFlatness',
        ] as const;
        const output = await runAnalysisJob(await request(featureIds), {
            yieldControl: async () => undefined,
        });
        expect(output.result.series.map((series) => series.featureId))
            .toEqual(featureIds);
        for (const series of output.result.series) {
            expect(series.payload.kind).toBe('scalar-f32');
            if (series.payload.kind === 'scalar-f32') {
                expect(Array.from(series.payload.values).every(Number.isFinite))
                    .toBe(true);
            }
        }
    });

    test('extracts Flux exact cursor from current and previous frames', async () => {
        const analysisRequest = await request(['spectralFlux']);
        const { retained } = await runAnalysisJob(analysisRequest, {
            yieldControl: async () => undefined,
        });
        const first = extractCursorValue(retained, {
            kind: 'cursor-value',
            requestId: 'first',
            generation: 8,
            trackHash: 'm8-track',
            config: analysisRequest.config,
            featureId: 'spectralFlux',
            timeSeconds: 0,
        });
        expect(first?.value).toBe(0);

        const transition = extractCursorValue(retained, {
            kind: 'cursor-value',
            requestId: 'transition',
            generation: 8,
            trackHash: 'm8-track',
            config: analysisRequest.config,
            featureId: 'spectralFlux',
            timeSeconds: 3,
        });
        expect(transition?.value).toEqual(expect.any(Number));
        expect(transition?.value as number).toBeGreaterThan(0);
    });

    test('accepts all 13 scalars individually and rejects M10 structures', async () => {
        for (const featureId of M8_SCALAR_FEATURE_IDS) {
            await expect(runAnalysisJob(await request([featureId]), {
                yieldControl: async () => undefined,
            })).resolves.toBeDefined();
        }
        await expect(runAnalysisJob(await request(['loudness'])))
            .rejects.toMatchObject({ code: 'unsupported-feature' });
    }, 30_000);
});
