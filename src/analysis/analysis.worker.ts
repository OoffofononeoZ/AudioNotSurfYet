import {
    AnalysisWorkerCoreError,
    extractCursorValue,
    extractTempoEstimate,
    responseTransferables,
    runAnalysisJob,
    type RetainedAnalysisPcm,
} from './workerCore';
import type {
    AnalysisCursorValueRequest,
    AnalysisJobRequest,
    AnalysisWorkerRequest,
    AnalysisWorkerResponse,
    TempoEstimateRequest,
} from './types';

interface WorkerScope {
    onmessage: ((event: MessageEvent<AnalysisWorkerRequest>) => void) | null;
    postMessage(message: AnalysisWorkerResponse, transfer?: Transferable[]): void;
}

const workerScope = globalThis as unknown as WorkerScope;
let activeToken = 0;
let activeJob: { jobId: string; generation: number } | null = null;
let retained: RetainedAnalysisPcm | null = null;
let queue = Promise.resolve();
const latestCursorRequest = new Map<string, string>();
let latestTempoRequestId: string | null = null;

const postError = (
    request: Pick<AnalysisJobRequest, 'jobId' | 'generation'>,
    error: unknown,
) => {
    const known = error instanceof AnalysisWorkerCoreError;
    workerScope.postMessage({
        kind: 'error',
        jobId: request.jobId,
        generation: request.generation,
        code: known ? error.code : 'worker-failed',
        message: error instanceof Error
            ? error.message
            : 'Analysis Worker failed.',
        recoverable: known ? error.recoverable : true,
    });
};

const analyze = async (request: AnalysisJobRequest, token: number) => {
    activeJob = {
        jobId: request.jobId,
        generation: request.generation,
    };
    try {
        const output = await runAnalysisJob(request, {
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
        });
        if (token !== activeToken) return;
        retained = output.retained;
        workerScope.postMessage(
            output.result,
            responseTransferables(output.result),
        );
    } catch (error) {
        if (
            token !== activeToken
            && error instanceof AnalysisWorkerCoreError
            && error.code === 'cancelled'
        ) {
            return;
        }
        postError(request, error);
    } finally {
        if (activeJob?.jobId === request.jobId) activeJob = null;
    }
};

const cursorValue = (request: AnalysisCursorValueRequest) => {
    if (
        latestCursorRequest.get(request.featureId) !== request.requestId
        || !retained
    ) {
        return;
    }
    try {
        const result = extractCursorValue(retained, request);
        if (
            result
            && latestCursorRequest.get(request.featureId)
                === request.requestId
        ) {
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

workerScope.onmessage = (event) => {
    const request = event.data;
    if (!request || typeof request !== 'object') return;
    if (request.kind === 'cancel') {
        if (
            !activeJob
            || (
                activeJob.jobId === request.jobId
                && activeJob.generation === request.generation
            )
        ) {
            activeToken += 1;
        }
        return;
    }
    if (request.kind === 'cursor-value') {
        latestCursorRequest.set(request.featureId, request.requestId);
        queue = queue.then(() => cursorValue(request));
        return;
    }
    if (request.kind === 'tempo-estimate') {
        latestTempoRequestId = request.requestId;
        queue = queue.then(() => tempoEstimate(request));
        return;
    }
    if (request.kind === 'analyze') {
        const token = ++activeToken;
        retained = null;
        latestTempoRequestId = null;
        queue = queue.then(() => analyze(request, token));
    }
};
