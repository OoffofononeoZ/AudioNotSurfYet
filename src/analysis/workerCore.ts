import { yieldAnalysisTask } from './taskScheduler';
import { SeriesAccumulator } from './seriesAccumulator';
import { validateAnalysisConfig } from './config';
import { analysisFrameCount, createAnalysisFrame, cursorFrameIndex, frameStartSeconds } from './frames';
import { exactM10Value, extractM10Frame } from './meydaAdapter';
import { estimateTempo } from './tempoEstimator';
import { analyzeWallpaperSpectrum, wallpaperFrameIndex } from './wallpaperSpectrum';
import {
    isFeatureId,
    isM10FeatureId,
    isSupportedFeatureId,
    type AnalysisCursorValueRequest,
    type AnalysisCursorValueResult,
    type AnalysisJobRequest,
    type AnalysisJobResult,
    type AnalysisSeries,
    type AnalysisWorkerResponse,
    type FeatureId,
    type TempoEstimateRequest,
    type TempoEstimateResult,
} from './types';

export class AnalysisWorkerCoreError extends Error {
    readonly code: 'invalid-request' | 'unsupported-feature' | 'extract-failed' | 'cancelled';
    readonly recoverable: boolean;

    constructor(
        code: 'invalid-request' | 'unsupported-feature' | 'extract-failed' | 'cancelled',
        message: string,
        recoverable = true,
    ) {
        super(message);
        this.name = 'AnalysisWorkerCoreError';
        this.code = code;
        this.recoverable = recoverable;
    }
}

export interface AnalysisWorkerHooks {
    isCancelled?: () => boolean;
    onProgress?: (completedFrames: number, totalFrames: number) => void;
    yieldControl?: () => Promise<void>;
    now?: () => number;
}

export interface RetainedAnalysisPcm {
    generation: number;
    trackHash: string;
    config: AnalysisJobRequest['config'];
    pcm: Float32Array;
    durationSeconds: number;
    featureIds: readonly FeatureId[];
    wallpaperSeries?: AnalysisSeries;
}

const invalid = (message: string): never => {
    throw new AnalysisWorkerCoreError('invalid-request', message, false);
};

export const validateAnalysisJobRequest = async (request: AnalysisJobRequest): Promise<void> => {
    if (
        request.kind !== 'analyze' ||
        typeof request.jobId !== 'string' ||
        request.jobId.length === 0 ||
        !Number.isInteger(request.generation) ||
        request.generation < 0 ||
        typeof request.trackHash !== 'string' ||
        request.trackHash.length === 0 ||
        !(request.pcm instanceof ArrayBuffer) ||
        request.pcm.byteLength === 0 ||
        request.pcm.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0 ||
        !Number.isFinite(request.durationSeconds) ||
        request.durationSeconds <= 0 ||
        !Array.isArray(request.featureIds) ||
        request.featureIds.length > 4 ||
        request.featureIds.some(id => !isFeatureId(id)) ||
        !Array.isArray(request.cursorFeatureIds) ||
        request.cursorFeatureIds.length > 4 ||
        request.cursorFeatureIds.some(id => !isFeatureId(id))
    ) {
        invalid('Analysis request structure is invalid.');
    }
    if (
        new Set(request.featureIds).size !== request.featureIds.length ||
        new Set(request.cursorFeatureIds).size !== request.cursorFeatureIds.length ||
        request.featureIds.some(featureId => !request.cursorFeatureIds.includes(featureId))
    ) {
        invalid('Analysis feature IDs must be unique.');
    }
    const unsupported = request.cursorFeatureIds.find(featureId => !isSupportedFeatureId(featureId));
    if (unsupported) {
        throw new AnalysisWorkerCoreError(
            'unsupported-feature',
            `${unsupported} is registered but not supported by the M10 Worker.`,
            false,
        );
    }
    if (!(await validateAnalysisConfig(request.config))) {
        invalid('Analysis config or config hash is invalid.');
    }
    if (
        request.featureIds.includes('wallpaperEngineSpectrum') &&
        (!request.stereoPcm ||
            request.stereoPcm.length !== 2 ||
            request.stereoPcm.some(
                channel => !(channel instanceof ArrayBuffer) || channel.byteLength !== request.pcm.byteLength,
            ))
    ) {
        invalid('Wallpaper spectrum requires matching stereo PCM.');
    }
    const sampleLength = request.pcm.byteLength / Float32Array.BYTES_PER_ELEMENT;
    const expectedDuration = sampleLength / request.config.sampleRate;
    if (Math.abs(expectedDuration - request.durationSeconds) > 1 / request.config.sampleRate) {
        invalid('PCM length and duration identity do not match.');
    }
};

