import { referencedLyrics } from './lyricCodec';
import { itemChildren, sceneGroups, elementScene, findScene3d, pruneSceneMembers, sceneUnits } from './scene3dModel';
import { referencedMedia } from './mediaCodec';
import { FEATURE_IDS, type FeatureId } from '../analysis/types';
import { analysisInputKey, validateAnalysisInputs, type AnalysisInput } from '../analysis/sources';
import { FT_ROLES } from '../processing/modelManifest';
import type { RangeEventV1 } from '../editor/types';
import { elementRegistry, findResource } from './elementRegistry';
import { mergeResources } from './resourceCodec';
import type { CompositionItem } from './resourceTypes';
import type { VisualizerElement, VisualizerProjectV6 } from './compositionTypes';
import { resourceKey } from './resourceIdentity';

export const elementDescriptor = (project: Pick<VisualizerProjectV6, 'resources'>, element: VisualizerElement) =>
    findResource(project.resources.elements, element.resource);
export const elementAlgorithm = (project: Pick<VisualizerProjectV6, 'resources'>, element: VisualizerElement) =>
    findResource(project.resources.algorithms, elementDescriptor(project, element).algorithm);
export const orderedElements = (elements: readonly VisualizerElement[]) =>
    elements
        .map((element, index) => ({ element, index }))
        .sort((a, b) => a.element.layer - b.element.layer || a.index - b.index)
        .map(e => e.element);
