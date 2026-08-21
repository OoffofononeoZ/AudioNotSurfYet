import { readFile } from 'node:fs/promises';
import {
    describe,
    expect,
    test,
} from 'vitest';
import {
    aggregateWaveform,
    dequantizeUint16,
    quantizeToUint16,
} from '../../src/analysis/compactCodec';
import { FEATURE_REGISTRY } from '../../src/analysis/featureRegistry';
import {
    extractM9Frame,
    vectorMeydaValue,
} from '../../src/analysis/meydaAdapter';
import {
    signedVectorMaximum,
    waveformEnvelopeAt,
} from '../../src/analysis/rendererData';
import {
    M9_AVAILABLE_FEATURE_IDS,
    M9_FEATURE_IDS,
} from '../../src/analysis/types';
import { M9_VECTOR_GOLDEN_PATH } from './generate-m9-vector-golden';
import {
    buildM9VectorGolden,
    createM9VectorFrames,
    M9_TEST_CONFIG,
} from '../support/m9-vector-fixture';
import { assertMeydaValueClose } from '../support/tolerance';

const assertVectorClose = (
    actual: readonly number[],
    expected: readonly number[],
    label: string,
) => {
    expect(actual, `${label}.length`).toHaveLength(expected.length);
    actual.forEach((value, index) => assertMeydaValueClose(
        value,
        expected[index] ?? Number.NaN,
        `${label}[${index}]`,
    ));
};

describe('M9 vector and waveform contract', () => {
    test('opens exactly three M9 features and 19 cumulative features', () => {
        expect(M9_FEATURE_IDS).toEqual(['powerSpectrum', 'mfcc', 'buffer']);
        expect(new Set(M9_AVAILABLE_FEATURE_IDS)).toHaveLength(19);
        expect(FEATURE_REGISTRY.powerSpectrum).toMatchObject({
            outputShape: 'frequency-vector',
            renderer: 'frequency-heatmap',
            workerSupported: true,
        });
        expect(FEATURE_REGISTRY.mfcc).toMatchObject({
            outputShape: 'category-vector',
            range: { signed: true },
            workerSupported: true,
        });
        expect(FEATURE_REGISTRY.buffer).toMatchObject({
            outputShape: 'waveform',
            renderer: 'waveform',
            workerSupported: true,
        });
    });

    test('matches direct Meyda vectors and the power-spectrum square relation', async () => {
        const committed = JSON.parse(
            await readFile(M9_VECTOR_GOLDEN_PATH, 'utf8'),
        ) as ReturnType<typeof buildM9VectorGolden>;
        expect(committed).toEqual(buildM9VectorGolden());

        createM9VectorFrames().forEach((fixture, caseIndex) => {
            const result = extractM9Frame(
                M9_FEATURE_IDS,
                fixture.frame,
                M9_TEST_CONFIG,
            ).values;
            const expected = committed.cases[caseIndex]!.expected;
            const power = vectorMeydaValue(
                result,
                'powerSpectrum',
                512,
            );
            const mfcc = vectorMeydaValue(result, 'mfcc', 13);
            const buffer = vectorMeydaValue(result, 'buffer', 1024);
            assertVectorClose(power, expected.powerSpectrum, `${fixture.id}.power`);
            assertVectorClose(mfcc, expected.mfcc, `${fixture.id}.mfcc`);
            assertVectorClose(buffer, expected.buffer, `${fixture.id}.buffer`);
            expected.powerSpectrum.forEach((value, index) => {
                assertMeydaValueClose(
                    value,
                    (expected.amplitudeSpectrum[index] ?? 0) ** 2,
                    `${fixture.id}.amplitude-squared[${index}]`,
                );
            });
        });
    });

    test('preserves signed MFCC quantization and waveform extrema', () => {
        const signed = [-4, -1, 0, 3];
        const quantized = quantizeToUint16(signed);
        const restored = dequantizeUint16(
            quantized.values,
            quantized.scale,
            quantized.offset,
        );
        [...restored].forEach((value, index) => {
            expect(value).toBeCloseTo(signed[index] ?? Number.NaN, 4);
        });
        expect(signedVectorMaximum(signed)).toBe(4);
        expect(() => signedVectorMaximum([Number.NaN])).toThrow(/finite/);

        const waveform = aggregateWaveform([
            [-1, 0.2, 0.5],
            [-0.4, 0.75],
        ], 2);
        expect(waveformEnvelopeAt({
            kind: 'waveform-envelope',
            ...waveform,
        }, 0).min).toBeCloseTo(-1, 4);
        expect(waveformEnvelopeAt({
            kind: 'waveform-envelope',
            ...waveform,
        }, 0).max).toBeCloseTo(0.75, 4);
    });

    test('fails explicitly for non-finite M9 vectors', () => {
        const frame = createM9VectorFrames()[1]!.frame.slice();
        frame[10] = Number.NaN;
        expect(() => extractM9Frame(['mfcc'], frame, M9_TEST_CONFIG))
            .toThrow(/invalid dimensions/);
    });

    test('encodes the intended power, timbre and impulse relationships', () => {
        const [, pure, rich, impulse] = buildM9VectorGolden().cases;
        const aboveThreshold = (values: readonly number[]) => {
            const maximum = Math.max(...values);
            return values.filter((value) => value > maximum * 0.05).length;
        };
        expect(aboveThreshold(rich!.expected.powerSpectrum))
            .toBeGreaterThan(aboveThreshold(pure!.expected.powerSpectrum));
        expect(rich!.expected.mfcc).not.toEqual(pure!.expected.mfcc);
        expect(Math.min(...impulse!.expected.buffer)).toBeLessThan(0);
        expect(Math.max(...impulse!.expected.buffer)).toBeGreaterThan(0);
    });
});
