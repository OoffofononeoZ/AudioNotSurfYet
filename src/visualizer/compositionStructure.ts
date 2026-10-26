import { validateResourceRef } from './resourceCodec';
import { sameResource, canonicalJson } from './resourceIdentity';
import { validateCommonControls } from './commonControls';
import { validateScene3d } from './scene3dCodec';
import type { Scene3dItem } from './scene3dTypes';
import { validateSceneOwnership } from './scene3dModel';
import { invalid, keys, record, text, UUID_PATTERN } from './projectValidation';
import type { VisualizerProjectV6 } from './compositionTypes';
import type { CompositionItem } from './resourceTypes';

export function validateCompositionItems(input: unknown, project: VisualizerProjectV6): CompositionItem[] {
    if (!Array.isArray(input)) return invalid('items 必须为列表。');
    const elements = new Map(project.elements.map(e => [e.id, e])),
        ids = new Set<string>(),
        owned: string[] = [];
    const items = input.map(input => {
        const i = record(input, '列表项'),
            id = text(i.id, '列表项 ID');
        if (!UUID_PATTERN.test(id) || ids.has(id)) return invalid('列表项 ID 无效或重复。');
        ids.add(id);
        if (i.kind === 'element') {
            keys(i, ['kind', 'id']);
            if (!elements.has(id)) return invalid('独立元素不存在。');
            owned.push(id);
            return { kind: 'element' as const, id };
        }
        if (i.kind === 'scene3d') {
            if (elements.has(id)) invalid('三维场景配置无效。');
            const scene = validateScene3d(i) as Scene3dItem;
            owned.push(...scene.children);
            return scene;
        }
        keys(i, ['kind', 'id', 'resource', 'name', 'enabled', 'children', 'controls'], ['scenes3d']);
        if (i.kind !== 'preset' || elements.has(id) || typeof i.enabled !== 'boolean') return invalid('预设实例无效。');
        const resource = validateResourceRef(i.resource),
            definition = project.resources.presets.find(d => sameResource(d, resource));
        if (!definition) return invalid('预设定义快照缺失。');
        if (
            !Array.isArray(i.children) ||
            !i.children.length ||
            i.children.some(id => typeof id !== 'string' || !elements.has(id))
        )
            return invalid('预设子元素引用无效。');
        const children = i.children as string[];
        const scenes3d =
            i.scenes3d === undefined
                ? undefined
                : Array.isArray(i.scenes3d)
                  ? i.scenes3d.map(s => validateScene3d(s) as Scene3dItem)
                  : invalid('三维场景配置无效。');
        validateSceneOwnership(
            scenes3d ?? [],
            children,
            id => !!project.resources.elements.find(d => sameResource(d, elements.get(id)!.resource))?.scene3dDefaults,
            project.track.durationSeconds,
        );
        for (const scene of scenes3d ?? []) {
            if (ids.has(scene.id) || elements.has(scene.id)) invalid('三维场景配置无效。');
            ids.add(scene.id);
        }
        owned.push(...children);
        const targets = new Map(
            children.map(id => {
                const e = elements.get(id)!;
                return [
                    id,
                    {
                        definition: project.resources.elements.find(d => sameResource(d, e.resource))!,
                        bindings: e.bindings,
                    },
                ];
            }),
        );
        const controls = validateCommonControls(i.controls, targets, project.resources.algorithms);
        for (const c of controls) {
            const original = definition.controls.find(d => d.id === c.id);
            const shape = (v: typeof c) => ({
                id: v.id,
                label: v.label,
                kind: v.kind,
                parameterId: v.parameterId,
                ...(v.field ? { field: v.field } : {}),
            });
            if (!original || canonicalJson(shape(original)) !== canonicalJson(shape(c)))
                return invalid('实例共同参数与预设定义不匹配。');
        }
        return {
            kind: 'preset' as const,
            id,
            resource,
            name: text(i.name, '预设名称'),
            enabled: i.enabled,
            children: [...children],
            ...(scenes3d ? { scenes3d } : {}),
            controls,
        };
    });
    const scenes = items.flatMap(i => (i.kind === 'scene3d' ? [i] : i.kind === 'preset' ? (i.scenes3d ?? []) : []));
    validateSceneOwnership(
        scenes,
        owned,
        id => {
            const element = elements.get(id);
            return (
                !!element && !!project.resources.elements.find(d => sameResource(d, element.resource))?.scene3dDefaults
            );
        },
        project.track.durationSeconds,
    );
    if (
        owned.length !== project.elements.length ||
        new Set(owned).size !== owned.length ||
        project.elements.some(e => !owned.includes(e.id))
    )
        return invalid('每个元素必须且只能属于一个顶层项。');
    for (const [layer, id] of owned.entries())
        if (elements.get(id)?.layer !== layer) return invalid('元素层级与分组顺序不一致。');
    return items;
}
