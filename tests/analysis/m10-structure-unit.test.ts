import { readFile } from 'node:fs/promises';
import {
    describe,
    expect,
    test,
} from 'vitest';
import {
    aggregateComplex,
    decodeAnalysisSeries,
    encodeAnalysisSeries,
} from '../../src/analysis/compactCodec';
import { FEATURE_REGISTRY } from '../../src/analysis/featureRegistry';
import {
    complexMeydaValue,
    extractM10Frame,
    loudnessMeydaValue,
} from '../../src/analysis/meydaAdapter';
import {
    complexAt,
    loudnessAt,
    signedFftBinFrequency,
} from '../../src/analysis/rendererData';
import {
    M10_AVAILABLE_FEATURE_IDS,
    M10_FEATURE_IDS,
    type AnalysisSeries,
} from '../../src/analysis/types';
import { M10_STRUCTURE_GOLDEN_PATH } from './generate-m10-structure-golden';
import {
    buildM10StructureGolden,
    createM10StructureFrames,
    M10_TEST_CONFIG,
} from '../support/m10-structure-fixture';
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

const magnitude = (real: readonly number[], imag: readonly number[]) =>
    real.map((value, index) => Math.hypot(value, imag[index] ?? 0));

const dominantPositiveBin = (real: readonly number[], imag: readonly number[]) => {
    const magnitudes = magnitude(real, imag);
    let bin = 1;
    for (let index = 2; index < magnitudes.length / 2; index += 1) {
        if ((magnitudes[index] ?? 0) > (magnitudes[bin] ?? 0)) bin = index;
    }
    return bin;
};

