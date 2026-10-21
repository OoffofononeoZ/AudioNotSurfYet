import type { FeatureId } from './types';
import { FT_ROLES, type StemRole } from '../processing/modelManifest';

export type AnalysisSource = 'original' | StemRole;
export interface AnalysisInput {
    featureId: FeatureId;
    stemRole?: StemRole;
}
export const STEM_FEATURE_IDS = [
    'wallpaperEngineSpectrum',
    'energy',
    'amplitudeSpectrum',
    'buffer',
] as const satisfies readonly FeatureId[];
export const isStemRole = (value: unknown): value is StemRole =>
    typeof value === 'string' && (FT_ROLES as readonly string[]).includes(value);
export const isStemFeature = (value: unknown): value is (typeof STEM_FEATURE_IDS)[number] =>
    (STEM_FEATURE_IDS as readonly unknown[]).includes(value);
export const analysisInputKey = (input: AnalysisInput): string => `${input.stemRole ?? 'original'}:${input.featureId}`;

export function validateAnalysisInputs(inputs: readonly AnalysisInput[]): void {
    const groups = new Map<string, Set<FeatureId>>();
    for (const input of inputs) {
        if (input.stemRole !== undefined && (!isStemRole(input.stemRole) || !isStemFeature(input.featureId)))
            throw Error('分轨仅支持 energy、幅度谱、buffer 和 Wallpaper Engine 频谱。');
        const key = input.stemRole ?? 'original',
            group = groups.get(key) ?? new Set();
        group.add(input.featureId);
        groups.set(key, group);
        if (group.size > 4) throw Error('每个来源最多使用四种分析特征。');
    }
}
