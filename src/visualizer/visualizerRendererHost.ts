import * as THREE from 'three';
import type {
    VisualizerRenderFrame,
    VisualizerRenderer,
    VisualizerRendererStatus,
    VisualizerResolvedParameterMap,
    VisualizerScene,
    VisualizerSceneFrameSnapshot,
    VisualizerSceneHost,
} from './rendererTypes';

export interface VisualizerRendererDiagnostics {
    activeHosts: number;
    activeRenderers: number;
    activeVisualAnimationFrames: number;
    scenesCreated: number;
    scenesDisposed: number;
    targetResolveCount: number;
    renderedFrames: number;
    lastFrameHash: string;
    lastSongTimeSeconds: number;
    lastFrameAtMs: number;
    maxFrameDurationMs: number;
    contextLosses: number;
    contextRestores: number;
    contextRestoreFailures: number;
    activeRecordingTaps: number;
    activeMediaRecorders: number;
    activeCaptureStreams: number;
    activeAudioTracks: number;
    activeVideoTracks: number;
    readyRecordingBlobs: number;
    recordingStarts: number;
    recordingFinalizes: number;
    recordingAborts: number;
    recordingSaveAttempts: number;
    recordingStage: string;
    lastRecordingError: string;
    lastRecorderState: string;
}

export const visualizerRendererDiagnostics: VisualizerRendererDiagnostics = {
    activeHosts: 0,
    activeRenderers: 0,
    activeVisualAnimationFrames: 0,
    scenesCreated: 0,
    scenesDisposed: 0,
    targetResolveCount: 0,
    renderedFrames: 0,
    lastFrameHash: '',
    lastSongTimeSeconds: 0,
    lastFrameAtMs: 0,
    maxFrameDurationMs: 0,
    contextLosses: 0,
    contextRestores: 0,
    contextRestoreFailures: 0,
    activeRecordingTaps: 0,
    activeMediaRecorders: 0,
    activeCaptureStreams: 0,
    activeAudioTracks: 0,
    activeVideoTracks: 0,
    readyRecordingBlobs: 0,
    recordingStarts: 0,
    recordingFinalizes: 0,
    recordingAborts: 0,
    recordingSaveAttempts: 0,
    recordingStage: 'idle',
    lastRecordingError: '',
    lastRecorderState: 'inactive',
};

declare global {
    interface Window {
        __VISUALIZER_DIAGNOSTICS__?: VisualizerRendererDiagnostics;
        __VISUALIZER_V3_DIAGNOSTICS__?: VisualizerRendererDiagnostics;
    }
}

export interface VisualizerRendererHostOptions {
    readonly canvas: HTMLCanvasElement;
    readonly createScene: (host: VisualizerSceneHost) => VisualizerScene;
    readonly readFrame: () => VisualizerRenderFrame | null;
    readonly resolveValuesAt: (timeSeconds: number) => VisualizerResolvedParameterMap;
    readonly onFrame: (
        values: VisualizerResolvedParameterMap,
        snapshot: VisualizerSceneFrameSnapshot,
    ) => void;
    readonly onStatus: (status: VisualizerRendererStatus) => void;
    readonly createRenderer?: (canvas: HTMLCanvasElement) => VisualizerRenderer;
    readonly requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    readonly cancelAnimationFrame?: (handle: number) => void;
}

export interface VisualizerRecordingSurfaceLease {
    readonly canvas: HTMLCanvasElement;
    readonly width: number;
    readonly height: number;
    renderNow(): void;
    release(): void;
}

let nextHostId = 1;
const developmentBuild = (
    import.meta as ImportMeta & { env?: { DEV?: boolean } }
).env?.DEV === true;

const defaultRenderer = (canvas: HTMLCanvasElement): VisualizerRenderer =>
    new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
    });

