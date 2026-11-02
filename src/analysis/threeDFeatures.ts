import type { FeatureId } from './types';

export const THREE_D_FEATURE_IDS = [
    'wallpaperEngineSpectrum',
    'amplitudeSpectrum',
    'powerSpectrum',
    'chroma',
    'loudness',
    'mfcc',
    'complexSpectrum',
] as const satisfies readonly FeatureId[];

export type ThreeDFeatureId = (typeof THREE_D_FEATURE_IDS)[number];
export type ChartMode = '2d' | '3d';

export interface AnalyzerPresentation {
    originalMode: ChartMode;
    threeDFeatureId: ThreeDFeatureId | null;
}

export const isThreeDFeature = (id: unknown): id is ThreeDFeatureId =>
    (THREE_D_FEATURE_IDS as readonly unknown[]).includes(id);

export const clonePresentation = (value?: AnalyzerPresentation): AnalyzerPresentation | undefined =>
    value ? { ...value } : undefined;

export function validatePresentation(value: unknown): asserts value is AnalyzerPresentation {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('3D 分析工作区无效。');
    const entry = value as AnalyzerPresentation;
    if (
        Object.keys(entry).some(key => !['originalMode', 'threeDFeatureId'].includes(key)) ||
        !['2d', '3d'].includes(entry.originalMode) ||
        (entry.threeDFeatureId !== null && !isThreeDFeature(entry.threeDFeatureId))
    )
        throw new TypeError('3D 分析工作区无效。');
}

export function presentationQueue(
    value: AnalyzerPresentation | undefined,
    original: readonly FeatureId[],
): FeatureId[] {
    return value?.originalMode === '3d' ? (value.threeDFeatureId ? [value.threeDFeatureId] : []) : [...original];
}
