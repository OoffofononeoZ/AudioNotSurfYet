import type {
    AudioPlaybackCheckpoint,
    RecordingTapLease,
} from '../audio/audioEngine';
import { RecordingTapError } from '../audio/audioEngine';
import type { AudioSessionService } from '../audio/audioSessionService';
import type { PlaybackSnapshot } from '../types/audio';
import type { VisualizerResolvedParameter } from './bindingResolver';
import {
    getVisualizerRecordingPreset,
    isReliableVisualizerRecordingPreset,
    selectVisualizerRecordingMimeType,
} from './recordingPresets';
import type { VisualizerRecordingPreset } from './recordingPresets';
import type { VisualizerRendererStatus } from './rendererTypes';
import type {
    VisualizerRecordingSurfaceLease,
} from './visualizerRendererHost';
import { visualizerRendererDiagnostics } from './visualizerRendererHost';
import type {
    VisualizerBindingRuntimeSnapshot,
    VisualizerProjectV1,
    VisualizerRecordingErrorCode,
    VisualizerRecordingState,
    VisualizerSessionState,
} from './types';
import {
    type VisualizerVideoFileGateway,
    visualizerVideoFileName,
} from './videoFileIO';

const START_WATCHDOG_MS = 5_000;
const FINALIZE_WATCHDOG_MS = 30_000;

export interface VisualizerRecordingTarget {
    getStatus(): VisualizerRendererStatus;
    acquireRecordingSurface(
        width: number,
        height: number,
    ): VisualizerRecordingSurfaceLease;
}

export interface VisualizerRecordingContext {
    readonly state: VisualizerSessionState;
    readonly activeTrackId: string | null;
    readonly project: VisualizerProjectV1 | null;
    readonly bindingRuntime: VisualizerBindingRuntimeSnapshot;
    readonly resolvedValues: readonly VisualizerResolvedParameter[];
}

export class VisualizerRecordingSessionError extends Error {
    readonly code: VisualizerRecordingErrorCode;

    constructor(code: VisualizerRecordingErrorCode, message: string) {
        super(message);
        this.name = 'VisualizerRecordingSessionError';
        this.code = code;
    }
}

export type VisualizerRecorderFactory = (
    stream: MediaStream,
    options: MediaRecorderOptions,
) => MediaRecorder;

export interface VisualizerRecordingSessionOptions {
    readonly audioSession: AudioSessionService;
    readonly readContext: () => VisualizerRecordingContext;
    readonly onState: (state: VisualizerRecordingState) => void;
    readonly videoGateway: VisualizerVideoFileGateway;
    readonly createRecorder?: VisualizerRecorderFactory;
    readonly createMediaStream?: (tracks: MediaStreamTrack[]) => MediaStream;
    readonly isTypeSupported?: (mimeType: string) => boolean;
    readonly isPresetAvailable?: (preset: VisualizerRecordingPreset) => boolean;
    readonly setTimer?: (
        handler: () => void,
        timeout: number,
    ) => ReturnType<typeof setTimeout>;
    readonly clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

const isActive = (state: VisualizerRecordingState): boolean =>
    ['preparing', 'recording', 'finalizing'].includes(state.status);

const recordingError = (
    error: unknown,
    fallbackCode: VisualizerRecordingErrorCode,
    fallbackMessage: string,
): VisualizerRecordingSessionError => {
    if (error instanceof VisualizerRecordingSessionError) return error;
    if (error instanceof RecordingTapError) {
        return new VisualizerRecordingSessionError(
            error.code === 'recording-busy' ? 'recording-busy' : 'audio-track-unavailable',
            error.message,
        );
    }
    return new VisualizerRecordingSessionError(
        fallbackCode,
        error instanceof Error ? error.message : fallbackMessage,
    );
};

export class VisualizerRecordingSession {
    private readonly options: VisualizerRecordingSessionOptions;
    private readonly createRecorder: VisualizerRecorderFactory;
    private readonly createMediaStream: (tracks: MediaStreamTrack[]) => MediaStream;
    private readonly isTypeSupported: (mimeType: string) => boolean;
    private readonly isPresetAvailable: (preset: VisualizerRecordingPreset) => boolean;
    private readonly setTimer: NonNullable<VisualizerRecordingSessionOptions['setTimer']>;
    private readonly clearTimer: NonNullable<VisualizerRecordingSessionOptions['clearTimer']>;
    private state: VisualizerRecordingState = { status: 'idle' };
    private target: VisualizerRecordingTarget | null = null;
    private checkpoint: AudioPlaybackCheckpoint | null = null;
    private tap: RecordingTapLease | null = null;
    private surface: VisualizerRecordingSurfaceLease | null = null;
    private videoStream: MediaStream | null = null;
    private combinedStream: MediaStream | null = null;
    private recorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];
    private readyBlob: Blob | null = null;
    private suggestedFileName: string | null = null;
    private unsubscribePlayback: (() => void) | null = null;
    private watchdog: ReturnType<typeof setTimeout> | null = null;
    private cancelStartWait: (() => void) | null = null;
    private generation = 0;
    private started = false;
    private expectedTrackId: string | null = null;
    private cleaning = false;

