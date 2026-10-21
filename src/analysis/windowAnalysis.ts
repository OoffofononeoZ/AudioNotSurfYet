import { analysisFrameCount, createAnalysisFrame, frameStartSeconds } from './frames';
import { exactM10Value } from './meydaAdapter';
import { buildSeries } from './seriesBuilder';
import { isM10FeatureId, type FeatureId } from './types';
import type { RetainedAnalysisPcm, AnalysisWorkerHooks } from './workerCore';
import type { AnalysisWindowRequest, AnalysisWindowSeries } from './windowTypes';

/** Reads the existing worker PCM; only bounded output and frame data are allocated. */
export async function extractWindowSeries(
    retained: RetainedAnalysisPcm,
    request: AnalysisWindowRequest,
    hooks: AnalysisWorkerHooks = {},
): Promise<AnalysisWindowSeries | null> {
    if (
        request.generation !== retained.generation ||
        request.trackHash !== retained.trackHash ||
        request.configHash !== retained.config.configHash ||
        !retained.featureIds.includes(request.featureId) ||
        !isM10FeatureId(request.featureId) ||
        !Number.isFinite(request.startSeconds) ||
        !Number.isFinite(request.endSeconds) ||
        request.endSeconds <= request.startSeconds ||
        !Number.isSafeInteger(request.waveformBucketSamples) ||
        request.waveformBucketSamples < 1
    )
        return null;
    const start = Math.max(0, request.startSeconds),
        end = Math.min(retained.durationSeconds, request.endSeconds);
    if (end <= start || hooks.isCancelled?.()) return null;
    const { sampleRate, hopSize } = retained.config;
    const now = hooks.now ?? (() => performance.now());
    const yieldControl = hooks.yieldControl ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
    let batchStart = now();
    async function checkpoint(index: number) {
        if (index % 32 === 31 || now() - batchStart >= 8) {
            await yieldControl();
            batchStart = now();
        }
        return !!hooks.isCancelled?.();
    }
    if (request.featureId === 'buffer') {
        const bucket = request.waveformBucketSamples;
        const first = Math.floor((start * sampleRate) / bucket);
        const last = Math.ceil((end * sampleRate) / bucket);
        const mins = new Int16Array(last - first),
            maxs = new Int16Array(last - first);
        // AudioBuffer samples are normally [-1,1], but preserve finite overshoot too.
        const minimums = new Float32Array(mins.length),
            maximums = new Float32Array(mins.length);
        let maximumAbsolute = 0;
        for (let bin = first; bin < last; bin++) {
            let min = Infinity,
                max = -Infinity;
            const from = bin * bucket,
                to = Math.min(retained.pcm.length, (bin + 1) * bucket);
            for (let i = from; i < to; i++) {
                const value = retained.pcm[i]!;
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
            minimums[bin - first] = min;
            maximums[bin - first] = max;
            maximumAbsolute = Math.max(maximumAbsolute, Math.abs(min), Math.abs(max));
            if (await checkpoint(bin - first)) return null;
        }
        const scale = maximumAbsolute / 32767;
        if (scale > 0)
            for (let i = 0; i < mins.length; i++) {
                mins[i] = Math.round(minimums[i]! / scale);
                maxs[i] = Math.round(maximums[i]! / scale);
            }
        return {
            schemaVersion: 1,
            trackHash: request.trackHash,
            configHash: request.configHash,
            featureId: 'buffer',
            startTimeSeconds: (first * bucket) / sampleRate,
            endTimeSeconds: Math.min(retained.durationSeconds, (last * bucket) / sampleRate),
            sampleStepSeconds: bucket / sampleRate,
            sampleCount: mins.length,
            dimensions: [1024],
            payload: { kind: 'waveform-envelope', min: mins, max: maxs, scale },
        };
    }
    const total = analysisFrameCount(retained.pcm.length, retained.config.frameSize, hopSize);
    const first = Math.min(total - 1, Math.floor((start * sampleRate) / hopSize));
    const last = Math.min(total, Math.ceil((end * sampleRate) / hopSize) + 1);
    const scalars = new Map<FeatureId, number[]>([[request.featureId, []]]);
    const vectors = new Map<FeatureId, number[][]>([[request.featureId, []]]);
    const loudness: Array<{ total: number; specific: number[] }> = [];
    const complex: Array<{ real: number[]; imag: number[] }> = [];
    for (let index = first; index < last; index++) {
        const frame = createAnalysisFrame(retained.pcm, index, retained.config);
        const previous =
            request.featureId === 'spectralFlux' && index > 0
                ? createAnalysisFrame(retained.pcm, index - 1, retained.config)
                : undefined;
        const value = exactM10Value(request.featureId, frame, retained.config, previous);
        if (typeof value === 'number') scalars.get(request.featureId)!.push(value);
        else if (Array.isArray(value)) vectors.get(request.featureId)!.push(value);
        else if ('specific' in value) loudness.push(value);
        else complex.push(value);
        if (await checkpoint(index - first)) return null;
    }
    const series = buildSeries(
        { trackHash: request.trackHash, config: retained.config },
        [request.featureId],
        scalars,
        vectors,
        loudness,
        complex,
        1,
    )[0]!;
    return {
        ...series,
        startTimeSeconds: frameStartSeconds(first, retained.config),
        endTimeSeconds: last === total ? retained.durationSeconds : frameStartSeconds(last, retained.config),
    };
}
