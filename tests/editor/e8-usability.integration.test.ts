import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AnalysisConsumerLease, AnalysisCoordinator } from '../../src/analysis/analysisCoordinator';
import type { AudioSessionService, RoutePlaybackLease } from '../../src/audio/audioSessionService';
import type { EditorDraftRepositoryPort } from '../../src/editor/editorDraftRepository';
import { EditorSessionController } from '../../src/editor/editorSessionController';
import type { EditorFileGateway } from '../../src/editor/fileIO';
import { resolveEditorUnavailableRecovery } from '../../src/editor/routeRecovery';
import type { EditorDraftEnvelopeV2 } from '../../src/editor/types';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type { DecodedAudioDescriptor, TrackRecord } from '../../src/types/audio';

const NOW = new Date('2026-09-03T00:00:00.000Z');
const track = (id: string, hash: string): TrackRecord => ({
    id,
    name: `${id}.wav`,
    mimeType: 'audio/wav',
    byteSize: 4096,
    lastModified: 1,
    durationSeconds: 12,
    encodedSampleRate: 48_000,
    metadata: { title: id },
    trackHash: hash,
    restoreState: 'file-missing',
});

class MemoryRepository implements EditorDraftRepositoryPort {
    envelope: EditorDraftEnvelopeV2 | null = null;
    replaceCount = 0;

    async restore() {
        return this.envelope ? structuredClone(this.envelope) : null;
    }
    async replace(value: EditorDraftEnvelopeV2) {
        this.replaceCount += 1;
        this.envelope = structuredClone(value);
    }
    async clear() {
        this.envelope = null;
    }
    async getLeaveWarningEnabled() {
        return true;
    }
    async setLeaveWarningEnabled() {}
    async getOverlayVisibility() {
        return null;
    }
    async setOverlayVisibility() {}
    close() {}
}

const analysisLease = (): AnalysisConsumerLease => ({
    token: crypto.randomUUID(),
    consumer: 'editor',
    setActiveFeatures: async () => undefined,
    requestWindowSeries: async () => null,
    requestCursorValue: async () => null,
    requestTempoEstimate: async () => null,
    getSeries: () => null,
    subscribe: () => () => undefined,
    release: () => undefined,
});

const analysisCoordinator = {
    getSnapshot: () => ({
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
    }),
    acquireConsumer: analysisLease,
} as unknown as AnalysisCoordinator;

const fileGateway: EditorFileGateway = {
    open: async () => null,
    save: async () => 'saved',
};

describe('Editor E8 unavailable recovery integration', () => {
    beforeEach(() => setActivePinia(createPinia()));

    test('recovers the same paused route without creating a draft on failure', async () => {
        const store = useAudioSessionStore();
        const routeTrack = track('track-a', 'a'.repeat(64));
        store.appendTracks([routeTrack]);
        store.setCurrentTrack(routeTrack.id);
        store.setPlayback({
            trackId: routeTrack.id,
            state: 'empty',
            currentTimeSeconds: 0,
            durationSeconds: 12,
            volume: 1,

            playbackRate: 1,
        });
        const repository = new MemoryRepository();
        let canAcquire = false;
        const audioSession = {
            acquireRoutePlayback: async (): Promise<RoutePlaybackLease> => {
                if (!canAcquire) throw new Error('route unavailable');
                return {
                    token: 'e8-playback',
                    consumer: 'editor',
                    trackId: routeTrack.id,
                    endedPolicy: 'repeat-one',
                    release: () => undefined,
                };
            },
            getDecodedTrackDescriptor: (): DecodedAudioDescriptor | null =>
                canAcquire
                    ? {
                          trackId: routeTrack.id,
                          revision: 1,
                          sampleRate: 48_000,
                          length: 576_000,
                          channelCount: 1,
                          durationSeconds: 12,
                      }
                    : null,
        } as unknown as AudioSessionService;
        const controller = new EditorSessionController({
            audioSession,
            analysisCoordinator,
            store,
            repository,
            fileGateway,
            now: () => NOW,
        });

        await controller.enter(routeTrack.id);
        expect(controller.getSnapshot().state).toBe('unavailable');
        expect(repository.replaceCount).toBe(0);

        canAcquire = true;
        store.updateTrack(routeTrack.id, { restoreState: 'available' });
        store.setPlayback({
            trackId: routeTrack.id,
            state: 'paused',
            currentTimeSeconds: 0,
            durationSeconds: 12,
            volume: 1,

            playbackRate: 1,
        });
        const decision = resolveEditorUnavailableRecovery({
            routeTrackId: routeTrack.id,
            queue: store.queue,
            currentTrackId: store.currentTrackId,
            playback: store.playback,
            persistenceState: store.persistence.state,
        });
        expect(decision).toMatchObject({
            kind: 'retry-route',
            trackId: routeTrack.id,
        });
        if (decision.kind === 'retry-route') {
            await controller.enter(decision.trackId);
        }
        await controller.flush();
        expect(controller.getSnapshot()).toMatchObject({
            state: 'ready',
            activeTrackId: routeTrack.id,
        });
        expect(store.playback.state).toBe('paused');
        expect(repository.replaceCount).toBe(1);
        await controller.dispose();
    });

    test('drops a late retry when a newer route has entered', async () => {
        const store = useAudioSessionStore();
        const trackA = track('track-a', 'a'.repeat(64));
        const trackB = track('track-b', 'b'.repeat(64));
        trackA.restoreState = 'available';
        trackB.restoreState = 'available';
        store.appendTracks([trackA, trackB]);
        let resolveTrackA!: () => void;
        const trackAGate = new Promise<void>(resolve => {
            resolveTrackA = resolve;
        });
        const releases: string[] = [];
        let descriptorTrackId: string | null = null;
        const audioSession = {
            acquireRoutePlayback: async ({ trackId }: { trackId: string }) => {
                if (trackId === trackA.id) await trackAGate;
                descriptorTrackId = trackId;
                return {
                    token: `e8-${trackId}`,
                    consumer: 'editor',
                    trackId,
                    endedPolicy: 'repeat-one',
                    release: () => releases.push(trackId),
                } satisfies RoutePlaybackLease;
            },
            getDecodedTrackDescriptor: (trackId: string): DecodedAudioDescriptor | null =>
                descriptorTrackId === trackId
                    ? {
                          trackId,
                          revision: 1,
                          sampleRate: 48_000,
                          length: 576_000,
                          channelCount: 1,
                          durationSeconds: 12,
                      }
                    : null,
        } as unknown as AudioSessionService;
        const repository = new MemoryRepository();
        const controller = new EditorSessionController({
            audioSession,
            analysisCoordinator,
            store,
            repository,
            fileGateway,
            now: () => NOW,
        });

        const staleEntry = controller.enter(trackA.id);
        await vi.waitFor(() =>
            expect(controller.getSnapshot()).toMatchObject({ state: 'loading', routeTrackId: trackA.id }),
        );
        const currentEntry = controller.enter(trackB.id);
        await currentEntry;
        resolveTrackA();
        await staleEntry;
        expect(controller.getSnapshot()).toMatchObject({
            state: 'ready',
            activeTrackId: trackB.id,
        });
        expect(releases).toContain(trackA.id);
        await controller.dispose();
    });
});
