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
    activeExportJobs: number;
    readyExportFiles: number;
    exportStarts: number;
    exportFinalizes: number;
    exportAborts: number;
    exportSaveAttempts: number;
    exportFramesDone: number;
    exportTotalFrames: number;
    exportStage: string;
    lastExportError: string;
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
    activeExportJobs: 0,
    readyExportFiles: 0,
    exportStarts: 0,
    exportFinalizes: 0,
    exportAborts: 0,
    exportSaveAttempts: 0,
    exportFramesDone: 0,
    exportTotalFrames: 0,
    exportStage: 'idle',
    lastExportError: '',
};

declare global {
    interface Window {
        __VISUALIZER_DIAGNOSTICS__?: VisualizerRendererDiagnostics;
        __VISUALIZER_V3_DIAGNOSTICS__?: VisualizerRendererDiagnostics;
    }
}

export interface VisualizerRendererHostOptions {
    readonly maxFrameRate?: () => number;
    readonly canvas: HTMLCanvasElement;
    readonly createScene: (host: VisualizerSceneHost) => VisualizerScene;
    readonly readFrame: () => VisualizerRenderFrame | null;
    readonly resolveValuesAt: (timeSeconds: number) => VisualizerResolvedParameterMap;
    readonly onFrame: (values: VisualizerResolvedParameterMap, snapshot: VisualizerSceneFrameSnapshot) => void;
    readonly onStatus: (status: VisualizerRendererStatus) => void;
    readonly createRenderer?: (canvas: HTMLCanvasElement) => VisualizerRenderer;
    readonly requestAnimationFrame?: (callback: FrameRequestCallback) => number;
    readonly cancelAnimationFrame?: (handle: number) => void;
}

export interface VisualizerExportSurfaceLease {
    readonly canvas: HTMLCanvasElement;
    readonly width: number;
    readonly height: number;
    renderAtTime(timeSeconds: number): Promise<void>;
    release(): void;
}