export { analysisAggregationFactor } from './frames';

export const runAnalysisJob = async (
    request: AnalysisJobRequest,
    hooks: AnalysisWorkerHooks = {},
): Promise<{
    result: AnalysisJobResult;
    retained: RetainedAnalysisPcm;
}> => {
    await validateAnalysisJobRequest(request);
    const featureIds = request.featureIds.filter(isM10FeatureId);
    const pcm = new Float32Array(request.pcm);
    const totalFrames = analysisFrameCount(pcm.length, request.config.frameSize, request.config.hopSize);
    const accumulators = featureIds.map(id => new SeriesAccumulator(id, request.config, totalFrames));
    const now = hooks.now ?? (() => performance.now());
    const yieldControl = hooks.yieldControl ?? yieldAnalysisTask;
    let batchStartedAt = now();
    let batchFrames = 0;
    let previousAmplitudeSpectrum: number[] | undefined;

    let wallpaperSeries: AnalysisSeries | undefined;
    const wallpaperFrames = request.featureIds.includes('wallpaperEngineSpectrum')
        ? Math.ceil((pcm.length / request.config.sampleRate) * 30)
        : 0;
    const meydaFrames = featureIds.length ? totalFrames : 0;
    try {
        if (wallpaperFrames && request.stereoPcm) {
            wallpaperSeries = await analyzeWallpaperSpectrum(
                new Float32Array(request.stereoPcm[0]),
                new Float32Array(request.stereoPcm[1]),
                request.config,
                request.trackHash,
                {
                    ...hooks,
                    yieldControl,
                    onProgress: completed => hooks.onProgress?.(completed, wallpaperFrames + meydaFrames),
                },
            );
        }
        if (featureIds.length === 0) {
            hooks.onProgress?.(wallpaperFrames || totalFrames, wallpaperFrames || totalFrames);
        }
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
            if (featureIds.length === 0) break;
            if (hooks.isCancelled?.()) {
                throw new AnalysisWorkerCoreError('cancelled', 'Analysis job was cancelled.');
            }
            if (featureIds.length > 0) {
                const frame = createAnalysisFrame(pcm, frameIndex, request.config);
                const extraction = extractM10Frame(featureIds, frame, request.config, previousAmplitudeSpectrum);
                for (const accumulator of accumulators) accumulator.push(extraction.values);
                if (extraction.amplitudeSpectrum) {
                    previousAmplitudeSpectrum = extraction.amplitudeSpectrum;
                }
            }
            batchFrames += 1;
            const completed = frameIndex + 1;
            if (completed === totalFrames || batchFrames >= 32 || now() - batchStartedAt >= 8) {
                hooks.onProgress?.(wallpaperFrames + completed, wallpaperFrames + meydaFrames);
                if (completed < totalFrames) {
                    await yieldControl();
                    batchFrames = 0;
                    batchStartedAt = now();
                }
            }
        }
    } catch (error) {
        if (hooks.isCancelled?.()) throw new AnalysisWorkerCoreError('cancelled', 'Analysis job was cancelled.');
        if (error instanceof AnalysisWorkerCoreError) throw error;
        throw new AnalysisWorkerCoreError(
            'extract-failed',
            error instanceof Error ? error.message : 'Meyda extraction failed.',
        );
    }

    const series = accumulators.map(accumulator => accumulator.finish(request.trackHash));
    if (wallpaperSeries) series.unshift(wallpaperSeries);
    return {
        result: {
            kind: 'result',
            jobId: request.jobId,
            generation: request.generation,
            trackHash: request.trackHash,
            configHash: request.config.configHash,
            series,
        },
        retained: {
            generation: request.generation,
            trackHash: request.trackHash,
            config: request.config,
            pcm,
            durationSeconds: request.durationSeconds,
            featureIds: [...request.cursorFeatureIds],
            // Result buffers are transferred. Retain only this small exact sequence, never stereo PCM.
            wallpaperSeries: wallpaperSeries
                ? {
                      ...wallpaperSeries,
                      payload: {
                          kind: 'stereo-spectrum-f32',
                          width: 128,
                          values: new Float32Array(
                              wallpaperSeries.payload.kind === 'stereo-spectrum-f32'
                                  ? wallpaperSeries.payload.values
                                  : [],
                          ),
                      },
                  }
                : undefined,
        },
    };
};

