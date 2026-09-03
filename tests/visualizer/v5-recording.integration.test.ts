import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { AudioPlaybackCheckpoint, RecordingTapLease } from '../../src/audio/audioEngine';
import type { AudioSessionService, RoutePlaybackLease } from '../../src/audio/audioSessionService';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type { DecodedAudioDescriptor, PlaybackSnapshot, TrackRecord } from '../../src/types/audio';
import type { VisualizerFileGateway } from '../../src/visualizer/fileIO';
import type { VisualizerRenderer } from '../../src/visualizer/rendererTypes';
import { SceneRegistry, type SceneTemplateDescriptor } from '../../src/visualizer/sceneRegistry';
import type { VisualizerDraftRepositoryPort } from '../../src/visualizer/visualizerDraftRepository';
import {
    VisualizerRendererHost,
    visualizerRendererDiagnostics,
} from '../../src/visualizer/visualizerRendererHost';
import { VisualizerSessionController } from '../../src/visualizer/visualizerSessionController';
import type { VisualizerDraftEnvelopeV1 } from '../../src/visualizer/types';
import type { VisualizerVideoFileGateway } from '../../src/visualizer/videoFileIO';

const TRACK_ID = 'visualizer-v5-track';
const TRACK_HASH = '5'.repeat(64);

class MemoryRepository implements VisualizerDraftRepositoryPort {
    value: VisualizerDraftEnvelopeV1 | null = null;
    async restore() { return this.value; }
    async replace(value: VisualizerDraftEnvelopeV1) { this.value = structuredClone(value); }
    async clear() { this.value = null; }
    close() {}
}

class FakeTrack extends EventTarget {
    readonly kind: 'audio' | 'video';
    readyState: MediaStreamTrackState = 'live';
    private readonly settings: MediaTrackSettings;

    constructor(
        kind: 'audio' | 'video',
        settings: MediaTrackSettings = {},
    ) {
        super();
        this.kind = kind;
        this.settings = settings;
    }

    getSettings() { return { ...this.settings }; }
    stop() { this.readyState = 'ended'; }
}

class FakeStream {
    readonly tracks: FakeTrack[];
    constructor(tracks: FakeTrack[]) { this.tracks = tracks; }
    getTracks() { return [...this.tracks] as unknown as MediaStreamTrack[]; }
    getAudioTracks() {
        return this.tracks.filter((track) => track.kind === 'audio') as unknown as MediaStreamTrack[];
    }
    getVideoTracks() {
        return this.tracks.filter((track) => track.kind === 'video') as unknown as MediaStreamTrack[];
    }
}

class FakeRecorder extends EventTarget {
    state: RecordingState = 'inactive';
    start() {
        this.state = 'recording';
        queueMicrotask(() => this.dispatchEvent(new Event('start')));
    }
    requestData() {
        this.dispatchEvent(Object.assign(new Event('dataavailable'), {
            data: new Blob(['v5-integration-webm']),
        }));
    }
    stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        queueMicrotask(() => this.dispatchEvent(new Event('stop')));
    }
}

const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

const track = (): TrackRecord => ({
    id: TRACK_ID,
    name: 'visualizer-v5-avsync-v1.wav',
    mimeType: 'audio/wav',
    byteSize: 288_044,
    lastModified: 1,
    durationSeconds: 3,
    encodedSampleRate: 48_000,
    metadata: { title: 'V5 AV Sync', artist: 'AudioNotSurfYet' },
    trackHash: TRACK_HASH,
    restoreState: 'available',
});

