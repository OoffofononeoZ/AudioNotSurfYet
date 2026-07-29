import type {
    RestoreState,
    TrackId,
    TrackRecord,
} from './audio';
import {
    FEATURE_IDS,
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
