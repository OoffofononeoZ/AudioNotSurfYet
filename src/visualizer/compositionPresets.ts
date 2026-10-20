import { elementRegistry, findResource } from './elementRegistry';
import { resourceRef } from './resourceIdentity';
import type { VisualizerElement } from './compositionTypes';
import type { PresetInstance, ResourceRef, ResourceSnapshot } from './resourceTypes';

export type CompositionPresetId = string;
export const compositionPresets = elementRegistry.presets;
export function instantiatePreset(id: string | ResourceRef, duration: number, startLayer = 0) {
    const definition = findResource(compositionPresets, id),
        ids = new Map(definition.elements.map(e => [e.key, crypto.randomUUID()]));
    const elements: VisualizerElement[] = definition.elements.map((e, index) => {
        const d = elementRegistry.get(e.element);
        return {
            id: ids.get(e.key)!,
            resource: resourceRef(d),
            name: e.name,
            enabled: e.enabled,
            layer: startLayer + index,
            bindings: structuredClone(e.bindings),
            ...(e.markerBindings ? { markerBindings: structuredClone(e.markerBindings) } : {}),
            timing:
                e.timing.kind === 'relative'
                    ? { kind: 'manual', startSeconds: duration * e.timing.start, endSeconds: duration * e.timing.end }
                    : { kind: 'unbound' },
            ...(e.targets
                ? {
                      targets:
                          e.targets.kind === 'composition'
                              ? { kind: 'composition' as const }
                              : { kind: 'elements' as const, ids: e.targets.ids.map(key => ids.get(key)!) },
                  }
                : {}),
        };
    });
    const group: PresetInstance = {
        kind: 'preset',
        id: crypto.randomUUID(),
        resource: resourceRef(definition),
        name: definition.title,
        enabled: true,
        children: elements.map(e => e.id),
        controls: definition.controls.map(c => ({
            ...structuredClone(c),
            targets: c.targets.map(key => ids.get(key)!),
        })),
    };
    const resources: ResourceSnapshot = {
        algorithms: [
            ...new Map(
                definition.elements.map(e => {
                    const d = elementRegistry.get(e.element);
                    const a = findResource(elementRegistry.algorithms, d.algorithm);
                    return [a.hash, a];
                }),
            ).values(),
        ],
        elements: [
            ...new Map(
                definition.elements.map(e => {
                    const d = elementRegistry.get(e.element);
                    return [d.hash, d];
                }),
            ).values(),
        ],
        presets: [definition],
    };
    return { group, elements, resources };
}
export function createPresetElements(id: CompositionPresetId, duration: number, startLayer = 0): VisualizerElement[] {
    return instantiatePreset(id, duration, startLayer).elements;
}
