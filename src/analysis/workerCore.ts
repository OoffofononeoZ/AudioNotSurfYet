import {
    aggregateScalars,
    aggregateVectors,
    quantizeToUint16,
} from './compactCodec';
import { validateAnalysisConfig } from './config';
import {
    analysisFrameCount,
    createAnalysisFrame,
    cursorFrameIndex,
    frameStartSeconds,
} from './frames';
import { getFeatureDefinition } from './featureRegistry';
import {
    exactValueFromMeyda,
    extractM6Features,
    scalarMeydaValue,
    vectorMeydaValue,
} from './meydaAdapter';
import {
    isFeatureId,
    isM6SupportedFeatureId,
    type AnalysisCursorValueRequest,
    type AnalysisCursorValueResult,
    type AnalysisJobRequest,
    type AnalysisJobResult,
    type AnalysisSeries,
    type AnalysisWorkerResponse,
    type FeatureId,
    type M6SupportedFeatureId,
} from './types';

export class AnalysisWorkerCoreError extends Error {
    readonly code:
        | 'invalid-request'
        | 'unsupported-feature'
        | 'extract-failed'
        | 'cancelled';
    readonly recoverable: boolean;

    constructor(
        code:
            | 'invalid-request'
            | 'unsupported-feature'
            | 'extract-failed'
            | 'cancelled',
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
    onProgress?: (
        completedFrames: number,
        totalFrames: number,
    ) => void;
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
}

const invalid = (message: string): never => {
    throw new AnalysisWorkerCoreError(
        'invalid-request',
        message,
        false,
    );
};

export const validateAnalysisJobRequest = async (
    request: AnalysisJobRequest,
): Promise<void> => {
    if (
        request.kind !== 'analyze'
        || typeof request.jobId !== 'string'
        || request.jobId.length === 0
        || !Number.isInteger(request.generation)
        || request.generation < 0
        || typeof request.trackHash !== 'string'
        || request.trackHash.length === 0
        || !(request.pcm instanceof ArrayBuffer)
        || request.pcm.byteLength === 0
        || request.pcm.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0
        || !Number.isFinite(request.durationSeconds)
        || request.durationSeconds <= 0
        || !Array.isArray(request.featureIds)
        || request.featureIds.length > 4
        || request.featureIds.some((id) => !isFeatureId(id))
        || !Array.isArray(request.cursorFeatureIds)
        || request.cursorFeatureIds.length > 4
        || request.cursorFeatureIds.some((id) => !isFeatureId(id))
    ) {
        invalid('Analysis request structure is invalid.');
    }
    if (
        new Set(request.featureIds).size !== request.featureIds.length
        || new Set(request.cursorFeatureIds).size
            !== request.cursorFeatureIds.length
        || request.featureIds.some((featureId) =>
            !request.cursorFeatureIds.includes(featureId))
    ) {
        invalid('Analysis feature IDs must be unique.');
    }
    const unsupported = request.cursorFeatureIds.find((featureId) =>
        !isM6SupportedFeatureId(featureId));
    if (unsupported) {
        throw new AnalysisWorkerCoreError(
            'unsupported-feature',
            `${unsupported} is registered but not supported by the M6 Worker.`,
            false,
        );
    }
    if (!await validateAnalysisConfig(request.config)) {
        invalid('Analysis config or config hash is invalid.');
    }
    const sampleLength =
        request.pcm.byteLength / Float32Array.BYTES_PER_ELEMENT;
    const expectedDuration = sampleLength / request.config.sampleRate;
    if (
        Math.abs(expectedDuration - request.durationSeconds)
        > 1 / request.config.sampleRate
    ) {
        invalid('PCM length and duration identity do not match.');
    }
};

export const analysisAggregationFactor = (
    sampleRate: number,
    hopSize: number,
): number => Math.max(1, Math.ceil(sampleRate / (hopSize * 30)));

const buildSeries = (
    request: AnalysisJobRequest,
    featureIds: readonly M6SupportedFeatureId[],
    scalarFrames: Map<FeatureId, number[]>,
    vectorFrames: Map<FeatureId, number[][]>,
): AnalysisSeries[] => {
    const factor = analysisAggregationFactor(
        request.config.sampleRate,
        request.config.hopSize,
    );
    const sampleStepSeconds =
        factor * request.config.hopSize / request.config.sampleRate;
    return featureIds.map((featureId) => {
        const definition = getFeatureDefinition(featureId);
        const dimensions = definition.dimensions(request.config);
        if (featureId === 'rms' || featureId === 'energy') {
            const values = aggregateScalars(
                scalarFrames.get(featureId) ?? [],
                factor,
            );
            return {
                schemaVersion: 1,
                trackHash: request.trackHash,
                configHash: request.config.configHash,
                featureId,
                startTimeSeconds: 0,
                sampleStepSeconds,
                sampleCount: values.length,
                dimensions,
                payload: {
                    kind: 'scalar-f32',
                    values,
                },
            };
        }
        const width = dimensions[0] ?? 0;
        const values = aggregateVectors(
            vectorFrames.get(featureId) ?? [],
            factor,
            width,
        );
        const quantized = quantizeToUint16(values);
        return {
            schemaVersion: 1,
            trackHash: request.trackHash,
            configHash: request.config.configHash,
            featureId,
            startTimeSeconds: 0,
            sampleStepSeconds,
            sampleCount: values.length / width,
            dimensions,
            payload: {
                kind: featureId === 'chroma'
                    ? 'category-u16'
                    : 'frequency-u16',
                values: quantized.values,
                width,
                scale: quantized.scale,
                offset: quantized.offset,
            },
        };
    });
};

export const runAnalysisJob = async (
    request: AnalysisJobRequest,
    hooks: AnalysisWorkerHooks = {},
): Promise<{
    result: AnalysisJobResult;
    retained: RetainedAnalysisPcm;
}> => {
    await validateAnalysisJobRequest(request);
    const featureIds =
        request.featureIds as readonly M6SupportedFeatureId[];
    const pcm = new Float32Array(request.pcm);
    const totalFrames = analysisFrameCount(
        pcm.length,
        request.config.frameSize,
        request.config.hopSize,
    );
    const scalarFrames = new Map<FeatureId, number[]>();
    const vectorFrames = new Map<FeatureId, number[][]>();
    for (const featureId of featureIds) {
        if (featureId === 'rms' || featureId === 'energy') {
            scalarFrames.set(featureId, []);
        } else {
            vectorFrames.set(featureId, []);
        }
    }
    const now = hooks.now ?? (() => performance.now());
    const yieldControl = hooks.yieldControl
        ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    let batchStartedAt = now();
    let batchFrames = 0;

    try {
        if (featureIds.length === 0) {
            hooks.onProgress?.(totalFrames, totalFrames);
        }
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
            if (featureIds.length === 0) break;
            if (hooks.isCancelled?.()) {
                throw new AnalysisWorkerCoreError(
                    'cancelled',
                    'Analysis job was cancelled.',
                );
            }
            if (featureIds.length > 0) {
                const frame = createAnalysisFrame(
                    pcm,
                    frameIndex,
                    request.config,
                );
                const extracted = extractM6Features(
                    featureIds,
                    frame,
                    request.config,
                );
                for (const featureId of featureIds) {
                    if (featureId === 'rms' || featureId === 'energy') {
                        scalarFrames.get(featureId)?.push(
                            scalarMeydaValue(extracted, featureId),
                        );
                    } else {
                        const width =
                            getFeatureDefinition(featureId)
                                .dimensions(request.config)[0] ?? 0;
                        vectorFrames.get(featureId)?.push(
                            vectorMeydaValue(
                                extracted,
                                featureId,
                                width,
                            ),
                        );
                    }
                }
            }
            batchFrames += 1;
            const completed = frameIndex + 1;
            if (
                completed === totalFrames
                || batchFrames >= 32
                || now() - batchStartedAt >= 8
            ) {
                hooks.onProgress?.(completed, totalFrames);
                if (completed < totalFrames) {
                    await yieldControl();
                    batchFrames = 0;
                    batchStartedAt = now();
                }
            }
        }
    } catch (error) {
        if (error instanceof AnalysisWorkerCoreError) throw error;
        throw new AnalysisWorkerCoreError(
            'extract-failed',
            error instanceof Error
                ? error.message
                : 'Meyda extraction failed.',
        );
    }

