import type { VisualizerExportState } from './exportTypes';
import type { EditorProjectV2, EditorTrackIdentityV1 } from '../editor/types';
import type {
    VisualizerParameterBindingV1,
    VisualizerResolution,
    VisualizerFrameRate,
    VisualizerBindingRuntimeSnapshot,
    VisualizerPersistenceState,
    VisualizerSessionState,
} from './types';
import type { NativeInputFeature } from './nativeAudioAnalysis';
import type { CompositionItem, ResourceRef, ResourceSnapshot } from './resourceTypes';
import type { MarkerBindings } from './editorMarkerTypes';

export type ElementKind = 'visual' | 'modifier' | 'transition';
export type ElementTiming =
    | { kind: 'manual'; startSeconds: number; endSeconds: number }
    | { kind: 'editor-range'; laneId: string; eventId: string }
    | { kind: 'unbound' };
export type ElementBinding = Omit<VisualizerParameterBindingV1, 'source'> & {
    source:
        | Exclude<VisualizerParameterBindingV1['source'], { kind: 'editor-event' }>
        | { kind: 'unbound' }
        | { kind: 'native'; featureId: NativeInputFeature };
};
export type EffectTargets = { kind: 'composition' } | { kind: 'elements'; ids: string[] };
export interface VisualizerElement {
    id: string;
    resource: ResourceRef;
    name: string;
    enabled: boolean;
    layer: number;
    timing: ElementTiming;
    bindings: ElementBinding[];
    markerBindings?: MarkerBindings;
    targets?: EffectTargets;
}
export interface VisualizerProjectV5 {
    format: 'audiosurf-visualizer';
    schemaVersion: 5;
    projectId: string;
    createdAt: string;
    updatedAt: string;
    track: EditorTrackIdentityV1;
    output: { aspectRatio: '16:9'; resolution: VisualizerResolution; frameRate: VisualizerFrameRate };
    seed: number | null;
    elements: VisualizerElement[];
    /** Each leaf is owned exactly once; sibling order determines render layers. */
    items: CompositionItem[];
    resources: ResourceSnapshot;
    editorSnapshot?: { capturedAt: string; project: EditorProjectV2 };
}
export interface CompositionDraft {
    schemaVersion: 5;
    savedAt: string;
    project: VisualizerProjectV5;
}

/** Renderer data shared by song projects and independent realtime styles. */
export type CompositionRenderModel = Pick<
    VisualizerProjectV5,
    'projectId' | 'seed' | 'elements' | 'items' | 'resources' | 'editorSnapshot'
>;

export interface CompositionSessionSnapshot {
    state: VisualizerSessionState | 'unsupported-draft';
    routeTrackId: string | null;
    activeTrackId: string | null;
    project: VisualizerProjectV5 | null;
    conflictingDraft: CompositionDraft | null;
    unsupportedDraft: unknown;
    persistence: VisualizerPersistenceState;
    restoredFromDraft: boolean;
    bindingRuntime: VisualizerBindingRuntimeSnapshot;
    export: VisualizerExportState;
    message?: string;
}
