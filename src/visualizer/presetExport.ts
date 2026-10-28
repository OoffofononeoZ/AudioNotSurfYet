import type { VisualizerProjectV6 } from './compositionTypes';
import type { PresetDefinition, VisualizerResourcePackageV2 } from './resourceTypes';
import type { ResourceInfo } from './resourceDirectory';
import { createRealtimeStyle } from './realtimeStyle';
import { validateResourcePackage } from './resourceCodec';
import { resourceHash, resourceRef } from './resourceIdentity';
import { orderedElements } from './compositionModel';
import { sceneGroups } from './scene3dModel';

export interface PresetExportDetails {
    title: string;
    description: string;
    creator: string;
}
export interface PreparedPresetExport {
    package: VisualizerResourcePackageV2;
    info: ResourceInfo;
    cover: Blob;
}

/** Visibility never exempts saved content from the usual realtime export validation. */
export function createPresetExportValidationProject(project: VisualizerProjectV6): VisualizerProjectV6 {
    return {
        ...project,
        elements: project.elements.map(e => ({ ...e, enabled: true })),
        items: project.items.map(item =>
            item.kind === 'preset'
                ? {
                      ...item,
                      enabled: true,
                      ...(item.scenes3d ? { scenes3d: item.scenes3d.map(s => ({ ...s, enabled: true })) } : {}),
                  }
                : item.kind === 'scene3d'
                  ? { ...item, enabled: true }
                  : item,
        ),
    };
}

/** Saves all content while preserving visibility separately from the validation snapshot. */
export function preparePresetExport(
    project: VisualizerProjectV6,
    details: PresetExportDetails,
    cover: Blob,
): PreparedPresetExport {
    const title = details.title.trim();
    if (!title) throw Error('请填写预设名称。');
    const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[
        cover.type
    ];
    if (!extension || !cover.size) throw Error('请选择有效的 PNG、JPEG 或 WebP 封面。');
    const style = createRealtimeStyle(createPresetExportValidationProject(project), title);
    const hiddenByPreset = new Set(
        project.items.flatMap(item => (item.kind === 'preset' && !item.enabled ? item.children : [])),
    );
    const visibility = new Map(project.elements.map(e => [e.id, e.enabled && !hiddenByPreset.has(e.id)]));
    const scenes = new Map(sceneGroups(project).map(s => [s.id, s]));
    const elements = orderedElements(
        style.elements.map(e => ({
            ...e,
            enabled: visibility.get(e.id)!,
            timing: { kind: 'manual' as const, startSeconds: 0, endSeconds: 1 },
        })),
    );
    const ids = new Map(elements.map((e, index) => [e.id, 'element-' + index]));
    for (const [index, scene] of (style.scenes3d ?? []).entries()) ids.set(scene.id, 'scene-' + index);
    const id = 'user-preset-' + crypto.randomUUID();
    const preset: PresetDefinition = {
        id,
        version: 1,
        hash: '',
        title,
        description: details.description.trim() || title,
        preview: 'geometric',
        elements: elements.map(e => ({
            key: ids.get(e.id)!,
            element: resourceRef(e.resource),
            name: e.name,
            enabled: e.enabled,
            ...(e.seed === undefined ? {} : { seed: e.seed }),
            bindings: structuredClone(e.bindings),
            ...(e.transform3d ? { transform3d: structuredClone(e.transform3d) } : {}),
            ...(e.mediaBindings ? { mediaBindings: structuredClone(e.mediaBindings) } : {}),
            timing: { kind: 'relative', start: 0, end: 1 },
            ...(e.targets
                ? {
                      targets:
                          e.targets.kind === 'composition'
                              ? { kind: 'composition' as const }
                              : { kind: e.targets.kind, ids: e.targets.ids.map(target => ids.get(target)!) },
                  }
                : {}),
        })),
        controls: [],
        ...(style.scenes3d?.length
            ? {
                  scenes3d: style.scenes3d.map(s => ({
                      key: ids.get(s.id)!,
                      name: s.name,
                      enabled: scenes.get(s.id)!.enabled,
                      children: s.children.map(id => ids.get(id)!),
                      start: 0,
                      end: 1,
                      camera: structuredClone(s.camera),
                  })),
              }
            : {}),
        ...(style.mediaAssets?.length ? { mediaAssets: style.mediaAssets } : {}),
    };
    preset.hash = resourceHash(preset);
    const pack = validateResourcePackage(
        {
            format: 'audiosurf-visualizer-resource',
            schemaVersion: 2,
            id,
            version: 1,
            algorithms: [],
            elements: [],
            presets: [preset],
        },
        style.resources,
    );
    const dependencies = [...new Map(preset.elements.map(e => [e.element.hash, e.element])).values()];
    return {
        package: pack,
        cover,
        info: {
            schemaVersion: 1,
            resource: resourceRef(preset),
            kind: 'preset',
            title,
            description: preset.description,
            creator: details.creator.trim() || 'default',
            createdAt: new Date().toISOString(),
            previewPath: 'preview.' + extension,
            sourceEntry: 'source/resource.json',
            packagePath: 'resource-package.json',
            dependencies,
            order: 0,
        },
    };
}
