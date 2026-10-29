import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AnalysisCoordinator, type AnalysisConsumerLease } from '../../src/analysis/analysisCoordinator';
import type { TempoEstimateResult } from '../../src/analysis/types';
import {
    AudioSessionService,
    type AudioEnginePort,
    type RoutePlaybackLease,
} from '../../src/audio/audioSessionService';
import {
    EditorDraftRepository,
    createEditorDraftEnvelope,
    type EditorDraftRepositoryPort,
} from '../../src/editor/editorDraftRepository';
import { EditorSessionController } from '../../src/editor/editorSessionController';
import type { EditorFileGateway } from '../../src/editor/fileIO';
import { createInitialEditorProject, encodeEditorProjectV2 } from '../../src/editor/projectCodec';
import type { EditorDraftEnvelopeV2, EditorProjectV2 } from '../../src/editor/types';
import type { SessionRepositoryPort } from '../../src/persistence/sessionRepository';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type { DecodedAudioDescriptor, PlaybackSnapshot, TrackRecord } from '../../src/types/audio';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const NOW = new Date('2026-08-26T01:00:00.000Z');

const track = (id: string, hash: string): TrackRecord => ({
    id,
    name: `${id}.wav`,
    mimeType: 'audio/wav',
    byteSize: 4096,
    lastModified: 1,
    durationSeconds: 12,
    encodedSampleRate: 48_000,
    metadata: { title: id, artist: 'Fixture' },
    trackHash: hash,
    restoreState: 'available',
});