    const series = buildSeries(
        request,
        featureIds,
        scalarFrames,
        vectorFrames,
    );
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
        },
    };
};

export const extractCursorValue = (
    retained: RetainedAnalysisPcm,
    request: AnalysisCursorValueRequest,
): AnalysisCursorValueResult | null => {
    if (
        request.generation !== retained.generation
        || request.trackHash !== retained.trackHash
        || request.config.configHash !== retained.config.configHash
        || !retained.featureIds.includes(request.featureId)
        || !isM6SupportedFeatureId(request.featureId)
    ) {
        return null;
    }
    const totalFrames = analysisFrameCount(
        retained.pcm.length,
        retained.config.frameSize,
        retained.config.hopSize,
    );
    const frameIndex = cursorFrameIndex(
        request.timeSeconds,
        retained.durationSeconds,
        totalFrames,
        retained.config,
    );
    const frame = createAnalysisFrame(
        retained.pcm,
        frameIndex,
        retained.config,
    );
    return {
        kind: 'cursor-value-result',
        requestId: request.requestId,
        generation: request.generation,
        trackHash: request.trackHash,
        configHash: request.config.configHash,
        featureId: request.featureId,
        frameStartSeconds: frameStartSeconds(
            frameIndex,
            retained.config,
        ),
        value: exactValueFromMeyda(
            request.featureId,
            frame,
            retained.config,
        ),
    };
};

export const responseTransferables = (
    response: AnalysisWorkerResponse,
): Transferable[] => {
    if (response.kind !== 'result') return [];
    const transferables: Transferable[] = [];
    for (const series of response.series) {
        switch (series.payload.kind) {
            case 'scalar-f32':
            case 'frequency-u16':
            case 'category-u16':
                transferables.push(series.payload.values.buffer);
                break;
            case 'waveform-envelope':
                transferables.push(
                    series.payload.min.buffer,
                    series.payload.max.buffer,
                );
                break;
            case 'loudness':
                transferables.push(
                    series.payload.total.buffer,
                    series.payload.specific.buffer,
                );
                break;
            case 'complex-derived':
                transferables.push(
                    series.payload.magnitude.buffer,
                    series.payload.phase.buffer,
                );
                break;
        }
    }
    return transferables;
};
