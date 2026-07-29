import { defineStore } from 'pinia';
import type {
    PlaybackSnapshot,
    SessionPersistenceSnapshot,
    TrackRecord,
} from '../types/audio';

const createEmptyPlayback = (): PlaybackSnapshot => ({
    trackId: null,
    state: 'empty',
    currentTimeSeconds: 0,
    durationSeconds: 0,
    volume: 1,
});

interface AudioSessionState {
    queue: TrackRecord[];
    currentTrackId: string | null;
    playback: PlaybackSnapshot;
    currentEnergy: number;
    persistence: SessionPersistenceSnapshot;
}

export const useAudioSessionStore = defineStore('audio-session', {
    state: (): AudioSessionState => ({
        queue: [],
        currentTrackId: null,
        playback: createEmptyPlayback(),
        currentEnergy: 0,
        persistence: {
            state: 'idle',
        },
    }),
    actions: {
        hydrateSession(
            queue: TrackRecord[],
            currentTrackId: string | null,
            volume: number,
        ) {
            this.queue = queue.map((track) => ({
                ...track,
                metadata: { ...track.metadata },
            }));
            this.currentTrackId = currentTrackId;
            this.playback = {
                trackId: currentTrackId,
                state: currentTrackId ? 'loading' : 'empty',
                currentTimeSeconds: 0,
                durationSeconds:
                    this.queue.find(
                        (track) => track.id === currentTrackId,
                    )?.durationSeconds ?? 0,
                volume,
            };
            this.currentEnergy = 0;
        },
        appendTracks(tracks: TrackRecord[]) {
            this.queue.push(...tracks);
        },
        removeTrack(trackId: string) {
            const index = this.queue.findIndex((track) => track.id === trackId);
            if (index >= 0) this.queue.splice(index, 1);
        },
        updateTrack(trackId: string, patch: Partial<TrackRecord>) {
            const index = this.queue.findIndex((track) => track.id === trackId);
            if (index < 0) return;
            const current = this.queue[index];
            if (!current) return;
            this.queue[index] = {
                ...current,
                ...patch,
                metadata: {
                    ...current.metadata,
                    ...patch.metadata,
                },
            };
        },
        setCurrentTrack(trackId: string | null) {
            this.currentTrackId = trackId;
        },
        setPlayback(snapshot: PlaybackSnapshot) {
            this.playback = {
                ...snapshot,
                error: snapshot.error ? { ...snapshot.error } : undefined,
            };
        },
        setEnergy(energy: number) {
            this.currentEnergy = Number.isFinite(energy)
                ? Math.max(0, energy)
                : 0;
        },
        setPersistence(snapshot: SessionPersistenceSnapshot) {
            this.persistence = {
                ...snapshot,
            };
        },
        clearSession(volume?: number) {
            const nextVolume = volume ?? this.playback.volume;
            this.queue = [];
            this.currentTrackId = null;
            this.playback = {
                ...createEmptyPlayback(),
                volume: nextVolume,
            };
            this.currentEnergy = 0;
            this.persistence = {
                state: 'ready',
            };
        },
    },
});
