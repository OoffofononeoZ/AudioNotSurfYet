import 'fake-indexeddb/auto';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
    AudioSessionService,
    type AudioEnginePort,
    type RoutePlaybackLease,
} from '../../src/audio/audioSessionService';
import type { SessionRepositoryPort } from '../../src/persistence/sessionRepository';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type {
    DecodedAudioDescriptor,
    PlaybackSnapshot,
    TrackRecord,
} from '../../src/types/audio';
import type { VisualizerFileGateway } from '../../src/visualizer/fileIO';
import { SceneRegistry } from '../../src/visualizer/sceneRegistry';
import {
    createInitialVisualizerProject,
    encodeVisualizerProjectV1,
} from '../../src/visualizer/projectCodec';
import type {
    VisualizerDraftEnvelopeV1,
    VisualizerProjectV1,
} from '../../src/visualizer/types';
import {
    VisualizerDraftRepository,
    type VisualizerDraftRepositoryPort,
} from '../../src/visualizer/visualizerDraftRepository';
import { VisualizerSessionController } from '../../src/visualizer/visualizerSessionController';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const NOW = new Date('2026-09-02T05:00:00.000Z');
const UUID_A = '00000000-0000-4000-8000-000000000201';
const UUID_B = '00000000-0000-4000-8000-000000000202';

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

