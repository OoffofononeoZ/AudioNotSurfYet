import type {
    RestoreState,
    TrackId,
    TrackRecord,
} from './audio';
import {
    FEATURE_IDS,
    isFeatureId,
    type ConfigHash,
    type FeatureId,
} from '../analysis/types';

export type TrackHash = string;
export type { ConfigHash, FeatureId };
export { FEATURE_IDS };

export interface ActiveAnalysisCard {
    slot: 0 | 1 | 2 | 3;
    featureId: FeatureId;
}

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
    initialized: boolean;
    activeCards: ActiveAnalysisCard[];
    viewport: PersistedTimelineViewport | null;
}

export interface AnalysisWorkspaceUpdate {
    activeCards: ActiveAnalysisCard[];
    viewport: PersistedTimelineViewport | null;
}

export interface PersistedSessionV1 {
    schemaVersion: 1;
    savedAt: string;
    queue: TrackRecord[];
    currentTrackId: TrackId | null;
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

export const DEFAULT_PERSISTED_ANALYSIS_CONFIG:
PersistedAnalysisConfig = {
    schemaVersion: 1,
    frameSize: 1024,
    hopSize: 512,
    windowingFunction: 'hanning',
    numberOfMFCCCoefficients: 13,
    channelMode: 'average-mono',
};

export const cloneActiveAnalysisCards = (
    cards: readonly ActiveAnalysisCard[],
): ActiveAnalysisCard[] => cards.map((card) => ({ ...card }));

export const clonePersistedTimelineViewport = (
    viewport: PersistedTimelineViewport | null,
): PersistedTimelineViewport | null =>
    viewport ? { ...viewport } : null;

export const assertValidAnalysisWorkspace = (
    workspace: AnalysisWorkspaceUpdate,
): void => {
    if (
        !Array.isArray(workspace.activeCards)
        || workspace.activeCards.length > 4
        || workspace.activeCards.some((card) =>
            !card
            || ![0, 1, 2, 3].includes(card.slot)
            || !isFeatureId(card.featureId))
        || new Set(workspace.activeCards.map((card) => card.slot)).size
            !== workspace.activeCards.length
        || new Set(workspace.activeCards.map((card) => card.featureId)).size
            !== workspace.activeCards.length
    ) {
        throw new TypeError(
            'Analysis workspace requires 0–4 cards with unique slots and features.',
        );
    }
    const viewport = workspace.viewport;
    if (
        viewport !== null
        && (
            !Number.isFinite(viewport.startSeconds)
            || !Number.isFinite(viewport.endSeconds)
            || !Number.isFinite(viewport.zoom)
            || viewport.startSeconds < 0
            || viewport.endSeconds <= viewport.startSeconds
            || viewport.zoom <= 0
        )
    ) {
        throw new TypeError(
            'Analysis workspace viewport must be finite, ordered, non-negative, and positively zoomed.',
        );
    }
};