    constructor(options: VisualizerRecordingSessionOptions) {
        this.options = options;
        this.createRecorder = options.createRecorder
            ?? ((stream, recorderOptions) => new MediaRecorder(stream, recorderOptions));
        this.createMediaStream = options.createMediaStream
            ?? ((tracks) => new MediaStream(tracks));
        this.isTypeSupported = options.isTypeSupported
            ?? ((mimeType) => typeof MediaRecorder !== 'undefined'
                && MediaRecorder.isTypeSupported(mimeType));
        this.isPresetAvailable = options.isPresetAvailable
            ?? isReliableVisualizerRecordingPreset;
        this.setTimer = options.setTimer
            ?? ((handler, timeout) => setTimeout(handler, timeout));
        this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
    }

    getState(): VisualizerRecordingState {
        return { ...this.state };
    }

    isLocked(): boolean {
        return isActive(this.state);
    }

    hasUnresolvedOutput(): boolean {
        return this.isLocked() || this.state.status === 'ready';
    }

    getReadyBlobForDiagnostics(): Blob | null {
        return this.readyBlob;
    }

    attachTarget(target: VisualizerRecordingTarget): () => void {
        if (this.target && this.target !== target) {
            throw new VisualizerRecordingSessionError(
                'renderer-unavailable',
                '已有录制渲染目标。',
            );
        }
        this.target = target;
        let detached = false;
        return () => {
            if (detached) return;
            detached = true;
            if (this.target !== target) return;
            this.target = null;
            if (isActive(this.state)) {
                void this.abort(
                    'renderer-unavailable',
                    '录制渲染目标已离开页面。',
                    false,
                );
            }
        };
    }

    notifyRendererStatus(status: VisualizerRendererStatus): void {
        if (!isActive(this.state)) return;
        if (status.state === 'recovering') {
            void this.abort('context-lost', '录制期间 WebGL 上下文丢失。', false);
        } else if (status.state === 'error') {
            void this.abort(
                'renderer-unavailable',
                status.message ?? '录制期间渲染器发生错误。',
                false,
            );
        }
    }

    async notifyIdentityChange(): Promise<void> {
        if (!isActive(this.state)) return;
        await this.abort('identity-changed', '录制期间歌曲或路由身份发生变化。', false);
    }

