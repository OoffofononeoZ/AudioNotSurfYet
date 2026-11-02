import type { VisualizerProjectV6 } from './compositionTypes';
import type { PresetInstance } from './resourceTypes';
import { compositionList, type CompositionListNode } from './compositionList';
import { synchronizeLayers } from './compositionModel';
import { findScene3d } from './scene3dModel';

/** Positions use the displayed, top-first order. Null parent means root; null before means the end. */
export interface CompositionMove {
    id: string;
    parentId: string | null;
    beforeId: string | null;
}
export type CompositionDropPosition = 'before' | 'inside' | 'after';
interface Location {
    node: CompositionListNode;
    parentId: string | null;
    siblings: CompositionListNode[];
}
function locations(project: VisualizerProjectV6) {
    const result = new Map<string, Location>();
    const visit = (nodes: CompositionListNode[], parentId: string | null) => {
        for (const node of nodes) {
            result.set(node.id, { node, parentId, siblings: nodes });
            visit(node.children, node.id);
        }
    };
    visit(compositionList(project), null);
    return result;
}
function resolveMove(project: VisualizerProjectV6, request: CompositionMove) {
    const index = locations(project),
        source = index.get(request.id);
    if (!source) throw Error('移动的列表项不存在。');
    const parent = request.parentId === null ? null : index.get(request.parentId);
    if (request.parentId !== null && (!parent || parent.node.kind === 'element'))
        throw Error('移动目标不是有效的分组。');
    if (source.node.kind === 'preset' && request.parentId !== null) throw Error('预设不能嵌套。');
    if (request.parentId === request.id) throw Error('不能移入自身。');
    const oldParent = source.parentId ? index.get(source.parentId)! : null;
    if ((oldParent?.node.kind === 'scene3d' || parent?.node.kind === 'scene3d') && source.parentId !== request.parentId)
        throw Error('请整体移动三维场景；更换成员归属请使用所属三维场景操作。');
    const siblings = parent ? parent.node.children : compositionList(project);
    if (request.beforeId === request.id) return null;
    if (request.beforeId !== null && !siblings.some(n => n.id === request.beforeId))
        throw Error('插入位置不属于目标分组。');
    const ids = siblings.filter(n => n.id !== request.id).map(n => n.id);
    const at = request.beforeId === null ? ids.length : ids.indexOf(request.beforeId);
    ids.splice(at, 0, request.id);
    if (source.parentId === request.parentId && ids.every((id, i) => siblings[i]?.id === id)) return null;
    return { source, ids };
}
export function canMoveComposition(project: VisualizerProjectV6, request: CompositionMove): boolean {
    try {
        return resolveMove(project, request) !== null;
    } catch {
        return false;
    }
}
function preset(project: VisualizerProjectV6, id: string): PresetInstance {
    const item = project.items.find(i => i.id === id);
    if (item?.kind !== 'preset') throw Error('预设不存在。');
    return item;
}
function orderUnits(project: VisualizerProjectV6, parentId: string | null, topFirst: string[]) {
    const ids = [...topFirst].reverse();
    if (parentId === null) {
        const byId = new Map(project.items.map(i => [i.id, i]));
        project.items = ids.map(id => byId.get(id)!);
        return;
    }
    const scene = findScene3d(project, parentId);
    if (scene) {
        const owner = project.items.find(i => i.kind === 'preset' && i.scenes3d?.some(s => s.id === scene.id));
        if (owner?.kind === 'preset') {
            const start = owner.children.indexOf(scene.children[0]!);
            owner.children.splice(start, scene.children.length, ...ids);
        }
        scene.children = ids;
    } else {
        const group = preset(project, parentId);
        group.children = ids.flatMap(id => group.scenes3d?.find(s => s.id === id)?.children ?? [id]);
    }
}
/** Move identities, not copies: references, bindings, assets and scene ownership stay intact. */
export function moveComposition(project: VisualizerProjectV6, request: CompositionMove): VisualizerProjectV6 {
    const resolved = resolveMove(project, request);
    if (!resolved) return project;
    const { source, ids } = resolved,
        result = structuredClone(project);
    if (source.parentId !== request.parentId) {
        const scene = source.node.kind === 'scene3d' ? findScene3d(result, request.id)! : null;
        const leaves = new Set(scene ? scene.children : [request.id]);
        if (source.parentId === null) result.items = result.items.filter(i => i.id !== request.id);
        else {
            const group = preset(result, source.parentId);
            group.children = group.children.filter(id => !leaves.has(id));
            if (scene) group.scenes3d = group.scenes3d?.filter(s => s.id !== scene.id);
            group.controls = group.controls.flatMap(control => {
                control.targets = control.targets.filter(id => !leaves.has(id));
                return control.targets.length ? [control] : [];
            });
        }
        if (request.parentId === null) result.items.push(scene ?? { kind: 'element', id: request.id });
        else {
            const group = preset(result, request.parentId);
            group.children.push(...leaves);
            if (scene) (group.scenes3d ??= []).push(scene);
        }
    }
    orderUnits(result, request.parentId, ids);
    result.items = result.items.filter(i => i.kind !== 'preset' || i.children.length);
    return synchronizeLayers(result);
}
export function compositionStepMove(
    project: VisualizerProjectV6,
    id: string,
    direction: -1 | 1,
): CompositionMove | null {
    const index = locations(project),
        source = index.get(id);
    if (!source) return null;
    const at = source.siblings.findIndex(n => n.id === id),
        next = source.siblings[at + direction];
    let request: CompositionMove;
    if (next) {
        if (source.node.kind !== 'preset' && next.kind === 'preset')
            request = { id, parentId: next.id, beforeId: direction === -1 ? null : (next.children[0]?.id ?? null) };
        else
            request = {
                id,
                parentId: source.parentId,
                beforeId: direction === -1 ? next.id : (source.siblings[at + 2]?.id ?? null),
            };
    } else {
        const parent = source.parentId ? index.get(source.parentId) : null;
        if (parent?.node.kind !== 'preset') return null;
        const parentAt = parent.siblings.findIndex(n => n.id === parent.node.id);
        request = {
            id,
            parentId: null,
            beforeId: direction === -1 ? parent.node.id : (parent.siblings[parentAt + 1]?.id ?? null),
        };
    }
    return canMoveComposition(project, request) ? request : null;
}
export function compositionDropMove(
    project: VisualizerProjectV6,
    id: string,
    targetId: string,
    position: CompositionDropPosition,
): CompositionMove | null {
    const target = locations(project).get(targetId);
    if (!target || id === targetId) return null;
    let request: CompositionMove;
    if (position === 'inside') {
        if (target.node.kind !== 'preset') return null;
        request = { id, parentId: targetId, beforeId: target.node.children[0]?.id ?? null };
    } else {
        const at = target.siblings.findIndex(n => n.id === targetId);
        request = {
            id,
            parentId: target.parentId,
            beforeId: position === 'before' ? targetId : (target.siblings[at + 1]?.id ?? null),
        };
    }
    return canMoveComposition(project, request) ? request : null;
}
export function compositionMoveTitle(
    project: VisualizerProjectV6,
    request: CompositionMove | null,
    direction: -1 | 1,
): string {
    const label = direction === -1 ? '上移' : '下移';
    if (!request) return label;
    const index = locations(project),
        source = index.get(request.id)!;
    if (request.parentId === source.parentId) return label;
    return request.parentId
        ? `移入${index.get(request.parentId)!.node.name}`
        : `移出${index.get(source.parentId!)!.node.name}并${label}`;
}
