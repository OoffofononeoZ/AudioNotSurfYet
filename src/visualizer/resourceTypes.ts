import type { MediaInputDefinition, MediaBindings } from './mediaTypes';
import type { ElementBinding, ElementKind, EffectTargets } from './compositionTypes';
import type { AlgorithmDefinition } from './algorithmTypes';
import type { SceneParameterDescriptor } from './parameterDescriptor';
import type { VisualizerNumericTransformV1 } from './types';
import type { MarkerBindings, MarkerInputDefinition } from './editorMarkerTypes';

export interface ResourceRef {
    id: string;
    version: number;
    hash: string;
}
export interface ElementDefinition extends ResourceRef {
    algorithm: ResourceRef;
    /** Declared only when frame.seed can change a supported visual effect. */
    usesSeed?: true;
    kind: ElementKind;
    title: string;
    icon: string;
    inputParameter?: string;
    parameters: SceneParameterDescriptor[];
    markerInputs?: MarkerInputDefinition[];
    mediaInputs?: MediaInputDefinition[];
}
export type CommonValue = number | string | boolean | number[] | Omit<ElementBinding, 'parameterId'>;
export interface CommonControl {
    id: string;
    label: string;
    kind: 'value' | 'binding' | 'transform';
    parameterId: string;
    field?: keyof VisualizerNumericTransformV1;
    targets: string[];
    /** Last value applied in bulk. Child bindings remain independently editable. */
    value: CommonValue;
}
export interface PresetElementTemplate {
    key: string;
    element: ResourceRef;
    name: string;
    enabled: boolean;
    bindings: ElementBinding[];
    markerBindings?: MarkerBindings;
    mediaBindings?: MediaBindings;
    timing: { kind: 'relative'; start: number; end: number } | { kind: 'unbound' };
    targets?: EffectTargets;
}
export interface PresetDefinition extends ResourceRef {
    title: string;
    description: string;
    preview: 'geometric' | 'cinematic';
    elements: PresetElementTemplate[];
    controls: CommonControl[];
}
export interface ResourceSnapshot {
    algorithms: AlgorithmDefinition[];
    elements: ElementDefinition[];
    presets: PresetDefinition[];
}
export interface VisualizerResourcePackageV2 extends ResourceSnapshot {
    format: 'audiosurf-visualizer-resource';
    schemaVersion: 2;
    id: string;
    version: number;
}
export interface PresetInstance {
    kind: 'preset';
    id: string;
    resource: ResourceRef;
    name: string;
    enabled: boolean;
    children: string[];
    controls: CommonControl[];
}
export type CompositionItem = { kind: 'element'; id: string } | PresetInstance;