    async start(): Promise<void> {
        const context = this.preflight();
        const target = this.target!;
        const project = context.project!;
        const trackId = context.activeTrackId!;
        const mimeType = selectVisualizerRecordingMimeType(this.isTypeSupported)!;
        const preset = getVisualizerRecordingPreset(
            project.output.resolution,
            project.output.frameRate,
        );
        const checkpoint = this.options.audioSession.capturePlaybackCheckpoint(trackId);
        const generation = ++this.generation;
        this.checkpoint = checkpoint;
        this.expectedTrackId = trackId;
        this.suggestedFileName = visualizerVideoFileName({
            fileName: project.track.fileName,
            templateId: project.scene.templateId,
            resolution: project.output.resolution,
            frameRate: project.output.frameRate,
        });
        this.started = false;
        this.chunks = [];
        visualizerRendererDiagnostics.recordingStage = 'preparing';
        visualizerRendererDiagnostics.lastRecordingError = '';
        this.setState({ status: 'preparing' });
        this.unsubscribePlayback = this.options.audioSession.subscribePlayback(
            (snapshot) => this.handlePlayback(snapshot, generation),
        );

        try {
            this.options.audioSession.pause();
            await this.options.audioSession.seek(0);
            this.assertGeneration(generation);

            this.surface = target.acquireRecordingSurface(preset.width, preset.height);
            visualizerRendererDiagnostics.recordingStage = 'surface-acquired';
            this.surface.renderNow();
            this.tap = this.options.audioSession.acquireRecordingTap(trackId);
            visualizerRendererDiagnostics.recordingStage = 'audio-tap-acquired';
            visualizerRendererDiagnostics.activeRecordingTaps += 1;

            this.videoStream = this.captureCanvas(
                this.surface.canvas,
                project.output.frameRate,
            );
            visualizerRendererDiagnostics.recordingStage = 'canvas-stream-acquired';
            const audioTracks = this.tap.stream.getAudioTracks();
            const videoTracks = this.videoStream.getVideoTracks();
            this.validateTracks(audioTracks, videoTracks, preset);
            try {
                videoTracks[0]!.contentHint = 'motion';
            } catch {
                // The hint is advisory; unsupported browsers keep their default.
            }
            this.combinedStream = this.createMediaStream([
                ...audioTracks,
                ...videoTracks,
            ]);
            visualizerRendererDiagnostics.activeCaptureStreams += 1;
            visualizerRendererDiagnostics.activeAudioTracks += audioTracks.length;
            visualizerRendererDiagnostics.activeVideoTracks += videoTracks.length;
            this.watchTracks(this.combinedStream.getTracks(), generation);

            this.recorder = this.createRecorder(this.combinedStream, {
                mimeType,
                videoBitsPerSecond: preset.videoBitsPerSecond,
                audioBitsPerSecond: preset.audioBitsPerSecond,
            });
            visualizerRendererDiagnostics.recordingStage = 'recorder-created';
            visualizerRendererDiagnostics.lastRecorderState = this.recorder.state;
            visualizerRendererDiagnostics.activeMediaRecorders += 1;
            this.installRecorderEvents(this.recorder, generation, mimeType);
            // Chrome defers MediaRecorder's `start` event for a WebGL+WebAudio
            // stream until the pre-Gain branch emits its first audio packet.
            // Keep the public state in `preparing`, start both handshakes
            // together at song time zero, and only publish `recording` after
            // the recorder event confirms the stream.
            await Promise.all([
                this.startRecorder(this.recorder, generation),
                this.options.audioSession.play(),
            ]);
            this.assertGeneration(generation);
            if (this.recorder.state !== 'recording') {
                throw new VisualizerRecordingSessionError(
                    'recorder-start-failed',
                    'MediaRecorder start 事件后未保持 recording 状态。',
                );
            }
            this.started = true;
            visualizerRendererDiagnostics.recordingStage = 'recording';
            visualizerRendererDiagnostics.lastRecorderState = this.recorder.state;
            visualizerRendererDiagnostics.recordingStarts += 1;
            this.setState({
                status: 'recording',
                startedAtContextTime: this.tap.getContextTime(),
                mimeType,
            });
        } catch (error) {
            if (generation !== this.generation) return;
            const normalized = recordingError(
                error,
                'recorder-start-failed',
                '录制启动失败。',
            );
            await this.abort(normalized.code, normalized.message, false);
        }
    }