const projectFor = (value: TrackRecord): EditorProjectV2 => {
    let id = 0;
    return createInitialEditorProject({
        track: {
            contentHash: value.trackHash!,
            fileName: value.name,
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: () => `${value.id}-id-${++id}`,
        now: () => NOW,
    });
};

class MemoryDraftRepository implements EditorDraftRepositoryPort {
    envelope: EditorDraftEnvelopeV2 | null = null;
    leaveWarning = true;
    failReplace = false;
    replaceCount = 0;
    overlayVisibility: { contentHash: string; enabled: boolean } | null = null;

    async restore() {
        return this.envelope ? structuredClone(this.envelope) : null;
    }

    async replace(envelope: EditorDraftEnvelopeV2) {
        this.replaceCount += 1;
        if (this.failReplace) throw new DOMException('quota', 'QuotaExceededError');
        this.envelope = structuredClone(envelope);
    }

    async clear() {
        this.envelope = null;
    }

    async getLeaveWarningEnabled() {
        return this.leaveWarning;
    }

    async setLeaveWarningEnabled(enabled: boolean) {
        this.leaveWarning = enabled;
    }

    async getOverlayVisibility(contentHash: string) {
        return this.overlayVisibility?.contentHash === contentHash ? this.overlayVisibility.enabled : null;
    }

    async setOverlayVisibility(contentHash: string, enabled: boolean) {
        this.overlayVisibility = { contentHash, enabled };
    }

    close() {}
}

const createControllerHarness = (
    draft: EditorDraftEnvelopeV2 | null = null,
    tempoRequest?: Promise<TempoEstimateResult | null>,
) => {
    const store = useAudioSessionStore();
    const trackA = track('track-a', HASH_A);
    const trackB = track('track-b', HASH_B);
    store.appendTracks([trackA, trackB]);
    const playbackReleases: string[] = [];
    const analysisReleases: string[] = [];
    const audioSession = {
        acquireRoutePlayback: async ({ trackId }: { trackId: string }): Promise<RoutePlaybackLease> => ({
            token: `play-${trackId}`,
            consumer: 'editor',
            trackId,
            endedPolicy: 'repeat-one',
            release: () => playbackReleases.push(trackId),
        }),
        getDecodedTrackDescriptor: (trackId: string): DecodedAudioDescriptor => ({
            trackId,
            revision: 1,
            sampleRate: 48_000,
            length: 576_000,
            channelCount: 1,
            durationSeconds: 12,
        }),
    };
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
            pcmState: 'empty',
            completedFrames: 0,
            totalFrames: 0,
            progress: 0,
            cacheState: 'idle',
            staleMessageCount: 0,
        }),
        acquireConsumer: (consumer: 'editor'): AnalysisConsumerLease => ({
            token: `analysis-${consumer}`,
            consumer,
            readStemWaveform: () => null,
            prepareStemWaveform: async () => undefined,
            setActiveInputs: async () => undefined,
            getSourceSnapshot: () =>
                analysisCoordinator.getSnapshot() as import('../../src/analysis/types').AnalysisCoordinatorSnapshot,
            setActiveFeatures: async () => undefined,
            requestWindowSeries: async () => null,
            requestCursorValue: async () => null,
            requestTempoEstimate: () => tempoRequest ?? Promise.resolve(null),
            getSeries: () => null,
            subscribe: listener => {
                if (tempoRequest) {
                    listener({
                        state: 'ready',
                        generation: 1,
                        trackId: 'track-a',
                        trackHash: HASH_A,
                        configHash: 'e2-config',
                        sampleRate: 48_000,
                        activeFeatureIds: ['buffer'],
                        readyFeatureIds: ['buffer'],
                        pcmState: 'ready',
                        completedFrames: 1,
                        totalFrames: 1,
                        progress: 1,
                        cacheState: 'miss',
                        staleMessageCount: 0,
                    });
                }
                return () => undefined;
            },
            release: () => analysisReleases.push(consumer),
        }),
    };
    const repository = new MemoryDraftRepository();
    repository.envelope = draft;
    const savedFiles: Uint8Array[] = [];
    let openedBytes: ArrayBuffer | null = null;
    const fileGateway: EditorFileGateway = {
        open: async () => (openedBytes ? { name: 'fixture.audiosurf-editor.json', bytes: openedBytes } : null),
        save: async (_codec, _name, bytes) => {
            savedFiles.push(bytes.slice());
            return 'saved';
        },
    };
    let id = 0;
    const controller = new EditorSessionController({
        audioSession: audioSession as unknown as AudioSessionService,
        analysisCoordinator: analysisCoordinator as unknown as AnalysisCoordinator,
        store,
        repository,
        fileGateway,
        createId: () => `generated-${++id}`,
        now: () => NOW,
    });
    return {
        controller,
        repository,
        trackA,
        trackB,
        playbackReleases,
        analysisReleases,
        savedFiles,
        fileGateway,
        setOpenedBytes: (bytes: Uint8Array | null) => {
            openedBytes = bytes
                ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
                : null;
        },
    };
};

class RepeatEngine implements AudioEnginePort {
    async prepareEncodedAudio(): Promise<never> {
        throw Error('Audio preparation is not used by this fixture.');
    }
    hasPreparedAudio() {
        return false;
    }
    commitPreparedAudio() {
        throw Error('Audio preparation is not used by this fixture.');
    }
    discardPreparedAudio() {}

    async setAuditionSource() {}
    setAuditionMuted() {}
    snapshot: PlaybackSnapshot = {
        trackId: 'track-a',
        state: 'paused',
        currentTimeSeconds: 5,
        durationSeconds: 12,
        volume: 1,

        playbackRate: 1,
    };
    listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
    seekValues: number[] = [];
    playCount = 0;

