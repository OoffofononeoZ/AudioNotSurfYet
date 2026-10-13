import { describe, expect, test } from 'vitest';
import { assertValidFeatureOrder, defaultFeatureOrder, isValidFeatureOrder, restoredFeatureOrder } from '../../src/analysis/featureOrder';
import { FEATURE_IDS } from '../../src/analysis/types';

describe('Analyzer persisted feature-order validation', () => {
    test('accepts only a complete unique twenty-one-feature permutation', () => {
        const order = defaultFeatureOrder();
        expect(isValidFeatureOrder(order)).toBe(true);
        expect(() => assertValidFeatureOrder(order)).not.toThrow();
        expect(isValidFeatureOrder(order.slice(0, -1))).toBe(false);
        expect(isValidFeatureOrder([...order.slice(0, -1), order[0]])).toBe(false);
        expect(isValidFeatureOrder([...order.slice(0, -1), 'unknown'])).toBe(false);
    });
    test('keeps V1 records readable and rejects damaged orders', () => {
        expect(restoredFeatureOrder(undefined)).toEqual(FEATURE_IDS);
        expect(restoredFeatureOrder([...FEATURE_IDS].reverse())).toEqual([...FEATURE_IDS].reverse());
        expect(() => restoredFeatureOrder([...FEATURE_IDS.slice(0, -1), FEATURE_IDS[0]])).toThrow(/all 21 unique features/);
    });
});
