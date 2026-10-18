import { validateResourceRef } from './resourceCodec';
import { sameResource, canonicalJson } from './resourceIdentity';
import { validateCommonControls } from './commonControls';
import { invalid, keys, record, text, UUID_PATTERN } from './projectValidation';
import type { VisualizerProjectV4 } from './compositionTypes';
import type { CompositionItem } from './resourceTypes';

export function validateCompositionItems(input: unknown, project: VisualizerProjectV4): CompositionItem[] {
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
        keys(i, ['kind', 'id', 'resource', 'name', 'enabled', 'children', 'controls']);
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
        const controls = validateCommonControls(i.controls, targets);
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
            controls,
        };
    });
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
