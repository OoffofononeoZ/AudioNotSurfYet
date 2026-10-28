import {
    AnalysisWorkerCoreError,
    extractCursorValue,
    extractTempoEstimate,
    responseTransferables,
    runAnalysisJob,
    validateAnalysisJobRequest,
    type RetainedAnalysisPcm,
} from './workerCore';
import type {
    AnalysisCursorValueRequest,
    AnalysisJobRequest,
    AnalysisSourceJob,
    AnalysisSourcePrepare,
    AnalysisWorkerRequest,
    AnalysisWorkerResponse,
    TempoEstimateRequest,
} from './types';
import { startRealtimeWorker } from './realtimeWorker';
import { extractWindowSeries } from './windowAnalysis';
import type { AnalysisWindowRequest } from './windowTypes';
import { createStemWorker } from './stemWorker';

interface WorkerScope {
    onmessage: ((event: MessageEvent<AnalysisWorkerRequest>) => void) | null;
    postMessage(message: AnalysisWorkerResponse, transfer?: Transferable[]): void;
}

const workerScope = globalThis as unknown as WorkerScope;
let activeToken = 0;
let activeJob: { jobId: string; generation: number } | null = null;
let retained: RetainedAnalysisPcm | null = null;
let sourceKey: string | null = null;
let queue = Promise.resolve();
const stemWorker = createStemWorker(
    message => workerScope.postMessage(message),
    run => {
        queue = queue.then(run);
    },
);
const windowJobs = new Map<string, { cancelled: boolean }>();

const windowSeries = (request: AnalysisWindowRequest) => {
    const job = { cancelled: false },
        token = activeToken;
    windowJobs.set(request.requestId, job);
    queue = queue.then(async () => {
        try {
            const source = retained;
            const series =
                source && token === activeToken && !job.cancelled
                    ? await extractWindowSeries(source, request, {
                          isCancelled: () => job.cancelled || token !== activeToken,
                      })
                    : null;
            if (job.cancelled || token !== activeToken) return;
            const result = {
                kind: 'window-series-result' as const,
                requestId: request.requestId,
                generation: request.generation,
                trackHash: request.trackHash,
                configHash: request.configHash,
                featureId: request.featureId,
                series,
            };
            workerScope.postMessage(
                result,
                series
                    ? responseTransferables({
                          kind: 'result',
                          jobId: request.requestId,
                          generation: request.generation,
                          trackHash: request.trackHash,
                          configHash: request.configHash,
                          series: [{ ...series, startTimeSeconds: 0 }],
                      })
                    : [],
            );
        } catch {
            if (!job.cancelled && token === activeToken)
                workerScope.postMessage({
                    kind: 'window-series-result',
                    requestId: request.requestId,
                    generation: request.generation,
                    trackHash: request.trackHash,
                    configHash: request.configHash,
                    featureId: request.featureId,
                    series: null,
                });
        } finally {
            windowJobs.delete(request.requestId);
        }
    });
};
const latestCursorRequest = new Map<string, string>();
let latestTempoRequestId: string | null = null;
let live: { id: string; stop(): void } | null = null;
let pendingLiveId: string | null = null;

const postError = (request: Pick<AnalysisJobRequest, 'jobId' | 'generation'>, error: unknown) => {
    const known = error instanceof AnalysisWorkerCoreError;
    workerScope.postMessage({
        kind: 'error',
        jobId: request.jobId,
        generation: request.generation,
        code: known ? error.code : 'worker-failed',
        message: error instanceof Error ? error.message : 'Analysis Worker failed.',
        recoverable: known ? error.recoverable : true,
    });
};

const prepareSource = async (request: AnalysisSourcePrepare, token: number) => {
    try {
        await validateAnalysisJobRequest({
            ...request,
            kind: 'analyze',
            jobId: request.sourceKey,
            generation: 0,
            featureIds: [],
            cursorFeatureIds: [],
        });
        if (token !== activeToken) return;
        retained = {
            generation: 0,
            trackHash: request.trackHash,
            config: request.config,
            pcm: new Float32Array(request.pcm),
            durationSeconds: request.durationSeconds,
            featureIds: [],
        };
        sourceKey = request.sourceKey;
        workerScope.postMessage({ kind: 'source-ready', sourceKey });
    } catch (error) {
        workerScope.postMessage({
            kind: 'source-error',
            sourceKey: request.sourceKey,
            message: error instanceof Error ? error.message : 'Unable to prepare audio.',
        });
    }
};

