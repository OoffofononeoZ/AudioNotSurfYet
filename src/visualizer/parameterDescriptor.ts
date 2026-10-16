import type { VisualizerAnalysisComponent, VisualizerAnalysisProjectionV1, VisualizerParameterBindingV1 } from './types';
export type SceneParameterValueKind = 'number' | 'boolean' | 'color' | 'vector';
export type SceneBindingSourceKind = 'constant' | 'analysis' | 'editor-event' | 'native';

export interface SceneNumericRange {
    readonly min: number;
    readonly max: number;
    readonly integer?: boolean;
}

export interface SceneParameterDescriptor {
    readonly id: string;
    readonly label: string;
    readonly valueKind: SceneParameterValueKind;
    readonly defaultValue: number | string | boolean | readonly number[];
    readonly allowedSourceKinds: readonly SceneBindingSourceKind[];
    readonly range?: SceneNumericRange;
    readonly vectorElementRange?: SceneNumericRange;
    readonly allowEmptyVector?: boolean;
    readonly allowedAnalysisComponents?: readonly VisualizerAnalysisComponent[];
    readonly allowedAnalysisProjections?: readonly VisualizerAnalysisProjectionV1['kind'][];
    readonly defaultBinding?: Omit<VisualizerParameterBindingV1, 'parameterId'>;
}
