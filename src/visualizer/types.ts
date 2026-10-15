import type { FeatureId } from '../analysis/types';

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

export interface VisualizerTrackValidationContext {
    contentHash: string;
    durationSeconds: number;
    sampleRate: number;
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

export type VisualizerEditorSnapshotSource =
    | 'none'
    | 'project'
    | 'draft'
    | 'imported';

export interface VisualizerBindingRuntimeSnapshot {
    bindingRevision: number;
    activeFeatureIds: FeatureId[];
    readyFeatureIds: FeatureId[];
    analysisState: 'idle' | 'loading' | 'ready' | 'error';
    analysisProgress: number;
    analysisMessage?: string;
    editorSnapshotSource: VisualizerEditorSnapshotSource;
}

export type VisualizerRecordingErrorCode =
    | 'recording-busy'
    | 'output-pending'
    | 'track-mismatch'
    | 'analysis-not-ready'
    | 'binding-invalid'
    | 'renderer-unavailable'
    | 'context-lost'
    | 'capture-unsupported'
    | 'capture-security'
    | 'preset-unavailable'
    | 'mime-unavailable'
    | 'audio-track-unavailable'
    | 'video-track-unavailable'
    | 'recorder-start-failed'
    | 'recorder-failed'
    | 'track-ended'
    | 'identity-changed'
    | 'empty-output';

export type VisualizerRecordingState =
    | { status: 'idle' }
    | { status: 'preparing' }
    | { status: 'recording'; startedAtContextTime: number; mimeType: string }
    | { status: 'finalizing'; mimeType: string }
    | { status: 'ready'; mimeType: string; byteLength: number }
    | {
        status: 'error';
        code: VisualizerRecordingErrorCode;
        message: string;
    };
