import type { ElementBinding, ElementKind, ElementType, EffectTargets } from './compositionTypes';
import type { SceneParameterDescriptor } from './parameterDescriptor';
import type { VisualizerNumericTransformV1 } from './types';

export interface ResourceRef {
    id: string;
    version: number;
    hash: string;
}
export interface ElementDefinition extends ResourceRef {
    kernelId: ElementType;
    kernelVersion: 1;
    kind: ElementKind;
    title: string;
    icon: string;
    inputParameter?: string;
    parameters: SceneParameterDescriptor[];
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
    elements: ElementDefinition[];
    presets: PresetDefinition[];
}
export interface VisualizerResourcePackageV1 extends ResourceSnapshot {
    format: 'audiosurf-visualizer-resource';
    schemaVersion: 1;
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
