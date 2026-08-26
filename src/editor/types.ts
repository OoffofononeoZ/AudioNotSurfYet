import type { FeatureId } from '../analysis/types';
import type { PersistedTimelineViewport } from '../types/session';

export type EditorId = string;
export type EditorSeconds = number;
export type MeterDenominator = 1 | 2 | 4 | 8 | 16 | 32;

export interface EditorTrackIdentityV1 {
    contentHash: string;
    fileName: string;
    title?: string;
    artist?: string;
    durationSeconds: EditorSeconds;
    sampleRate?: number;
}

export interface MeteredTempoSegmentV1 {
    id: EditorId;
    startSeconds: EditorSeconds;
    mode: 'metered';
    bpm: number | null;
    bpmSource: 'unset' | 'estimated' | 'user';
    meter: {
        numerator: number;
        denominator: MeterDenominator;
    };
}

export interface SingleBeatTempoSegmentV1 {
    id: EditorId;
    startSeconds: EditorSeconds;
    mode: 'single-beat';
}

export type TempoSegmentV1 =
    | MeteredTempoSegmentV1
    | SingleBeatTempoSegmentV1;

export interface InnerClassV1 {
    id: EditorId;
    label: string;
}

export interface PointEventV1 {
    id: EditorId;
    innerClassId: EditorId;
    atSeconds: EditorSeconds;
}

export interface RangeEventV1 {
    id: EditorId;
    innerClassId: EditorId;
    startSeconds: EditorSeconds;
    endSeconds: EditorSeconds;
}

export interface PointLaneV1 {
    id: EditorId;
    name: string;
    eventKind: 'point';
    innerClasses: InnerClassV1[];
    events: PointEventV1[];
}

export interface RangeLaneV1 {
    id: EditorId;
    name: string;
    eventKind: 'range';
    innerClasses: InnerClassV1[];
    events: RangeEventV1[];
}

export type EditorLaneV1 = PointLaneV1 | RangeLaneV1;

export interface EditorProjectV1 {
    format: 'audiosurf-editor';
    schemaVersion: 1;
    projectId: EditorId;
    createdAt: string;
    updatedAt: string;
    track: EditorTrackIdentityV1;
    tempoMap: TempoSegmentV1[];
    lanes: EditorLaneV1[];
    workspace: {
        viewport: PersistedTimelineViewport;
        overlay: {
            featureId: FeatureId | null;
            topRatio: number;
            heightRatio: number;
        };
    };
}

export interface EditorDraftEnvelopeV1 {
    schemaVersion: 1;
    savedAt: string;
    project: EditorProjectV1;
}

export interface EditorTrackValidationContext {
    contentHash: string;
    durationSeconds: number;
    sampleRate: number;
}

export interface CreateEditorProjectInput {
    track: EditorTrackIdentityV1;
    createId?: () => string;
    now?: () => Date;
}

export type EditorPersistenceState =
    | 'clean'
    | 'saving'
    | 'saved'
    | 'not-persisted';

export type EditorSessionState =
    | 'empty'
    | 'loading'
    | 'ready'
    | 'draft-conflict'
    | 'unavailable'
    | 'draft-error';

export interface EditorSessionSnapshot {
    state: EditorSessionState;
    routeTrackId: string | null;
    activeTrackId: string | null;
    project: EditorProjectV1 | null;
    conflictingDraft: EditorDraftEnvelopeV1 | null;
    persistence: EditorPersistenceState;
    restoredFromDraft: boolean;
    tempoEstimateState?:
        | 'idle'
        | 'estimating'
        | 'reliable'
        | 'low-confidence'
        | 'unavailable';
    tempoEstimateConfidence?: number;
    message?: string;
}
