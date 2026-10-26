import type { CompositionRenderModel } from './compositionTypes';
import type { CompositionItem, PresetInstance } from './resourceTypes';
import type { Scene3dItem } from './scene3dTypes';
import { validateScene3d } from './scene3dCodec';
import { invalid, UUID_PATTERN } from './projectValidation';

export const sceneGroups = (project: Pick<CompositionRenderModel, 'items'>): Scene3dItem[] =>
    project.items.flatMap(i => (i.kind === 'scene3d' ? [i] : i.kind === 'preset' ? (i.scenes3d ?? []) : []));
export const findScene3d = (project: Pick<CompositionRenderModel, 'items'>, id: string) =>
    sceneGroups(project).find(s => s.id === id);
export const elementScene = (project: Pick<CompositionRenderModel, 'items'>, id: string) =>
    sceneGroups(project).find(s => s.children.includes(id));
export const itemChildren = (item: CompositionItem): string[] => (item.kind === 'element' ? [item.id] : item.children);

/** Scenes are render units; a preset preserves contiguous scene members in its flat ownership list. */
export type SceneUnit = { kind: 'element' | 'scene3d'; id: string };
export function sceneUnits(ids: readonly string[], scenes: readonly Scene3dItem[]): SceneUnit[] {
    const members = new Set(scenes.flatMap(s => s.children));
    return ids.flatMap<SceneUnit>(id => {
        const scene = scenes.find(s => s.children[0] === id);
        return scene
            ? [{ kind: 'scene3d' as const, id: scene.id }]
            : members.has(id)
              ? []
              : [{ kind: 'element' as const, id }];
    });
}
export function renderUnits(project: Pick<CompositionRenderModel, 'items'>): SceneUnit[] {
    return project.items.flatMap<SceneUnit>(i =>
        i.kind === 'preset' ? sceneUnits(i.children, i.scenes3d ?? []) : [{ kind: i.kind, id: i.id }],
    );
}
export function validateSceneOwnership(
    scenes: Scene3dItem[],
    ids: readonly string[],
    world: (id: string) => boolean,
    duration = Infinity,
) {
    const members = new Set<string>();
    for (const scene of scenes) {
        validateScene3d(scene);
        if (!UUID_PATTERN.test(scene.id) || scene.endSeconds > duration) invalid('三维场景身份或时间超出工程。');
        const start = ids.indexOf(scene.children[0]!);
        if (start < 0 || scene.children.some((id, i) => ids[start + i] !== id)) invalid('三维场景成员必须连续排列。');
        for (const id of scene.children) {
            if (!ids.includes(id) || members.has(id) || !world(id)) invalid('三维场景只能独占世界空间元素。');
            members.add(id);
        }
    }
    if (ids.some(id => world(id) !== members.has(id))) invalid('世界空间元素必须属于一个三维场景。');
}
export function pruneSceneMembers(item: Scene3dItem | PresetInstance, removed: Set<string>) {
    item.children = item.children.filter(id => !removed.has(id));
    if (item.kind === 'preset') {
        if (item.scenes3d)
            item.scenes3d = item.scenes3d.flatMap(s => {
                s.children = s.children.filter(id => !removed.has(id));
                return s.children.length ? [s] : [];
            });
        item.controls = item.controls.flatMap(c => {
            c.targets = c.targets.filter(id => !removed.has(id));
            return c.targets.length ? [c] : [];
        });
    }
}