    async cancel(): Promise<void> {
        if (!isActive(this.state)) return;
        await this.abort('recorder-failed', '录制已取消。', true);
    }

    async save(): Promise<'saved' | 'cancelled'> {
        if (this.state.status !== 'ready' || !this.readyBlob) {
            throw new VisualizerRecordingSessionError(
                'empty-output',
                '没有可保存的 WebM。',
            );
        }
        if (!this.suggestedFileName) {
            throw new VisualizerRecordingSessionError(
                'identity-changed',
                '录制输出身份已失效。',
            );
        }
        visualizerRendererDiagnostics.recordingSaveAttempts += 1;
        const result = await this.options.videoGateway.save(
            this.suggestedFileName,
            this.readyBlob,
        );
        if (result === 'saved') {
            this.clearReadyBlob();
            this.setState({ status: 'idle' });
        }
        return result;
    }

    discard(): void {
        if (this.state.status === 'ready') this.clearReadyBlob();
        if (this.state.status === 'error' || this.state.status === 'ready') {
            this.setState({ status: 'idle' });
        }
    }

    resetError(): void {
        if (this.state.status === 'error') this.setState({ status: 'idle' });
    }

    async handlePageHide(): Promise<void> {
        if (isActive(this.state)) await this.cancel();
        if (this.state.status === 'ready') this.discard();
    }

    async dispose(): Promise<void> {
        ++this.generation;
        await this.cleanupResources();
        this.clearReadyBlob();
        this.suggestedFileName = null;
        this.target = null;
        this.state = { status: 'idle' };
    }

    private preflight(): VisualizerRecordingContext {
        if (this.state.status === 'ready') {
            throw new VisualizerRecordingSessionError(
                'output-pending',
                '请先保存或丢弃当前 WebM。',
            );
        }
        if (isActive(this.state)) {
            throw new VisualizerRecordingSessionError(
                'recording-busy',
                '录制已经在进行。',
            );
        }
        const context = this.options.readContext();
        if (
            !context.project
            || !context.activeTrackId
            || !['ready', 'not-persisted'].includes(context.state)
            || context.project.track.contentHash.length === 0
        ) {
            return this.failPreflight('track-mismatch', '当前歌曲或工程身份不可录制。');
        }
        const active = context.bindingRuntime.activeFeatureIds;
        const ready = context.bindingRuntime.readyFeatureIds;
        if (
            active.length > 0
            && (
                context.bindingRuntime.analysisState !== 'ready'
                || active.some((featureId) => !ready.includes(featureId))
            )
        ) {
            return this.failPreflight('analysis-not-ready', '活动分析尚未全部就绪。');
        }
        if (context.resolvedValues.some((value) => value.state !== 'ready')) {
            return this.failPreflight('binding-invalid', '存在未就绪或无效的参数绑定。');
        }
        if (!this.target) {
            return this.failPreflight('renderer-unavailable', '录制渲染目标尚未就绪。');
        }
        const rendererStatus = this.target.getStatus();
        if (rendererStatus.state === 'recovering') {
            return this.failPreflight('context-lost', 'WebGL 上下文尚未恢复。');
        }
        if (!['ready', 'neutral'].includes(rendererStatus.state)) {
            return this.failPreflight('renderer-unavailable', '渲染器尚未就绪。');
        }
        if (!selectVisualizerRecordingMimeType(this.isTypeSupported)) {
            return this.failPreflight('mime-unavailable', '当前浏览器不支持 VP9/VP8 + Opus WebM。');
        }
        const preset = getVisualizerRecordingPreset(
            context.project.output.resolution,
            context.project.output.frameRate,
        );
        if (!this.isPresetAvailable(preset)) {
            return this.failPreflight(
                'preset-unavailable',
                '当前浏览器无法稳定提供所选录制尺寸或帧率。',
            );
        }
        return context;
    }

