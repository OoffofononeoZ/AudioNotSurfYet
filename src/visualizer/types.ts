import type { FeatureId } from '../analysis/types';
import type { EditorProjectV1, EditorTrackIdentityV1 } from '../editor/types';

export type VisualizerTemplateId = 'orthogonal-lines' | 'cube-swarm';
export type VisualizerResolution = '720p' | '1080p';
export type VisualizerFrameRate = 30 | 60;

export type VisualizerAnalysisComponent =
    | 'default'
    | 'total'
    | 'specific'
    | 'real'
    | 'imag'
    | 'magnitude'
    | 'phase';

export type VisualizerAnalysisProjectionV1 =
    | { kind: 'scalar' }
    | { kind: 'full' }
    | { kind: 'mean' | 'max' | 'peak' }
    | { kind: 'bin'; index: number }
    | { kind: 'band'; start: number; end: number };

export type VisualizerBindingSourceV1 =
    | { kind: 'constant'; value: number | string | boolean | number[] }
    | {
        kind: 'analysis';
        featureId: FeatureId;
        component?: VisualizerAnalysisComponent;
        projection: VisualizerAnalysisProjectionV1;
    }
    | { kind: 'editor-event'; laneId: string; innerClassId?: string };

export interface VisualizerNumericTransformV1 {
    inputMin: number;
    inputMax: number;
    outputMin: number;
    outputMax: number;
    clamp: boolean;
    invert: boolean;
    attackSeconds: number;
    releaseSeconds: number;
}
export interface VisualizerParameterBindingV1 {
    parameterId: string;
    source: VisualizerBindingSourceV1;
    transform?: VisualizerNumericTransformV1;
}

export interface VisualizerProjectV1 {
    format: 'audiosurf-visualizer';
    schemaVersion: 1;
    projectId: string;
    createdAt: string;
    updatedAt: string;
    track: EditorTrackIdentityV1;
    output: {
        aspectRatio: '16:9';
        resolution: VisualizerResolution;
        frameRate: VisualizerFrameRate;
    };
    scene: {
        templateId: VisualizerTemplateId;
        templateVersion: 1;
        seed: number;
        bindings: VisualizerParameterBindingV1[];
    };
    editorSnapshot?: {
        capturedAt: string;
        project: EditorProjectV1;
    };
}

export interface VisualizerTrackValidationContext {
    contentHash: string;
    durationSeconds: number;
    sampleRate: number;
}

export interface VisualizerDraftEnvelopeV1 {
    schemaVersion: 1;
    savedAt: string;
    project: VisualizerProjectV1;
}

export type VisualizerPersistenceState =
    | 'clean'
    | 'saving'
    | 'saved'
    | 'not-persisted';

export type VisualizerSessionState =
    | 'empty'
    | 'loading'
    | 'ready'
    | 'draft-conflict'
    | 'unavailable'
    | 'not-persisted';

export interface VisualizerSessionSnapshot {
    state: VisualizerSessionState;
    routeTrackId: string | null;
    activeTrackId: string | null;
    project: VisualizerProjectV1 | null;
    conflictingDraft: VisualizerDraftEnvelopeV1 | null;
    persistence: VisualizerPersistenceState;
    restoredFromDraft: boolean;
    message?: string;
}
