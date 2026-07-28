import { describe, expect, test } from 'vitest';
import {
    FORMAT_MASTER_SAMPLE_COUNT,
    SAMPLE_RATE,
    createDualTone,
    createFormatMaster,
    createImpulse,
    createSilence,
    createSine,
    sha256Float32,
} from '../support/audio-fixtures';

describe('deterministic PCM generators', () => {
    test('rebuilds the same format master', () => {
        const first = createFormatMaster();
        const second = createFormatMaster();

        expect(first).toHaveLength(FORMAT_MASTER_SAMPLE_COUNT);
        expect(sha256Float32(first)).toBe(sha256Float32(second));
        expect(first.slice(0, SAMPLE_RATE / 2).every((sample) => sample === 0)).toBe(true);
    });

    test('generates finite bounded signals', () => {
        const fixtures = [
            createSilence(),
            createSine(440),
            createDualTone(261.625565, 329.627557),
        ];

        for (const fixture of fixtures) {
            expect(Array.from(fixture).every(Number.isFinite)).toBe(true);
            expect(Math.max(...fixture)).toBeLessThanOrEqual(1);
            expect(Math.min(...fixture)).toBeGreaterThanOrEqual(-1);
        }
    });

    test.each([0, 511, 512, 1_023])('places an impulse at frame boundary %i', (position) => {
        const impulse = createImpulse(1_024, position);
        expect(impulse[position]).toBe(1);
        expect(Array.from(impulse).filter((sample) => sample !== 0)).toEqual([1]);
    });

    test('rejects an out-of-range impulse', () => {
        expect(() => createImpulse(1_024, 1_024)).toThrow(RangeError);
    });
});
