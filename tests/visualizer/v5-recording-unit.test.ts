import { describe, expect, test, vi } from 'vitest';
import type { AudioPlaybackCheckpoint, RecordingTapLease } from '../../src/audio/audioEngine';
import type { AudioSessionService } from '../../src/audio/audioSessionService';
import type { PlaybackSnapshot } from '../../src/types/audio';
import {
    getVisualizerRecordingPreset,
    getVisualizerRecordingAvailability,
    isReliableVisualizerRecordingPreset,
    selectVisualizerRecordingMimeType,
} from '../../src/visualizer/recordingPresets';
import type { VisualizerRecordingState } from '../../src/visualizer/types';
import { createComposition } from '../../src/visualizer/compositionCodec';
import {
    VisualizerRecordingSession,
} from '../../src/visualizer/visualizerRecordingSession';
import { visualizerVideoFileName } from '../../src/visualizer/videoFileIO';

class FakeTrack extends EventTarget {
    readonly kind: 'audio' | 'video';
    readyState: MediaStreamTrackState = 'live';
    contentHint = '';
    private readonly settings: MediaTrackSettings;

    constructor(kind: 'audio' | 'video', settings: MediaTrackSettings = {}) {
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
            data: new Blob(['valid-webm-bytes'], { type: 'video/webm' }),
        }));
    }

    stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        queueMicrotask(() => this.dispatchEvent(new Event('stop')));
    }
}

const project = () => createComposition({contentHash:'5'.repeat(64),fileName:'V5 同步测试.wav',durationSeconds:3,sampleRate:48000});

const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

const harness = (input: {
    surfaceError?: Error;
    isPresetAvailable?: () => boolean;
} = {}) => {
    const operations: string[] = [];
    const projectValue = project();
    const audioTrack = new FakeTrack('audio');
    const videoTrack = new FakeTrack('video', {
        width: 1280,
        height: 720,
        frameRate: 30,
    });
    const audioStream = new FakeStream([audioTrack]);
    const videoStream = new FakeStream([videoTrack]);
    let playback: PlaybackSnapshot = {
        trackId: 'track-v5',
        state: 'playing',
        currentTimeSeconds: 1.25,
        durationSeconds: 3,
        volume: 0,
    };
    const listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
    const emit = () => listeners.forEach((listener) => listener({ ...playback }));
    const checkpoint: AudioPlaybackCheckpoint = {
        trackId: 'track-v5',
        state: 'playing',
        currentTimeSeconds: 1.25,
    };
    const restorePlaybackCheckpoint = vi.fn(async (value: AudioPlaybackCheckpoint) => {
        operations.push('restore');
        playback = {
            ...playback,
            state: value.state,
            currentTimeSeconds: value.currentTimeSeconds,
        };
        emit();
    });
    const tap: RecordingTapLease = {
        token: 'tap-v5',
        stream: audioStream as unknown as MediaStream,
        getContextTime: () => 10.5,
        release: vi.fn(() => operations.push('release-tap')),
    };
    const audioSession = {
        acquireRecordingTransport: () => ({
            pause: () => audioSession.pause(), seek: (seconds: number) => audioSession.seek(seconds),
            play: () => audioSession.play(), release: vi.fn(),
        }),
        capturePlaybackCheckpoint: () => checkpoint,
        restorePlaybackCheckpoint,
        acquireRecordingTap: () => {
            operations.push('tap');
            return tap;
        },
        subscribePlayback(listener: (snapshot: PlaybackSnapshot) => void) {
            listeners.add(listener);
            listener({ ...playback });
            return () => listeners.delete(listener);
        },
        pause() {
            operations.push('pause');
            playback = { ...playback, state: 'paused' };
            emit();
        },
        async seek(seconds: number) {
            operations.push(`seek:${seconds}`);
            playback = { ...playback, state: 'paused', currentTimeSeconds: seconds };
            emit();
        },
        async play() {
            operations.push('play');
            playback = { ...playback, state: 'playing' };
            emit();
        },
    } as unknown as AudioSessionService;
    const canvas = {
        captureStream: vi.fn(() => {
            operations.push('capture-stream');
            return videoStream as unknown as MediaStream;
        }),
    } as unknown as HTMLCanvasElement;
    const surface = {
        canvas,
        width: 1280,
        height: 720,
        renderNow: vi.fn(() => operations.push('render:0')),
        release: vi.fn(() => operations.push('release-surface')),
    };
    const states: VisualizerRecordingState[] = [];
    const saves: Array<'saved' | 'cancelled'> = [];
    const gateway = {
        save: vi.fn(async () => saves.shift() ?? 'saved'),
    };
    const session = new VisualizerRecordingSession({
        audioSession,
        readContext: () => ({
            state: 'ready',
            activeTrackId: 'track-v5',
            project: projectValue,
            bindingRuntime: {
                bindingRevision: 1,
                activeFeatureIds: [],
                readyFeatureIds: [],
                analysisState: 'idle',
                analysisProgress: 0,
                editorSnapshotSource: 'none',
            },
            resolvedValues: [],
        }),
        onState: (state) => states.push(state),
        videoGateway: gateway,
        createRecorder: () => {
            operations.push('recorder');
            return new FakeRecorder() as unknown as MediaRecorder;
        },
        createMediaStream: (tracks) => new FakeStream(
            tracks as unknown as FakeTrack[],
        ) as unknown as MediaStream,
        isTypeSupported: (mime) => mime.includes('vp9'),
        isPresetAvailable: input.isPresetAvailable,
    });
    session.attachTarget({
        getStatus: () => ({ state: 'ready' }),
        acquireRecordingSurface: () => {
            operations.push('surface');
            if (input.surfaceError) throw input.surfaceError;
            return surface;
        },
    });
    return {
        session,
        states,
        operations,
        audioTrack,
        videoTrack,
        saves,
        gateway,
        project: projectValue,
        restorePlaybackCheckpoint,
        emitEnded() {
            playback = { ...playback, state: 'ended', currentTimeSeconds: 3 };
            emit();
        },
    };
};