const controllerHarness = () => {
    const store = useAudioSessionStore();
    store.appendTracks([track()]);
    let playback: PlaybackSnapshot = {
        trackId: TRACK_ID,
        state: 'paused',
        currentTimeSeconds: 1.25,
        durationSeconds: 3,
        volume: 0,
    };
    store.setPlayback(playback);
    const listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
    const emit = (snapshot: PlaybackSnapshot) => {
        playback = snapshot;
        store.setPlayback(snapshot);
        listeners.forEach((listener) => listener({ ...snapshot }));
    };
    const tapReleases: ReturnType<typeof vi.fn>[] = [];
    const audioSession = {
        acquireRoutePlayback: async (): Promise<RoutePlaybackLease> => ({
            token: 'route-v5',
            consumer: 'visualizer',
            trackId: TRACK_ID,
            endedPolicy: 'pause-at-end',
            release() {},
        }),
        getDecodedTrackDescriptor: (): DecodedAudioDescriptor => ({
            trackId: TRACK_ID,
            revision: 1,
            sampleRate: 48_000,
            length: 144_000,
            channelCount: 1,
            durationSeconds: 3,
        }),
        capturePlaybackCheckpoint: (): AudioPlaybackCheckpoint => ({
            trackId: TRACK_ID,
            state: playback.state as AudioPlaybackCheckpoint['state'],
            currentTimeSeconds: playback.currentTimeSeconds,
        }),
        async restorePlaybackCheckpoint(checkpoint: AudioPlaybackCheckpoint) {
            emit({
                ...playback,
                state: checkpoint.state,
                currentTimeSeconds: checkpoint.currentTimeSeconds,
            });
        },
        acquireRecordingTap: (): RecordingTapLease => {
            const release = vi.fn();
            tapReleases.push(release);
            return {
                token: `tap-${tapReleases.length}`,
                stream: new FakeStream([new FakeTrack('audio')]) as unknown as MediaStream,
                getContextTime: () => tapReleases.length,
                release,
            };
        },
        subscribePlayback(listener: (snapshot: PlaybackSnapshot) => void) {
            listeners.add(listener);
            listener({ ...playback });
            return () => listeners.delete(listener);
        },
        pause() { emit({ ...playback, state: 'paused' }); },
        async seek(seconds: number) {
            emit({ ...playback, state: 'paused', currentTimeSeconds: seconds });
        },
        async play() { emit({ ...playback, state: 'playing' }); },
        async togglePlayback() {
            emit({ ...playback, state: playback.state === 'playing' ? 'paused' : 'playing' });
        },
    } as unknown as AudioSessionService;
    const repository = new MemoryRepository();
    const projectGateway: VisualizerFileGateway = {
        open: async () => null,
        save: async () => 'saved',
    };
    const saveResults: Array<'saved' | 'cancelled'> = [];
    const videoGateway: VisualizerVideoFileGateway = {
        save: vi.fn(async () => saveResults.shift() ?? 'saved'),
    };
    const controller = new VisualizerSessionController({
        audioSession,
        store,
        repository,
        fileGateway: projectGateway,
        videoGateway,
        createId: () => '00000000-0000-4000-8000-000000000506',
        createSeed: () => 56,
        now: () => new Date('2026-09-03T00:00:00.000Z'),
        recordingRuntime: {
            isTypeSupported: (mime) => mime.includes('vp9'),
            createMediaStream: (tracks) => new FakeStream(
                tracks as unknown as FakeTrack[],
            ) as unknown as MediaStream,
            createRecorder: () => new FakeRecorder() as unknown as MediaRecorder,
        },
    });
    let surfaceAcquireCount = 0;
    let surfaceReleaseCount = 0;
    const canvas = {
        captureStream: () => new FakeStream([new FakeTrack('video', {
            width: 1280,
            height: 720,
            frameRate: 30,
        })]) as unknown as MediaStream,
    } as unknown as HTMLCanvasElement;
    controller.attachRecordingTarget({
        getStatus: () => ({ state: 'ready' }),
        acquireRecordingSurface: (width, height) => {
            surfaceAcquireCount += 1;
            return {
                canvas,
                width,
                height,
                renderNow() {},
                release() { surfaceReleaseCount += 1; },
            };
        },
    });
    return {
        controller,
        store,
        saveResults,
        videoGateway,
        tapReleases,
        surfaceCounts: () => ({ surfaceAcquireCount, surfaceReleaseCount }),
        endTrack() {
            emit({ ...playback, state: 'ended', currentTimeSeconds: 3 });
        },
    };
};

const createRafHarness = () => {
    let next = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    return {
        callbacks,
        request(callback: FrameRequestCallback) {
            const handle = next++;
            callbacks.set(handle, callback);
            return handle;
        },
        cancel(handle: number) { callbacks.delete(handle); },
        flush() {
            const entry = callbacks.entries().next().value as [number, FrameRequestCallback];
            callbacks.delete(entry[0]);
            entry[1](16);
        },
    };
};

