export type TrackId = string;

export type RestoreState =
    | 'available'
    | 'permission-required'
    | 'permission-denied'
    | 'file-missing'
    | 'content-changed'
    | 'not-persisted'
    | 'decode-error';

export interface TrackRecord {
    id: TrackId;
    name: string;
    mimeType: string;
    byteSize: number;
    lastModified: number;
    durationSeconds?: number;
    encodedSampleRate?: number;
    metadata: {
        title?: string;
        artist?: string;
        album?: string;
        artworkMimeType?: string;
    };
    trackHash?: string;
    handleKey?: string;
    restoreState: RestoreState;
}

export type PlaybackState =
    | 'empty'
    | 'loading'
    | 'paused'
    | 'playing'
    | 'ended'
    | 'error';

export type PlaybackErrorCode = 'decode' | 'context' | 'source' | 'unsupported';

export interface PlaybackError {
    code: PlaybackErrorCode;
    message: string;
}

export interface PlaybackSnapshot {
    trackId: TrackId | null;
    state: PlaybackState;
    currentTimeSeconds: number;
    durationSeconds: number;
    volume: number;
    error?: PlaybackError;
}

export type SessionPersistenceState =
    | 'idle'
    | 'restoring'
    | 'ready'
    | 'saving'
    | 'not-persisted'
    | 'unsupported-schema'
    | 'restore-error';

export interface SessionPersistenceSnapshot {
    state: SessionPersistenceState;
    message?: string;
}

export interface LocalAudioInput {
    file: File;
    handle?: FileSystemFileHandle;
}
