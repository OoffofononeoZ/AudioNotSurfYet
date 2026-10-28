import { yieldAnalysisTask as yieldTask } from './taskScheduler';
import { analysisAggregationFactor, analysisFrameCount, cursorFrameIndex } from './frames';
import { exactM10Value } from './meydaAdapter';
import { aggregateScalars, aggregateVectors, quantizeToUint16 } from './compactCodec';
import { WallpaperBlockTransform, WallpaperSmoothing, wallpaperFrameIndex } from './wallpaperSpectrum';
import { StemPcmReader } from './stemPcmReader';
import { isStemFeature } from './sources';
import type { StemPcmSource } from './stemProtocol';
import type { AnalysisSeries, FeatureId, AnalysisCursorValueResult } from './types';
import type { AnalysisWindowInput, AnalysisWindowSeries } from './windowTypes';

function base(
    source: StemPcmSource,
    featureId: FeatureId,
    step: number,
    count: number,
): Omit<AnalysisSeries, 'payload'> {
    return {
        schemaVersion: 1,
        trackHash: source.trackHash,
        configHash: source.config.configHash,
        featureId,
        startTimeSeconds: 0,
        sampleStepSeconds: step,
        sampleCount: count,
        dimensions:
            featureId === 'energy'
                ? []
                : [featureId === 'buffer' ? 1024 : featureId === 'wallpaperEngineSpectrum' ? 128 : 512],
    };
}
function waveform(minimum: Float32Array, maximum: Float32Array) {
    let peak = 0;
    for (let i = 0; i < minimum.length; i++) peak = Math.max(peak, Math.abs(minimum[i]!), Math.abs(maximum[i]!));
    const scale = peak / 32767,
        min = new Int16Array(minimum.length),
        max = new Int16Array(maximum.length);
    if (scale)
        for (let i = 0; i < min.length; i++) {
            min[i] = Math.round(minimum[i]! / scale);
            max[i] = Math.round(maximum[i]! / scale);
        }
    return { kind: 'waveform-envelope' as const, min, max, scale };
}
async function meydaSeries(
    reader: StemPcmReader,
    ids: readonly FeatureId[],
    first: number,
    last: number,
    factor: number,
): Promise<AnalysisSeries[]> {
    const { source } = reader,
        { sampleRate, hopSize, frameSize } = source.config,
        count = Math.ceil((last - first) / factor);
    const energy = ids.includes('energy') ? new Float32Array(count) : null;
    const amplitude = ids.includes('amplitudeSpectrum') ? new Float32Array(count * 512) : null;
    const minimum = new Float32Array(count),
        maximum = new Float32Array(count);
    for (let bucket = 0; bucket < count; bucket++) {
        reader.check();
        const scalars: number[] = [],
            vectors: number[][] = [];
        let low = Infinity,
            high = -Infinity;
        for (let index = first + bucket * factor; index < Math.min(last, first + (bucket + 1) * factor); index++) {
            const frame = await reader.mono(index * hopSize, frameSize);
            if (energy) scalars.push(exactM10Value('energy', frame, source.config) as number);
            if (amplitude) vectors.push(exactM10Value('amplitudeSpectrum', frame, source.config) as number[]);
            if (ids.includes('buffer'))
                for (const value of exactM10Value('buffer', frame, source.config) as number[]) {
                    low = Math.min(low, value);
                    high = Math.max(high, value);
                }
        }
        if (energy) energy[bucket] = aggregateScalars(scalars, factor)[0]!;
        if (amplitude) amplitude.set(aggregateVectors(vectors, factor, 512), bucket * 512);
        minimum[bucket] = Number.isFinite(low) ? low : 0;
        maximum[bucket] = Number.isFinite(high) ? high : 0;
        if (bucket % 8 === 7) await yieldTask();
    }
    reader.check();
    const step = (factor * hopSize) / sampleRate,
        result: AnalysisSeries[] = [];
    if (energy)
        result.push({ ...base(source, 'energy', step, count), payload: { kind: 'scalar-f32', values: energy } });
    if (amplitude)
        result.push({
            ...base(source, 'amplitudeSpectrum', step, count),
            payload: { kind: 'frequency-u16', width: 512, ...quantizeToUint16(amplitude) },
        });
    if (ids.includes('buffer'))
        result.push({ ...base(source, 'buffer', step, count), payload: waveform(minimum, maximum) });
    return result;
}
export async function runStemAnalysis(
    source: StemPcmSource,
    ids: readonly FeatureId[],
    cancelled: () => boolean,
    progress: (value: number) => void = () => {},
): Promise<AnalysisSeries[]> {
    if (
        ids.length > 4 ||
        ids.some(id => !isStemFeature(id)) ||
        source.frames <= 0 ||
        source.config.sampleRate !== 44100 ||
        source.left.size !== source.frames * 4 ||
        source.right.size !== source.frames * 4
    )
        throw Error('分轨分析输入无效。');
    const reader = new StemPcmReader(source, cancelled),
        result: AnalysisSeries[] = [];
    if (ids.includes('wallpaperEngineSpectrum')) {
        const transform = new WallpaperBlockTransform(source.config.sampleRate),
            smoothing = new WallpaperSmoothing();
        const count = Math.ceil((source.frames / source.config.sampleRate) * 30),
            values = new Float32Array(count * 128);
        let completed = 0,
            raw: Float32Array = new Float32Array(128),
            batchStart = performance.now();
        for (let frame = 0; frame < count; frame++) {
            reader.check();
            const available = Math.floor((frame * source.config.sampleRate) / 30);
            while (completed + transform.pcmLength <= available) {
                const [left, right] = await reader.stereo(completed, transform.pcmLength);
                raw = transform.extract(left, right, 0);
                completed += transform.pcmLength;
            }
            values.set(smoothing.advance(raw), frame * 128);
            if (frame % 32 === 31 || performance.now() - batchStart >= 8) {
                progress(((frame + 1) / count) * (ids.length > 1 ? 0.5 : 1));
                await yieldTask();
                batchStart = performance.now();
            }
        }
        result.push({
            ...base(source, 'wallpaperEngineSpectrum', 1 / 30, count),
            payload: { kind: 'stereo-spectrum-f32', width: 128, values },
        });
    }
    const meyda = ids.filter(id => id !== 'wallpaperEngineSpectrum');
    if (meyda.length)
        result.push(
            ...(await meydaSeries(
                reader,
                meyda,
                0,
                analysisFrameCount(source.frames),
                analysisAggregationFactor(source.config.sampleRate, 512),
            )),
        );
    reader.check();
    progress(1);
    return result;
}
export async function readStemCursor(
    source: StemPcmSource,
    featureId: FeatureId,
    time: number,
    epoch: number,
    requestId: string,
    cancelled: () => boolean,
    wallpaper?: AnalysisSeries,
): Promise<AnalysisCursorValueResult | null> {
    if (!isStemFeature(featureId) || !Number.isFinite(time)) return null;
    const index =
        featureId === 'wallpaperEngineSpectrum'
            ? wallpaperFrameIndex(time, wallpaper?.sampleCount ?? 0)
            : cursorFrameIndex(time, source.frames / 44100, analysisFrameCount(source.frames), source.config);
    let value;
    if (featureId === 'wallpaperEngineSpectrum') {
        if (wallpaper?.payload.kind !== 'stereo-spectrum-f32') return null;
        value = Array.from(wallpaper.payload.values.subarray(index * 128, (index + 1) * 128));
    } else
        value = exactM10Value(
            featureId,
            await new StemPcmReader(source, cancelled).mono(index * 512, 1024),
            source.config,
        );
    return {
        kind: 'cursor-value-result',
        requestId,
        generation: epoch,
        trackHash: source.trackHash,
        configHash: source.config.configHash,
        featureId,
        frameStartSeconds: index * (featureId === 'wallpaperEngineSpectrum' ? 1 / 30 : 512 / 44100),
        value,
    };
}
export async function readStemWindow(
    source: StemPcmSource,
    input: AnalysisWindowInput,
    cancelled: () => boolean,
): Promise<AnalysisWindowSeries | null> {
    if (
        !isStemFeature(input.featureId) ||
        input.featureId === 'wallpaperEngineSpectrum' ||
        !Number.isFinite(input.startSeconds) ||
        !Number.isFinite(input.endSeconds) ||
        input.endSeconds <= input.startSeconds ||
        !Number.isSafeInteger(input.waveformBucketSamples) ||
        input.waveformBucketSamples < 1
    )
        return null;
    const reader = new StemPcmReader(source, cancelled),
        start = Math.max(0, input.startSeconds),
        end = Math.min(source.frames / 44100, input.endSeconds);
    if (end <= start) return null;
    if (input.featureId === 'buffer') {
        const size = input.waveformBucketSamples,
            first = Math.floor((start * 44100) / size),
            last = Math.ceil((end * 44100) / size),
            min = new Float32Array(last - first),
            max = new Float32Array(last - first);
        for (let i = first; i < last; i++) {
            let low = Infinity,
                high = -Infinity;
            // Read large pixel buckets in bounded pieces as well.
            for (let at = i * size; at < Math.min(source.frames, (i + 1) * size); at += 65536)
                for (const v of await reader.mono(at, Math.min(65536, source.frames - at, (i + 1) * size - at))) {
                    low = Math.min(low, v);
                    high = Math.max(high, v);
                }
            min[i - first] = low;
            max[i - first] = high;
            if (i % 32 === 31) await yieldTask();
        }
        return {
            ...base(source, 'buffer', size / 44100, last - first),
            startTimeSeconds: (first * size) / 44100,
            endTimeSeconds: Math.min(source.frames, last * size) / 44100,
            payload: waveform(min, max),
        };
    }
    const total = analysisFrameCount(source.frames),
        first = Math.min(total - 1, Math.floor((start * 44100) / 512)),
        last = Math.min(total, Math.ceil((end * 44100) / 512) + 1);
    const series = (await meydaSeries(reader, [input.featureId], first, last, 1))[0]!;
    return {
        ...series,
        startTimeSeconds: (first * 512) / 44100,
        endTimeSeconds: last === total ? source.frames / 44100 : (last * 512) / 44100,
    };
}
