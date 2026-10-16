import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import { FEATURE_IDS, type FeatureId } from '../analysis/types';
import type { SceneParameterDescriptor } from './parameterDescriptor';
import type {
    VisualizerAnalysisComponent,
    VisualizerAnalysisProjectionV1,
    VisualizerNumericTransformV1,
    VisualizerParameterBindingV1,
} from './types';

export const analysisComponentsForFeature = (
    featureId: FeatureId,
): VisualizerAnalysisComponent[] => {
    const shape = FEATURE_REGISTRY[featureId].outputShape;
    if (shape === 'loudness-structure') return ['total', 'specific'];
    if (shape === 'complex-spectrum') {
        return ['real', 'imag', 'magnitude', 'phase'];
    }
    return ['default'];
};

export const analysisComponentIsVector = (
    featureId: FeatureId,
    component: VisualizerAnalysisComponent,
): boolean => {
    const shape = FEATURE_REGISTRY[featureId].outputShape;
    if (shape === 'scalar') return false;
    if (shape === 'loudness-structure') return component === 'specific';
    return true;
};

export const analysisVectorLength = (
    featureId: FeatureId,
    component: VisualizerAnalysisComponent,
): number => {
    if (!analysisComponentIsVector(featureId, component)) return 0;
    if (featureId === 'loudness') return 24;
    if (featureId === 'complexSpectrum') return 1024;
    if (featureId === 'chroma') return 12;
    if (featureId === 'mfcc') return 13;
    if (featureId === 'buffer') return 1024;
    if (featureId === 'wallpaperEngineSpectrum') return 128;
    return 512;
};

export const compatibleAnalysisFeatures = (
    parameter: SceneParameterDescriptor,
): FeatureId[] => FEATURE_IDS.filter((featureId) => {
    const components = analysisComponentsForFeature(featureId);
    return components.some((component) => {
        if (!parameter.allowedAnalysisComponents?.includes(component)) return false;
        const vector = analysisComponentIsVector(featureId, component);
        if (parameter.valueKind === 'vector') {
            return vector
                && (parameter.allowedAnalysisProjections?.includes('full') ?? false);
        }
        if (parameter.valueKind !== 'number') return false;
        return parameter.allowedAnalysisProjections?.some((kind) =>
            vector ? kind !== 'scalar' && kind !== 'full' : kind === 'scalar') ?? false;
    });
});

export const compatibleAnalysisProjections = (
    parameter: SceneParameterDescriptor,
    featureId: FeatureId,
    component: VisualizerAnalysisComponent,
): VisualizerAnalysisProjectionV1['kind'][] => {
    const vector = analysisComponentIsVector(featureId, component);
    return (parameter.allowedAnalysisProjections ?? []).filter((kind) => {
        if (parameter.valueKind === 'vector') return vector && kind === 'full';
        if (parameter.valueKind !== 'number') return false;
        return vector ? kind !== 'scalar' && kind !== 'full' : kind === 'scalar';
    });
};

export const createProjection = (
    kind: VisualizerAnalysisProjectionV1['kind'],
): VisualizerAnalysisProjectionV1 => {
    if (kind === 'bin') return { kind, index: 0 };
    if (kind === 'band') return { kind, start: 0, end: 1 };
    return { kind };
};

export const defaultAnalysisSelection = (
    parameter: SceneParameterDescriptor,
    featureId: FeatureId,
): {
    component: VisualizerAnalysisComponent;
    projection: VisualizerAnalysisProjectionV1;
} => {
    const components = analysisComponentsForFeature(featureId).filter(
        (component) => parameter.allowedAnalysisComponents?.includes(component),
    );
    const component = components.find((entry) =>
        parameter.valueKind === 'vector'
            ? analysisComponentIsVector(featureId, entry)
            : !analysisComponentIsVector(featureId, entry))
        ?? components[0];
    if (!component) throw new Error('该特征没有兼容的分析分量。');
    const projections = compatibleAnalysisProjections(
        parameter,
        featureId,
        component,
    );
    const preferred = projections.includes('mean')
        ? 'mean'
        : projections[0];
    if (!preferred) throw new Error('该参数没有兼容的分析投影。');
    return { component, projection: createProjection(preferred) };
};

export const defaultNumericTransform = (
    parameter: SceneParameterDescriptor,
    featureId?: FeatureId,
): VisualizerNumericTransformV1 => {
    if (parameter.valueKind !== 'number' || !parameter.range) {
        throw new Error('只有数值参数可以建立数值映射。');
    }
    const featureRange = featureId ? FEATURE_REGISTRY[featureId].range : undefined;
    const finiteRegistryRange = Number.isFinite(featureRange?.min)
        && Number.isFinite(featureRange?.max)
        && (featureRange?.max ?? 0) > (featureRange?.min ?? 0);
    return {
        inputMin: finiteRegistryRange ? featureRange!.min! : 0,
        inputMax: finiteRegistryRange ? featureRange!.max! : 1,
        outputMin: typeof parameter.defaultValue === 'number'
            ? parameter.defaultValue
            : parameter.range.min,
        outputMax: parameter.range.max,
        clamp: true,
        invert: false,
        attackSeconds: 0,
        releaseSeconds: 0,
    };
};

export const createDefaultAnalysisBinding = (
    parameter: SceneParameterDescriptor,
    featureId: FeatureId,
): VisualizerParameterBindingV1 => {
    const selection = defaultAnalysisSelection(parameter, featureId);
    return {
        parameterId: parameter.id,
        source: {
            kind: 'analysis',
            featureId,
            ...(selection.component === 'default'
                ? {}
                : { component: selection.component }),
            projection: selection.projection,
        },
        ...(parameter.valueKind === 'number'
            ? { transform: defaultNumericTransform(parameter, featureId) }
            : {}),
    };
};
