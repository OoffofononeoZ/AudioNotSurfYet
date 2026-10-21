import type { AnalysisSeries } from '../analysis/types';
import type { AnalysisWindowInput, AnalysisWindowSeries } from '../analysis/windowTypes';

export const ANALYSIS_ZOOM_SETTLE_MS = 150;
export interface AnalysisWindowViewInput {
    series: AnalysisSeries | null;
    generation: number;
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
    sampleRate: number;
    pixels: number;
    enabled: boolean;
}
type Request = (input: AnalysisWindowInput, signal: AbortSignal) => Promise<AnalysisWindowSeries | null>;

export function windowCovers(series: AnalysisWindowSeries, input: AnalysisWindowViewInput): boolean {
    return (
        series.trackHash === input.series?.trackHash &&
        series.configHash === input.series.configHash &&
        series.featureId === input.series.featureId &&
        series.startTimeSeconds <= Math.max(0, input.startSeconds) + 1e-9 &&
        series.endTimeSeconds >= Math.min(input.durationSeconds, input.endSeconds) - 1e-9
    );
}
export function waveformBucketSamples(input: AnalysisWindowViewInput): number {
    return (
        2 **
        Math.floor(
            Math.log2(
                Math.max(1, ((input.endSeconds - input.startSeconds) * input.sampleRate) / Math.max(1, input.pixels)),
            ),
        )
    );
}

/** One visible-window cache, one running request, and the newest pending view per instance. */
export class EditorAnalysisWindowView {
    private current: AnalysisWindowViewInput | null = null;
    private cache: AnalysisWindowSeries | null = null;
    private abort: AbortController | null = null;
    private running: Promise<void> | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private revision = 0;
    private disposed = false;
    private retryAfter = 0;
    private requested: AnalysisWindowInput | null = null;
    private readonly request: Request;
    private readonly changed: (series: AnalysisWindowSeries | null, pending: boolean) => void;
    constructor(request: Request, changed: (series: AnalysisWindowSeries | null, pending: boolean) => void) {
        this.request = request;
        this.changed = changed;
    }

    update(input: AnalysisWindowViewInput): void {
        if (this.disposed) return;
        const previous = this.current;
        const scopeChanged =
            !previous ||
            previous.series !== input.series ||
            previous.generation !== input.generation ||
            previous.enabled !== input.enabled;
        const zoomed =
            previous &&
            (Math.abs(previous.endSeconds - previous.startSeconds - (input.endSeconds - input.startSeconds)) > 1e-8 ||
                previous.pixels !== input.pixels);
        this.current = input;
        if (scopeChanged) {
            this.cancel();
            this.cache = null;
            this.retryAfter = 0;
            this.changed(null, false);
        }
        if (!this.needsDetail(input)) {
            this.cancel();
            this.changed(this.cache, false);
            return;
        }
        if (zoomed || scopeChanged) {
            this.cancel();
            this.timer = setTimeout(() => {
                this.timer = null;
                this.pump();
            }, ANALYSIS_ZOOM_SETTLE_MS);
            return;
        }
        if (
            this.running &&
            this.requested &&
            (Math.max(0, input.startSeconds) < this.requested.startSeconds ||
                Math.min(input.durationSeconds, input.endSeconds) > this.requested.endSeconds)
        )
            this.cancel();
        if (!this.timer) this.pump();
    }
    private needsDetail(input: AnalysisWindowViewInput): boolean {
        if (
            !input.enabled ||
            !input.series ||
            input.pixels <= 0 ||
            input.sampleRate <= 0 ||
            input.endSeconds <= input.startSeconds ||
            input.series.featureId === 'wallpaperEngineSpectrum'
        )
            return false;
        const nativeStep =
            input.series.featureId === 'buffer'
                ? waveformBucketSamples(input) / input.sampleRate
                : 512 / input.sampleRate;
        return (
            nativeStep < input.series.sampleStepSeconds &&
            (input.series.featureId === 'buffer' ||
                input.series.sampleStepSeconds > (input.endSeconds - input.startSeconds) / input.pixels)
        );
    }
    private satisfied(input: AnalysisWindowViewInput): boolean {
        const cache = this.cache;
        if (!cache || !windowCovers(cache, input)) return false;
        if (
            input.series?.featureId === 'buffer' &&
            cache.sampleStepSeconds > waveformBucketSamples(input) / input.sampleRate + 1e-12
        )
            return false;
        const margin = (input.endSeconds - input.startSeconds) * 0.25;
        return (
            (cache.startTimeSeconds === 0 || input.startSeconds - cache.startTimeSeconds >= margin) &&
            (cache.endTimeSeconds >= input.durationSeconds || cache.endTimeSeconds - input.endSeconds >= margin)
        );
    }
    private pump(): void {
        const input = this.current;
        if (
            this.disposed ||
            !input ||
            this.timer ||
            this.running ||
            !this.needsDetail(input) ||
            this.satisfied(input) ||
            performance.now() < this.retryAfter
        )
            return;
        const span = input.endSeconds - input.startSeconds;
        const revision = this.revision;
        const abort = new AbortController();
        this.abort = abort;
        this.changed(this.cache, true);
        this.requested = {
            featureId: input.series!.featureId,
            startSeconds: Math.max(0, input.startSeconds - span),
            endSeconds: Math.min(input.durationSeconds, input.endSeconds + span),
            waveformBucketSamples: waveformBucketSamples(input),
        };
        const request = this.requested;
        this.running = Promise.resolve()
            .then(() => this.request(request, abort.signal))
            .then(series => {
                if (this.disposed || revision !== this.revision || abort.signal.aborted) return;
                if (series) this.cache = series;
                else this.retryAfter = performance.now() + 1000;
                this.changed(this.cache, false);
            })
            .catch(() => {
                if (!this.disposed && revision === this.revision) {
                    this.retryAfter = performance.now() + 1000;
                    this.changed(this.cache, false);
                }
            })
            .finally(() => {
                this.running = null;
                this.requested = null;
                if (this.abort === abort) this.abort = null;
                this.pump();
            });
    }
    private cancel(): void {
        ++this.revision;
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.abort?.abort();
        this.abort = null;
    }
    dispose(): void {
        this.disposed = true;
        this.cancel();
        this.cache = null;
        this.current = null;
        this.changed(null, false);
    }
}