    private failPreflight(
        code: VisualizerRecordingErrorCode,
        message: string,
    ): never {
        this.setState({ status: 'error', code, message });
        throw new VisualizerRecordingSessionError(code, message);
    }

    private captureCanvas(canvas: HTMLCanvasElement, frameRate: number): MediaStream {
        const captureStream = canvas.captureStream;
        if (typeof captureStream !== 'function') {
            throw new VisualizerRecordingSessionError(
                'capture-unsupported',
                '当前浏览器不支持 Canvas captureStream。',
            );
        }
        try {
            return captureStream.call(canvas, frameRate);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'SecurityError') {
                throw new VisualizerRecordingSessionError(
                    'capture-security',
                    'Canvas 因安全限制不能录制。',
                );
            }
            throw error;
        }
    }

    private validateTracks(
        audioTracks: MediaStreamTrack[],
        videoTracks: MediaStreamTrack[],
        preset: ReturnType<typeof getVisualizerRecordingPreset>,
    ): void {
        if (audioTracks.length !== 1 || audioTracks[0]?.readyState !== 'live') {
            throw new VisualizerRecordingSessionError(
                'audio-track-unavailable',
                '录制音轨不可用。',
            );
        }
        if (videoTracks.length !== 1 || videoTracks[0]?.readyState !== 'live') {
            throw new VisualizerRecordingSessionError(
                'video-track-unavailable',
                '录制视频轨不可用。',
            );
        }
        const settings = videoTracks[0].getSettings();
        if (
            (settings.width !== undefined && settings.width !== preset.width)
            || (settings.height !== undefined && settings.height !== preset.height)
            || (
                settings.frameRate !== undefined
                && Math.abs(settings.frameRate - preset.frameRate) > 0.5
            )
        ) {
            throw new VisualizerRecordingSessionError(
                'preset-unavailable',
                '浏览器无法提供所选录制尺寸或帧率。',
            );
        }
    }

    private watchTracks(tracks: MediaStreamTrack[], generation: number): void {
        for (const track of tracks) {
            track.addEventListener('ended', () => {
                if (generation !== this.generation || this.cleaning) return;
                void this.abort('track-ended', '录制媒体轨意外结束。', false);
            }, { once: true });
        }
    }

    private installRecorderEvents(
        recorder: MediaRecorder,
        generation: number,
        mimeType: string,
    ): void {
        recorder.addEventListener('dataavailable', (event: BlobEvent) => {
            if (generation !== this.generation || event.data.size === 0) return;
            this.chunks.push(event.data);
        });
        recorder.addEventListener('error', () => {
            if (generation !== this.generation || this.cleaning) return;
            void this.abort('recorder-failed', 'MediaRecorder 录制失败。', false);
        });
        recorder.addEventListener('stop', () => {
            if (generation !== this.generation || this.cleaning) return;
            if (this.state.status !== 'finalizing') {
                void this.abort('recorder-failed', 'MediaRecorder 意外停止。', false);
                return;
            }
            void this.completeFinalization(generation, mimeType);
        });
    }

    private startRecorder(recorder: MediaRecorder, generation: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const clear = () => {
                recorder.removeEventListener('start', onStart);
                recorder.removeEventListener('error', onError);
                this.clearWatchdog();
                if (this.cancelStartWait === cancelWait) this.cancelStartWait = null;
            };
            const cancelWait = () => {
                clear();
                reject(new VisualizerRecordingSessionError(
                    'recorder-start-failed',
                    '录制启动已取消。',
                ));
            };
            const onStart = () => {
                visualizerRendererDiagnostics.recordingStage = 'recorder-start-event';
                visualizerRendererDiagnostics.lastRecorderState = recorder.state;
                clear();
                resolve();
            };
            const onError = () => {
                clear();
                reject(new VisualizerRecordingSessionError(
                    'recorder-start-failed',
                    'MediaRecorder 未能启动。',
                ));
            };
            recorder.addEventListener('start', onStart, { once: true });
            recorder.addEventListener('error', onError, { once: true });
            this.cancelStartWait = cancelWait;
            this.watchdog = this.setTimer(() => {
                visualizerRendererDiagnostics.lastRecorderState = recorder.state;
                clear();
                reject(new VisualizerRecordingSessionError(
                    'recorder-start-failed',
                    'MediaRecorder 启动超时。',
                ));
            }, START_WATCHDOG_MS);
            try {
                recorder.start(1_000);
                visualizerRendererDiagnostics.recordingStage = 'recorder-start-called';
                visualizerRendererDiagnostics.lastRecorderState = recorder.state;
                // captureStream is acquired after the required time-zero draw.
                // Draw the same deterministic frame once more so browsers that
                // wait for a post-capture canvas mutation can emit `start`.
                this.surface?.renderNow();
            } catch (error) {
                clear();
                reject(error);
            }
            if (generation !== this.generation) {
                clear();
                reject(new VisualizerRecordingSessionError(
                    'recorder-start-failed',
                    '录制启动已取消。',
                ));
            }
        });
    }

    private handlePlayback(snapshot: PlaybackSnapshot, generation: number): void {
        if (generation !== this.generation || !isActive(this.state)) return;
        if (snapshot.trackId !== this.expectedTrackId) {
            void this.abort('identity-changed', '录制期间歌曲身份发生变化。', false);
            return;
        }
        if (snapshot.state === 'error') {
            void this.abort('recorder-failed', '录制期间音频播放失败。', false);
            return;
        }
        if (snapshot.state === 'ended' && this.state.status === 'recording') {
            this.beginFinalization();
        }
    }

    private beginFinalization(): void {
        const recorder = this.recorder;
        if (!recorder || this.state.status !== 'recording') return;
        const mimeType = this.state.mimeType;
        this.setState({ status: 'finalizing', mimeType });
        this.watchdog = this.setTimer(() => {
            void this.abort('recorder-failed', 'MediaRecorder 收尾超时。', false);
        }, FINALIZE_WATCHDOG_MS);
        try {
            recorder.requestData();
            recorder.stop();
        } catch (error) {
            const normalized = recordingError(error, 'recorder-failed', '录制收尾失败。');
            void this.abort(normalized.code, normalized.message, false);
        }
    }

    private async completeFinalization(generation: number, mimeType: string): Promise<void> {
        if (generation !== this.generation) return;
        this.clearWatchdog();
        const blob = new Blob(this.chunks, { type: mimeType });
        if (blob.size === 0) {
            await this.abort('empty-output', 'MediaRecorder 没有生成有效数据。', false);
            return;
        }
        const finalTracks = this.combinedStream?.getTracks() ?? [];
        if (
            finalTracks.filter((track) => track.kind === 'audio').length !== 1
            || finalTracks.filter((track) => track.kind === 'video').length !== 1
            || finalTracks.some((track) => track.readyState !== 'live')
        ) {
            await this.abort('track-ended', '录制收尾前音频或视频轨已失效。', false);
            return;
        }
        ++this.generation;
        await this.cleanupResources();
        this.readyBlob = blob;
        visualizerRendererDiagnostics.recordingStage = 'ready';
        visualizerRendererDiagnostics.readyRecordingBlobs += 1;
        visualizerRendererDiagnostics.recordingFinalizes += 1;
        this.checkpoint = null;
        this.expectedTrackId = null;
        this.setState({ status: 'ready', mimeType, byteLength: blob.size });
    }

    private async abort(
        code: VisualizerRecordingErrorCode,
        message: string,
        cancelled: boolean,
    ): Promise<void> {
        if (!isActive(this.state)) return;
        const wasPreparing = this.state.status === 'preparing' && !this.started;
        const checkpoint = this.checkpoint;
        ++this.generation;
        visualizerRendererDiagnostics.recordingAborts += 1;
        visualizerRendererDiagnostics.recordingStage = cancelled ? 'cancelled' : 'error';
        visualizerRendererDiagnostics.lastRecordingError = message;
        if (!wasPreparing) this.options.audioSession.pause();
        await this.cleanupResources();
        if (wasPreparing && checkpoint) {
            try {
                await this.options.audioSession.restorePlaybackCheckpoint(checkpoint);
            } catch (error) {
                const normalized = recordingError(
                    error,
                    'identity-changed',
                    '录制前播放状态恢复失败。',
                );
                this.setState({
                    status: 'error',
                    code: normalized.code,
                    message: normalized.message,
                });
                return;
            }
        }
        this.checkpoint = null;
        this.expectedTrackId = null;
        this.suggestedFileName = null;
        this.started = false;
        this.setState(cancelled
            ? { status: 'idle' }
            : { status: 'error', code, message });
    }

    private async cleanupResources(): Promise<void> {
        if (this.cleaning) return;
        this.cleaning = true;
        this.cancelStartWait?.();
        this.cancelStartWait = null;
        this.clearWatchdog();
        this.unsubscribePlayback?.();
        this.unsubscribePlayback = null;
        const recorder = this.recorder;
        const combinedStream = this.combinedStream;
        const videoStream = this.videoStream;
        const tap = this.tap;
        const surface = this.surface;
        this.recorder = null;
        this.combinedStream = null;
        this.videoStream = null;
        this.tap = null;
        this.surface = null;
        this.chunks = [];
        if (recorder) {
            if (recorder.state !== 'inactive') {
                try {
                    recorder.stop();
                } catch {
                    // The recorder may have stopped between the state read and stop.
                }
            }
            visualizerRendererDiagnostics.lastRecorderState = recorder.state;
            visualizerRendererDiagnostics.activeMediaRecorders = Math.max(
                0,
                visualizerRendererDiagnostics.activeMediaRecorders - 1,
            );
        }
        const combinedTracks = combinedStream?.getTracks() ?? [];
        const audioCount = combinedTracks.filter((track) => track.kind === 'audio').length;
        const videoCount = combinedTracks.filter((track) => track.kind === 'video').length;
        for (const track of new Set([
            ...combinedTracks,
            ...(videoStream?.getTracks() ?? []),
        ])) track.stop();
        if (combinedStream) {
            visualizerRendererDiagnostics.activeCaptureStreams = Math.max(
                0,
                visualizerRendererDiagnostics.activeCaptureStreams - 1,
            );
            visualizerRendererDiagnostics.activeAudioTracks = Math.max(
                0,
                visualizerRendererDiagnostics.activeAudioTracks - audioCount,
            );
            visualizerRendererDiagnostics.activeVideoTracks = Math.max(
                0,
                visualizerRendererDiagnostics.activeVideoTracks - videoCount,
            );
        }
        if (tap) {
            tap.release();
            visualizerRendererDiagnostics.activeRecordingTaps = Math.max(
                0,
                visualizerRendererDiagnostics.activeRecordingTaps - 1,
            );
        }
        surface?.release();
        this.cleaning = false;
    }

    private clearReadyBlob(): void {
        if (!this.readyBlob) return;
        this.readyBlob = null;
        this.suggestedFileName = null;
        visualizerRendererDiagnostics.readyRecordingBlobs = Math.max(
            0,
            visualizerRendererDiagnostics.readyRecordingBlobs - 1,
        );
    }

    private clearWatchdog(): void {
        if (!this.watchdog) return;
        this.clearTimer(this.watchdog);
        this.watchdog = null;
    }

    private assertGeneration(generation: number): void {
        if (generation !== this.generation) {
            throw new VisualizerRecordingSessionError(
                'recorder-start-failed',
                '录制启动已取消。',
            );
        }
    }

    private setState(state: VisualizerRecordingState): void {
        this.state = state;
        visualizerRendererDiagnostics.recordingStage = state.status;
        this.options.onState({ ...state });
    }
}