describe('M10 structured feature contract', () => {
    test('opens the final two features and all 21 registry entries', () => {
        expect(M10_FEATURE_IDS).toEqual(['loudness', 'complexSpectrum']);
        expect(new Set(M10_AVAILABLE_FEATURE_IDS)).toHaveLength(21);
        expect(FEATURE_REGISTRY.loudness).toMatchObject({
            outputShape: 'loudness-structure',
            renderer: 'loudness',
            workerSupported: true,
        });
        expect(FEATURE_REGISTRY.complexSpectrum).toMatchObject({
            outputShape: 'complex-spectrum',
            renderer: 'complex-spectrum',
            workerSupported: true,
        });
        expect(FEATURE_REGISTRY.loudness.dimensions(M10_TEST_CONFIG))
            .toEqual([24, 1]);
        expect(FEATURE_REGISTRY.complexSpectrum.dimensions(M10_TEST_CONFIG))
            .toEqual([1024, 2]);
    });

    test('matches direct Meyda 5.6.3 structures and the committed golden', async () => {
        const committed = JSON.parse(
            await readFile(M10_STRUCTURE_GOLDEN_PATH, 'utf8'),
        ) as ReturnType<typeof buildM10StructureGolden>;
        expect(committed).toEqual(buildM10StructureGolden());

        createM10StructureFrames().forEach((fixture, caseIndex) => {
            const result = extractM10Frame(
                M10_FEATURE_IDS,
                fixture.frame,
                M10_TEST_CONFIG,
            ).values;
            const actualLoudness = loudnessMeydaValue(result);
            const actualComplex = complexMeydaValue(result, 1024);
            const expected = committed.cases[caseIndex]!.expected;
            assertMeydaValueClose(
                actualLoudness.total,
                expected.loudness.total,
                `${fixture.id}.loudness.total`,
            );
            assertVectorClose(
                actualLoudness.specific,
                expected.loudness.specific,
                `${fixture.id}.loudness.specific`,
            );
            assertVectorClose(
                actualComplex.real,
                expected.complexSpectrum.real,
                `${fixture.id}.complex.real`,
            );
            assertVectorClose(
                actualComplex.imag,
                expected.complexSpectrum.imag,
                `${fixture.id}.complex.imag`,
            );
        });
    });

    test('applies project zero semantics to both structured shapes', () => {
        const silence = createM10StructureFrames()[0]!.frame;
        const extracted = extractM10Frame(
            M10_FEATURE_IDS,
            silence,
            M10_TEST_CONFIG,
        ).values;
        expect(loudnessMeydaValue(extracted)).toEqual({
            total: 0,
            specific: Array.from({ length: 24 }, () => 0),
        });
        expect(complexMeydaValue(extracted, 1024)).toEqual({
            real: Array.from({ length: 1024 }, () => 0),
            imag: Array.from({ length: 1024 }, () => 0),
        });
    });

    test('keeps loudness total equal to its bands and moves dominance upward', () => {
        const golden = buildM10StructureGolden().cases;
        const low = golden.find((entry) => entry.id === 'low-tone')!;
        const high = golden.find((entry) => entry.id === 'high-tone')!;
        for (const entry of [low, high]) {
            expect(entry.expected.loudness.total).toBeCloseTo(
                entry.expected.loudness.specific.reduce(
                    (sum, value) => sum + value,
                    0,
                ),
                6,
            );
        }
        const dominantBand = (values: readonly number[]) => values.reduce(
            (best, value, index) => value > (values[best] ?? 0) ? index : best,
            0,
        );
        expect(dominantBand(high.expected.loudness.specific))
            .toBeGreaterThan(dominantBand(low.expected.loudness.specific));
    });

    test('preserves phase relations while keeping comparable magnitudes', () => {
        const golden = buildM10StructureGolden().cases;
        const phaseZero = golden.find((entry) => entry.id === 'phase-zero')!;
        const phaseQuarter = golden.find((entry) => entry.id === 'phase-quarter')!;
        const zeroComplex = phaseZero.expected.complexSpectrum;
        const quarterComplex = phaseQuarter.expected.complexSpectrum;
        const bin = dominantPositiveBin(zeroComplex.real, zeroComplex.imag);
        const zeroMagnitude = Math.hypot(
            zeroComplex.real[bin] ?? 0,
            zeroComplex.imag[bin] ?? 0,
        );
        const quarterMagnitude = Math.hypot(
            quarterComplex.real[bin] ?? 0,
            quarterComplex.imag[bin] ?? 0,
        );
        expect(quarterMagnitude / zeroMagnitude).toBeCloseTo(1, 1);
        const zeroPhase = Math.atan2(
            zeroComplex.imag[bin] ?? 0,
            zeroComplex.real[bin] ?? 0,
        );
        const quarterPhase = Math.atan2(
            quarterComplex.imag[bin] ?? 0,
            quarterComplex.real[bin] ?? 0,
        );
        const wrappedDifference = Math.atan2(
            Math.sin(quarterPhase - zeroPhase),
            Math.cos(quarterPhase - zeroPhase),
        );
        expect(Math.abs(wrappedDifference)).toBeCloseTo(Math.PI / 2, 1);

        const positive = golden.find((entry) => entry.id === 'positive-impulse')!;
        const negative = golden.find((entry) => entry.id === 'negative-impulse')!;
        assertVectorClose(
            magnitude(
                positive.expected.complexSpectrum.real,
                positive.expected.complexSpectrum.imag,
            ),
            magnitude(
                negative.expected.complexSpectrum.real,
                negative.expected.complexSpectrum.imag,
            ),
            'impulse-magnitude',
        );
        const impulseBin = 1;
        const positivePhase = Math.atan2(
            positive.expected.complexSpectrum.imag[impulseBin] ?? 0,
            positive.expected.complexSpectrum.real[impulseBin] ?? 0,
        );
        const negativePhase = Math.atan2(
            negative.expected.complexSpectrum.imag[impulseBin] ?? 0,
            negative.expected.complexSpectrum.real[impulseBin] ?? 0,
        );
        const impulsePhaseDifference = Math.atan2(
            Math.sin(negativePhase - positivePhase),
            Math.cos(negativePhase - positivePhase),
        );
        expect(Math.abs(impulsePhaseDifference)).toBeCloseTo(Math.PI, 4);
    });

    test('round-trips codecs, signed frequencies and circular phase', () => {
        const aggregated = aggregateComplex([
            { real: [-1], imag: [0.001] },
            { real: [-1], imag: [-0.001] },
        ], 2, 1);
        const series: AnalysisSeries = {
            schemaVersion: 1,
            trackHash: 'm10',
            configHash: 'm10',
            featureId: 'complexSpectrum',
            startTimeSeconds: 0,
            sampleStepSeconds: 1,
            sampleCount: 1,
            dimensions: [1, 2],
            payload: { kind: 'complex-derived', bins: 1, ...aggregated },
        };
        expect(decodeAnalysisSeries(encodeAnalysisSeries(series))).toEqual(series);
        const decoded = complexAt(series.payload as Extract<
            AnalysisSeries['payload'], { kind: 'complex-derived' }
        >, 0);
        expect(Math.abs(decoded.phase[0] ?? 0)).toBeCloseTo(Math.PI, 3);
        expect(signedFftBinFrequency(0, 1024, 48_000)).toBe(0);
        expect(signedFftBinFrequency(512, 1024, 48_000)).toBe(24_000);
        expect(signedFftBinFrequency(1023, 1024, 48_000)).toBeCloseTo(-46.875);

        const loudness = loudnessAt({
            kind: 'loudness',
            total: new Float32Array([3]),
            specific: new Uint16Array(24),
            bands: 24,
            scale: 0,
            offset: 0,
        }, 0);
        expect(loudness).toEqual({ total: 3, specific: Array(24).fill(0) });
    });

    test('fails explicitly for malformed or non-finite structures', () => {
        expect(() => loudnessMeydaValue({
            loudness: { total: Number.NaN, specific: new Float32Array(24) },
        } as never)).toThrow(/invalid structure/);
        expect(() => complexMeydaValue({
            complexSpectrum: {
                real: new Float32Array(1024),
                imag: [Number.POSITIVE_INFINITY],
            },
        } as never, 1024)).toThrow(/invalid dimensions/);
        const nonFiniteFrame = createM10StructureFrames()[1]!.frame.slice();
        nonFiniteFrame[10] = Number.NaN;
        expect(() => extractM10Frame(
            M10_FEATURE_IDS,
            nonFiniteFrame,
            M10_TEST_CONFIG,
        )).toThrow(/invalid/);
    });
});
