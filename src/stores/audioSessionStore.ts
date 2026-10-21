import { defineStore } from 'pinia';
import type { PlaybackSnapshot, SessionPersistenceSnapshot, TrackRecord } from '../types/audio';
import type { AnalysisCoordinatorSnapshot, FeatureId } from '../analysis/types';
import { cloneSourceWorkspace } from '../analysis/sourceWorkspace';
import {
    cloneActiveFeatureQueue,
    clonePersistedTimelineViewport,
    type AnalysisWorkspaceSnapshot,
    type PersistedSessionV1,
} from '../types/session';

const createEmptyPlayback = (): PlaybackSnapshot => ({
    trackId: null,
    state: 'empty',
    currentTimeSeconds: 0,
    durationSeconds: 0,
    volume: 1,
    playbackRate: 1,
});

interface AudioSessionState {
    queue: TrackRecord[];
    currentTrackId: string | null;
    playback: PlaybackSnapshot;
    currentEnergy: number;
    persistence: SessionPersistenceSnapshot;
    analysis: AnalysisCoordinatorSnapshot;
    analysisWorkspace: AnalysisWorkspaceSnapshot;
    analysisCacheManifest: NonNullable<PersistedSessionV1['currentAnalysisCache']> | null;
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
        analysis: {
            state: 'idle',
            generation: 0,
            trackId: null,
            trackHash: null,
            configHash: null,
            sampleRate: null,
            activeFeatureIds: [],
            readyFeatureIds: [],
            completedFrames: 0,
            totalFrames: 0,
            progress: 0,
            cacheState: 'idle',
            staleMessageCount: 0,
        },
        analysisWorkspace: {
            initialized: false,
            activeFeatureQueue: [],
            viewport: null,
        },
        analysisCacheManifest: null,
    }),
    actions: {
        hydrateSession(
            queue: TrackRecord[],
            currentTrackId: string | null,
            volume: number,
            workspace?: Omit<AnalysisWorkspaceSnapshot, 'initialized'>,
        ) {
            this.queue = queue.map(track => ({
                ...track,
                metadata: { ...track.metadata },
            }));
            this.currentTrackId = currentTrackId;
            this.playback = {
                trackId: currentTrackId,
                state: currentTrackId ? 'loading' : 'empty',
                currentTimeSeconds: 0,
                durationSeconds: this.queue.find(track => track.id === currentTrackId)?.durationSeconds ?? 0,
                volume,
                playbackRate: this.playback.playbackRate,
            };
            this.currentEnergy = 0;
            if (workspace) {
                this.analysisWorkspace = {
                    initialized: true,
                    ...(workspace.sources ? { sources: cloneSourceWorkspace(workspace.sources) } : {}),
                    activeFeatureQueue: cloneActiveFeatureQueue(workspace.activeFeatureQueue),
                    viewport: clonePersistedTimelineViewport(workspace.viewport),
                };
            }
        },
        appendTracks(tracks: TrackRecord[]) {
            this.queue.push(...tracks);
        },
        removeTrack(trackId: string) {
            const index = this.queue.findIndex(track => track.id === trackId);
            if (index >= 0) this.queue.splice(index, 1);
        },
        updateTrack(trackId: string, patch: Partial<TrackRecord>) {
            const index = this.queue.findIndex(track => track.id === trackId);
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
            this.currentEnergy = Number.isFinite(energy) ? Math.max(0, energy) : 0;
        },
        setPersistence(snapshot: SessionPersistenceSnapshot) {
            this.persistence = {
                ...snapshot,
            };
        },
        setAnalysis(snapshot: AnalysisCoordinatorSnapshot) {
            this.analysis = {
                ...snapshot,
                activeFeatureIds: [...snapshot.activeFeatureIds],
                readyFeatureIds: [...snapshot.readyFeatureIds],
                error: snapshot.error ? { ...snapshot.error } : undefined,
            };
        },
        setAnalysisWorkspace(snapshot: AnalysisWorkspaceSnapshot) {
            this.analysisWorkspace = {
                initialized: snapshot.initialized,
                ...(snapshot.sources ? { sources: cloneSourceWorkspace(snapshot.sources) } : {}),
                activeFeatureQueue: cloneActiveFeatureQueue(snapshot.activeFeatureQueue),
                viewport: clonePersistedTimelineViewport(snapshot.viewport),
            };
        },
        setAnalysisCacheManifest(manifest: NonNullable<PersistedSessionV1['currentAnalysisCache']> | null) {
            this.analysisCacheManifest = manifest
                ? {
                      ...manifest,
                      featureIds: [...manifest.featureIds] as FeatureId[],
                      cacheKeys: [...manifest.cacheKeys],
                  }
                : null;
        },
        clearSession(volume?: number) {
            const nextVolume = volume ?? this.playback.volume;
            this.queue = [];
            this.currentTrackId = null;
            this.playback = {
                ...createEmptyPlayback(),
                volume: nextVolume,
                playbackRate: this.playback.playbackRate,
            };
            this.currentEnergy = 0;
            this.persistence = {
                state: 'ready',
            };
            this.analysis = {
                state: 'idle',
                generation: this.analysis.generation + 1,
                trackId: null,
                trackHash: null,
                configHash: null,
                sampleRate: null,
                activeFeatureIds: [],
                readyFeatureIds: [],
                completedFrames: 0,
                totalFrames: 0,
                progress: 0,
                cacheState: 'idle',
                staleMessageCount: this.analysis.staleMessageCount,
            };
            this.analysisWorkspace = {
                initialized: false,
                activeFeatureQueue: [],
                viewport: null,
            };
            this.analysisCacheManifest = null;
        },
    },
});
