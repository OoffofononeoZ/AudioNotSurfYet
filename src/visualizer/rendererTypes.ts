import type * as THREE from 'three';
import type { VisualizerResolvedParameter } from './bindingResolver';
import type { VisualizerTemplateId } from './types';

export type VisualizerResolvedParameterMap = ReadonlyMap<string, VisualizerResolvedParameter>;

export interface VisualizerSceneRenderInput {
    readonly timeSeconds: number;
    readonly values: VisualizerResolvedParameterMap;
    readonly bindingRevision: number;
}

export interface VisualizerSceneFrameSnapshot {
    readonly hash: string;
    readonly needsSourcePrompt: boolean;
}

export interface VisualizerRenderer {
    readonly domElement: HTMLCanvasElement;
    setPixelRatio(value: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setClearColor(color: THREE.ColorRepresentation, alpha?: number): void;
    render(scene: THREE.Scene, camera: THREE.Camera): void;
    getContext?(): WebGLRenderingContext | WebGL2RenderingContext;
    dispose(): void;
    forceContextLoss?(): void;
}

export interface VisualizerSceneHost {
    readonly canvas: HTMLCanvasElement;
    readonly renderer: VisualizerRenderer;
    resolveValuesAt(timeSeconds: number): VisualizerResolvedParameterMap;
}

export interface VisualizerScene {
    readonly kind: 'rendered' | 'neutral';
    render(input: VisualizerSceneRenderInput): VisualizerSceneFrameSnapshot;
    resize(width: number, height: number, dpr: number): void;
    dispose(): void;
}

export type VisualizerSceneFactory = (
    host: VisualizerSceneHost,
    seed: number,
) => VisualizerScene;

export interface VisualizerRenderFrame {
    readonly trackIdentity: string;
    readonly templateId: VisualizerTemplateId;
    readonly templateVersion: 1;
    readonly seed: number;
    readonly timeSeconds: number;
    readonly bindingRevision: number;
    readonly playbackState: 'empty' | 'loading' | 'paused' | 'playing' | 'ended' | 'error';
}

export interface VisualizerRendererStatus {
    readonly state: 'idle' | 'ready' | 'neutral' | 'error';
    readonly message?: string;
}
