import {
    FEATURE_IDS,
    isFeatureId,
    type FeatureId,
} from './types';

export const defaultFeatureOrder = (): FeatureId[] => [...FEATURE_IDS];

export const isValidFeatureOrder = (value: unknown): value is FeatureId[] =>
    Array.isArray(value)
    && value.length === FEATURE_IDS.length
    && value.every(isFeatureId)
    && new Set(value).size === FEATURE_IDS.length;

export const assertValidFeatureOrder: (
    value: unknown,
) => asserts value is FeatureId[] = (value) => {
    if (!isValidFeatureOrder(value)) {
        throw new TypeError(
            `Feature order requires all ${FEATURE_IDS.length} unique features.`,
        );
    }
};

export const cloneFeatureOrder = (order: readonly FeatureId[]): FeatureId[] => {
    assertValidFeatureOrder(order);
    return [...order];
};

export const restoredFeatureOrder = (
    value: readonly FeatureId[] | undefined,
): FeatureId[] => value === undefined
    ? defaultFeatureOrder()
    : cloneFeatureOrder(value);
