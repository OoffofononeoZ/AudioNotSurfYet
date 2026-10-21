import { validateSeriesShape } from './compactCodec';
import type { AnalysisWindowRequest, AnalysisWindowResult, AnalysisWindowSeries } from './windowTypes';
import type { AnalysisWorkerRequest } from './types';

/** Pending runtime messages only; the view owns its single bounded data cache. */
export class AnalysisWindowRequests {
    private readonly pending = new Map<
        string,
        { request: AnalysisWindowRequest; finish(value: AnalysisWindowSeries | null): void }
    >();
    private readonly post: (message: AnalysisWorkerRequest) => void;
    constructor(post: (message: AnalysisWorkerRequest) => void) {
        this.post = post;
    }

    request(request: AnalysisWindowRequest, signal?: AbortSignal): Promise<AnalysisWindowSeries | null> {
        if (signal?.aborted) return Promise.resolve(null);
        return new Promise(resolve => {
            const cancel = () => {
                try {
                    this.post({ kind: 'cancel-window', requestId: request.requestId });
                } catch {
                    // A stopped Worker cannot acknowledge cancellation.
                } finally {
                    finish(null);
                }
            };
            const timer = setTimeout(cancel, 30_000);
            const finish = (value: AnalysisWindowSeries | null) => {
                clearTimeout(timer);
                signal?.removeEventListener('abort', cancel);
                this.pending.delete(request.requestId);
                resolve(value);
            };
            this.pending.set(request.requestId, { request, finish });
            signal?.addEventListener('abort', cancel, { once: true });
            try {
                this.post(request);
            } catch {
                finish(null);
            }
        });
    }
    handle(result: AnalysisWindowResult): void {
        const pending = this.pending.get(result.requestId);
        if (!pending) return;
        const expected = pending.request,
            series = result.series;
        if (
            result.generation !== expected.generation ||
            result.trackHash !== expected.trackHash ||
            result.configHash !== expected.configHash ||
            result.featureId !== expected.featureId
        )
            return;
        try {
            if (series) {
                const { startTimeSeconds, endTimeSeconds, ...base } = series;
                if (
                    !Number.isFinite(startTimeSeconds) ||
                    !Number.isFinite(endTimeSeconds) ||
                    startTimeSeconds < 0 ||
                    endTimeSeconds <= startTimeSeconds ||
                    series.trackHash !== expected.trackHash ||
                    series.configHash !== expected.configHash ||
                    series.featureId !== expected.featureId
                )
                    throw Error('Invalid window identity');
                validateSeriesShape({ ...base, startTimeSeconds: 0 });
            }
            pending.finish(series);
        } catch {
            pending.finish(null);
        }
    }
    clear(): void {
        for (const pending of this.pending.values()) {
            try {
                this.post({ kind: 'cancel-window', requestId: pending.request.requestId });
            } catch {
                // Still release every pending promise if the Worker has failed.
            } finally {
                pending.finish(null);
            }
        }
    }
}