describe('Visualizer V5 recording integration', () => {
    beforeEach(() => setActivePinia(createPinia()));

    test('locks mutable commands, preserves export, retries save, and releases 20 lifecycles', async () => {
        const initial = { ...visualizerRendererDiagnostics };
        const value = controllerHarness();
        await value.controller.enter(TRACK_ID);
        await value.controller.startRecording();
        expect(value.controller.getSnapshot().recording.status).toBe('recording');
        expect(() => value.controller.updateOutput('1080p', 60)).toThrowError(
            expect.objectContaining({ code: 'recording-locked' }),
        );
        expect(() => value.controller.switchTemplate('cube-swarm')).toThrowError(
            expect.objectContaining({ code: 'recording-locked' }),
        );
        expect(() => value.controller.updateProject(
            value.controller.getSnapshot().project!,
        )).toThrowError(expect.objectContaining({ code: 'recording-locked' }));
        expect(() => value.controller.updateBinding(
            value.controller.getSnapshot().project!.scene.bindings[0]!,
        )).toThrowError(expect.objectContaining({ code: 'recording-locked' }));
        expect(() => value.controller.removeEditorSnapshot()).toThrowError(
            expect.objectContaining({ code: 'recording-locked' }),
        );
        await expect(value.controller.seek(2)).rejects.toMatchObject({ code: 'recording-locked' });
        await expect(value.controller.togglePlayback()).rejects.toMatchObject({ code: 'recording-locked' });
        await expect(value.controller.reloadEditorDraft()).rejects.toMatchObject({
            code: 'recording-locked',
        });
        await expect(value.controller.importEditorProject()).rejects.toMatchObject({
            code: 'recording-locked',
        });
        await expect(value.controller.importProject()).rejects.toMatchObject({
            code: 'recording-locked',
        });
        await expect(value.controller.exportProject()).resolves.toBe('saved');

        value.endTrack();
        await flush();
        expect(value.controller.getSnapshot().recording.status).toBe('ready');
        value.saveResults.push('cancelled', 'saved');
        await expect(value.controller.saveRecording()).resolves.toBe('cancelled');
        expect(value.controller.getSnapshot().recording.status).toBe('ready');
        await expect(value.controller.saveRecording()).resolves.toBe('saved');

        for (let cycle = 0; cycle < 20; cycle += 1) {
            await value.controller.startRecording();
            await value.controller.cancelRecording();
        }
        expect(value.surfaceCounts()).toEqual({
            surfaceAcquireCount: 21,
            surfaceReleaseCount: 21,
        });
        expect(value.tapReleases).toHaveLength(21);
        expect(value.tapReleases.every((release) => release.mock.calls.length === 1)).toBe(true);
        expect(visualizerRendererDiagnostics.activeRecordingTaps)
            .toBe(initial.activeRecordingTaps);
        expect(visualizerRendererDiagnostics.activeMediaRecorders)
            .toBe(initial.activeMediaRecorders);
        expect(visualizerRendererDiagnostics.activeCaptureStreams)
            .toBe(initial.activeCaptureStreams);
        expect(visualizerRendererDiagnostics.activeAudioTracks)
            .toBe(initial.activeAudioTracks);
        expect(visualizerRendererDiagnostics.activeVideoTracks)
            .toBe(initial.activeVideoTracks);
        expect(visualizerRendererDiagnostics.readyRecordingBlobs)
            .toBe(initial.readyRecordingBlobs);
        await value.controller.dispose();
    });

    test('uses the original host Canvas at exact DPR 1 and restores the latest preview resize', () => {
        const raf = createRafHarness();
        const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
        const canvas = {
            dataset: {},
            width: 1,
            height: 1,
            addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
                const values = listeners.get(type) ?? new Set();
                values.add(listener);
                listeners.set(type, values);
            },
            removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
                listeners.get(type)?.delete(listener);
            },
        } as unknown as HTMLCanvasElement;
        const sizes: Array<[number, number, number]> = [];
        let dpr = 1;
        const renderer: VisualizerRenderer = {
            domElement: canvas,
            setPixelRatio(value) { dpr = value; },
            setSize(width, height) {
                sizes.push([width, height, dpr]);
                canvas.width = width * dpr;
                canvas.height = height * dpr;
            },
            setClearColor() {},
            render() {},
            dispose() {},
        };
        const descriptor: SceneTemplateDescriptor = {
            id: 'orthogonal-lines',
            version: 1,
            title: 'capture fixture',
            description: 'capture fixture',
            parameters: [],
            create: () => ({
                kind: 'rendered',
                render: () => ({ hash: 'capture', needsSourcePrompt: false }),
                resize() {},
                dispose() {},
            }),
        };
        const host = new VisualizerRendererHost({
            canvas,
            registry: new SceneRegistry([descriptor]),
            readFrame: () => ({
                trackIdentity: TRACK_HASH,
                templateId: 'orthogonal-lines',
                templateVersion: 1,
                seed: 1,
                timeSeconds: 0,
                bindingRevision: 1,
                playbackState: 'paused',
            }),
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus() {},
            createRenderer: () => renderer,
            requestAnimationFrame: (callback) => raf.request(callback),
            cancelAnimationFrame: (handle) => raf.cancel(handle),
        });
        host.resize(640, 360, 2);
        const lease = host.acquireRecordingSurface(1920, 1080);
        expect(lease.canvas).toBe(canvas);
        expect(sizes.at(-1)).toEqual([1920, 1080, 1]);
        host.resize(800, 450, 1.5);
        expect(sizes.at(-1)).toEqual([1920, 1080, 1]);
        lease.renderNow();
        expect(raf.callbacks.size).toBe(1);
        lease.release();
        expect(sizes.at(-1)).toEqual([800, 450, 1.5]);
        expect(raf.callbacks.size).toBe(1);
        raf.flush();
        expect(raf.callbacks.size).toBe(0);
        host.dispose();
    });
});