let nextHostId = 1;
const developmentBuild = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

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
    private exportToken: symbol | null = null;
    private disposed = false;
    private contextLost = false;
    private renderBlocked = false;
    private failNextRender = false;
    private sampleCenterOnNextFrame = false;
    private renderGeneration = 0;
    private preparation: symbol | null = null;
    private pendingPreview = false;
    private lastPreviewAt = -Infinity;

    invalidateFrame(): void {
        this.renderGeneration++;
    }

    constructor(options: VisualizerRendererHostOptions) {
        this.options = options;
        this.canvas = options.canvas;
        this.renderer = (options.createRenderer ?? defaultRenderer)(this.canvas);
        this.requestAnimationFrameImpl = options.requestAnimationFrame ?? window.requestAnimationFrame.bind(window);
        this.cancelAnimationFrameImpl = options.cancelAnimationFrame ?? window.cancelAnimationFrame.bind(window);
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
        if (this.exportToken || this.contextLost) return;
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

    acquireExportSurface(width: number, height: number): VisualizerExportSurfaceLease {
        if (this.disposed) throw new Error('Visualizer renderer host 已释放。');
        if (this.contextLost) throw new Error('WebGL 上下文尚未恢复。');
        if (this.renderBlocked) throw new Error('Visualizer 场景需要重试后才能导出。');
        if (this.exportToken) throw new Error('Visualizer export surface 正在使用。');
        const token = Symbol('visualizer-export-surface');
        const exportWidth = Math.max(1, Math.round(width));
        const exportHeight = Math.max(1, Math.round(height));
        this.exportToken = token;
        this.canvas.dataset.exportActive = 'true';
        try {
            this.cancelPendingFrame();
            this.disposeScene();
            this.applySize(exportWidth, exportHeight, 1);
        } catch (error) {
            this.exportToken = null;
            delete this.canvas.dataset.exportActive;
            throw error;
        }
        let released = false;
        return {
            canvas: this.canvas,
            width: exportWidth,
            height: exportHeight,
            renderAtTime: async timeSeconds => {
                if (released || this.exportToken !== token || this.disposed || this.contextLost || this.renderBlocked)
                    throw new Error('导出渲染租约已失效。');
                const frame = this.options.readFrame();
                if (!frame) throw new Error('导出工程身份已失效。');
                await this.renderCurrentFrame({ ...frame, timeSeconds });
            },
            release: () => {
                if (released) return;
                released = true;
                if (this.exportToken !== token) return;
                this.exportToken = null;
                delete this.canvas.dataset.exportActive;
                if (this.disposed) return;
                if (this.contextLost) {
                    this.width = this.previewWidth;
                    this.height = this.previewHeight;
                    this.dpr = this.previewDpr;
                    return;
                }
                try {
                    this.disposeScene();
                    this.applySize(this.previewWidth, this.previewHeight, this.previewDpr);
                    this.requestFrame();
                } catch (error) {
                    this.options.onStatus({
                        state: 'error',
                        message: error instanceof Error ? error.message : '导出画布恢复失败。',
                    });
                }
            },
        };
    }

    requestFrame(): void {
        if (this.disposed || this.contextLost || this.renderBlocked || this.exportToken || this.frameHandle !== null)
            return;
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
        this.exportToken = null;
        delete this.canvas.dataset.exportActive;
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
        const fps = this.options.maxFrameRate?.() ?? 0,
            now = performance.now();
        if (fps > 0 && now - this.lastPreviewAt < 1000 / fps - 0.5) {
            this.requestFrame();
            return;
        }
        this.lastPreviewAt = now;
        void this.renderCurrentFrame();
    };

    private renderCurrentFrame(override?: VisualizerRenderFrame): void | Promise<void> {
        if (this.disposed || this.contextLost || this.renderBlocked) return;
        if (this.exportToken && !override) return;
        const frame = override ?? this.options.readFrame();
        if (!frame) {
            this.options.onStatus({ state: 'idle' });
            return;
        }
        if ((frame.animate ?? frame.playbackState === 'playing') && !this.exportToken) this.requestFrame();
        if (this.preparation) {
            if (override) return Promise.reject(Error('上一帧算法计算尚未结束。'));
            this.pendingPreview = true;
            return;
        }
        const failed = (error: unknown) => {
            const current = this.options.readFrame();
            if (
                this.disposed ||
                generation !== this.renderGeneration ||
                !current ||
                current.trackIdentity !== frame.trackIdentity ||
                current.bindingRevision !== frame.bindingRevision ||
                current.seed !== frame.seed
            ) {
                if (override) throw error;
                return;
            }
            this.cancelPendingFrame();
            this.renderBlocked = true;
            this.options.onStatus({
                state: 'error',
                message: error instanceof Error ? error.message : '场景渲染失败。',
            });
            if (override) throw error;
        };
        let generation = this.renderGeneration;
        try {
            const scene = this.ensureScene(frame);
            generation = this.renderGeneration;
            if (this.failNextRender) {
                this.failNextRender = false;
                throw new Error('场景错误恢复测试。');
            }
            const values = this.options.resolveValuesAt(frame.timeSeconds);
            visualizerRendererDiagnostics.targetResolveCount += 1;
            const renderStartedAt = performance.now();
            const input = {
                timeSeconds: frame.timeSeconds,
                values,
                bindingRevision: frame.bindingRevision,
            };
            const draw = () => {
                if (generation !== this.renderGeneration || this.disposed || this.contextLost || scene !== this.scene) {
                    if (override) throw Error('导出帧身份已失效。');
                    return;
                }
                const current = this.options.readFrame();
                if (
                    !current ||
                    current.trackIdentity !== frame.trackIdentity ||
                    current.bindingRevision !== frame.bindingRevision ||
                    current.seed !== frame.seed
                ) {
                    if (override) throw Error('导出帧身份已失效。');
                    return;
                }
                const snapshot = scene.render(input);
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
            };
            if (scene.prepare) {
                const token = Symbol('frame preparation');
                this.preparation = token;
                return scene
                    .prepare(input)
                    .then(draw)
                    .catch(failed)
                    .finally(() => {
                        if (this.preparation !== token) return;
                        this.preparation = null;
                        if (this.pendingPreview && !this.disposed) {
                            this.pendingPreview = false;
                            this.requestFrame();
                        }
                    });
            }
            draw();
        } catch (error) {
            failed(error);
        }
    }

    private applySize(width: number, height: number, dpr: number): void {
        this.invalidateFrame();
        this.width = width;
        this.height = height;
        this.dpr = dpr;
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(width, height, false);
        this.scene?.resize(width, height, dpr);
        this.canvas.dataset.renderDpr = dpr.toString();
    }

    private ensureScene(frame: VisualizerRenderFrame): VisualizerScene {
        const nextKey = [frame.trackIdentity, frame.seed].join(':');
        if (this.scene && this.sceneKey === nextKey) return this.scene;
        this.disposeScene();
        this.scene = this.options.createScene(this);
        this.sceneKey = nextKey;
        this.scene.resize(this.width, this.height, this.dpr);
        visualizerRendererDiagnostics.scenesCreated += 1;
        return this.scene;
    }

    private disposeScene(): void {
        this.invalidateFrame();
        this.preparation = null;
        if (!this.scene) return;
        const scene = this.scene;
        scene.dispose();
        this.scene = null;
        this.sceneKey = '';
        visualizerRendererDiagnostics.scenesDisposed += 1;
    }
}
