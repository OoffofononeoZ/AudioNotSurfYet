import { FEATURE_IDS, type FeatureId } from '../analysis/types';
import type { RangeEventV1 } from '../editor/types';
import { elementRegistry } from './elementRegistry';
import type { VisualizerElement, VisualizerProjectV3 } from './compositionTypes';

export const orderedElements = (elements: readonly VisualizerElement[]) =>
    elements.map((element, index) => ({ element, index }))
        .sort((a,b) => a.element.layer - b.element.layer || a.index - b.index).map(entry => entry.element);

export function elementRange(project: VisualizerProjectV3, element: VisualizerElement): Pick<RangeEventV1, 'startSeconds' | 'endSeconds'> | null {
    const t = element.timing;
    if (t.kind === 'manual') return t;
    if (t.kind === 'unbound') return null;
    const lane = project.editorSnapshot?.project.lanes.find(lane => lane.id === t.laneId);
    if (lane?.eventKind !== 'range') return null;
    return lane.events.find(event => event.id === t.eventId) ?? null;
}

export function planCompositionFeatures(project: VisualizerProjectV3, includeDisabled = false): FeatureId[] {
    const requested = new Set<FeatureId>();
    for (const e of project.elements) {
        if (!e.enabled && !includeDisabled) continue;
        for (const b of e.bindings) if (b.source.kind === 'analysis') requested.add(b.source.featureId);
    }
    const result = FEATURE_IDS.filter(id => requested.has(id));
    if (result.length > 4) throw new Error('一个工程最多使用四个不同的 Analyzer 特征。');
    return result;
}

export function compositionIssues(project: VisualizerProjectV3): string[] {
    const issues: string[] = [];
    for (const e of project.elements.filter(e => e.enabled)) {
        if (!elementRange(project,e)) issues.push(e.name + '：请选择范围标记');
        if (e.bindings.some(b => b.source.kind === 'unbound')) issues.push(e.name + '：输入未配置');
        if (elementRegistry.get(e.type).kind !== 'visual' && e.targets?.kind === 'elements' && !e.targets.ids.length)
            issues.push(e.name + '：请选择影响对象');
    }
    return issues;
}

export function removeCompositionElement(project: VisualizerProjectV3, id: string): VisualizerProjectV3 {
    const result = structuredClone(project);
    result.elements = result.elements.filter(e => e.id !== id);
    for (const e of result.elements) if (e.targets?.kind === 'elements') e.targets.ids = e.targets.ids.filter(target => target !== id);
    return result;
}

export function reorderComposition(project: VisualizerProjectV3, topFirstIds: readonly string[]): VisualizerProjectV3 {
    const result = structuredClone(project);
    if (topFirstIds.length !== result.elements.length || new Set(topFirstIds).size !== result.elements.length
        || topFirstIds.some(id => !result.elements.some(e => e.id === id))) throw new Error('元素排序引用无效。');
    for (const e of result.elements) e.layer = topFirstIds.length - 1 - topFirstIds.indexOf(e.id);
    return result;
}
