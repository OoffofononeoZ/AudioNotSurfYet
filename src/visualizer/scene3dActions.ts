import type { VisualizerProjectV6 } from './compositionTypes';
import type { Scene3dItem } from './scene3dTypes';
import { elementScene, findScene3d } from './scene3dModel';
import { elementDescriptor, synchronizeLayers } from './compositionModel';

export function updateScene3d(
    project: VisualizerProjectV6,
    id: string,
    patch: Partial<Pick<Scene3dItem, 'name' | 'enabled' | 'camera' | 'startSeconds' | 'endSeconds'>>,
) {
    const result = structuredClone(project),
        scene = findScene3d(result, id);
    if (!scene) throw Error('三维场景不存在。');
    Object.assign(scene, structuredClone(patch));
    return result;
}
export function movableScenes(project: VisualizerProjectV6, elementId: string): Scene3dItem[] {
    const owner = project.items.find(i => i.kind === 'preset' && i.children.includes(elementId));
    return owner?.kind === 'preset'
        ? (owner.scenes3d ?? [])
        : project.items.filter((i): i is Scene3dItem => i.kind === 'scene3d');
}
export function moveWorldElement(project: VisualizerProjectV6, elementId: string, targetId: string | null) {
    const result = structuredClone(project),
        source = elementScene(result, elementId);
    const element = result.elements.find(e => e.id === elementId);
    if (!source || !element) throw Error('三维成员不存在。');
    if (source.id === targetId) return project;
    let target = targetId ? movableScenes(result, elementId).find(s => s.id === targetId) : undefined;
    if (targetId && !target) throw Error('只能移入同一预设或顶层的三维场景。');
    const owner = result.items.find(i => i.kind === 'preset' && i.children.includes(elementId));
    const oldIndex =
        owner?.kind === 'preset' ? owner.children.indexOf(elementId) : result.items.findIndex(i => i.id === source.id);
    source.children = source.children.filter(id => id !== elementId);
    const created = !target;
    if (!target)
        target = {
            kind: 'scene3d',
            id: crypto.randomUUID(),
            name: element.name + '场景',
            enabled: true,
            children: [],
            startSeconds: 0,
            endSeconds: project.track.durationSeconds,
            camera: structuredClone(elementDescriptor(project, element).scene3dDefaults!.camera),
        };
    if (owner?.kind === 'preset') {
        owner.children = owner.children.filter(id => id !== elementId);
        owner.scenes3d = (owner.scenes3d ?? []).filter(s => s.children.length);
        if (created) owner.scenes3d.push(target);
        const insert = created
            ? Math.min(oldIndex, owner.children.length)
            : owner.children.indexOf(target.children[target.children.length - 1]!) + 1;
        owner.children.splice(insert, 0, elementId);
    } else {
        result.items = result.items.filter(i => i.id !== source.id || source.children.length);
        if (created) result.items.splice(Math.min(oldIndex, result.items.length), 0, target);
    }
    target.children.push(elementId);
    const scenes = new Set(
        result.items.flatMap(i =>
            i.kind === 'scene3d' ? [i.id] : i.kind === 'preset' ? (i.scenes3d?.map(s => s.id) ?? []) : [],
        ),
    );
    for (const e of result.elements)
        if (e.targets?.kind === 'scenes3d') e.targets.ids = e.targets.ids.filter(id => scenes.has(id));
    return synchronizeLayers(result);
}
