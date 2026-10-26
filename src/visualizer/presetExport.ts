import type { VisualizerProjectV5 } from './compositionTypes';
import type { PresetDefinition, VisualizerResourcePackageV2 } from './resourceTypes';
import type { ResourceInfo } from './resourceDirectory';
import { createRealtimeStyle } from './realtimeStyle';
import { validateResourcePackage } from './resourceCodec';
import { resourceHash, resourceRef } from './resourceIdentity';
import { orderedElements } from './compositionModel';

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

/** Converts the same effective content as realtime styles, without changing the song project. */
export function preparePresetExport(
    project: VisualizerProjectV5,
    details: PresetExportDetails,
    cover: Blob,
): PreparedPresetExport {
    const title = details.title.trim();
    if (!title) throw Error('请填写预设名称。');
    const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[
        cover.type
    ];
    if (!extension || !cover.size) throw Error('请选择有效的 PNG、JPEG 或 WebP 封面。');
    const style = createRealtimeStyle(project, title);
    const elements = orderedElements(
        style.elements.map(e => ({
            ...e,
            enabled: true,
            timing: { kind: 'manual' as const, startSeconds: 0, endSeconds: 1 },
        })),
    );
    const ids = new Map(elements.map((e, index) => [e.id, 'element-' + index]));
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
            enabled: true,
            ...(e.seed === undefined ? {} : { seed: e.seed }),
            bindings: structuredClone(e.bindings),
            ...(e.mediaBindings ? { mediaBindings: structuredClone(e.mediaBindings) } : {}),
            timing: { kind: 'relative', start: 0, end: 1 },
            ...(e.targets
                ? {
                      targets:
                          e.targets.kind === 'composition'
                              ? { kind: 'composition' as const }
                              : { kind: 'elements' as const, ids: e.targets.ids.map(target => ids.get(target)!) },
                  }
                : {}),
        })),
        controls: [],
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
