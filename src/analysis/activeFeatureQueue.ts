import type { FeatureId } from './types';

export const MAX_ACTIVE_FEATURES = 4;

export interface ActiveFeatureQueueTransition {
    queue: FeatureId[];
    evictedFeatureId: FeatureId | null;
    expanded: boolean;
}

export const toggleActiveFeature = (
    current: readonly FeatureId[],
    featureId: FeatureId,
): ActiveFeatureQueueTransition => {
    const existingIndex = current.indexOf(featureId);
    if (existingIndex >= 0) {
        return {
            queue: current.filter((id) => id !== featureId),
            evictedFeatureId: null,
            expanded: false,
        };
    }

    const shouldEvict = current.length >= MAX_ACTIVE_FEATURES;
    const evictedFeatureId = shouldEvict ? current[0] ?? null : null;
    return {
        queue: [
            ...(shouldEvict ? current.slice(1) : current),
            featureId,
        ],
        evictedFeatureId,
        expanded: true,
    };
};
