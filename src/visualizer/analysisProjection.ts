import type { AnalysisSeries } from '../analysis/types';
import { WAVEFORM_FRAME_SIZE } from './waveformSource';
import type {
    VisualizerAnalysisComponent,
    VisualizerAnalysisProjectionV1,
} from './types';

export type VisualizerProjectedValue = number | number[];

const finite = (value: number): number => {
    if (!Number.isFinite(value)) throw new Error('分析数据包含非有限值。');
    return value;
};

const interpolate = (left: number, right: number, ratio: number): number =>
    finite(left + (right - left) * ratio);

const sampleIndexes = (
    series: AnalysisSeries,
    timeSeconds: number,
): { left: number; right: number; ratio: number } => {
    if (series.sampleCount <= 0) throw new Error('分析序列为空。');
    const position = Math.max(0, timeSeconds) / series.sampleStepSeconds;
    const left = Math.min(series.sampleCount - 1, Math.floor(position));
    const right = Math.min(series.sampleCount - 1, left + 1);
    return { left, right, ratio: Math.max(0, Math.min(1, position - left)) };
};

const quantized = (
    value: number,
    scale: number,
    offset: number,
): number => finite(scale === 0 ? offset : offset + value * scale);

const frameVector = (
    series: AnalysisSeries,
    index: number,
    component: VisualizerAnalysisComponent,
): number[] => {
    const payload = series.payload;
    if (payload.kind === 'frequency-u16' || payload.kind === 'category-u16') {
        if (component !== 'default') throw new Error('该特征只支持 default 分量。');
        const offset = index * payload.width;
        return Array.from(
            payload.values.subarray(offset, offset + payload.width),
            (value) => quantized(value, payload.scale, payload.offset),
        );
    }
    if (payload.kind === 'waveform-envelope') {
        if (component !== 'default') throw new Error('Buffer 只支持 default 分量。');
        throw new Error('Buffer 包络不包含完整波形帧。');
    }
    if (payload.kind === 'loudness') {
        if (component !== 'specific') throw new Error('Loudness specific 才是向量。');
        const offset = index * payload.bands;
        return Array.from(
            payload.specific.subarray(offset, offset + payload.bands),
            (value) => quantized(value, payload.scale, payload.offset),
        );
    }
    if (payload.kind === 'complex-derived') {
        if (!['real', 'imag', 'magnitude', 'phase'].includes(component)) {
            throw new Error('Complex Spectrum 需要明确分量。');
        }
        const offset = index * payload.bins;
        const magnitudes = payload.magnitude.subarray(offset, offset + payload.bins);
        const phases = payload.phase.subarray(offset, offset + payload.bins);
        return Array.from(magnitudes, (rawMagnitude, bin) => {
            const magnitude = finite(rawMagnitude * payload.magnitudeScale);
            const phase = finite(((phases[bin] ?? 0) / 32_767) * Math.PI);
            if (component === 'magnitude') return magnitude;
            if (component === 'phase') return phase;
            return component === 'real'
                ? finite(magnitude * Math.cos(phase))
                : finite(magnitude * Math.sin(phase));
        });
    }
    throw new Error('该分析 payload 不是向量。');
};

const sampleRaw = (
    series: AnalysisSeries,
    component: VisualizerAnalysisComponent,
    timeSeconds: number,
    waveform?: readonly number[] | null,
): VisualizerProjectedValue => {
    if (series.featureId === 'buffer') {
        if (component !== 'default') throw new Error('Buffer 只支持 default 分量。');
        if (!waveform || waveform.length !== WAVEFORM_FRAME_SIZE) throw new Error('完整波形帧尚未就绪。');
        return Array.from(waveform, finite);
    }
    const { left, right, ratio } = sampleIndexes(series, timeSeconds);
    if (series.payload.kind === 'scalar-f32') {
        if (component !== 'default') throw new Error('标量只支持 default 分量。');
        return interpolate(
            series.payload.values[left] ?? 0,
            series.payload.values[right] ?? 0,
            ratio,
        );
    }
    if (series.payload.kind === 'loudness' && component === 'total') {
        return interpolate(
            series.payload.total[left] ?? 0,
            series.payload.total[right] ?? 0,
            ratio,
        );
    }
    const leftVector = frameVector(series, left, component);
    const rightVector = frameVector(series, right, component);
    if (leftVector.length !== rightVector.length) {
        throw new Error('分析向量维度发生变化。');
    }
    return leftVector.map((value, index) => {
        const next = rightVector[index] ?? value;
        if (component === 'phase') {
            const delta = Math.atan2(Math.sin(next - value), Math.cos(next - value));
            const phase = value + delta * ratio;
            return finite(Math.atan2(Math.sin(phase), Math.cos(phase)));
        }
        return interpolate(value, next, ratio);
    });
};

export const projectAnalysisSeries = (
    series: AnalysisSeries,
    component: VisualizerAnalysisComponent,
    projection: VisualizerAnalysisProjectionV1,
    timeSeconds: number,
    waveform?: readonly number[] | null,
): VisualizerProjectedValue => {
    const raw = sampleRaw(series, component, timeSeconds, waveform);
    if (typeof raw === 'number') {
        if (projection.kind !== 'scalar') throw new Error('标量 projection 不匹配。');
        return raw;
    }
    if (projection.kind === 'full') return raw;
    if (raw.length === 0) throw new Error('分析向量为空。');
    if (projection.kind === 'bin') {
        const value = raw[projection.index];
        if (value === undefined) throw new Error('分析 bin 超出向量范围。');
        return finite(value);
    }
    const values = projection.kind === 'band'
        ? raw.slice(projection.start, projection.end)
        : raw;
    if (values.length === 0) throw new Error('分析 band 为空。');
    if (projection.kind === 'mean' || projection.kind === 'band') {
        return finite(values.reduce((sum, value) => sum + value, 0) / values.length);
    }
    if (projection.kind === 'max') return finite(Math.max(...values));
    if (projection.kind === 'peak') {
        let peakIndex = 0;
        for (let index = 1; index < values.length; index += 1) {
            if ((values[index] ?? -Infinity) > (values[peakIndex] ?? -Infinity)) {
                peakIndex = index;
            }
        }
        return peakIndex / Math.max(1, values.length - 1);
    }
    throw new Error('分析 projection 不受支持。');
};
