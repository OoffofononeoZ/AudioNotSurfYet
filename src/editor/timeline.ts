import {
    canvasXToTime,
    clamp,
    normalizeTimelineViewport,
    resetTimelineViewport,
    timeToCanvasX,
    zoomTimelineViewport,
} from '../analysis/timelineViewport';
import type { PersistedTimelineViewport } from '../types/session';

export {
    canvasXToTime as editorXToTime,
    normalizeTimelineViewport as normalizeEditorViewport,
    resetTimelineViewport as resetEditorViewport,
    timeToCanvasX as editorTimeToX,
};

export const zoomEditorViewportAtX = (
    viewport: PersistedTimelineViewport,
    durationSeconds: number,
    nextZoom: number,
    pointerX: number,
    width: number,
): PersistedTimelineViewport => zoomTimelineViewport(
    viewport,
    durationSeconds,
    nextZoom,
    canvasXToTime(pointerX, viewport, width),
);

export const panEditorViewportByPixels = (
    viewport: PersistedTimelineViewport,
    durationSeconds: number,
    deltaPixels: number,
    width: number,
): PersistedTimelineViewport => {
    const normalized = normalizeTimelineViewport(viewport, durationSeconds);
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
    const normalized = normalizeTimelineViewport(viewport, durationSeconds);
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
    const normalized = normalizeTimelineViewport(viewport, durationSeconds);
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
