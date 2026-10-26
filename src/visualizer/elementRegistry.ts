import type { SceneParameterDescriptor } from './parameterDescriptor';
import type { VisualizerElement } from './compositionTypes';
import type { ElementDefinition, PresetDefinition, ResourceRef, ResourceSnapshot } from './resourceTypes';
import { resourceKey, resourceRef, sameResource } from './resourceIdentity';
import { defaultMediaBindings } from './mediaCodec';
import { defaultMarkerBindings } from './editorMarkerValidation';
import { defaultTransform3d } from './scene3dTypes';

export type ElementDescriptor = ElementDefinition;
export function findResource<T extends ResourceRef>(entries: readonly T[], id: string | ResourceRef): T {
    const found =
        typeof id === 'string'
            ? (entries.find(e => resourceKey(e) === id) ??
              entries.filter(e => e.id === id).sort((a, b) => b.version - a.version)[0])
            : entries.find(e => sameResource(e, id));
    if (!found) throw Error('资源不存在或版本缺失：' + (typeof id === 'string' ? id : resourceKey(id)));
    return found;
}
export function createDefinitionElement(
    d: ElementDefinition,
    durationSeconds: number,
    layer: number,
    timingInput?: string,
): VisualizerElement {
    const markerBindings = defaultMarkerBindings(d.markerInputs, timingInput);
    return {
        id: crypto.randomUUID(),
        resource: resourceRef(d),
        name: d.title,
        enabled: true,
        ...(d.usesSeed ? { seed: null } : {}),
        layer,
        timing:
            d.kind === 'transition'
                ? { kind: 'unbound' }
                : { kind: 'manual', startSeconds: 0, endSeconds: durationSeconds },
        bindings: d.parameters.map(p => ({
            parameterId: p.id,
            ...(p.defaultBinding
                ? structuredClone(p.defaultBinding)
                : { source: { kind: 'constant' as const, value: structuredClone(p.defaultValue) } }),
        })) as VisualizerElement['bindings'],
        ...(markerBindings ? { markerBindings } : {}),
        ...(d.mediaInputs ? { mediaBindings: defaultMediaBindings(d.mediaInputs) } : {}),
        ...(d.scene3dDefaults ? { transform3d: defaultTransform3d() } : {}),
        ...(d.kind === 'visual' ? {} : { targets: { kind: 'composition' as const } }),
    };
}
/** Available library content; project rendering always resolves its embedded snapshots. */
export class ElementRegistry {
    private definitions: ElementDefinition[] = [];
    readonly presets: PresetDefinition[] = [];
    readonly algorithms: import('./algorithmTypes').AlgorithmDefinition[] = [];
    replace(snapshot: ResourceSnapshot) {
        this.algorithms.splice(0, this.algorithms.length, ...structuredClone(snapshot.algorithms));
        this.definitions.splice(0, this.definitions.length, ...structuredClone(snapshot.elements));
        this.presets.splice(0, this.presets.length, ...structuredClone(snapshot.presets));
    }
    list() {
        return this.definitions;
    }
    get(id: string | ResourceRef): ElementDefinition {
        return findResource(this.definitions, id);
    }
    create(id: string | ResourceRef, duration: number, layer: number) {
        const definition = this.get(id),
            algorithm = findResource(this.algorithms, definition.algorithm);
        return createDefinitionElement(definition, duration, layer, algorithm.contract.timingInput);
    }
}
export const elementRegistry = new ElementRegistry();
export const definitionParameter = (definition: ElementDefinition, id: string): SceneParameterDescriptor => {
    const parameter = definition.parameters.find(p => p.id === id);
    if (!parameter) throw Error('参数不存在。');
    return parameter;
};
