import type { AnalysisSeries } from './types';
import type { PersistedTimelineViewport } from '../types/session';
import { visibleSampleRange } from './rendererData';

export const sampleTime = (series: AnalysisSeries, index: number): number =>
    series.startTimeSeconds + index * series.sampleStepSeconds;

/** Do not clamp time: clipping must preserve the scale and song padding. */
export const plotTimeX = (time: number, viewport: PersistedTimelineViewport, width: number): number =>
    ((time - viewport.startSeconds) / (viewport.endSeconds - viewport.startSeconds)) * width;

export interface PlotColumn {
    startIndex: number;
    endIndex: number;
    left: number;
    right: number;
}

/** Group adjacent samples only when they are narrower than one display pixel. */
export function plotColumns(
    series: AnalysisSeries,
    viewport: PersistedTimelineViewport,
    width: number,
    dpr = 1,
    durationSeconds = Infinity,
): PlotColumn[] {
    if (width <= 0 || viewport.endSeconds <= viewport.startSeconds) return [];
    const range = visibleSampleRange(series, viewport);
    const stride = Math.max(1, Math.floor((range.endIndex - range.startIndex) / Math.max(1, width * dpr)));
    const columns: PlotColumn[] = [];
    for (let startIndex = range.startIndex; startIndex < range.endIndex; startIndex += stride) {
        const endIndex = Math.min(range.endIndex, startIndex + stride);
        const start = Math.max(0, viewport.startSeconds, sampleTime(series, startIndex));
        const end = Math.min(durationSeconds, viewport.endSeconds, sampleTime(series, endIndex));
        if (end <= start) continue;
        columns.push({
            startIndex,
            endIndex,
            left: plotTimeX(start, viewport, width),
            right: plotTimeX(end, viewport, width),
        });
    }
    return columns;
}