const projectFor = (value: TrackRecord, id = UUID_A): VisualizerProjectV1 =>
    createInitialVisualizerProject({
        track: {
            contentHash: value.trackHash!,
            fileName: value.name,
            title: value.metadata.title,
            artist: value.metadata.artist,
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: () => id,
        createSeed: () => 7,
        now: () => NOW,
    });

class MemoryRepository implements VisualizerDraftRepositoryPort {
    envelope: VisualizerDraftEnvelopeV1 | null = null;
    failReplace = false;
    replaceCount = 0;
    restoreGate: Promise<void> | null = null;

    async restore() {
        if (this.restoreGate) await this.restoreGate;
        return this.envelope ? structuredClone(this.envelope) : null;
    }

    async replace(envelope: VisualizerDraftEnvelopeV1) {
        this.replaceCount += 1;
        if (this.failReplace) throw new DOMException('quota', 'QuotaExceededError');
        this.envelope = structuredClone(envelope);
    }

    async clear() { this.envelope = null; }
    close() {}
}

const createHarness = (draft: VisualizerDraftEnvelopeV1 | null = null) => {
    const store = useAudioSessionStore();
    const trackA = track('track-a', HASH_A);
    const trackB = track('track-b', HASH_B);
    store.appendTracks([trackA, trackB]);
    const repository = new MemoryRepository();
    repository.envelope = draft;
    const released: string[] = [];
    let openedBytes: ArrayBuffer | null = null;
    const saved: Uint8Array[] = [];
    const audioSession = {
        acquireRoutePlayback: async ({ trackId }: { trackId: string }): Promise<RoutePlaybackLease> => ({
            token: `visualizer-${trackId}`,
            consumer: 'visualizer',
            trackId,
            endedPolicy: 'pause-at-end',
            release: () => released.push(trackId),
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
    const fileGateway: VisualizerFileGateway = {
        open: async () => openedBytes
            ? { name: 'v1.audiosurf-visualizer.json', bytes: openedBytes }
            : null,
        save: async (_codec, _name, bytes) => {
            saved.push(bytes.slice());
            return 'saved';
        },
    };
    const controller = new VisualizerSessionController({
        audioSession: audioSession as unknown as AudioSessionService,
        store,
        repository,
        fileGateway,
        createId: () => UUID_B,
        createSeed: () => 9,
        now: () => NOW,
    });
    return {
        controller,
        repository,
        released,
        saved,
        trackA,
        trackB,
        setOpenedProject(project: VisualizerProjectV1 | null) {
            if (!project) {
                openedBytes = null;
                return;
            }
            const bytes = encodeVisualizerProjectV1(project);
            openedBytes = bytes.buffer.slice(
                bytes.byteOffset,
                bytes.byteOffset + bytes.byteLength,
            ) as ArrayBuffer;
        },
        setOpenedText(text: string) {
            openedBytes = new TextEncoder().encode(text).buffer as ArrayBuffer;
        },
    };
};

class PolicyEngine implements AudioEnginePort {
    async setAuditionSource() {}
    setAuditionMuted() {}
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
        const nextTime = this.snapshot.state === 'ended'
            ? 0
            : this.snapshot.currentTimeSeconds;
        this.emit({ ...this.snapshot, state: 'playing', currentTimeSeconds: nextTime });
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
    capturePlaybackCheckpoint() { return null; }
    async restorePlaybackCheckpoint(): Promise<void> {}
    acquireRecordingTap(): never { throw new Error('not implemented'); }
    copyDecodedChannelRange() { return null; }
    subscribe(listener: (snapshot: PlaybackSnapshot) => void) {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }
    unload() {}
    async dispose() {}
    finish() { this.emit({ ...this.snapshot, state: 'ended', currentTimeSeconds: 12 }); }
    private emit(snapshot: PlaybackSnapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners) listener(this.getSnapshot());
    }
}

describe('Visualizer V1 foundation integration', () => {
    beforeEach(() => setActivePinia(createPinia()));

    test('round-trips the independent latest draft in IndexedDB', async () => {
        const repository = new VisualizerDraftRepository({
            indexedDB,
            databaseName: `visualizer-v1-${crypto.randomUUID()}`,
        });
        const project = projectFor(track('track-a', HASH_A));
        const envelope = { schemaVersion: 1 as const, savedAt: NOW.toISOString(), project };
        await repository.replace(envelope);
        expect(await repository.restore()).toEqual(envelope);
        await repository.clear();
        expect(await repository.restore()).toBeNull();
        repository.close();
    });

    test('restores a same-song draft and guards a different-song draft', async () => {
        const draft = {
            schemaVersion: 1 as const,
            savedAt: NOW.toISOString(),
            project: projectFor(track('track-a', HASH_A)),
        };
        const harness = createHarness(draft);
        await harness.controller.enter(harness.trackA.id);
        expect(harness.controller.getSnapshot()).toMatchObject({
            state: 'ready',
            restoredFromDraft: true,
            project: { track: { contentHash: HASH_A } },
        });
        await harness.controller.enter(harness.trackB.id);
        expect(harness.controller.getSnapshot()).toMatchObject({
            state: 'draft-conflict',
            activeTrackId: 'track-b',
            conflictingDraft: { project: { track: { contentHash: HASH_A } } },
        });
        const result = await harness.controller.cancelConflictingEntry();
        expect(result).toEqual({ kind: 'restored-old', trackId: 'track-a' });
        expect(harness.controller.getSnapshot()).toMatchObject({
            state: 'ready',
            activeTrackId: 'track-a',
        });
        await harness.controller.dispose();
    });

    test('exposes the active route identity while a slow draft restore holds the lease', async () => {
        const harness = createHarness();
        let releaseRestore!: () => void;
        harness.repository.restoreGate = new Promise<void>((resolve) => {
            releaseRestore = resolve;
        });
        const entering = harness.controller.enter(harness.trackA.id);
        await vi.waitFor(() => expect(harness.controller.getSnapshot()).toMatchObject({
            state: 'loading',
            routeTrackId: 'track-a',
            activeTrackId: 'track-a',
        }));
        expect(harness.controller.hasActivePlaybackLease()).toBe(true);
        releaseRestore();
        await entering;
        expect(harness.controller.getSnapshot().state).toBe('ready');
        await harness.controller.dispose();
    });

    test('switches template and output through one autosave queue', async () => {
        const harness = createHarness();
        await harness.controller.enter(harness.trackA.id);
        harness.controller.switchTemplate('cube-swarm');
        harness.controller.updateOutput('1080p', 60);
        await harness.controller.flush();
        expect(harness.controller.getSnapshot().project).toMatchObject({
            output: { resolution: '1080p', frameRate: 60 },
            scene: { templateId: 'cube-swarm' },
        });
        expect(harness.repository.envelope?.project.scene.bindings.filter(
            (binding) => binding.source.kind === 'analysis',
        ).map((binding) => binding.parameterId)).toEqual(['centerSpectrum', 'riseSpeed']);
        await harness.controller.dispose();
    });

    test('keeps invalid import atomic and immediately saves a valid candidate', async () => {
        const harness = createHarness();
        await harness.controller.enter(harness.trackA.id);
        await harness.controller.flush();
        const original = harness.controller.getSnapshot().project!;
        harness.setOpenedText('{"format":"bad"}');
        await expect(harness.controller.importProject()).rejects.toThrow();
        expect(harness.controller.getSnapshot().project).toEqual(original);
        const candidate = structuredClone(original);
        candidate.scene.templateId = 'cube-swarm';
        candidate.scene.bindings = new SceneRegistry().createDefaultBindings('cube-swarm');
        const orbit = candidate.scene.bindings.find((binding) => binding.parameterId === 'orbitSpeed')!;
        orbit.source = { kind: 'constant', value: 1.75 };
        candidate.output.frameRate = 60;
        harness.setOpenedProject(candidate);
        await expect(harness.controller.importProject()).resolves.toBe('imported');
        expect(harness.controller.getSnapshot().project?.output.frameRate).toBe(60);
        expect(harness.controller.getSnapshot().project?.scene.bindings.find(
            (binding) => binding.parameterId === 'orbitSpeed',
        )?.source).toEqual({ kind: 'constant', value: 1.75 });
        expect(harness.repository.envelope?.project.output.frameRate).toBe(60);
        await harness.controller.dispose();
    });

    test('preserves the in-memory project and old durable draft on quota failure', async () => {
        const durable = projectFor(track('track-a', HASH_A));
        const harness = createHarness({
            schemaVersion: 1,
            savedAt: NOW.toISOString(),
            project: durable,
        });
        await harness.controller.enter(harness.trackA.id);
        harness.repository.failReplace = true;
        harness.controller.switchTemplate('cube-swarm');
        await harness.controller.flush();
        expect(harness.controller.getSnapshot()).toMatchObject({
            state: 'not-persisted',
            persistence: 'not-persisted',
            project: { scene: { templateId: 'cube-swarm' } },
        });
        expect(harness.repository.envelope?.project.scene.templateId)
            .toBe('orthogonal-lines');
        await harness.controller.dispose();
    });

    test('maps Editor to repeat-one and Visualizer to pause-at-end', async () => {
        const store = useAudioSessionStore();
        store.appendTracks([track('track-a', HASH_A)]);
        store.setCurrentTrack('track-a');
        const engine = new PolicyEngine();
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
        const editor = await service.acquireRoutePlayback({
            consumer: 'editor',
            trackId: 'track-a',
        });
        expect(editor.endedPolicy).toBe('repeat-one');
        engine.finish();
        await vi.waitFor(() => expect(engine.seekValues).toEqual([0]));
        expect(engine.playCount).toBe(1);

        const visualizer = await service.acquireRoutePlayback({
            consumer: 'visualizer',
            trackId: 'track-a',
        });
        expect(visualizer.endedPolicy).toBe('pause-at-end');
        editor.release();
        engine.finish();
        await Promise.resolve();
        expect(engine.seekValues).toEqual([0]);
        expect(engine.playCount).toBe(1);
        expect(store.playback.state).toBe('ended');
        await service.togglePlayback();
        expect(engine.getSnapshot()).toMatchObject({
            state: 'playing',
            currentTimeSeconds: 0,
        });
        visualizer.release();
        await service.dispose();
    });
});
