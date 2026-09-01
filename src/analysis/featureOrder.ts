import {
    FEATURE_IDS,
    isFeatureId,
    type FeatureId,
} from './types';

export type FeatureOrderAction = 'up' | 'down' | 'first' | 'last';
export type FeatureDropEdge = 'before' | 'after';

export interface FeatureOrderRect {
    id: FeatureId;
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface FeatureDropTarget {
    featureId: FeatureId;
    edge: FeatureDropEdge;
}

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

export const isDefaultFeatureOrder = (order: readonly FeatureId[]): boolean =>
    isValidFeatureOrder(order)
    && order.every((featureId, index) => featureId === FEATURE_IDS[index]);

export const insertFeatureOrder = (
    current: readonly FeatureId[],
    sourceId: FeatureId,
    targetId: FeatureId,
    edge: FeatureDropEdge,
): FeatureId[] => {
    assertValidFeatureOrder(current);
    if (sourceId === targetId) return [...current];
    const withoutSource = current.filter((featureId) => featureId !== sourceId);
    const targetIndex = withoutSource.indexOf(targetId);
    if (targetIndex < 0) throw new TypeError('Feature order target is missing.');
    const insertionIndex = targetIndex + (edge === 'after' ? 1 : 0);
    return [
        ...withoutSource.slice(0, insertionIndex),
        sourceId,
        ...withoutSource.slice(insertionIndex),
    ];
};

export const moveFeatureOrder = (
    current: readonly FeatureId[],
    sourceId: FeatureId,
    action: FeatureOrderAction,
): FeatureId[] => {
    assertValidFeatureOrder(current);
    const index = current.indexOf(sourceId);
    if (index < 0) throw new TypeError('Feature order source is missing.');
    if (
        (action === 'up' && index === 0)
        || (action === 'down' && index === current.length - 1)
        || (action === 'first' && index === 0)
        || (action === 'last' && index === current.length - 1)
    ) return [...current];
    const withoutSource = current.filter((featureId) => featureId !== sourceId);
    const targetIndex = action === 'first'
        ? 0
        : action === 'last'
            ? withoutSource.length
            : action === 'up'
                ? index - 1
                : index + 1;
    return [
        ...withoutSource.slice(0, targetIndex),
        sourceId,
        ...withoutSource.slice(targetIndex),
    ];
};

const squaredDistanceToRect = (
    x: number,
    y: number,
    rect: FeatureOrderRect,
): number => {
    const dx = x < rect.left
        ? rect.left - x
        : x > rect.right
            ? x - rect.right
            : 0;
    const dy = y < rect.top
        ? rect.top - y
        : y > rect.bottom
            ? y - rect.bottom
            : 0;
    return dx * dx + dy * dy;
};

export const findFeatureDropTarget = (
    x: number,
    y: number,
    root: Omit<FeatureOrderRect, 'id'>,
    items: readonly FeatureOrderRect[],
    sourceId: FeatureId,
): FeatureDropTarget | null => {
    if (
        x < root.left
        || x > root.right
        || y < root.top
        || y > root.bottom
    ) return null;
    let target: FeatureOrderRect | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const item of items) {
        if (item.id === sourceId) continue;
        const candidate = squaredDistanceToRect(x, y, item);
        if (candidate < distance) {
            target = item;
            distance = candidate;
        }
    }
    if (!target) return null;
    return {
        featureId: target.id,
        edge: y < (target.top + target.bottom) / 2 ? 'before' : 'after',
    };
};
