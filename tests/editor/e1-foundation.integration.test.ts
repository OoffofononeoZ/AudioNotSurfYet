import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import {
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vitest';
import {
    AnalysisCoordinator,
    type AnalysisConsumerLease,
} from '../../src/analysis/analysisCoordinator';
import {
    AudioSessionService,
    type AudioEnginePort,
    type EditorPlaybackLease,
} from '../../src/audio/audioSessionService';
import {
    EditorDraftRepository,
    createEditorDraftEnvelope,
    type EditorDraftRepositoryPort,
} from '../../src/editor/editorDraftRepository';
import { EditorSessionController } from '../../src/editor/editorSessionController';
import type { EditorFileGateway } from '../../src/editor/fileIO';
import {
    createInitialEditorProject,
    encodeEditorProjectV1,
} from '../../src/editor/projectCodec';
import type {
    EditorDraftEnvelopeV1,
    EditorProjectV1,
} from '../../src/editor/types';
import type { SessionRepositoryPort } from '../../src/persistence/sessionRepository';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type {
    DecodedAudioDescriptor,
    PlaybackSnapshot,
    TrackRecord,
} from '../../src/types/audio';

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

const projectFor = (value: TrackRecord): EditorProjectV1 => {
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
    envelope: EditorDraftEnvelopeV1 | null = null;
    leaveWarning = true;
    failReplace = false;
    replaceCount = 0;

    async restore() {
        return this.envelope ? structuredClone(this.envelope) : null;
    }

    async replace(envelope: EditorDraftEnvelopeV1) {
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

    close() {}
}

const createControllerHarness = (draft: EditorDraftEnvelopeV1 | null = null) => {
    const store = useAudioSessionStore();
    const trackA = track('track-a', HASH_A);
    const trackB = track('track-b', HASH_B);
    store.appendTracks([trackA, trackB]);
    const playbackReleases: string[] = [];
    const analysisReleases: string[] = [];
    const audioSession = {
        acquireEditorPlayback: async (trackId: string): Promise<EditorPlaybackLease> => ({
            token: `play-${trackId}`,
            trackId,
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
        acquireConsumer: (consumer: 'editor'): AnalysisConsumerLease => ({
            token: `analysis-${consumer}`,
            consumer,
            setActiveFeatures: async () => undefined,
            requestCursorValue: async () => null,
            requestTempoEstimate: async () => null,
            getSeries: () => null,
            subscribe: () => () => undefined,
            release: () => analysisReleases.push(consumer),
        }),
    };
    const repository = new MemoryDraftRepository();
    repository.envelope = draft;
    const savedFiles: Uint8Array[] = [];
    let openedBytes: ArrayBuffer | null = null;
    const fileGateway: EditorFileGateway = {
        open: async () => openedBytes
            ? { name: 'fixture.audiosurf-editor.json', bytes: openedBytes }
            : null,
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
        setOpenedBytes: (bytes: Uint8Array | null) => {
            openedBytes = bytes
                ? bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength,
                ) as ArrayBuffer
                : null;
        },
    };
};

class RepeatEngine implements AudioEnginePort {
    snapshot: PlaybackSnapshot = {
        trackId: 'track-a',
        state: 'paused',
        currentTimeSeconds: 5,
        durationSeconds: 12,
        volume: 1,
    };
    listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
    seekValues: number[] = [];
    playCount = 0;

    async load(): Promise<'loaded'> { return 'loaded'; }
    async play() {
        this.playCount += 1;
        this.emit({ ...this.snapshot, state: 'playing' });
    }
    pause() { this.emit({ ...this.snapshot, state: 'paused' }); }
    async seek(seconds: number) {
        this.seekValues.push(seconds);
        this.emit({ ...this.snapshot, currentTimeSeconds: seconds });
    }
    setVolume(volume: number) { this.emit({ ...this.snapshot, volume }); }
    getSnapshot() { return { ...this.snapshot }; }
    getTimeDomainFloatData() { return null; }
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
    copyDecodedChannelRange() { return null; }
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
            schemaVersion: 1,
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
        const harness = createControllerHarness(
            createEditorDraftEnvelope(oldProject, () => NOW),
        );
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
        harness.setOpenedBytes(encodeEditorProjectV1(imported));
        await expect(harness.controller.importProject()).resolves.toBe('imported');
        expect(harness.repository.envelope?.project.updatedAt)
            .toBe('2026-08-26T01:01:00.000Z');
        await harness.controller.dispose();
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
        const stale = await service.acquireEditorPlayback('track-a');
        const current = await service.acquireEditorPlayback('track-a');
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
        const coordinator = new AnalysisCoordinator(
            engine,
            repository,
            store,
            {
                workerFactory: () => {
                    throw new Error('E1 Editor must not start a Worker job.');
                },
            },
        );
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
