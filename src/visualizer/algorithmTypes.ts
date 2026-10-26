import type { MediaInputContract, MediaFrame } from './mediaTypes';
import type { ElementKind } from './compositionTypes';
import type { SceneParameterDescriptor } from './parameterDescriptor';
import type { ResourceRef } from './resourceTypes';
import type { MarkerInputContract, MarkerPage, MarkerQuery } from './editorMarkerTypes';
import type { CameraFrame } from './scene3dTypes';

export type AlgorithmParameter = Omit<SceneParameterDescriptor, 'label' | 'defaultValue' | 'defaultBinding'>;
export interface AlgorithmContract {
    kind: ElementKind;
    parameters: AlgorithmParameter[];
    inputParameter?: string;
    sharedParameters: string[];
    historyParameters: string[];
    /** Additional parameters whose configuration changes invalidate accumulated state. Omitted means all parameters. */
    stateParameters?: string[];
    markerInputs?: MarkerInputContract[];
    timingInput?: string;
    mediaInputs?: MediaInputContract[];
    executionModes?: ('timeline' | 'realtime')[];
    renderSpace?: 'world';
}
export type UniformType = 'number' | 'int' | 'boolean' | 'color' | 'vec2' | 'vec3' | 'array' | 'source' | 'media';
export interface ShaderProgram {
    vertex: string;
    fragment: string;
    geometry: 'quad' | 'triangles';
    uniforms: Record<string, { type: UniformType; length?: number; inputId?: string; slot?: 'current' | 'next' }>;
    alphaMode?: 'opaque' | 'mask';
    alphaCutoff?: number;
}
export interface AlgorithmDefinition extends ResourceRef {
    apiVersion: 1 | 2 | 3 | 4;
    contract: AlgorithmContract;
    source: string;
    programs: Record<string, ShaderProgram>;
}
export type UniformValue = number | boolean | string | number[];
export interface MeshPacket {
    positions: Float32Array;
    colors: Float32Array;
    edges: Float32Array;
}
export interface DrawPass {
    program: string;
    uniforms: Record<string, UniformValue>;
    mesh?: MeshPacket;
}
export interface DrawPacket {
    passes: DrawPass[];
    /** Viewport-independent state for deterministic timeline diagnostics. */
    state?: number[];
}
export interface AlgorithmValue {
    value: number | boolean | string | number[];
    unit?: string;
}
export interface AlgorithmFrame {
    mode?: 'timeline' | 'realtime';
    media?: MediaFrame;
    time: number;
    seed: number;
    revision: string;
    width: number;
    height: number;
    range: { startSeconds: number; endSeconds: number } | null;
    parameters: Record<string, AlgorithmValue>;
    camera?: CameraFrame;
}
export interface HistorySample {
    time: number;
    value: number | boolean | string | number[];
    unit?: string;
}
export interface HistoryRequest {
    parameterId: string;
    startTick: number;
    endTick: number;
}
export interface AlgorithmInstance {
    prepareFrame(
        frame: AlgorithmFrame,
        input: {
            history(request: HistoryRequest): Promise<HistorySample[]>;
            markers(request: MarkerQuery): Promise<MarkerPage>;
        },
    ): DrawPacket | Promise<DrawPacket>;
    reset?(): void;
    dispose?(): void;
}