    async load(): Promise<'loaded'> {
        return 'loaded';
    }
    async play() {
        this.playCount += 1;
        this.emit({ ...this.snapshot, state: 'playing' });
    }
    pause() {
        this.emit({ ...this.snapshot, state: 'paused' });
    }
    async seek(seconds: number) {
        this.seekValues.push(seconds);
        this.emit({ ...this.snapshot, currentTimeSeconds: seconds });
    }
    async setPlaybackRate(playbackRate: number) {
        this.snapshot.playbackRate = playbackRate;
    }
    setVolume(volume: number) {
        this.emit({ ...this.snapshot, volume });
    }
    getSnapshot() {
        return { ...this.snapshot };
    }
    getTimeDomainFloatData() {
        return null;
    }
    getDecodedAudioDescriptor(): DecodedAudioDescriptor {
        return {
            trackId: 'track-a',
            revision: 1,
            sampleRate: 48_000,
            length: 576_000,
            channelCount: 1,
            durationSeconds: 12,
        };
    }
    capturePlaybackCheckpoint() {
        return null;
    }
    async restorePlaybackCheckpoint(): Promise<void> {}
    acquireRecordingTap(): never {
        throw new Error('not implemented');
    }
    copyDecodedChannelRange() {
        return null;
    }
    subscribe(listener: (snapshot: PlaybackSnapshot) => void) {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }
    unload() {}
    async dispose() {}
    finish() {
        this.emit({ ...this.snapshot, state: 'ended', currentTimeSeconds: 12 });
    }
    private emit(snapshot: PlaybackSnapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners) listener(this.getSnapshot());
    }
}

