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
    | 'buffering'
    | 'paused'
    | 'playing'
    | 'ended'
    | 'error';

export type PlaybackErrorCode = 'decode' | 'context' | 'source' | 'unsupported' | 'audition-read';

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
    audition?: {
        kind:'original'|'ft'|'auxiliary';label:string;resultId?:string;
        roles:string[];mutedRoles:string[];
    };
}

export interface DecodedAudioDescriptor {
    trackId: TrackId;
    revision: number;
    sampleRate: number;
    length: number;
    channelCount: number;
    durationSeconds: number;
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