const analyze = async (request: AnalysisSourceJob, token: number) => {
    activeJob = {
        jobId: request.jobId,
        generation: request.generation,
    };
    try {
        const source = retained;
        if (!source || sourceKey !== request.sourceKey) throw new Error('Analysis PCM source is unavailable.');
        retained = { ...source, generation: request.generation, featureIds: request.cursorFeatureIds };
        const output = await runAnalysisJob(
            {
                ...request,
                config: source.config,
                pcm: source.pcm.buffer as ArrayBuffer,
                durationSeconds: source.durationSeconds,
            },
            {
                isCancelled: () => token !== activeToken,
                onProgress: (completedFrames, totalFrames) => {
                    if (token !== activeToken) return;
                    workerScope.postMessage({
                        kind: 'progress',
                        jobId: request.jobId,
                        generation: request.generation,
                        completedFrames,
                        totalFrames,
                    });
                },
            },
        );
        if (token !== activeToken) return;
        retained = { ...output.retained, wallpaperSeries: output.retained.wallpaperSeries ?? source.wallpaperSeries };
        workerScope.postMessage(output.result, responseTransferables(output.result));
    } catch (error) {
        if (token !== activeToken && error instanceof AnalysisWorkerCoreError && error.code === 'cancelled') {
            return;
        }
        postError(request, error);
    } finally {
        if (activeJob?.jobId === request.jobId) activeJob = null;
    }
};

const cursorValue = (request: AnalysisCursorValueRequest) => {
    if (latestCursorRequest.get(request.featureId) !== request.requestId || !retained) {
        return;
    }
    try {
        const result = extractCursorValue(retained, request);
        if (result && latestCursorRequest.get(request.featureId) === request.requestId) {
            workerScope.postMessage(result);
        }
    } catch {
        // Cursor reads are best-effort; the coordinator resolves stale/error
        // requests to null without affecting the analysis job or playback.
    }
};

const tempoEstimate = (request: TempoEstimateRequest) => {
    if (latestTempoRequestId !== request.requestId || !retained) return;
    try {
        const result = extractTempoEstimate(retained, request, {
            isCancelled: () => latestTempoRequestId !== request.requestId,
        });
        if (result && latestTempoRequestId === request.requestId) {
            workerScope.postMessage(result);
        }
    } catch {
        // Tempo estimation is optional. Coordinator timeout/stale handling
        // resolves failures to null without affecting analysis or playback.
    }
};

workerScope.onmessage = event => {
    const request = event.data;
    if (!request || typeof request !== 'object') return;
    if (request.kind === 'prepare-source') {
        const token = ++activeToken;
        retained = null;
        sourceKey = null;
        queue = queue.then(() => prepareSource(request, token));
        return;
    }
    if (request.kind === 'release-source') {
        ++activeToken;
        retained = null;
        sourceKey = null;
        latestTempoRequestId = null;
        return;
    }
    if (request.kind === 'stem-analyze' || request.kind === 'stem-read' || request.kind === 'stem-clear') {
        stemWorker(request);
        return;
    }
    if (request.kind === 'window-series') {
        windowSeries(request);
        return;
    }
    if (request.kind === 'cancel-window') {
        const job = windowJobs.get(request.requestId);
        if (job) job.cancelled = true;
        return;
    }
    if (request.kind === 'realtime-stop') {
        if (pendingLiveId === request.sessionId) {
            ++activeToken;
            pendingLiveId = null;
        }
        if (live?.id === request.sessionId) {
            live.stop();
            live = null;
        }
        return;
    }
    if (request.kind === 'realtime-start') {
        const token = ++activeToken;
        pendingLiveId = request.sessionId;
        retained = null;
        sourceKey = null;
        live?.stop();
        live = null;
        queue = queue.then(async () => {
            if (token !== activeToken) {
                request.port.close();
                return;
            }
            const stop = await startRealtimeWorker(request, message => workerScope.postMessage(message));
            if (token !== activeToken) stop();
            else {
                live = { id: request.sessionId, stop };
                pendingLiveId = null;
            }
        });
        return;
    }
    if (request.kind === 'cancel') {
        if (!activeJob || (activeJob.jobId === request.jobId && activeJob.generation === request.generation)) {
            activeToken += 1;
        }
        return;
    }
    if (request.kind === 'cursor-value') {
        latestCursorRequest.set(request.featureId, request.requestId);
        // Window jobs yield, allowing the exact cursor to use retained PCM immediately.
        if (retained?.generation === request.generation) cursorValue(request);
        else queue = queue.then(() => cursorValue(request));
        return;
    }
    if (request.kind === 'tempo-estimate') {
        latestTempoRequestId = request.requestId;
        queue = queue.then(() => tempoEstimate(request));
        return;
    }
    if (request.kind === 'analyze') {
        pendingLiveId = null;
        live?.stop();
        live = null;
        const token = ++activeToken;
        latestTempoRequestId = null;
        queue = queue.then(() => analyze(request, token));
    }
};