describe('Editor E1 foundation integration', () => {
    test.each([false, true])(
        'writes a migrated draft through autosave and preserves it on quota failure (%s)',
        async fail => {
            const h = createControllerHarness();
            const previous = { schemaVersion: 2 as const, savedAt: NOW.toISOString(), project: projectFor(h.trackA) };
            h.repository.envelope = previous;
            const restored = { ...previous, migratedFromV1: true as const };
            vi.spyOn(h.repository, 'restore').mockResolvedValue(restored);
            h.repository.failReplace = fail;
            await h.controller.enter(h.trackA.id);
            await h.controller.flush();
            expect(h.controller.getSnapshot()).toMatchObject({
                state: 'ready',
                persistence: fail ? 'not-persisted' : 'saved',
                project: { schemaVersion: 2 },
            });
            expect(h.repository.replaceCount).toBeGreaterThan(0);
            expect(h.repository.envelope).toEqual(previous);
            await h.controller.dispose();
        },
    );
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    test('persists the independent latest draft and leave-warning preference', async () => {
        const databaseName = `editor-e1-${crypto.randomUUID()}`;
        const repository = new EditorDraftRepository({ indexedDB, databaseName });
        const project = projectFor(track('track-a', HASH_A));
        await repository.replace(createEditorDraftEnvelope(project, () => NOW));
        await repository.setLeaveWarningEnabled(false);
        expect(await repository.restore()).toEqual({
            schemaVersion: 2,
            savedAt: NOW.toISOString(),
            project,
        });
        expect(await repository.getLeaveWarningEnabled()).toBe(false);
        await repository.clear();
        expect(await repository.restore()).toBeNull();
        repository.close();
    });

    test('creates, saves and restores a same-track project', async () => {
        const first = createControllerHarness();
        await first.controller.enter(first.trackA.id);
        await first.controller.flush();
        expect(first.controller.getSnapshot()).toMatchObject({
            state: 'ready',
            activeTrackId: 'track-a',
            restoredFromDraft: false,
            persistence: 'saved',
        });
        const envelope = first.repository.envelope;
        expect(envelope?.project.track.contentHash).toBe(HASH_A);

        const second = createControllerHarness(envelope);
        await second.controller.enter(second.trackA.id);
        expect(second.controller.getSnapshot()).toMatchObject({
            state: 'ready',
            activeTrackId: 'track-a',
            restoredFromDraft: true,
        });
        await first.controller.dispose();
        await second.controller.dispose();
    });

    test('requires an explicit cross-track choice and can restore the old draft', async () => {
        const oldProject = projectFor(track('track-a', HASH_A));
        const harness = createControllerHarness(createEditorDraftEnvelope(oldProject, () => NOW));
        await harness.controller.enter(harness.trackB.id);
        expect(harness.controller.getSnapshot()).toMatchObject({
            state: 'draft-conflict',
            activeTrackId: 'track-b',
        });
        expect(await harness.controller.exportConflictingDraft()).toBe('saved');
        expect(harness.savedFiles).toHaveLength(1);
        const resolution = await harness.controller.cancelConflictingEntry();
        expect(resolution).toEqual({ kind: 'restored-old', trackId: 'track-a' });
        expect(harness.controller.getSnapshot()).toMatchObject({
            state: 'ready',
            activeTrackId: 'track-a',
            restoredFromDraft: true,
        });
        await harness.controller.dispose();
    });

    test('consumes a confirmed track switch once and keeps ordinary entry conflicts', async () => {
        const h = createControllerHarness();
        await h.controller.enter(h.trackA.id);
        const approval = await h.controller.approveTrackChange(h.trackB.id);
        expect(approval).not.toBeNull();
        await h.controller.enter(h.trackB.id, approval!);
        expect(h.controller.getSnapshot().state).toBe('ready');
        await h.controller.flush();
        await h.controller.enter(h.trackA.id, approval!);
        expect(h.controller.getSnapshot().state).toBe('draft-conflict');
        await h.controller.dispose();
    });

    test('binds approval to the destination and source revision and blocks failed saves', async () => {
        const h = createControllerHarness();
        await h.controller.enter(h.trackA.id);
        const approval = await h.controller.approveTrackChange(h.trackB.id);
        expect(h.controller.isTrackChangeApproved(approval!, null)).toBe(false);
        h.controller.updateProject(h.controller.getSnapshot().project!);
        expect(h.controller.isTrackChangeApproved(approval!, h.trackB.id)).toBe(false);
        h.repository.failReplace = true;
        expect(await h.controller.approveTrackChange(h.trackB.id)).toBeNull();
        expect(h.controller.getSnapshot().activeTrackId).toBe(h.trackA.id);
        expect(await h.controller.exportProject()).toBe('saved');
        h.repository.failReplace = false;
        expect(await h.controller.approveTrackChange(h.trackB.id)).not.toBeNull();
        await h.controller.dispose();
    });

    test('freezes late tempo results after confirming a track change', async () => {
        let resolveTempo!: (value: TempoEstimateResult | null) => void;
        const tempo = new Promise<TempoEstimateResult | null>(resolve => {
            resolveTempo = resolve;
        });
        const h = createControllerHarness(null, tempo);
        await h.controller.enter(h.trackA.id);
        await vi.waitFor(() => expect(h.controller.getSnapshot().tempoEstimateState).toBe('estimating'));
        const project = h.controller.getSnapshot().project;
        const token = await h.controller.approveTrackChange(h.trackB.id);
        resolveTempo({
            kind: 'tempo-estimate-result',
            requestId: 'late-after-confirm',
            generation: 1,
            trackHash: HASH_A,
            configHash: 'config',
            state: 'reliable',
            bpm: 140,
            confidence: 0.95,
        });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(h.controller.getSnapshot().project).toEqual(project);
        expect(h.controller.isTrackChangeApproved(token!, h.trackB.id)).toBe(true);
        await h.controller.enter(h.trackB.id, token!);
        expect(h.controller.getSnapshot().state).toBe('ready');
        await h.controller.dispose();
    });

    test('validates imports before atomic replacement', async () => {
        const harness = createControllerHarness();
        await harness.controller.enter(harness.trackA.id);
        await harness.controller.flush();
        const before = harness.controller.getSnapshot().project;
        harness.setOpenedBytes(new TextEncoder().encode('{'));
        await expect(harness.controller.importProject()).rejects.toThrow();
        expect(harness.controller.getSnapshot().project).toEqual(before);

        const imported = structuredClone(before)!;
        imported.updatedAt = '2026-08-26T01:01:00.000Z';
        harness.setOpenedBytes(encodeEditorProjectV2(imported));
        await expect(harness.controller.importProject()).resolves.toBe('imported');
        expect(harness.repository.envelope?.project.updatedAt).toBe('2026-08-26T01:01:00.000Z');
        await harness.controller.dispose();
    });

    test.each(['edit', 'leave', 'dispose'])('ignores a delayed project import after %s', async action => {
        const h = createControllerHarness();
        await h.controller.enter(h.trackA.id);
        let finish!: (value: { name: string; bytes: ArrayBuffer }) => void;
        vi.spyOn(h.fileGateway, 'open').mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finish = resolve;
                }),
        );
        const importing = h.controller.importProject();
        if (action === 'edit') {
            const project = h.controller.getSnapshot().project!;
            const segment = project.tempoMap[0]!;
            if (segment.mode !== 'metered') throw Error('Expected metered fixture');
            segment.bpm = 123;
            segment.bpmSource = 'user';
            h.controller.updateProject(project, true);
            await h.controller.flush();
        } else if (action === 'leave') await h.controller.leave();
        else await h.controller.dispose();
        const expected = h.controller.getSnapshot().project;
        finish({ name: 'stale.json', bytes: new TextEncoder().encode('{').buffer });
        expect(await importing).toBe('cancelled');
        expect(h.controller.getSnapshot().project).toEqual(expected);
        await h.controller.dispose();
    });

    test('a newer project choice wins over an older picker result', async () => {
        const h = createControllerHarness();
        await h.controller.enter(h.trackA.id);
        const project = h.controller.getSnapshot().project!;
        project.updatedAt = '2026-08-26T02:00:00.000Z';
        let finish!: (value: { name: string; bytes: ArrayBuffer }) => void;
        vi.spyOn(h.fileGateway, 'open')
            .mockImplementationOnce(
                () =>
                    new Promise(resolve => {
                        finish = resolve;
                    }),
            )
            .mockResolvedValueOnce({ name: 'new.json', bytes: encodeEditorProjectV2(project).buffer as ArrayBuffer });
        const old = h.controller.importProject();
        expect(await h.controller.importProject()).toBe('imported');
        finish({ name: 'old.json', bytes: new TextEncoder().encode('{').buffer });
        expect(await old).toBe('cancelled');
        expect(h.controller.getSnapshot().project?.updatedAt).toBe(project.updatedAt);
        await h.controller.dispose();
    });

    test('a delayed export does not clear the leave warning for edits made while saving', async () => {
        const h = createControllerHarness();
        await h.controller.enter(h.trackA.id);
        const first = h.controller.getSnapshot().project!;
        const firstSegment = first.tempoMap[0]!;
        if (firstSegment.mode !== 'metered') throw Error('Expected metered fixture');
        firstSegment.bpm = 111;
        firstSegment.bpmSource = 'user';
        h.controller.updateProject(first, true);
        await h.controller.flush();
        let finish!: (result: 'saved') => void;
        vi.spyOn(h.fileGateway, 'save').mockImplementationOnce(
            () =>
                new Promise(resolve => {
                    finish = resolve;
                }),
        );
        const exporting = h.controller.exportProject();
        const next = h.controller.getSnapshot().project!;
        const nextSegment = next.tempoMap[0]!;
        if (nextSegment.mode !== 'metered') throw Error('Expected metered fixture');
        nextSegment.bpm = 128;
        h.controller.updateProject(next, true);
        await h.controller.flush();
        finish('saved');
        expect(await exporting).toBe('saved');
        expect(h.controller.shouldWarnOnLeave()).toBe(true);
        expect(h.controller.getSnapshot().project?.tempoMap[0]).toMatchObject({ bpm: 128 });
        await h.controller.dispose();
    });

    test('retains the in-memory project when draft persistence fails', async () => {
        const harness = createControllerHarness();
        harness.repository.failReplace = true;
        await harness.controller.enter(harness.trackA.id);
        await harness.controller.flush();
        expect(harness.controller.getSnapshot()).toMatchObject({
            state: 'ready',
            persistence: 'not-persisted',
            project: { track: { contentHash: HASH_A } },
        });
        await harness.controller.dispose();
    });

    test('does not let a late tempo estimate overwrite a user tempo edit', async () => {
        let resolveTempo!: (value: TempoEstimateResult | null) => void;
        const tempoRequest = new Promise<TempoEstimateResult | null>(resolve => {
            resolveTempo = resolve;
        });
        const harness = createControllerHarness(null, tempoRequest);
        await harness.controller.enter(harness.trackA.id);
        await vi.waitFor(() =>
            expect(harness.controller.getSnapshot()).toMatchObject({ tempoEstimateState: 'estimating' }),
        );
        const project = harness.controller.getSnapshot().project!;
        project.tempoMap[0] = {
            id: project.tempoMap[0]!.id,
            startSeconds: 0,
            mode: 'metered',
            beatOriginSeconds: 0,
            bpm: 127.5,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        };
        harness.controller.updateProject(project, true);
        resolveTempo({
            kind: 'tempo-estimate-result',
            requestId: 'late-e2',
            generation: 1,
            trackHash: HASH_A,
            configHash: 'e2-config',
            confidence: 0.95,
            state: 'reliable',
            bpm: 100,
        });
        await tempoRequest;
        await vi.waitFor(() =>
            expect(harness.controller.getSnapshot().project).toMatchObject({
                tempoMap: [{ bpm: 127.5, bpmSource: 'user' }],
            }),
        );
        expect(harness.controller.getSnapshot().tempoEstimateState).toBe('idle');
        await harness.controller.dispose();
    });

    test('only the current playback lease keeps repeat-one active', async () => {
        const store = useAudioSessionStore();
        store.appendTracks([track('track-a', HASH_A)]);
        store.setCurrentTrack('track-a');
        const engine = new RepeatEngine();
        const repository = {
            restore: async () => null,
            saveQueue: async () => undefined,
            replaceCurrent: async () => undefined,
            replaceCurrentAnalysisCache: async () => 'stored' as const,
            removeTrack: async () => undefined,
            clear: async () => undefined,
        } satisfies SessionRepositoryPort;
        const service = new AudioSessionService(store, {
            engine,
            repository,
            requestFrame: () => 1,
            cancelFrame: () => undefined,
        });
        const stale = await service.acquireRoutePlayback({
            consumer: 'editor',
            trackId: 'track-a',
        });
        const current = await service.acquireRoutePlayback({
            consumer: 'editor',
            trackId: 'track-a',
        });
        stale.release();
        engine.finish();
        await vi.waitFor(() => expect(engine.seekValues).toEqual([0]));
        expect(engine.playCount).toBe(1);
        current.release();
        engine.finish();
        await Promise.resolve();
        expect(engine.seekValues).toEqual([0]);
        await service.dispose();
    });

    test('invalidates a stale analysis consumer without starting Editor analysis', async () => {
        const store = useAudioSessionStore();
        store.appendTracks([track('track-a', HASH_A)]);
        store.setCurrentTrack('track-a');
        const engine = new RepeatEngine();
        const repository = {
            restore: async () => null,
            saveQueue: async () => undefined,
            replaceCurrent: async () => undefined,
            replaceCurrentAnalysisCache: async () => 'stored' as const,
            removeTrack: async () => undefined,
            clear: async () => undefined,
        } satisfies SessionRepositoryPort;
        const coordinator = new AnalysisCoordinator(engine, repository, store, {
            workerFactory: () => {
                throw new Error('E1 Editor must not start a Worker job.');
            },
        });
        const analyzer = coordinator.acquireConsumer('analyzer');
        const editor = coordinator.acquireConsumer('editor');
        await analyzer.setActiveFeatures(['rms']);
        expect(coordinator.getSnapshot().activeFeatureIds).toEqual([]);
        expect(await editor.requestTempoEstimate()).toBeNull();
        expect(coordinator.getDevelopmentConsumerProxy('analyzer')).toBeNull();
        editor.release();
        expect(coordinator.getSnapshot()).toMatchObject({
            state: 'idle',
            activeFeatureIds: [],
        });
        await coordinator.dispose();
    });
});
