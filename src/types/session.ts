import type { RestoreState, TrackId, TrackRecord } from './audio';
import { validateSourceWorkspace, type AnalyzerSourceWorkspace } from '../analysis/sourceWorkspace';
import { FEATURE_IDS, isFeatureId, type ConfigHash, type FeatureId } from '../analysis/types';

export type TrackHash = string;
export type { ConfigHash, FeatureId };
export { FEATURE_IDS };

export interface ActiveAnalysisCard {
    slot: 0 | 1 | 2 | 3;
    featureId: FeatureId;
}

export type ActiveFeatureQueue = FeatureId[];

export interface PersistedAnalysisConfig {
    schemaVersion: 1;
    frameSize: 1024;
    hopSize: 512;
    windowingFunction: 'hanning';
    numberOfMFCCCoefficients: 13;
    channelMode: 'average-mono';
}

export interface PersistedTimelineViewport {
    startSeconds: number;
    endSeconds: number;
    zoom: number;
}

export interface TimelineViewport extends PersistedTimelineViewport {
    cursorSeconds: number;
}

export interface AnalysisWorkspaceSnapshot {
    sources?: AnalyzerSourceWorkspace;
    initialized: boolean;
    activeFeatureQueue: ActiveFeatureQueue;
    viewport: PersistedTimelineViewport | null;
}

export interface AnalysisWorkspaceUpdate {
    sources?: AnalyzerSourceWorkspace;
    activeFeatureQueue: ActiveFeatureQueue;
    viewport: PersistedTimelineViewport | null;
}

export interface PersistedSessionV1 {
    schemaVersion: 1;
    savedAt: string;
    queue: TrackRecord[];
    currentTrackId: TrackId | null;
    analyzerWorkspaceVersion?: 2;
    analysisSources?: AnalyzerSourceWorkspace;
    activeCards: ActiveAnalysisCard[];
    analysisConfig: PersistedAnalysisConfig;
    viewport: PersistedTimelineViewport | null;
    handles: Array<{ trackId: TrackId; handleKey: string }>;
    currentBlob?: {
        trackId: TrackId;
        blobKey: string;
        trackHash: TrackHash;
    };
    currentAnalysisCache?: {
        trackId: TrackId;
        trackHash: TrackHash;
        configHash: ConfigHash;
        featureIds: FeatureId[];
        cacheKeys: string[];
    };
}

export interface StoredHandle {
    trackId: TrackId;
    handleKey: string;
    handle: FileSystemFileHandle;
}

export interface StoredCurrentBlob {
    trackId: TrackId;
    blobKey: string;
    trackHash: TrackHash;
    blob: Blob;
}

export interface StoredAnalysisCache {
    manifest: NonNullable<PersistedSessionV1['currentAnalysisCache']>;
    payloads: Array<{ cacheKey: string; payload: ArrayBuffer }>;
}

export interface RestoredSessionBundle {
    session: PersistedSessionV1;
    handles: StoredHandle[];
    currentBlob?: StoredCurrentBlob;
    currentAnalysisCache?: StoredAnalysisCache;
}

export type RestoreResult<T> =
    | { ok: true; value: T; source: 'blob' | 'handle' | 'cache' }
    | {
          ok: false;
          state: Exclude<RestoreState, 'available'>;
          recoverable: boolean;
          detail?: string;
      };

export const DEFAULT_PERSISTED_ANALYSIS_CONFIG: PersistedAnalysisConfig = {
    schemaVersion: 1,
    frameSize: 1024,
    hopSize: 512,
    windowingFunction: 'hanning',
    numberOfMFCCCoefficients: 13,
    channelMode: 'average-mono',
};

export const cloneActiveAnalysisCards = (cards: readonly ActiveAnalysisCard[]): ActiveAnalysisCard[] =>
    cards.map(card => ({ ...card }));

export const cloneActiveFeatureQueue = (featureIds: readonly FeatureId[]): ActiveFeatureQueue => [...featureIds];

export const activeCardsToFeatureQueue = (cards: readonly ActiveAnalysisCard[]): ActiveFeatureQueue =>
    [...cards].sort((left, right) => left.slot - right.slot).map(card => card.featureId);

export const activeFeatureQueueToCards = (featureIds: readonly FeatureId[]): ActiveAnalysisCard[] =>
    featureIds.map((featureId, slot) => ({
        slot: slot as ActiveAnalysisCard['slot'],
        featureId,
    }));

export const clonePersistedTimelineViewport = (
    viewport: PersistedTimelineViewport | null,
): PersistedTimelineViewport | null => (viewport ? { ...viewport } : null);

export const assertValidAnalysisWorkspace = (workspace: AnalysisWorkspaceUpdate): void => {
    if (workspace.sources !== undefined) validateSourceWorkspace(workspace.sources);
    if (
        !Array.isArray(workspace.activeFeatureQueue) ||
        workspace.activeFeatureQueue.length > 4 ||
        workspace.activeFeatureQueue.some(featureId => !isFeatureId(featureId)) ||
        new Set(workspace.activeFeatureQueue).size !== workspace.activeFeatureQueue.length
    ) {
        throw new TypeError('Analysis workspace requires 0–4 unique active features.');
    }
    const viewport = workspace.viewport;
    if (
        viewport !== null &&
        (!Number.isFinite(viewport.startSeconds) ||
            !Number.isFinite(viewport.endSeconds) ||
            !Number.isFinite(viewport.zoom) ||
            viewport.startSeconds < 0 ||
            viewport.endSeconds <= viewport.startSeconds ||
            viewport.zoom <= 0)
    ) {
        throw new TypeError(
            'Analysis workspace viewport must be finite, ordered, non-negative, and positively zoomed.',
        );
    }
};

export const assertValidPersistedActiveCards = (cards: readonly ActiveAnalysisCard[]): void => {
    if (
        cards.length > 4 ||
        cards.some(card => !card || ![0, 1, 2, 3].includes(card.slot) || !isFeatureId(card.featureId)) ||
        new Set(cards.map(card => card.slot)).size !== cards.length ||
        new Set(cards.map(card => card.featureId)).size !== cards.length
    ) {
        throw new TypeError('Persisted analysis cards require 0–4 unique slots and features.');
    }
};
