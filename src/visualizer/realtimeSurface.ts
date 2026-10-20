import type { ExactFeatureValue, FeatureId } from '../analysis/types';
import type { NativeAudioFrame } from './nativeAudioAnalysis';
import type { VisualizerRendererStatus } from './rendererTypes';
import { CompositionScene, type CompositionRenderPort } from './compositionScene';
import { VisualizerRendererHost } from './visualizerRendererHost';
import { realtimeRenderModel, type RealtimeStyleV1 } from './realtimeStyle';
import { RealtimeResolver } from './realtimeResolver';
import { validateAlgorithmPrograms } from './validateAlgorithmPrograms';

/** Shared browser / Wallpaper Engine surface. Audio acquisition remains with its host. */
export class RealtimeSurface {
    readonly host: VisualizerRendererHost;
    private resolver = new RealtimeResolver();
    private features: Partial<Record<FeatureId, ExactFeatureValue>> = {};
    private native: NativeAudioFrame | null = null;
    private revision = 0;
    private started = performance.now();
    private pausedAt: number | null = null;
    private pausedDuration = 0;
    private observer: ResizeObserver;
    private style: RealtimeStyleV1;
    readNative: (() => NativeAudioFrame | null) | null = null;
    constructor(
        canvas: HTMLCanvasElement,
        style: RealtimeStyleV1,
        onStatus: (status: VisualizerRendererStatus) => void,
    ) {
        this.style = style;
        const model = realtimeRenderModel(style);
        this.host = new VisualizerRendererHost({
            canvas,
            createScene: surface => {
                validateAlgorithmPrograms(surface.renderer, style.resources);
                return new CompositionScene({
                    renderer: surface.renderer as CompositionRenderPort,
                    readProject: () => model,
                    resolveAt: time => this.resolve(time),
                    realtime: true,
                });
            },
            readFrame: () => ({
                trackIdentity: style.id,
                seed: style.seed,
                timeSeconds: this.time(),
                bindingRevision: this.revision,
                playbackState: 'paused',
                animate: this.pausedAt === null,
            }),
            resolveValuesAt: time => this.resolve(time),
            onFrame() {},
            onStatus,
        });
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(canvas);
        this.resize();
        this.host.requestFrame();
    }
    private resolve(time: number) {
        return this.resolver.resolve(this.style, time, this.features, this.readNative?.() ?? this.native);
    }
    private resize() {
        const rect = this.host.canvas.getBoundingClientRect();
        this.host.resize(rect.width, rect.height);
    }
    private time() {
        return ((this.pausedAt ?? performance.now()) - this.started - this.pausedDuration) / 1000;
    }
    setFeatures(values: Partial<Record<FeatureId, ExactFeatureValue>>) {
        this.features = values;
        if (import.meta.env.DEV) {
            this.host.canvas.dataset.realtimeInputFrames = String(
                Number(this.host.canvas.dataset.realtimeInputFrames ?? 0) + 1,
            );
            this.host.canvas.dataset.realtimeInputPeak = String(
                Math.max(
                    0,
                    ...Object.values(values).flatMap(v => (typeof v === 'number' ? [v] : Array.isArray(v) ? v : [])),
                ),
            );
        }
    }
    resetInput() {
        this.features = {};
        this.native = null;
        this.readNative = null;
        this.resolver.reset();
        this.revision++;
        this.host.invalidateFrame();
        this.host.requestFrame();
    }
    setPaused(paused: boolean) {
        if (paused === (this.pausedAt !== null)) return;
        if (paused) this.pausedAt = performance.now();
        else {
            this.pausedDuration += performance.now() - this.pausedAt!;
            this.pausedAt = null;
        }
        this.host.invalidateFrame();
        this.host.requestFrame();
    }
    retry() {
        this.host.retry();
    }
    dispose() {
        this.observer.disconnect();
        this.host.dispose();
    }
}
