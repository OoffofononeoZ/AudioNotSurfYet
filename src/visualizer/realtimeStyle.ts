import type { MediaAsset } from './mediaTypes';
import { validateMediaAssets, validateMediaBindings, referencedMedia } from './mediaCodec';
import type { VisualizerElement, VisualizerProjectV6, CompositionRenderModel } from './compositionTypes';
import type { ResourceSnapshot } from './resourceTypes';
import { validateResourceSnapshot, validateResourceRef } from './resourceCodec';
import { effectiveElements, elementDescriptor } from './compositionModel';
import { resourceKey, sameResource } from './resourceIdentity';
import { inspectRealtimeProject, inspectRealtimeContent } from './realtimeCapabilities';
import { validateElementBindings } from './elementBindings';
import { record, keys, text, integer, iso, invalid, UUID_PATTERN } from './projectValidation';
import { elementSeedField } from './seed';
import { migrateRealtimeStyleV1 } from './compositionMigration';
import { sceneGroups, sceneUnits, validateSceneOwnership } from './scene3dModel';
import { validateScene3d, validateTransform3d } from './scene3dCodec';
import { defaultTransform3d, type Scene3dItem } from './scene3dTypes';

export type RealtimeStyleElement = Omit<VisualizerElement, 'enabled' | 'timing' | 'markerBindings'>;
export interface RealtimeStyleV2 {
    format: 'audiosurf-realtime-style';
    schemaVersion: 2;
    id: string;
    name: string;
    createdAt: string;
    frameRate: 30 | 60;
    elements: RealtimeStyleElement[];
    resources: ResourceSnapshot;
    mediaAssets?: MediaAsset[];
    scenes3d?: Scene3dItem[];
}
export function realtimeRenderModel(
    style: RealtimeStyleV2,
    endSeconds = Number.MAX_SAFE_INTEGER,
): CompositionRenderModel {
    return {
        projectId: style.id,
        resources: style.resources,
        ...(style.mediaAssets ? { mediaAssets: style.mediaAssets } : {}),
        items: sceneUnits(
            style.elements.map(e => e.id),
            style.scenes3d ?? [],
        ).map(i =>
            i.kind === 'scene3d'
                ? { ...style.scenes3d!.find(s => s.id === i.id)!, endSeconds }
                : { kind: 'element', id: i.id },
        ),
        elements: style.elements.map(e => ({
            ...e,
            enabled: true,
            timing: { kind: 'manual', startSeconds: 0, endSeconds },
        })),
    };
}
export function createRealtimeStyle(project: VisualizerProjectV6, name: string): RealtimeStyleV2 {
    const capability = inspectRealtimeProject(project);
    if (!capability.browser) throw Error(capability.browserIssues.join('\n'));
    const active = effectiveElements(project).filter(e => e.enabled);
    const ids = new Set(active.map(e => e.id));
    const used = new Set(active.map(e => resourceKey(e.resource)));
    const elements = project.resources.elements.filter(e => used.has(resourceKey(e)));
    const algorithms = new Set(elements.map(e => resourceKey(e.algorithm)));
    return validateRealtimeStyle({
        format: 'audiosurf-realtime-style',
        schemaVersion: 2,
        id: crypto.randomUUID(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        frameRate: project.output.frameRate,
        ...(project.mediaAssets ? { mediaAssets: referencedMedia(active, project.mediaAssets) } : {}),
        elements: active.map(({ enabled: _enabled, timing: _timing, markerBindings: _markers, ...e }, layer) => ({
            ...e,
            layer,
            ...(e.targets?.kind === 'elements'
                ? { targets: { kind: 'elements', ids: e.targets.ids.filter(id => ids.has(id)) } }
                : {}),
        })),
        scenes3d: sceneGroups(project)
            .filter(s => s.enabled)
            .flatMap(s => {
                const children = s.children.filter(id => ids.has(id));
                return children.length
                    ? [{ ...structuredClone(s), children, startSeconds: 0, endSeconds: Number.MAX_SAFE_INTEGER }]
                    : [];
            }),
        resources: {
            algorithms: project.resources.algorithms.filter(a => algorithms.has(resourceKey(a))),
            elements,
            presets: [],
        },
    });
}
export function validateRealtimeStyle(input: unknown): RealtimeStyleV2 {
    const v = record(migrateRealtimeStyleV1(input), '实时样式');
    keys(
        v,
        ['format', 'schemaVersion', 'id', 'name', 'createdAt', 'frameRate', 'elements', 'resources'],
        ['mediaAssets', 'scenes3d'],
    );
    const mediaAssets = validateMediaAssets(v.mediaAssets);
    if (v.format !== 'audiosurf-realtime-style' || v.schemaVersion !== 2 || !UUID_PATTERN.test(text(v.id, 'id')))
        return invalid('实时样式格式无效。');
    const resources = validateResourceSnapshot(v.resources);
    if ((v.frameRate !== 30 && v.frameRate !== 60) || !Array.isArray(v.elements) || resources.presets.length)
        return invalid('实时样式参数无效。');
    const elements = v.elements.map((input, layer): RealtimeStyleElement => {
        const e = record(input, '元素');
        keys(e, ['id', 'resource', 'name', 'layer', 'bindings'], ['targets', 'seed', 'mediaBindings', 'transform3d']);
        if (!UUID_PATTERN.test(text(e.id, 'id')) || integer(e.layer, 'layer') !== layer)
            return invalid('实时元素身份或顺序无效。');
        const resource = validateResourceRef(e.resource),
            definition = resources.elements.find(d => sameResource(d, resource));
        if (!definition) return invalid('实时元素定义缺失。');
        return {
            id: String(e.id),
            resource,
            name: text(e.name, 'name'),
            ...elementSeedField(e.seed, definition.usesSeed),
            layer,
            ...(definition.scene3dDefaults
                ? {
                      transform3d:
                          e.transform3d === undefined ? defaultTransform3d() : validateTransform3d(e.transform3d),
                  }
                : e.transform3d === undefined
                  ? {}
                  : invalid('二维元素不能保存三维变换。')),
            bindings: validateElementBindings(e.bindings, definition.parameters),
            ...(definition.mediaInputs
                ? { mediaBindings: validateMediaBindings(e.mediaBindings, definition.mediaInputs, mediaAssets) }
                : e.mediaBindings === undefined
                  ? {}
                  : (() => {
                        throw Error('元素未声明媒体输入。');
                    })()),
            ...(e.targets === undefined ? {} : { targets: structuredClone(e.targets) as VisualizerElement['targets'] }),
        };
    });
    if (new Set(elements.map(e => e.id)).size !== elements.length) return invalid('实时元素身份重复。');
    const scenes3d =
        v.scenes3d === undefined
            ? undefined
            : Array.isArray(v.scenes3d)
              ? v.scenes3d.map(s => validateScene3d(s) as Scene3dItem)
              : invalid('实时场景必须为列表。');
    validateSceneOwnership(
        scenes3d ?? [],
        elements.map(e => e.id),
        id =>
            !!resources.elements.find(d => sameResource(d, elements.find(e => e.id === id)!.resource))?.scene3dDefaults,
    );
    if (
        new Set(scenes3d?.map(s => s.id)).size !== (scenes3d?.length ?? 0) ||
        scenes3d?.some(s => elements.some(e => e.id === s.id))
    )
        invalid('实时场景 ID 重复。');
    const style: RealtimeStyleV2 = {
        format: 'audiosurf-realtime-style',
        schemaVersion: 2,
        id: String(v.id),
        name: text(v.name, 'name'),
        createdAt: iso(v.createdAt, 'createdAt'),
        frameRate: v.frameRate,
        elements,
        resources,
        ...(scenes3d ? { scenes3d } : {}),
        ...(mediaAssets ? { mediaAssets } : {}),
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
                !['elements', 'scenes3d'].includes(String(target.kind)) ||
                !Array.isArray(target.ids) ||
                new Set(target.ids).size !== target.ids.length ||
                target.ids.some(id =>
                    target.kind === 'scenes3d'
                        ? !scenes3d?.some(s => s.id === id)
                        : !model.elements.some(
                              item =>
                                  item.id === id &&
                                  elementDescriptor(model, item).kind === 'visual' &&
                                  !resources.elements.find(d => sameResource(d, item.resource))?.scene3dDefaults,
                          ),
                )
            )
                return invalid('实时效果目标无效。');
        }
    }
    return structuredClone(style);
}
