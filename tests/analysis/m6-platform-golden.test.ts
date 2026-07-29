import Meyda from 'meyda';
import {
    describe,
    expect,
    test,
} from 'vitest';
import { dequantizeUint16 } from '../../src/analysis/compactCodec';
import { createAnalysisConfig } from '../../src/analysis/config';
import {
    extractCursorValue,
    runAnalysisJob,
} from '../../src/analysis/workerCore';
import type {
    AnalysisJobRequest,
    AnalysisSeries,
} from '../../src/analysis/types';
import {
    createDualTone,
    createImpulse,
    createSilence,
    createSine,
    SAMPLE_RATE,
} from '../support/audio-fixtures';
import { assertMeydaValueClose } from '../support/tolerance';

interface DirectResult {
    rms: number;
    energy: number;
    amplitudeSpectrum: number[];
    chroma: number[];
}

const GOLDEN_FEATURE_IDS = [
    'rms',
    'energy',
    'amplitudeSpectrum',
    'chroma',
] as const;

const direct = (frame: Float32Array): DirectResult => {
    const runtime = Meyda as unknown as {
        bufferSize: number;
        sampleRate: number;
        windowingFunction: 'hanning';
        numberOfMFCCCoefficients: number;
        extract(
            features: string[],
            signal: Float32Array,
        ): {
            rms: number;
            energy: number;
            amplitudeSpectrum: Float32Array;
            chroma: number[];
        };
    };
    runtime.bufferSize = 1024;
    runtime.sampleRate = SAMPLE_RATE;
    runtime.windowingFunction = 'hanning';
    runtime.numberOfMFCCCoefficients = 13;
    const result = runtime.extract([
        'rms',
        'energy',
        'amplitudeSpectrum',
        'chroma',
    ], frame);
    return {
        rms: result.rms,
        energy: result.energy,
        amplitudeSpectrum: Array.from(result.amplitudeSpectrum),
        chroma: Array.from(result.chroma),
    };
};

const dequantized = (series: AnalysisSeries): Float32Array => {
    if (
        series.payload.kind !== 'frequency-u16'
        && series.payload.kind !== 'category-u16'
    ) {
        throw new TypeError('Expected quantized vector series.');
    }
    return dequantizeUint16(
        series.payload.values,
        series.payload.scale,
        series.payload.offset,
    );
};

describe('M6 platform golden against direct Meyda 5.6.3', () => {
    test.each([
        ['silence', createSilence(1024)],
        ['440hz-sine', createSine(440, 1024)],
        ['dual-tone', createDualTone(261.625565, 329.627557, 1024)],
        ['impulse', createImpulse(1024, 512)],
    ] as const)(
        'matches the representative four-feature contract for %s',
        async (_id, pcm) => {
            const config = await createAnalysisConfig(SAMPLE_RATE);
            const request: AnalysisJobRequest = {
                kind: 'analyze',
                jobId: 'golden',
                generation: 1,
                trackHash: 'golden-track',
                config,
                featureIds: GOLDEN_FEATURE_IDS,
                cursorFeatureIds: GOLDEN_FEATURE_IDS,
                pcm: pcm.buffer.slice(
                    pcm.byteOffset,
                    pcm.byteOffset + pcm.byteLength,
                ) as ArrayBuffer,
                durationSeconds: pcm.length / SAMPLE_RATE,
            };
            const expected = direct(pcm);
            const output = await runAnalysisJob(request);
            const byId = new Map(
                output.result.series.map((series) => [
                    series.featureId,
                    series,
                ]),
            );
            const rms = byId.get('rms');
            const energy = byId.get('energy');
            if (
                rms?.payload.kind !== 'scalar-f32'
                || energy?.payload.kind !== 'scalar-f32'
            ) {
                throw new TypeError('Expected scalar series.');
            }
            assertMeydaValueClose(rms.payload.values[0]!, expected.rms, 'rms');
            assertMeydaValueClose(
                energy.payload.values[0]!,
                expected.energy,
                'energy',
            );

            for (const featureId of [
                'amplitudeSpectrum',
                'chroma',
            ] as const) {
                const actualSeries = byId.get(featureId);
                if (!actualSeries) throw new Error(`Missing ${featureId}.`);
                const actual = dequantized(actualSeries);
                const expectedVector = expected[featureId];
                const payload = actualSeries.payload;
                if (
                    payload.kind !== 'frequency-u16'
                    && payload.kind !== 'category-u16'
                ) {
                    throw new TypeError('Expected a quantized vector.');
                }
                const scale = payload.scale;
                actual.forEach((value, index) => {
                    const directValue = expectedVector[index]!;
                    expect(
                        Math.abs(value - directValue),
                        `${featureId}[${index}]`,
                    ).toBeLessThanOrEqual(
                        scale / 2
                        + Math.max(1e-6, Math.abs(directValue) * 1e-5),
                    );
                });
            }

            for (const featureId of GOLDEN_FEATURE_IDS) {
                const cursor = extractCursorValue(output.retained, {
                    kind: 'cursor-value',
                    requestId: `cursor-${featureId}`,
                    generation: 1,
                    trackHash: 'golden-track',
                    config,
                    featureId,
                    timeSeconds: 0,
                });
                expect(cursor).not.toBeNull();
                assertMeydaValueClose(
                    cursor!.value as number | number[],
                    expected[featureId],
                    `cursor.${featureId}`,
                );
            }
        },
    );

    test('records Meyda spectralFlux as an M8-blocking dependency defect', async () => {
        const config = await createAnalysisConfig(SAMPLE_RATE);
        const runtime = Meyda as unknown as {
            bufferSize: number;
            sampleRate: number;
            windowingFunction: 'hanning';
            extract(
                feature: string,
                signal: Float32Array,
                previous: Float32Array,
            ): unknown;
        };
        runtime.bufferSize = config.frameSize;
        runtime.sampleRate = config.sampleRate;
        runtime.windowingFunction = config.windowingFunction;
        const current = createSine(440, 1024);
        const previous = createSine(220, 1024);
        expect(() => runtime.extract(
            'spectralFlux',
            current,
            previous,
        )).toThrow(/x is not defined/);
    });
});
