import type * as THREE from 'three';
export type SpectrumUnit = 'meyda-amplitude' | 'we-strength' | 'byte-frequency' | 'signed-waveform';
export interface VisualizerResolvedParameter {
    parameterId:string;
    state:'ready'|'loading'|'error';
    value?:number|string|boolean|number[];
    message?:string;
    unit?:SpectrumUnit;
    channelLayout?:'mono'|'stereo-64'|'stereo-1024';
}

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
    autoClear: boolean;
    clear(color?:boolean,depth?:boolean,stencil?:boolean):void;
    setRenderTarget(target:THREE.WebGLRenderTarget | null):void;
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
    readonly seed: number;
    readonly timeSeconds: number;
    readonly bindingRevision: number;
    readonly playbackState: 'empty' | 'loading' | 'buffering' | 'paused' | 'playing' | 'ended' | 'error';
}

export interface VisualizerRendererStatus {
    readonly state: 'idle' | 'ready' | 'neutral' | 'recovering' | 'error';
    readonly message?: string;
}
