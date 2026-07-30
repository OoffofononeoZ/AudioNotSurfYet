import type {
    PersistedTimelineViewport,
    TimelineViewport,
} from '../types/session';

export const MIN_TIMELINE_ZOOM = 1;
export const MAX_TIMELINE_ZOOM = 64;

const finiteOr = (value: number, fallback: number): number =>
    Number.isFinite(value) ? value : fallback;

export const clamp = (
    value: number,
    minimum: number,
    maximum: number,
): number => Math.min(maximum, Math.max(minimum, value));

export const normalizeDuration = (durationSeconds: number): number =>
    Math.max(0, finiteOr(durationSeconds, 0));

export const resetTimelineViewport = (
    durationSeconds: number,
): PersistedTimelineViewport => {
    const duration = normalizeDuration(durationSeconds);
    return {
        startSeconds: 0,
        endSeconds: Math.max(duration, 1),
        zoom: 1,
    };
};

export const normalizeTimelineViewport = (
    viewport: PersistedTimelineViewport | null,
    durationSeconds: number,
): PersistedTimelineViewport => {
    const duration = normalizeDuration(durationSeconds);
    if (duration <= 0 || !viewport) {
        return resetTimelineViewport(duration);
    }
    const zoom = clamp(
        finiteOr(viewport.zoom, 1),
        MIN_TIMELINE_ZOOM,
        MAX_TIMELINE_ZOOM,
    );
    const span = clamp(
        duration / zoom,
        duration / MAX_TIMELINE_ZOOM,
        duration,
    );
    const startSeconds = clamp(
        finiteOr(viewport.startSeconds, 0),
        0,
        Math.max(0, duration - span),
    );
    return {
        startSeconds,
        endSeconds: startSeconds + span,
        zoom,
    };
};

export const withTimelineCursor = (
    viewport: PersistedTimelineViewport,
    cursorSeconds: number,
): TimelineViewport => ({
    ...viewport,
    cursorSeconds: clamp(
        finiteOr(cursorSeconds, viewport.startSeconds),
        viewport.startSeconds,
        viewport.endSeconds,
    ),
});

export const timeToCanvasX = (
    timeSeconds: number,
    viewport: PersistedTimelineViewport,
    width: number,
): number => {
    const span = viewport.endSeconds - viewport.startSeconds;
    if (span <= 0 || width <= 0) return 0;
    return clamp(
        (timeSeconds - viewport.startSeconds) / span,
        0,
        1,
    ) * width;
};

export const canvasXToTime = (
    x: number,
    viewport: PersistedTimelineViewport,
    width: number,
): number => {
    if (width <= 0) return viewport.startSeconds;
    return viewport.startSeconds
        + clamp(x / width, 0, 1)
        * (viewport.endSeconds - viewport.startSeconds);
};

export const zoomTimelineViewport = (
    viewport: PersistedTimelineViewport,
    durationSeconds: number,
    nextZoom: number,
    anchorSeconds: number,
): PersistedTimelineViewport => {
    const duration = normalizeDuration(durationSeconds);
    if (duration <= 0) return resetTimelineViewport(duration);
    const normalized = normalizeTimelineViewport(viewport, duration);
    const zoom = clamp(
        finiteOr(nextZoom, normalized.zoom),
        MIN_TIMELINE_ZOOM,
        MAX_TIMELINE_ZOOM,
    );
    const nextSpan = duration / zoom;
    const anchor = clamp(anchorSeconds, 0, duration);
    const currentSpan =
        normalized.endSeconds - normalized.startSeconds;
    const anchorRatio = currentSpan <= 0
        ? 0.5
        : clamp(
            (anchor - normalized.startSeconds) / currentSpan,
            0,
            1,
        );
    const startSeconds = clamp(
        anchor - nextSpan * anchorRatio,
        0,
        Math.max(0, duration - nextSpan),
    );
    return {
        startSeconds,
        endSeconds: startSeconds + nextSpan,
        zoom,
    };
};

export const panTimelineViewport = (
    viewport: PersistedTimelineViewport,
    durationSeconds: number,
    direction: -1 | 1,
): PersistedTimelineViewport => {
    const duration = normalizeDuration(durationSeconds);
    const normalized = normalizeTimelineViewport(viewport, duration);
    if (duration <= 0) return normalized;
    const span = normalized.endSeconds - normalized.startSeconds;
    const startSeconds = clamp(
        normalized.startSeconds + direction * span * 0.25,
        0,
        Math.max(0, duration - span),
    );
    return {
        ...normalized,
        startSeconds,
        endSeconds: startSeconds + span,
    };
};
