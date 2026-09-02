import { FEATURE_IDS, type FeatureId } from '../analysis/types';
import type { VisualizerProjectV1 } from './types';

export class VisualizerBindingPlannerError extends Error {
    readonly code = 'analysis-feature-limit' as const;
    readonly featureIds: readonly FeatureId[];

    constructor(featureIds: readonly FeatureId[]) {
        super('一个场景最多使用四个不同的分析特征。');
        this.name = 'VisualizerBindingPlannerError';
        this.featureIds = [...featureIds];
    }
}

export const planVisualizerFeatures = (
    project: VisualizerProjectV1,
): FeatureId[] => {
    const requested = new Set<FeatureId>();
    for (const binding of project.scene.bindings) {
        if (binding.source.kind === 'analysis') {
            requested.add(binding.source.featureId);
        }
    }
    const ordered = FEATURE_IDS.filter((featureId) => requested.has(featureId));
    if (ordered.length > 4) throw new VisualizerBindingPlannerError(ordered);
    return ordered;
};

export const wouldExceedVisualizerFeatureLimit = (
    project: VisualizerProjectV1,
    featureId: FeatureId,
    parameterId: string,
): boolean => {
    const requested = new Set<FeatureId>();
    for (const binding of project.scene.bindings) {
        if (
            binding.parameterId !== parameterId
            && binding.source.kind === 'analysis'
        ) requested.add(binding.source.featureId);
    }
    requested.add(featureId);
    return requested.size > 4;
};
