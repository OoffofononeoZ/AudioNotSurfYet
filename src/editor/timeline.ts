import {
    canvasXToTime,
    clamp,
    timeToCanvasX,
} from '../analysis/timelineViewport';
import type { PersistedTimelineViewport } from '../types/session';
import { segmentAtTime } from './tempoMap';
import type { TempoSegmentV1 } from './types';

export const EDITOR_WAVEFORM_VERTICAL_PADDING_PX = 6;

export interface EditorWaveformVerticalGeometry {
    centerY: number;
    amplitude: number;
    padding: number;
}

export const editorWaveformVerticalGeometry = (
    height: number,
): EditorWaveformVerticalGeometry => {
    const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
    return {
        centerY: safeHeight / 2,
        amplitude: Math.max(
            0,
            (safeHeight - EDITOR_WAVEFORM_VERTICAL_PADDING_PX * 2) / 2,
        ),
        padding: EDITOR_WAVEFORM_VERTICAL_PADDING_PX,
    };
};

export {
    canvasXToTime as editorXToTime,
    timeToCanvasX as editorTimeToX,
};

/** Editor uses musical window bounds; Analyzer retains its independent 1–64 range. */
export function normalizeEditorViewport(viewport: PersistedTimelineViewport | null, durationSeconds: number): PersistedTimelineViewport {
    const duration = Math.max(0, Number.isFinite(durationSeconds) ? durationSeconds : 0);
    if (!duration) return { startSeconds: 0, endSeconds: 1, zoom: 1 };
    const zoom = Math.max(1, Number.isFinite(viewport?.zoom) ? viewport!.zoom : 1);
    const span = clamp(duration / zoom, Math.min(duration, 1e-6), duration);
    const startSeconds = clamp(Number.isFinite(viewport?.startSeconds) ? viewport!.startSeconds : 0, 0, duration - span);
    return { startSeconds, endSeconds: startSeconds + span, zoom: duration / span };
}

export function editorMeasureSeconds(map: readonly TempoSegmentV1[], time: number): number | null {
    if (!map.length) return null;
    const segment = segmentAtTime(map, time);
    return segment.mode === 'metered' && segment.bpm !== null ? 60 / segment.bpm * segment.meter.numerator : null;
}

export function editorViewportForMeasures(duration: number, map: readonly TempoSegmentV1[], measures: number, anchor: number): PersistedTimelineViewport {
    if (duration <= 0) return normalizeEditorViewport(null, duration);
    const measure = editorMeasureSeconds(map, anchor);
    const span = Math.min(duration, measure === null ? 10 : measure * measures);
    const segment = map.length ? segmentAtTime(map, anchor) : null;
    const start = measure !== null && segment ? segment.startSeconds + Math.floor(Math.max(0, anchor - segment.startSeconds) / measure) * measure : anchor;
    const startSeconds = clamp(start, 0, duration - span);
    return { startSeconds, endSeconds: startSeconds + span, zoom: duration / span };
}

export const resetEditorViewport = (duration: number, map: readonly TempoSegmentV1[] = [], anchor = 0) => editorViewportForMeasures(duration, map, 4, anchor);

export function constrainEditorViewport(viewport: PersistedTimelineViewport, duration: number, map: readonly TempoSegmentV1[]): PersistedTimelineViewport {
    const normalized = normalizeEditorViewport(viewport, duration);
    const center = (normalized.startSeconds + normalized.endSeconds) / 2;
    const minimum = Math.min(duration, editorMeasureSeconds(map, center) ?? 1);
    if (normalized.endSeconds - normalized.startSeconds >= minimum - 1e-9) return normalized;
    const startSeconds = clamp(center - minimum / 2, 0, duration - minimum);
    return { startSeconds, endSeconds: startSeconds + minimum, zoom: duration / minimum };
}

export const zoomEditorViewportAtX = (
    viewport: PersistedTimelineViewport,
    durationSeconds: number,
    nextZoom: number,
    pointerX: number,
    width: number,
    minimumSpan = 1,
): PersistedTimelineViewport => {
    const current = normalizeEditorViewport(viewport, durationSeconds);
    if (durationSeconds <= 0) return current;
    const span = clamp(durationSeconds / Math.max(1, nextZoom), Math.min(durationSeconds, minimumSpan), durationSeconds);
    const ratio = width > 0 ? clamp(pointerX / width, 0, 1) : .5;
    const anchor = canvasXToTime(pointerX, current, width);
    const startSeconds = clamp(anchor - span * ratio, 0, durationSeconds - span);
    return { startSeconds, endSeconds: startSeconds + span, zoom: durationSeconds / span };
};

export const panEditorViewportByPixels = (
    viewport: PersistedTimelineViewport,
    durationSeconds: number,
    deltaPixels: number,
    width: number,
): PersistedTimelineViewport => {
    const normalized = normalizeEditorViewport(viewport, durationSeconds);
    if (!Number.isFinite(deltaPixels) || width <= 0 || durationSeconds <= 0) {
        return normalized;
    }
    const span = normalized.endSeconds - normalized.startSeconds;
    const shift = -deltaPixels / width * span;
    const startSeconds = clamp(
        normalized.startSeconds + shift,
        0,
        Math.max(0, durationSeconds - span),
    );
    return {
        ...normalized,
        startSeconds,
        endSeconds: startSeconds + span,
    };
};
export const panEditorViewportByRatio = (
    viewport: PersistedTimelineViewport,
    durationSeconds: number,
    ratio: number,
): PersistedTimelineViewport => {
    const normalized = normalizeEditorViewport(viewport, durationSeconds);
    const span = normalized.endSeconds - normalized.startSeconds;
    const startSeconds = clamp(
        normalized.startSeconds + span * ratio,
        0,
        Math.max(0, durationSeconds - span),
    );
    return {
        ...normalized,
        startSeconds,
        endSeconds: startSeconds + span,
    };
};

export const centerEditorViewport = (
    viewport: PersistedTimelineViewport,
    durationSeconds: number,
    centerSeconds: number,
): PersistedTimelineViewport => {
    const normalized = normalizeEditorViewport(viewport, durationSeconds);
    const span = normalized.endSeconds - normalized.startSeconds;
    const startSeconds = clamp(
        centerSeconds - span / 2,
        0,
        Math.max(0, durationSeconds - span),
    );
    return {
        ...normalized,
        startSeconds,
        endSeconds: startSeconds + span,
    };
};