export class VisualizerRendererHost implements VisualizerSceneHost {
    readonly id = `visualizer-renderer-host-${nextHostId++}`;
    readonly canvas: HTMLCanvasElement;
    readonly renderer: VisualizerRenderer;
    private readonly options: VisualizerRendererHostOptions;
    private readonly requestAnimationFrameImpl: (callback: FrameRequestCallback) => number;
    private readonly cancelAnimationFrameImpl: (handle: number) => void;
    private scene: VisualizerScene | null = null;
    private sceneKey = '';
    private frameHandle: number | null = null;
    private width = 1;
    private height = 1;
    private dpr = 1;
    private previewWidth = 1;
    private previewHeight = 1;
    private previewDpr = 1;
    private captureToken: symbol | null = null;
    private disposed = false;
    private contextLost = false;
    private renderBlocked = false;
    private failNextRender = false;
    private sampleCenterOnNextFrame = false;

    constructor(options: VisualizerRendererHostOptions) {
        this.options = options;
        this.canvas = options.canvas;
        this.renderer = (options.createRenderer ?? defaultRenderer)(this.canvas);
        this.requestAnimationFrameImpl = options.requestAnimationFrame
            ?? window.requestAnimationFrame.bind(window);
        this.cancelAnimationFrameImpl = options.cancelAnimationFrame
            ?? window.cancelAnimationFrame.bind(window);
        visualizerRendererDiagnostics.activeHosts += 1;
        visualizerRendererDiagnostics.activeRenderers += 1;
        this.canvas.dataset.rendererHostId = this.id;
        this.canvas.dataset.webglContextState = 'ready';
        this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
        this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
        if (developmentBuild && typeof window !== 'undefined') {
            window.__VISUALIZER_DIAGNOSTICS__ = visualizerRendererDiagnostics;
            window.__VISUALIZER_V3_DIAGNOSTICS__ = visualizerRendererDiagnostics;
            this.canvas.addEventListener('visualizer-scene-error-test', this.handleTestError);
            this.canvas.addEventListener('visualizer-sample-center-test', this.handleCenterSample);
        }
    }

    resolveValuesAt(timeSeconds: number): VisualizerResolvedParameterMap {
        return this.options.resolveValuesAt(timeSeconds);
    }

    resize(width: number, height: number, devicePixelRatio = window.devicePixelRatio || 1): void {
        if (this.disposed) return;
        this.previewWidth = Math.max(1, width);
        this.previewHeight = Math.max(1, height);
        this.previewDpr = Math.min(Math.max(1, devicePixelRatio), 2);
        if (this.captureToken || this.contextLost) return;
        try {
            this.applySize(this.previewWidth, this.previewHeight, this.previewDpr);
        } catch (error) {
            this.options.onStatus({
                state: 'error',
                message: error instanceof Error ? error.message : '场景尺寸更新失败。',
            });
            return;
        }
        this.requestFrame();
    }

    acquireRecordingSurface(
        width: number,
        height: number,
    ): VisualizerRecordingSurfaceLease {
        if (this.disposed) throw new Error('Visualizer renderer host 已释放。');
        if (this.contextLost) throw new Error('WebGL 上下文尚未恢复。');
        if (this.renderBlocked) throw new Error('Visualizer 场景需要重试后才能录制。');
        if (this.captureToken) throw new Error('Visualizer capture surface 正在使用。');
        const token = Symbol('visualizer-recording-surface');
        const captureWidth = Math.max(1, Math.round(width));
        const captureHeight = Math.max(1, Math.round(height));
        this.captureToken = token;
        this.canvas.dataset.captureActive = 'true';
        try {
            this.applySize(captureWidth, captureHeight, 1);
        } catch (error) {
            this.captureToken = null;
            delete this.canvas.dataset.captureActive;
            throw error;
        }
        let released = false;
        return {
            canvas: this.canvas,
            width: captureWidth,
            height: captureHeight,
            renderNow: () => {
                if (released || this.captureToken !== token) return;
                this.cancelPendingFrame();
                this.renderCurrentFrame();
            },
            release: () => {
                if (released) return;
                released = true;
                if (this.captureToken !== token) return;
                this.captureToken = null;
                delete this.canvas.dataset.captureActive;
                if (this.disposed) return;
                if (this.contextLost) {
                    this.width = this.previewWidth;
                    this.height = this.previewHeight;
                    this.dpr = this.previewDpr;
                    return;
                }
                try {
                    this.applySize(this.previewWidth, this.previewHeight, this.previewDpr);
                    this.requestFrame();
                } catch (error) {
                    this.options.onStatus({
                        state: 'error',
                        message: error instanceof Error
                            ? error.message
                            : '录制画布恢复失败。',
                    });
                }
            },
        };
    }

