import { isStemRole, isStemFeature, type AnalysisSource } from './sources';
import type { StemRole } from '../processing/modelManifest';
import type { FeatureId } from './types';

export interface AnalyzerSourceWorkspace {
    selected: AnalysisSource;
    queues: Partial<Record<StemRole, FeatureId[]>>;
}
export function cloneSourceWorkspace(value: AnalyzerSourceWorkspace | undefined): AnalyzerSourceWorkspace | undefined {
    return value
        ? {
              selected: value.selected,
              queues: Object.fromEntries(Object.entries(value.queues).map(([role, ids]) => [role, [...ids]])),
          }
        : undefined;
}
export function validateSourceWorkspace(value: unknown): asserts value is AnalyzerSourceWorkspace {
    if (!value || typeof value !== 'object') throw Error('分析来源工作区无效。');
    const v = value as AnalyzerSourceWorkspace;
    if (
        Object.keys(v).some(k => !['selected', 'queues'].includes(k)) ||
        (v.selected !== 'original' && !isStemRole(v.selected)) ||
        !v.queues ||
        typeof v.queues !== 'object' ||
        Array.isArray(v.queues)
    )
        throw Error('分析来源工作区无效。');
    for (const [role, ids] of Object.entries(v.queues))
        if (
            !isStemRole(role) ||
            !Array.isArray(ids) ||
            ids.length > 4 ||
            new Set(ids).size !== ids.length ||
            ids.some(id => !isStemFeature(id))
        )
            throw Error('分轨置顶队列无效。');
}
