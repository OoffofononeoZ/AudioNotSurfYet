import { describe, expect, test } from 'vitest';
import {
    assertMeydaValueClose,
    withinMeydaTolerance,
} from '../support/tolerance';

describe('Meyda floating-point tolerance', () => {
    test('accepts values inside the absolute and relative boundaries', () => {
        expect(withinMeydaTolerance(0.000001, 0)).toBe(true);
        expect(withinMeydaTolerance(100.0009, 100)).toBe(true);
    });

    test('rejects values outside the approved tolerance', () => {
        expect(withinMeydaTolerance(0.000002, 0)).toBe(false);
        expect(withinMeydaTolerance(Number.NaN, 0)).toBe(false);
        expect(withinMeydaTolerance(Number.POSITIVE_INFINITY, 0)).toBe(false);
    });

    test('compares vectors and rejects dimension drift', () => {
        expect(() => assertMeydaValueClose([1, 2], [1, 2], 'vector')).not.toThrow();
        expect(() => assertMeydaValueClose([1], [1, 2], 'vector')).toThrow(RangeError);
    });
});