    requestFrame(): void {
        if (
            this.disposed
            || this.contextLost
            || this.renderBlocked
            || this.frameHandle !== null
        ) return;
        this.frameHandle = this.requestAnimationFrameImpl(this.draw);
        visualizerRendererDiagnostics.activeVisualAnimationFrames += 1;
    }

    retry(): void {
        if (this.disposed) return;
        if (this.contextLost) {
            this.options.onStatus({
                state: 'recovering',
                message: '等待 WebGL 上下文恢复后再重建场景。',
            });
            return;
        }
        try {
            this.disposeScene();
        } catch (error) {
            this.options.onStatus({
                state: 'error',
                message: error instanceof Error ? error.message : '旧场景释放失败。',
            });
            return;
        }
        this.renderBlocked = false;
        this.options.onStatus({ state: 'idle' });
        this.requestFrame();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.captureToken = null;
        delete this.canvas.dataset.captureActive;
        this.cancelPendingFrame();
        try {
            this.disposeScene();
        } catch {
            // Host disposal must continue through renderer/context cleanup.
        }
        this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
        this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
        if (developmentBuild && typeof window !== 'undefined') {
            this.canvas.removeEventListener('visualizer-scene-error-test', this.handleTestError);
            this.canvas.removeEventListener('visualizer-sample-center-test', this.handleCenterSample);
        }
        this.renderer.dispose();
        this.renderer.forceContextLoss?.();
        visualizerRendererDiagnostics.activeHosts -= 1;
        visualizerRendererDiagnostics.activeRenderers -= 1;
        delete this.canvas.dataset.rendererHostId;
        delete this.canvas.dataset.webglContextState;
    }

    private readonly handleTestError = (): void => {
        this.failNextRender = true;
        this.requestFrame();
    };

    private readonly handleCenterSample = (): void => {
        this.sampleCenterOnNextFrame = true;
        this.requestFrame();
    };

    private readonly handleContextLost = (event: Event): void => {
        event.preventDefault();
        if (this.disposed || this.contextLost) return;
        this.contextLost = true;
        this.cancelPendingFrame();
        visualizerRendererDiagnostics.contextLosses += 1;
        this.canvas.dataset.webglContextState = 'lost';
        try {
            // The old GL resources cannot be reused. Release their scene ownership
            // while the context is lost so Three.js does not delete stale handles
            // from the newly restored context.
            this.disposeScene();
        } catch {
            // Keep the scene reference so restoration can retry disposal.
        }
        this.options.onStatus({
            state: 'recovering',
            message: 'WebGL 上下文已丢失；工程和播放状态保持不变。',
        });
    };

    private readonly handleContextRestored = (): void => {
        if (this.disposed || !this.contextLost) return;
        this.contextLost = false;
        visualizerRendererDiagnostics.contextRestores += 1;
        this.canvas.dataset.webglContextState = 'restoring';
        this.options.onStatus({
            state: 'recovering',
            message: 'WebGL 上下文已恢复，正在重建当前场景。',
        });
        try {
            this.renderer.setPixelRatio(this.dpr);
            this.renderer.setSize(this.width, this.height, false);
            if (this.scene) this.disposeScene();
        } catch (error) {
            visualizerRendererDiagnostics.contextRestoreFailures += 1;
            this.canvas.dataset.webglContextState = 'error';
            this.options.onStatus({
                state: 'error',
                message: error instanceof Error ? error.message : 'WebGL 场景恢复失败。',
            });
            return;
        }
        this.renderBlocked = false;
        this.requestFrame();
    };

    private cancelPendingFrame(): void {
        if (this.frameHandle === null) return;
        this.cancelAnimationFrameImpl(this.frameHandle);
        this.frameHandle = null;
        visualizerRendererDiagnostics.activeVisualAnimationFrames -= 1;
    }

