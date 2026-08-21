import type {
    AnalysisSeries,
    CategoryPayload,
    FrequencyPayload,
    WaveformPayload,
} from './types';
import type { PersistedTimelineViewport } from '../types/session';

export interface VisibleSampleRange {
    startIndex: number;
    endIndex: number;
}

export interface ScalarPlotDomain {
    min: number;
    max: number;
}

export const scalarPlotDomain = (
    values: ArrayLike<number>,
    range: { min?: number; max?: number; signed?: boolean },
): ScalarPlotDomain => {
    const finite = Array.from(values).filter(Number.isFinite);
    const visibleMin = finite.length > 0 ? Math.min(...finite) : 0;
    const visibleMax = finite.length > 0 ? Math.max(...finite) : 0;
    let min = range.min ?? (range.signed ? Math.min(0, visibleMin) : 0);
    let max = range.max ?? Math.max(range.signed ? 0 : min, visibleMax);
    if (range.signed) {
        min = Math.min(min, 0, visibleMin);
        max = Math.max(max, 0, visibleMax);
    }
    if (max <= min) {
        const padding = Math.max(0.000001, Math.abs(min) * 0.05);
        max = min + padding;
    }
    return { min, max };
};

export const visibleSampleRange = (
    series: AnalysisSeries,
    viewport: PersistedTimelineViewport,
): VisibleSampleRange => {
    if (series.sampleCount <= 0 || series.sampleStepSeconds <= 0) {
        return { startIndex: 0, endIndex: 0 };
    }
    const startIndex = Math.max(
        0,
        Math.floor(viewport.startSeconds / series.sampleStepSeconds),
    );
    const endIndex = Math.min(
        series.sampleCount,
        Math.ceil(viewport.endSeconds / series.sampleStepSeconds) + 1,
    );
    return {
        startIndex: Math.min(startIndex, endIndex),
        endIndex,
    };
};

export const cursorSampleIndex = (
    series: AnalysisSeries,
    cursorSeconds: number,
): number => {
    if (series.sampleCount <= 0 || series.sampleStepSeconds <= 0) return 0;
    return Math.min(
        series.sampleCount - 1,
        Math.max(0, Math.floor(cursorSeconds / series.sampleStepSeconds)),
    );
};

export const decodeQuantizedValue = (
    value: number,
    scale: number,
    offset: number,
): number => value * scale + offset;

export const vectorAt = (
    payload: FrequencyPayload | CategoryPayload,
    sampleIndex: number,
): number[] => {
    const safeIndex = Math.min(
        Math.max(0, sampleIndex),
        Math.max(0, Math.floor(payload.values.length / payload.width) - 1),
    );
    const offset = safeIndex * payload.width;
    return Array.from(
        payload.values.subarray(offset, offset + payload.width),
        (value) => decodeQuantizedValue(
            value,
            payload.scale,
            payload.offset,
        ),
    );
};

export const waveformEnvelopeAt = (
    payload: WaveformPayload,
    sampleIndex: number,
): { min: number; max: number } => {
    const safeIndex = Math.min(
        Math.max(0, sampleIndex),
        Math.max(0, payload.min.length - 1),
    );
    return {
        min: (payload.min[safeIndex] ?? 0) * payload.scale,
        max: (payload.max[safeIndex] ?? 0) * payload.scale,
    };
};

export const signedVectorMaximum = (
    values: ArrayLike<number>,
): number => {
    let maximum = 0;
    for (let index = 0; index < values.length; index += 1) {
        const value = values[index] ?? 0;
        if (!Number.isFinite(value)) {
            throw new RangeError('Signed vector values must be finite.');
        }
        maximum = Math.max(maximum, Math.abs(value));
    }
    return Math.max(maximum, 0.000001);
};

export const peakBin = (
    values: readonly number[],
): { index: number; value: number } => {
    let index = 0;
    let value = Number.NEGATIVE_INFINITY;
    values.forEach((candidate, candidateIndex) => {
        if (candidate > value) {
            index = candidateIndex;
            value = candidate;
        }
    });
    return {
        index,
        value: Number.isFinite(value) ? value : 0,
    };
};
