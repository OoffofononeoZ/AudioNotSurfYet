import type {
    PlaybackSnapshot,
    SessionPersistenceState,
    TrackRecord,
} from '../types/audio';

const READY_PLAYBACK_STATES = new Set<PlaybackSnapshot['state']>([
    'paused',
    'playing',
    'ended',
]);

const RUNTIME_READY_RESTORE_STATES = new Set<TrackRecord['restoreState']>([
    'available',
    'not-persisted',
]);

export type EditorUnavailableRecoveryDecision =
    | {
        kind: 'retry-route';
        trackId: string;
        signature: string;
    }
    | {
        kind: 'offer-current';
        trackId: string;
        title: string;
    }
    | { kind: 'none' };

export interface EditorUnavailableRecoveryInput {
    routeTrackId: string | null;
    queue: readonly TrackRecord[];
    currentTrackId: string | null;
    playback: PlaybackSnapshot;
    persistenceState: SessionPersistenceState;
}

const playableTrack = (
    track: TrackRecord | undefined,
    playback: PlaybackSnapshot,
): track is TrackRecord => Boolean(
    track?.trackHash
    && playback.trackId === track.id
    && READY_PLAYBACK_STATES.has(playback.state),
);

export const resolveEditorUnavailableRecovery = (
    input: EditorUnavailableRecoveryInput,
): EditorUnavailableRecoveryDecision => {
    const {
        routeTrackId,
        queue,
        currentTrackId,
        playback,
        persistenceState,
    } = input;
    if (!routeTrackId || persistenceState === 'restoring') {
        return { kind: 'none' };
    }

    const routeTrack = queue.find((track) => track.id === routeTrackId);
    const routePlaybackReady = playableTrack(routeTrack, playback);
    const routeCanBeAcquired = Boolean(
        routeTrack?.trackHash
        && currentTrackId !== routeTrackId
        && RUNTIME_READY_RESTORE_STATES.has(routeTrack.restoreState),
    );
    if (routeTrack && (routePlaybackReady || routeCanBeAcquired)) {
        return {
            kind: 'retry-route',
            trackId: routeTrackId,
            signature: [
                routeTrackId,
                routeTrack.trackHash,
                routeTrack.restoreState,
                routePlaybackReady ? 'playback-ready' : 'route-acquirable',
            ].join(':'),
        };
    }

    if (currentTrackId && currentTrackId !== routeTrackId) {
        const currentTrack = queue.find((track) => track.id === currentTrackId);
        if (playableTrack(currentTrack, playback)) {
            return {
                kind: 'offer-current',
                trackId: currentTrackId,
                title: currentTrack.metadata.title || currentTrack.name,
            };
        }
    }

    return { kind: 'none' };
};
