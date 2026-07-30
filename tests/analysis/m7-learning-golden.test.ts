import { readFile } from 'node:fs/promises';
import {
    describe,
    expect,
    test,
} from 'vitest';
import {
    buildM7LearningGolden,
    type M7LearningGoldenCase,
} from '../support/m7-learning-fixture';
import { M7_LEARNING_GOLDEN_PATH } from './generate-m7-learning-golden';
import { assertMeydaValueClose } from '../support/tolerance';

const peakIndex = (values: readonly number[]): number =>
    values.reduce(
        (best, value, index) => value > values[best]! ? index : best,
        0,
    );

const caseById = (
    cases: readonly M7LearningGoldenCase[],
    id: string,
): M7LearningGoldenCase => {
    const result = cases.find((entry) => entry.id === id);
    if (!result) throw new Error(`Missing M7 golden case ${id}.`);
    return result;
};

describe('M7 versioned learning golden', () => {
    test('matches committed L1/L2/L3 direct-Meyda values', async () => {
        const committed = JSON.parse(
            await readFile(M7_LEARNING_GOLDEN_PATH, 'utf8'),
        ) as ReturnType<typeof buildM7LearningGolden>;
        const current = buildM7LearningGolden();
        expect(committed.schemaVersion).toBe(1);
        expect(committed.generatorVersion).toBe('m7-learning-fixtures-v1');
        expect(committed.meydaVersion).toBe('5.6.3');
        expect(committed.cases.map((entry) => entry.id))
            .toEqual(current.cases.map((entry) => entry.id));
        committed.cases.forEach((expected, index) => {
            const actual = current.cases[index]!;
            expect(actual.fixtureHash, expected.id)
                .toBe(expected.fixtureHash);
            assertMeydaValueClose(
                actual.expected.rms,
                expected.expected.rms,
                `${expected.id}.rms`,
            );
            assertMeydaValueClose(
                actual.expected.amplitudeSpectrum,
                expected.expected.amplitudeSpectrum,
                `${expected.id}.amplitudeSpectrum`,
            );
            assertMeydaValueClose(
                actual.expected.chroma,
                expected.expected.chroma,
                `${expected.id}.chroma`,
            );
        });
    });

    test('encodes the three intended learning relationships', () => {
        const cases = buildM7LearningGolden().cases;
        const l1Low = caseById(cases, 'l1-a4-low');
        const l1High = caseById(cases, 'l1-a4-high');
        expect(l1High.expected.rms / l1Low.expected.rms)
            .toBeCloseTo(3, 5);
        expect(peakIndex(l1Low.expected.amplitudeSpectrum))
            .toBe(peakIndex(l1High.expected.amplitudeSpectrum));
        expect(peakIndex(l1Low.expected.chroma))
            .toBe(peakIndex(l1High.expected.chroma));

        const l2Ce = caseById(cases, 'l2-c4-e4');
        const l2Gb = caseById(cases, 'l2-g4-b4');
        expect(peakIndex(l2Ce.expected.amplitudeSpectrum))
            .not.toBe(peakIndex(l2Gb.expected.amplitudeSpectrum));
        expect(peakIndex(l2Ce.expected.chroma))
            .not.toBe(peakIndex(l2Gb.expected.chroma));
        expect(Math.abs(l2Ce.expected.rms - l2Gb.expected.rms))
            .toBeLessThan(0.02);

        const l3Sine = caseById(cases, 'l3-a4-sine');
        const l3Rich = caseById(cases, 'l3-a4-harmonic-rich');
        expect(Math.abs(l3Sine.expected.rms - l3Rich.expected.rms))
            .toBeLessThan(0.001);
        const sineBins = l3Sine.expected.amplitudeSpectrum.filter(
            (value) => value > 1,
        ).length;
        const richBins = l3Rich.expected.amplitudeSpectrum.filter(
            (value) => value > 1,
        ).length;
        expect(richBins).toBeGreaterThan(sineBins);
        expect(peakIndex(l3Sine.expected.chroma))
            .toBe(peakIndex(l3Rich.expected.chroma));
    });
});
