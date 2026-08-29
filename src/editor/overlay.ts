import type { AnalysisCursorValueResult, FeatureId } from '../analysis/types';

export const EDITOR_OVERLAY_DEFAULT_TOP = 0.10;
export const EDITOR_OVERLAY_DEFAULT_HEIGHT = 0.35;
export const EDITOR_OVERLAY_MIN_HEIGHT = 0.12;
export const EDITOR_OVERLAY_KEYBOARD_STEP = 0.01;
export const EDITOR_OVERLAY_KEYBOARD_COARSE_STEP = 0.05;

export interface EditorOverlayBounds {
    topRatio: number;
    heightRatio: number;
}

export type EditorOverlayHandle = 'top' | 'move' | 'bottom';

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

export const normalizeEditorOverlayBounds = (
    bounds: EditorOverlayBounds,
): EditorOverlayBounds => {
    const heightRatio = clamp(
        Number.isFinite(bounds.heightRatio)
            ? bounds.heightRatio
            : EDITOR_OVERLAY_DEFAULT_HEIGHT,
        EDITOR_OVERLAY_MIN_HEIGHT,
        1,
    );
    const topRatio = clamp(
        Number.isFinite(bounds.topRatio)
            ? bounds.topRatio
            : EDITOR_OVERLAY_DEFAULT_TOP,
        0,
        1 - heightRatio,
    );
    return { topRatio, heightRatio };
};

export const moveEditorOverlayHandle = (
    bounds: EditorOverlayBounds,
    handle: EditorOverlayHandle,
    deltaRatio: number,
): EditorOverlayBounds => {
    const normalized = normalizeEditorOverlayBounds(bounds);
    const delta = Number.isFinite(deltaRatio) ? deltaRatio : 0;
    if (handle === 'move') {
        return {
            ...normalized,
            topRatio: clamp(
                normalized.topRatio + delta,
                0,
                1 - normalized.heightRatio,
            ),
        };
    }
    if (handle === 'top') {
        const bottom = normalized.topRatio + normalized.heightRatio;
        const topRatio = clamp(
            normalized.topRatio + delta,
            0,
            bottom - EDITOR_OVERLAY_MIN_HEIGHT,
        );
        return { topRatio, heightRatio: bottom - topRatio };
    }
    return {
        topRatio: normalized.topRatio,
        heightRatio: clamp(
            normalized.heightRatio + delta,
            EDITOR_OVERLAY_MIN_HEIGHT,
            1 - normalized.topRatio,
        ),
    };
};

export const editorOverlayFeatureIds = (
    featureId: FeatureId | null,
    overlayOpen = true,
): FeatureId[] => overlayOpen && featureId && featureId !== 'buffer'
    ? ['buffer', featureId]
    : ['buffer'];

export const resolveEditorOverlayOpen = (
    featureId: FeatureId | null,
    storedVisibility: boolean | null,
): boolean => featureId !== null && (storedVisibility ?? true);

const format = (value: number) => Number.isFinite(value)
    ? value.toFixed(5)
    : '—';

export const editorOverlayExactSummary = (
    featureId: FeatureId,
    exact: AnalysisCursorValueResult | null,
): string => {
    const value = exact?.value;
    if (typeof value === 'number') return format(value);
    if (Array.isArray(value)) {
        if (value.length === 0) return '等待精确值';
        if (featureId === 'buffer') {
            return `frame ${format(Math.min(...value))}…${format(Math.max(...value))}`;
        }
        let peakIndex = 0;
        for (let index = 1; index < value.length; index += 1) {
            if ((value[index] ?? 0) > (value[peakIndex] ?? 0)) peakIndex = index;
        }
        const label = featureId === 'chroma'
            ? ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][peakIndex]
            : featureId === 'mfcc' ? `C${peakIndex}` : `bin ${peakIndex}`;
        return `${label ?? peakIndex} · ${format(value[peakIndex] ?? 0)}`;
    }
    if (value && 'specific' in value) {
        let peakIndex = 0;
        value.specific.forEach((entry, index) => {
            if (entry > (value.specific[peakIndex] ?? 0)) peakIndex = index;
        });
        return `total ${format(value.total)} · B${peakIndex}`;
    }
    if (value && 'real' in value) {
        let peakIndex = 0;
        let peakMagnitude = 0;
        value.real.forEach((real, index) => {
            const imaginary = value.imag[index] ?? 0;
            const magnitude = Math.hypot(real, imaginary);
            if (magnitude > peakMagnitude) {
                peakIndex = index;
                peakMagnitude = magnitude;
            }
        });
        const real = value.real[peakIndex] ?? 0;
        const imaginary = value.imag[peakIndex] ?? 0;
        const phase = peakMagnitude === 0 ? '未定义' : format(Math.atan2(imaginary, real));
        return `bin ${peakIndex} · |X| ${format(peakMagnitude)} · phase ${phase}`;
    }
    return '等待精确值';
};