    private readonly draw: FrameRequestCallback = () => {
        this.frameHandle = null;
        visualizerRendererDiagnostics.activeVisualAnimationFrames -= 1;
        this.renderCurrentFrame();
    };

    private renderCurrentFrame(): void {
        if (this.disposed || this.contextLost || this.renderBlocked) return;
        const frame = this.options.readFrame();
        if (!frame) {
            this.options.onStatus({ state: 'idle' });
            return;
        }
        // Queue the one permitted visual RAF before doing scene/renderer work.
        // A capture lease keeps that same loop alive while transport is still
        // paused during recorder startup/finalization, preventing an initial
        // packet hole without introducing another clock or RAF owner.
        if (frame.playbackState === 'playing' || this.captureToken) this.requestFrame();
        try {
            const scene = this.ensureScene(frame);
            if (this.failNextRender) {
                this.failNextRender = false;
                throw new Error('场景错误恢复测试。');
            }
            const values = this.options.resolveValuesAt(frame.timeSeconds);
            visualizerRendererDiagnostics.targetResolveCount += 1;
            const renderStartedAt = performance.now();
            const snapshot = scene.render({
                timeSeconds: frame.timeSeconds,
                values,
                bindingRevision: frame.bindingRevision,
            });
            visualizerRendererDiagnostics.maxFrameDurationMs = Math.max(
                visualizerRendererDiagnostics.maxFrameDurationMs,
                performance.now() - renderStartedAt,
            );
            if (this.sampleCenterOnNextFrame) {
                this.sampleCenterOnNextFrame = false;
                const context = this.renderer.getContext?.();
                if (context) {
                    const pixel = new Uint8Array(4);
                    context.readPixels(
                        Math.floor(this.canvas.width / 2),
                        Math.floor(this.canvas.height / 2),
                        1,
                        1,
                        context.RGBA,
                        context.UNSIGNED_BYTE,
                        pixel,
                    );
                    this.canvas.dataset.centerPixel = [...pixel].join(',');
                }
            }
            visualizerRendererDiagnostics.lastFrameHash = snapshot.hash;
            visualizerRendererDiagnostics.lastSongTimeSeconds = frame.timeSeconds;
            visualizerRendererDiagnostics.lastFrameAtMs = performance.now();
            visualizerRendererDiagnostics.renderedFrames += 1;
            this.canvas.dataset.frameStateHash = snapshot.hash;
            this.canvas.dataset.frameTime = frame.timeSeconds.toFixed(6);
            this.canvas.dataset.bindingRevision = frame.bindingRevision.toString();
            this.canvas.dataset.webglContextState = 'ready';
            this.options.onFrame(values, snapshot);
            this.options.onStatus({ state: scene.kind === 'neutral' ? 'neutral' : 'ready' });
        } catch (error) {
            this.cancelPendingFrame();
            this.renderBlocked = true;
            this.options.onStatus({
                state: 'error',
                message: error instanceof Error ? error.message : '场景渲染失败。',
            });
        }
    }

    private applySize(width: number, height: number, dpr: number): void {
        this.width = width;
        this.height = height;
        this.dpr = dpr;
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(width, height, false);
        this.scene?.resize(width, height, dpr);
        this.canvas.dataset.renderDpr = dpr.toString();
    }

    private ensureScene(frame: VisualizerRenderFrame): VisualizerScene {
        const nextKey = [
            frame.trackIdentity,
            frame.seed,
        ].join(':');
        if (this.scene && this.sceneKey === nextKey) return this.scene;
        this.disposeScene();
        this.scene = this.options.createScene(this);
        this.sceneKey = nextKey;
        this.scene.resize(this.width, this.height, this.dpr);
        visualizerRendererDiagnostics.scenesCreated += 1;
        return this.scene;
    }

    private disposeScene(): void {
        if (!this.scene) return;
        const scene = this.scene;
        scene.dispose();
        this.scene = null;
        this.sceneKey = '';
        visualizerRendererDiagnostics.scenesDisposed += 1;
    }
}
