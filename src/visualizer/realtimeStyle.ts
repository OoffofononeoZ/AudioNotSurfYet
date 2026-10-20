import type { VisualizerElement, VisualizerProjectV5, CompositionRenderModel } from './compositionTypes';
import type { ResourceSnapshot } from './resourceTypes';
import { validateResourceSnapshot, validateResourceRef } from './resourceCodec';
import { effectiveElements, elementDescriptor } from './compositionModel';
import { resourceKey, sameResource } from './resourceIdentity';
import { inspectRealtimeProject, inspectRealtimeContent } from './realtimeCapabilities';
import { validateElementBindings } from './elementBindings';
import { record, keys, text, integer, iso, invalid, UUID_PATTERN } from './projectValidation';

export type RealtimeStyleElement = Omit<VisualizerElement, 'enabled' | 'timing' | 'markerBindings'>;
export interface RealtimeStyleV1 {
    format: 'audiosurf-realtime-style';
    schemaVersion: 1;
    id: string;
    name: string;
    createdAt: string;
    seed: number;
    frameRate: 30 | 60;
    elements: RealtimeStyleElement[];
    resources: ResourceSnapshot;
}
export function realtimeRenderModel(
    style: RealtimeStyleV1,
    endSeconds = Number.MAX_SAFE_INTEGER,
): CompositionRenderModel {
    return {
        projectId: style.id,
        seed: style.seed,
        resources: style.resources,
        items: style.elements.map(e => ({ kind: 'element', id: e.id })),
        elements: style.elements.map(e => ({
            ...e,
            enabled: true,
            timing: { kind: 'manual', startSeconds: 0, endSeconds },
        })),
    };
}
export function createRealtimeStyle(project: VisualizerProjectV5, name: string): RealtimeStyleV1 {
    const capability = inspectRealtimeProject(project);
    if (!capability.browser) throw Error(capability.browserIssues.join('\n'));
    const active = effectiveElements(project).filter(e => e.enabled);
    const ids = new Set(active.map(e => e.id));
    const used = new Set(active.map(e => resourceKey(e.resource)));
    const elements = project.resources.elements.filter(e => used.has(resourceKey(e)));
    const algorithms = new Set(elements.map(e => resourceKey(e.algorithm)));
    return validateRealtimeStyle({
        format: 'audiosurf-realtime-style',
        schemaVersion: 1,
        id: crypto.randomUUID(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        seed: project.seed,
        frameRate: project.output.frameRate,
        elements: active.map(({ enabled: _enabled, timing: _timing, markerBindings: _markers, ...e }, layer) => ({
            ...e,
            layer,
            ...(e.targets?.kind === 'elements'
                ? { targets: { kind: 'elements', ids: e.targets.ids.filter(id => ids.has(id)) } }
                : {}),
        })),
        resources: {
            algorithms: project.resources.algorithms.filter(a => algorithms.has(resourceKey(a))),
            elements,
            presets: [],
        },
    });
}
export function validateRealtimeStyle(input: unknown): RealtimeStyleV1 {
    const v = record(input, '实时样式');
    keys(v, ['format', 'schemaVersion', 'id', 'name', 'createdAt', 'seed', 'frameRate', 'elements', 'resources']);
    if (v.format !== 'audiosurf-realtime-style' || v.schemaVersion !== 1 || !UUID_PATTERN.test(text(v.id, 'id')))
        return invalid('实时样式格式无效。');
    const resources = validateResourceSnapshot(v.resources),
        seed = integer(v.seed, 'seed');
    if (
        seed < 0 ||
        seed > 0xffffffff ||
        (v.frameRate !== 30 && v.frameRate !== 60) ||
        !Array.isArray(v.elements) ||
        resources.presets.length
    )
        return invalid('实时样式参数无效。');
    const elements = v.elements.map((input, layer): RealtimeStyleElement => {
        const e = record(input, '元素');
        keys(e, ['id', 'resource', 'name', 'layer', 'bindings'], ['targets']);
        if (!UUID_PATTERN.test(text(e.id, 'id')) || integer(e.layer, 'layer') !== layer)
            return invalid('实时元素身份或顺序无效。');
        const resource = validateResourceRef(e.resource),
            definition = resources.elements.find(d => sameResource(d, resource));
        if (!definition) return invalid('实时元素定义缺失。');
        return {
            id: String(e.id),
            resource,
            name: text(e.name, 'name'),
            layer,
            bindings: validateElementBindings(e.bindings, definition.parameters),
            ...(e.targets === undefined ? {} : { targets: structuredClone(e.targets) as VisualizerElement['targets'] }),
        };
    });
    if (new Set(elements.map(e => e.id)).size !== elements.length) return invalid('实时元素身份重复。');
    const style: RealtimeStyleV1 = {
        format: 'audiosurf-realtime-style',
        schemaVersion: 1,
        id: String(v.id),
        name: text(v.name, 'name'),
        createdAt: iso(v.createdAt, 'createdAt'),
        seed,
        frameRate: v.frameRate,
        elements,
        resources,
    };
    const model = realtimeRenderModel(style, 1),
        capabilities = inspectRealtimeContent(model.elements, resources, 1);
    if (!capabilities.browser) return invalid(capabilities.browserIssues.join('\n'));
    const featureIds = new Set(
        elements.flatMap(e => e.bindings.flatMap(b => (b.source.kind === 'analysis' ? [b.source.featureId] : []))),
    );
    if (featureIds.size > 4) return invalid('实时样式最多使用四种 Analyzer 特征。');
    for (const e of elements) {
        const kind = elementDescriptor(
            model,
            model.elements.find(item => item.id === e.id)!,
        ).kind;
        if (kind === 'visual') {
            if (e.targets !== undefined) return invalid('视觉元素不能包含效果目标。');
            continue;
        }
        const target = record(e.targets, '效果目标');
        if (target.kind === 'composition') keys(target, ['kind']);
        else {
            keys(target, ['kind', 'ids']);
            if (
                target.kind !== 'elements' ||
                !Array.isArray(target.ids) ||
                new Set(target.ids).size !== target.ids.length ||
                target.ids.some(
                    id =>
                        !model.elements.some(
                            item => item.id === id && elementDescriptor(model, item).kind === 'visual',
                        ),
                )
            )
                return invalid('实时效果目标无效。');
        }
    }
    return structuredClone(style);
}