const effectiveCache = new WeakMap<object, VisualizerElement[]>();
export function effectiveElements(project: Pick<VisualizerProjectV6, 'elements' | 'items'>): VisualizerElement[] {
    let elements = effectiveCache.get(project);
    if (!elements) {
        const hidden = new Set(project.items.flatMap(i => (i.kind !== 'element' && !i.enabled ? i.children : [])));
        for (const scene of sceneGroups(project)) if (!scene.enabled) for (const id of scene.children) hidden.add(id);
        elements = project.elements.map(e => (hidden.has(e.id) ? { ...e, enabled: false } : e));
        effectiveCache.set(project, elements);
    }
    return elements;
}
export function synchronizeLayers(project: VisualizerProjectV6): VisualizerProjectV6 {
    const ids = project.items.flatMap(itemChildren),
        byId = new Map(project.elements.map(e => [e.id, e]));
    return {
        ...project,
        elements: ids.map((id, layer) => {
            const e = byId.get(id);
            if (!e) throw Error('分组引用无效。');
            return { ...e, layer };
        }),
    };
}
export function pruneCompositionResources(project: VisualizerProjectV6): VisualizerProjectV6 {
    const presets = new Set(project.items.flatMap(i => (i.kind === 'preset' ? [resourceKey(i.resource)] : [])));
    const definitions = project.resources.presets.filter(p => presets.has(resourceKey(p)));
    const elements = new Set([
        ...project.elements.map(e => resourceKey(e.resource)),
        ...definitions.flatMap(d => d.elements.map(e => resourceKey(e.element))),
    ]);
    const algorithms = new Set(
        project.resources.elements.filter(e => elements.has(resourceKey(e))).map(e => resourceKey(e.algorithm)),
    );
    return {
        ...project,
        ...(project.mediaAssets ? { mediaAssets: referencedMedia(project.elements, project.mediaAssets) } : {}),
        ...(project.lyricAssets ? { lyricAssets: referencedLyrics(project.elements, project.lyricAssets) } : {}),
        resources: {
            algorithms: project.resources.algorithms.filter(a => algorithms.has(resourceKey(a))),
            elements: project.resources.elements.filter(e => elements.has(resourceKey(e))),
            presets: definitions,
        },
    };
}
/** Explicit authoring helper, also used by fixtures; validation never invents membership or definitions. */
export function appendStandaloneElements(
    project: VisualizerProjectV6,
    elements: VisualizerElement[],
): VisualizerProjectV6 {
    return synchronizeLayers({
        ...project,
        elements: [...project.elements, ...elements],
        items: [
            ...project.items,
            ...elements.map(e => {
                const definition = elementRegistry.get(e.resource);
                return definition.scene3dDefaults
                    ? {
                          kind: 'scene3d' as const,
                          id: crypto.randomUUID(),
                          name: e.name + '场景',
                          enabled: true,
                          children: [e.id],
                          startSeconds: 0,
                          endSeconds: project.track.durationSeconds,
                          camera: structuredClone(definition.scene3dDefaults.camera),
                      }
                    : { kind: 'element' as const, id: e.id };
            }),
        ],
        resources: mergeResources(project.resources, {
            algorithms: elements.map(e =>
                findResource(elementRegistry.algorithms, elementRegistry.get(e.resource).algorithm),
            ),
            elements: elements.map(e => elementRegistry.get(e.resource)),
            presets: [],
        }),
    });
}
export function elementRange(
    project: Pick<VisualizerProjectV6, 'editorSnapshot'> & Partial<Pick<VisualizerProjectV6, 'items'>>,
    element: VisualizerElement,
): Pick<RangeEventV1, 'startSeconds' | 'endSeconds'> | null {
    const t = element.timing;
    if (t.kind === 'manual') {
        const scene =
            'items' in project ? elementScene(project as Pick<VisualizerProjectV6, 'items'>, element.id) : undefined;
        return scene
            ? {
                  startSeconds: Math.max(t.startSeconds, scene.startSeconds),
                  endSeconds: Math.min(t.endSeconds, scene.endSeconds),
              }
            : t;
    }
    if (t.kind === 'unbound') return null;
    const lane = project.editorSnapshot?.project.lanes.find(l => l.id === t.laneId);
    return lane?.eventKind === 'range' ? (lane.events.find(e => e.id === t.eventId) ?? null) : null;
}
export function planCompositionFeatures(project: VisualizerProjectV6, includeDisabled = false): FeatureId[] {
    return planCompositionInputs(project, includeDisabled)
        .filter(input => !input.stemRole)
        .map(input => input.featureId);
}
export function planCompositionInputs(project: VisualizerProjectV6, includeDisabled = false): AnalysisInput[] {
    const requested = new Map<string, AnalysisInput>();
    for (const e of includeDisabled ? project.elements : effectiveElements(project)) {
        if (!e.enabled && !includeDisabled) continue;
        for (const b of e.bindings)
            if (b.source.kind === 'analysis') {
                const input = {
                    featureId: b.source.featureId,
                    ...(b.source.stemRole ? { stemRole: b.source.stemRole } : {}),
                };
                requested.set(analysisInputKey(input), input);
            }
    }
    const result = [undefined, ...FT_ROLES].flatMap(stemRole =>
        FEATURE_IDS.flatMap(featureId => {
            const input = requested.get(analysisInputKey({ featureId, stemRole }));
            return input ? [input] : [];
        }),
    );
    validateAnalysisInputs(result);
    return result;
}
export function compositionIssues(project: VisualizerProjectV6): string[] {
    const issues: string[] = [];
    for (const e of effectiveElements(project).filter(e => e.enabled)) {
        if (Object.values(e.lyricBindings ?? {}).some(b => b.kind === 'unbound')) issues.push(e.name + '：歌词未配置');
        if (!elementRange(project, e)) issues.push(e.name + '：请选择范围标记');
        if (e.bindings.some(b => b.source.kind === 'unbound')) issues.push(e.name + '：输入未配置');
        if (Object.values(e.markerBindings ?? {}).some(b => b.kind === 'unbound'))
            issues.push(e.name + '：标记输入未配置');
        if (
            elementDescriptor(project, e).kind !== 'visual' &&
            e.targets?.kind !== 'composition' &&
            e.targets &&
            !e.targets.ids.length
        )
            issues.push(e.name + '：请选择影响对象');
    }
    return issues;
}
export function removeCompositionElement(project: VisualizerProjectV6, id: string): VisualizerProjectV6 {
    const result = structuredClone(project),
        group = result.items.find(i => i.kind === 'preset' && i.id === id);
    const scene = findScene3d(result, id);
    const removed = new Set(group?.kind === 'preset' ? group.children : scene ? scene.children : [id]);
    result.elements = result.elements.filter(e => !removed.has(e.id));
    result.items = result.items
        .filter(i => i.id !== id)
        .flatMap<CompositionItem>(i => {
            if (i.kind === 'element') return removed.has(i.id) ? [] : [i];
            pruneSceneMembers(i, removed);
            return i.children.length ? [i] : [];
        });
    for (const e of result.elements)
        if (e.targets?.kind === 'elements') e.targets.ids = e.targets.ids.filter(target => !removed.has(target));
        else if (e.targets?.kind === 'scenes3d') {
            const ids = new Set(sceneGroups(result).map(s => s.id));
            e.targets.ids = e.targets.ids.filter(id => ids.has(id));
        }
    return synchronizeLayers(result);
}
export function reorderComposition(
    project: VisualizerProjectV6,
    topFirstIds: readonly string[],
    parentId?: string,
): VisualizerProjectV6 {
    const result = structuredClone(project),
        group = parentId ? result.items.find(i => i.id === parentId && i.kind === 'preset') : null;
    const scene = parentId ? findScene3d(result, parentId) : undefined;
    if (scene) {
        if (
            topFirstIds.length !== scene.children.length ||
            new Set(topFirstIds).size !== scene.children.length ||
            topFirstIds.some(id => !scene.children.includes(id))
        )
            throw Error('场景排序无效。');
        const owner = result.items.find(i => i.kind === 'preset' && i.scenes3d?.some(s => s.id === scene.id));
        if (owner?.kind === 'preset') {
            const start = owner.children.indexOf(scene.children[0]!);
            owner.children.splice(start, scene.children.length, ...[...topFirstIds].reverse());
        }
        scene.children = [...topFirstIds].reverse();
        return synchronizeLayers(result);
    }
    if (parentId && group?.kind !== 'preset') throw Error('预设不存在。');
    const current =
        group?.kind === 'preset'
            ? sceneUnits(group.children, group.scenes3d ?? []).map(i => i.id)
            : result.items.map(i => i.id);
    if (
        topFirstIds.length !== current.length ||
        new Set(topFirstIds).size !== current.length ||
        topFirstIds.some(id => !current.includes(id))
    )
        throw Error('排序引用无效。');
    if (group?.kind === 'preset')
        group.children = [...topFirstIds]
            .reverse()
            .flatMap(id => group.scenes3d?.find(s => s.id === id)?.children ?? [id]);
    else result.items = [...topFirstIds].reverse().map(id => result.items.find(i => i.id === id)!);
    return synchronizeLayers(result);
}