describe('Visualizer V5 recording unit contract', () => {
    test('selects exact presets, MIME priority, and deterministic filename', () => {
        expect(getVisualizerRecordingPreset('720p', 30)).toMatchObject({
            width: 1280,
            height: 720,
            videoBitsPerSecond: 6_000_000,
            audioBitsPerSecond: 192_000,
        });
        expect(getVisualizerRecordingPreset('1080p', 60)).toMatchObject({
            width: 1920,
            height: 1080,
            videoBitsPerSecond: 16_000_000,
        });
        expect(selectVisualizerRecordingMimeType(() => true)).toContain('vp9');
        expect(selectVisualizerRecordingMimeType((mime) => mime.includes('vp8'))).toContain('vp8');
        expect(selectVisualizerRecordingMimeType(() => false)).toBeNull();
        expect(isReliableVisualizerRecordingPreset(
            getVisualizerRecordingPreset('720p', 60),
            'Mozilla/5.0 Edg/151.0.0.0',
        )).toBe(false);
        for (const resolution of ['720p','1080p'] as const) for (const fps of [30,60] as const) {
            const availability = getVisualizerRecordingAvailability(resolution,fps);
            expect(isReliableVisualizerRecordingPreset(getVisualizerRecordingPreset(resolution,fps))).toBe(availability.available);
            if (!availability.available) expect(availability.reason).toContain('尚未通过录制稳定性验证');
        }
        expect(isReliableVisualizerRecordingPreset(
            getVisualizerRecordingPreset('1080p', 30),
            'Mozilla/5.0 Edg/151.0.0.0',
        )).toBe(false);
        expect(isReliableVisualizerRecordingPreset(
            getVisualizerRecordingPreset('720p', 30),
            'Mozilla/5.0 Edg/151.0.0.0',
        )).toBe(true);
        expect(isReliableVisualizerRecordingPreset(
            getVisualizerRecordingPreset('1080p', 60),
            'Mozilla/5.0 Chrome/151.0.0.0 Safari/537.36',
        )).toBe(false);
        expect(visualizerVideoFileName({
            fileName: 'V5 同步测试.wav',
            templateId: 'composition',
            resolution: '720p',
            frameRate: 30,
        })).toBe('V5-同步测试-composition-720p30fps.webm');
    });

    test('runs the fixed prepare/start/finalize order and preserves ready Blob on save cancel', async () => {
        const value = harness();
        await value.session.start();
        expect(value.session.getState()).toEqual({
            status: 'recording',
            startedAtContextTime: 10.5,
            mimeType: 'video/webm;codecs=vp9,opus',
        });
        expect(value.videoTrack.contentHint).toBe('motion');
        expect(value.operations).toEqual([
            'pause',
            'seek:0',
            'surface',
            'render:0',
            'tap',
            'capture-stream',
            'recorder',
            'render:0',
            'play',
        ]);

        value.emitEnded();
        await flush();
        expect(value.session.getState()).toMatchObject({
            status: 'ready',
            byteLength: 16,
        });
        expect(value.operations).toContain('release-tap');
        expect(value.operations).toContain('release-surface');

        value.project.elements = [];
        value.project.output = { ...value.project.output, resolution: '1080p', frameRate: 60 };
        value.saves.push('cancelled', 'saved');
        await expect(value.session.save()).resolves.toBe('cancelled');
        expect(value.session.getState().status).toBe('ready');
        await expect(value.session.save()).resolves.toBe('saved');
        expect(value.session.getState()).toEqual({ status: 'idle' });
        expect(value.gateway.save).toHaveBeenCalledTimes(2);
        expect(value.gateway.save).toHaveBeenLastCalledWith(
            'V5-同步测试-composition-720p30fps.webm',
            expect.any(Blob),
        );
    });

    test('restores the exact playback checkpoint when preparation fails', async () => {
        const value = harness({ surfaceError: new Error('surface unavailable') });
        await value.session.start();
        expect(value.restorePlaybackCheckpoint).toHaveBeenCalledWith({
            trackId: 'track-v5',
            state: 'playing',
            currentTimeSeconds: 1.25,
        });
        expect(value.session.getState()).toEqual({
            status: 'error',
            code: 'recorder-start-failed',
            message: 'surface unavailable',
        });
    });

    test('rejects an unreliable preset before playback or resource acquisition', async () => {
        const value = harness({ isPresetAvailable: () => false });
        await expect(value.session.start()).rejects.toMatchObject({
            code: 'preset-unavailable',
        });
        expect(value.session.getState()).toMatchObject({
            status: 'error',
            code: 'preset-unavailable',
        });
        expect(value.operations).toEqual([]);
    });

    test('cancels after recorder start at the current paused position without a ready file', async () => {
        const value = harness();
        await value.session.start();
        await value.session.cancel();
        expect(value.session.getState()).toEqual({ status: 'idle' });
        expect(value.operations.filter((entry) => entry === 'pause')).toHaveLength(2);
        expect(value.restorePlaybackCheckpoint).not.toHaveBeenCalled();
        expect(value.gateway.save).not.toHaveBeenCalled();
    });

    test('rejects final output when either combined track is no longer live', async () => {
        const value = harness();
        await value.session.start();
        value.videoTrack.readyState = 'ended';
        value.emitEnded();
        await flush();
        expect(value.session.getState()).toMatchObject({
            status: 'error',
            code: 'track-ended',
        });
        expect(value.session.getReadyBlobForDiagnostics()).toBeNull();
    });
});
