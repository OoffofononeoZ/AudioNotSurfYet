import type { ElementKind } from './compositionTypes';
import type { SceneParameterDescriptor } from './parameterDescriptor';
import type { ResourceRef } from './resourceTypes';

export type AlgorithmParameter = Omit<SceneParameterDescriptor, 'label' | 'defaultValue' | 'defaultBinding'>;
export interface AlgorithmContract {
    kind: ElementKind;
    parameters: AlgorithmParameter[];
    inputParameter?: string;
    sharedParameters: string[];
    historyParameters: string[];
}
export type UniformType = 'number' | 'int' | 'boolean' | 'color' | 'vec2' | 'vec3' | 'array' | 'source';
export interface ShaderProgram {
    vertex: string;
    fragment: string;
    geometry: 'quad' | 'triangles';
    uniforms: Record<string, { type: UniformType; length?: number }>;
}
export interface AlgorithmDefinition extends ResourceRef {
    apiVersion: 1;
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
    time: number;
    seed: number;
    revision: string;
    width: number;
    height: number;
    range: { startSeconds: number; endSeconds: number } | null;
    parameters: Record<string, AlgorithmValue>;
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
        input: { history(request: HistoryRequest): Promise<HistorySample[]> },
    ): DrawPacket | Promise<DrawPacket>;
    reset?(): void;
    dispose?(): void;
}