export const extractCursorValue = (
    retained: RetainedAnalysisPcm,
    request: AnalysisCursorValueRequest,
): AnalysisCursorValueResult | null => {
    if (
        request.generation !== retained.generation ||
        request.trackHash !== retained.trackHash ||
        request.config.configHash !== retained.config.configHash ||
        !retained.featureIds.includes(request.featureId) ||
        !isSupportedFeatureId(request.featureId)
    ) {
        return null;
    }
    if (request.featureId === 'wallpaperEngineSpectrum') {
        const series = retained.wallpaperSeries;
        if (!series || series.payload.kind !== 'stereo-spectrum-f32') return null;
        const index = wallpaperFrameIndex(request.timeSeconds, series.sampleCount);
        return {
            kind: 'cursor-value-result',
            requestId: request.requestId,
            generation: request.generation,
            trackHash: request.trackHash,
            configHash: request.config.configHash,
            featureId: request.featureId,
            frameStartSeconds: index / 30,
            value: Array.from(series.payload.values.subarray(index * 128, (index + 1) * 128)),
        };
    }
    const totalFrames = analysisFrameCount(retained.pcm.length, retained.config.frameSize, retained.config.hopSize);
    const frameIndex = cursorFrameIndex(request.timeSeconds, retained.durationSeconds, totalFrames, retained.config);
    const frame = createAnalysisFrame(retained.pcm, frameIndex, retained.config);
    const previousFrame =
        request.featureId === 'spectralFlux' && frameIndex > 0
            ? createAnalysisFrame(retained.pcm, frameIndex - 1, retained.config)
            : undefined;
    return {
        kind: 'cursor-value-result',
        requestId: request.requestId,
        generation: request.generation,
        trackHash: request.trackHash,
        configHash: request.config.configHash,
        featureId: request.featureId,
        frameStartSeconds: frameStartSeconds(frameIndex, retained.config),
        value: exactM10Value(request.featureId, frame, retained.config, previousFrame),
    };
};

export const extractTempoEstimate = (
    retained: RetainedAnalysisPcm,
    request: TempoEstimateRequest,
    hooks: Pick<AnalysisWorkerHooks, 'isCancelled'> = {},
): TempoEstimateResult | null => {
    if (
        request.generation !== retained.generation ||
        request.trackHash !== retained.trackHash ||
        request.configHash !== retained.config.configHash
    ) {
        return null;
    }
    const estimate = estimateTempo(retained.pcm, retained.config, hooks);
    const base = {
        kind: 'tempo-estimate-result' as const,
        requestId: request.requestId,
        generation: request.generation,
        trackHash: request.trackHash,
        configHash: request.configHash,
        confidence: estimate.confidence,
    };
    return estimate.state === 'reliable' && estimate.bpm !== undefined
        ? { ...base, state: 'reliable', bpm: estimate.bpm }
        : { ...base, state: 'low-confidence' };
};

export const responseTransferables = (response: AnalysisWorkerResponse): Transferable[] => {
    if (response.kind !== 'result') return [];
    const transferables: Transferable[] = [];
    for (const series of response.series) {
        switch (series.payload.kind) {
            case 'scalar-f32':
            case 'stereo-spectrum-f32':
            case 'frequency-u16':
            case 'category-u16':
                transferables.push(series.payload.values.buffer);
                break;
            case 'waveform-envelope':
                transferables.push(series.payload.min.buffer, series.payload.max.buffer);
                break;
            case 'loudness':
                transferables.push(series.payload.total.buffer, series.payload.specific.buffer);
                break;
            case 'complex-derived':
                transferables.push(series.payload.magnitude.buffer, series.payload.phase.buffer);
                break;
        }
    }
    return transferables;
};
