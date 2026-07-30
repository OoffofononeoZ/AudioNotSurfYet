import type {
    AnalysisSeries,
    CategoryPayload,
    FrequencyPayload,
} from './types';
import type { PersistedTimelineViewport } from '../types/session';

export interface VisibleSampleRange {
    startIndex: number;
    endIndex: number;
}

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
