import type { EditorProjectV1, EditorTrackIdentityV1 } from '../editor/types';
import type { VisualizerParameterBindingV1, VisualizerResolution, VisualizerFrameRate, VisualizerBindingRuntimeSnapshot, VisualizerRecordingState, VisualizerPersistenceState, VisualizerSessionState } from './types';

export type ElementType = 'solid' | 'spectral-strings' | 'spectral-dots' | 'reactive-rings'
    | 'radial-spectrum' | 'orbit-solids' | 'wireform' | 'arc-lattice' | 'light-tunnel' | 'starfield'
    | 'scale' | 'blur' | 'fade';
export type ElementKind = 'visual' | 'modifier' | 'transition';
export type ElementTiming =
    | { kind: 'manual'; startSeconds: number; endSeconds: number }
    | { kind: 'editor-range'; laneId: string; eventId: string }
    | { kind: 'unbound' };
export type ElementBinding = Omit<VisualizerParameterBindingV1, 'source'> & {
    source: Exclude<VisualizerParameterBindingV1['source'], { kind: 'editor-event' }> | { kind: 'unbound' };
};
export type EffectTargets = { kind: 'composition' } | { kind: 'elements'; ids: string[] };
export interface VisualizerElement {
    id: string;
    type: ElementType;
    version: 1;
    name: string;
    enabled: boolean;
    layer: number;
    timing: ElementTiming;
    bindings: ElementBinding[];
    targets?: EffectTargets;
}
export interface VisualizerProjectV3 {
    format: 'audiosurf-visualizer';
    schemaVersion: 3;
    projectId: string;
    createdAt: string;
    updatedAt: string;
    track: EditorTrackIdentityV1;
    output: { aspectRatio: '16:9'; resolution: VisualizerResolution; frameRate: VisualizerFrameRate };
    seed: number;
    elements: VisualizerElement[];
    editorSnapshot?: { capturedAt: string; project: EditorProjectV1 };
}
export interface CompositionDraft {
    schemaVersion: 3;
    savedAt: string;
    project: VisualizerProjectV3;
}

export interface CompositionSessionSnapshot {
    state: VisualizerSessionState | 'unsupported-draft';
    routeTrackId:string|null;
    activeTrackId:string|null;
    project:VisualizerProjectV3|null;
    conflictingDraft:CompositionDraft|null;
    unsupportedDraft:unknown;
    persistence:VisualizerPersistenceState;
    restoredFromDraft:boolean;
    bindingRuntime:VisualizerBindingRuntimeSnapshot;
    recording:VisualizerRecordingState;
    message?:string;
}
