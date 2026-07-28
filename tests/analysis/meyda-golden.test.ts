import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { buildGolden, GOLDEN_PATH } from './generate-golden';
import { assertMeydaValueClose } from '../support/tolerance';

interface GoldenCase {
    id: string;
    fixtureHash: string;
    expected: {
        rms: number;
        amplitudeSpectrum: number[];
        chroma: number[];
    };
}

interface GoldenFile {
    schemaVersion: number;
    meydaVersion: string;
    cases: GoldenCase[];
}

describe('direct Meyda golden baseline', () => {
    test('matches the committed first-slice golden values', async () => {
        const committed = JSON.parse(await readFile(GOLDEN_PATH, 'utf8')) as GoldenFile;
        const current = buildGolden();

        expect(committed.schemaVersion).toBe(1);
        expect(committed.meydaVersion).toBe('5.6.3');
        expect(committed.cases.map((entry) => entry.id)).toEqual(
            current.cases.map((entry) => entry.id),
        );

        committed.cases.forEach((entry, index) => {
            const currentEntry = current.cases[index];
            expect(currentEntry, entry.id).toBeDefined();
            expect(currentEntry!.fixtureHash, entry.id).toBe(entry.fixtureHash);
            assertMeydaValueClose(currentEntry!.expected.rms, entry.expected.rms, `${entry.id}.rms`);
            assertMeydaValueClose(
                currentEntry!.expected.amplitudeSpectrum,
                entry.expected.amplitudeSpectrum,
                `${entry.id}.amplitudeSpectrum`,
            );
            assertMeydaValueClose(
                currentEntry!.expected.chroma,
                entry.expected.chroma,
                `${entry.id}.chroma`,
            );
        });
    });

    test('keeps all first-slice values finite and dimensions fixed', () => {
        for (const entry of buildGolden().cases) {
            expect(Number.isFinite(entry.expected.rms), entry.id).toBe(true);
            expect(entry.expected.amplitudeSpectrum, entry.id).toHaveLength(512);
            expect(entry.expected.chroma, entry.id).toHaveLength(12);
            expect(entry.expected.amplitudeSpectrum.every(Number.isFinite), entry.id).toBe(true);
            expect(entry.expected.chroma.every(Number.isFinite), entry.id).toBe(true);
        }
    });
});
