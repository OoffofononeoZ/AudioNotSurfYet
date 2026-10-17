import type { PersistedTimelineViewport } from '../types/session';
import {
    EDITOR_MAX_BPM,
    EDITOR_MIN_METERED_BPM,
    EDITOR_MIN_SUBDIVISION_WIDTH_PX,
} from './editorConfig';
import { normalizeEditorSeconds } from './projectCodec';
import { DEFAULT_BEAT_SNAP, divisorForIndex, type EditorBeatSnapSetting } from './beatSnap';
import type {
    MeterDenominator,
    MeteredTempoSegmentV1,
    TempoSegmentV1,
} from './types';

export type EditorGridLineKind = 'measure' | 'beat' | 'subdivision';

export interface EditorGridLine {
    timeSeconds: number;
    kind: EditorGridLineKind;
    segmentId: string;
    divisor: number;
}

export const cloneTempoSegment = (
    segment: TempoSegmentV1,
): TempoSegmentV1 => segment.mode === 'metered'
    ? { ...segment, meter: { ...segment.meter } }
    : { ...segment };

export type EditorSubdivision = 1 | 2 | 4 | 8 | 16;

export const beatSecondsFor = (bpm: number): number => 60 / bpm;

export const segmentAtTime = (
    tempoMap: readonly TempoSegmentV1[],
    timeSeconds: number,
): TempoSegmentV1 => {
    let active = tempoMap[0]!;
    for (const segment of tempoMap) {
        if (segment.startSeconds > timeSeconds) break;
        active = segment;
    }
    return active;
};

export const segmentEndSeconds = (
    tempoMap: readonly TempoSegmentV1[],
    index: number,
    durationSeconds: number,
): number => tempoMap[index + 1]?.startSeconds ?? durationSeconds;

export const selectVisibleSubdivision = (
    beatSeconds: number,
    viewport: PersistedTimelineViewport,
    width: number,
): EditorSubdivision => {
    const pixelsPerBeat = width * beatSeconds
        / Math.max(1e-9, viewport.endSeconds - viewport.startSeconds);
    for (const subdivision of [16, 8, 4, 2, 1] as const) {
        if (pixelsPerBeat / subdivision >= EDITOR_MIN_SUBDIVISION_WIDTH_PX) {
            return subdivision;
        }
    }
    return 1;
};

export const snapEditorTime = (
    rawSeconds: number,
    tempoMap: readonly TempoSegmentV1[],
    _viewport: PersistedTimelineViewport,
    _width: number,
    durationSeconds: number,
    setting: Readonly<EditorBeatSnapSetting> = DEFAULT_BEAT_SNAP,
): number => {
    const clamped = Math.max(0, Math.min(durationSeconds, rawSeconds));
    const segment = segmentAtTime(tempoMap, clamped);
    if (segment.mode !== 'metered' || segment.bpm === null) {
        return normalizeEditorSeconds(clamped);
    }
    const beatSeconds = beatSecondsFor(segment.bpm);
    const subdivision = setting.divisor;
    const step = beatSeconds / subdivision;
    const index = tempoMap.findIndex(entry => entry.id === segment.id);
    const end = segmentEndSeconds(tempoMap, index, durationSeconds);
    return normalizeEditorSeconds(Math.max(
        segment.startSeconds,
        Math.min(
            end,
            segment.startSeconds
                + Math.round((clamped - segment.startSeconds) / step) * step,
        ),
    ));
};

export const generateTempoGrid = (
    tempoMap: readonly TempoSegmentV1[],
    durationSeconds: number,
    viewport: PersistedTimelineViewport,
    setting: Readonly<EditorBeatSnapSetting> = DEFAULT_BEAT_SNAP,
    width = 1_000,
): EditorGridLine[] => {
    const lines: EditorGridLine[] = [];
    tempoMap.forEach((segment, segmentIndex) => {
        if (segment.mode !== 'metered' || segment.bpm === null) return;
        const beatSeconds = beatSecondsFor(segment.bpm);
        const end = segmentEndSeconds(tempoMap, segmentIndex, durationSeconds);
        // Draw only a legible subset; the selected editing divisor is never changed.
        const pixelsPerBeat = width * beatSeconds / Math.max(1e-9, viewport.endSeconds - viewport.startSeconds);
        const displayDivisor = Array.from({ length: setting.divisor }, (_, i) => setting.divisor - i)
            .find(value => setting.divisor % value === 0 && pixelsPerBeat / value >= 4) ?? 1;
        const step = beatSeconds / displayDivisor;
        const firstBeat = Math.max(
            0,
            Math.ceil((viewport.startSeconds - segment.startSeconds) / step),
        );
        const lastBeat = Math.floor(
            (Math.min(viewport.endSeconds, end) - segment.startSeconds) / step,
        );
        for (let beatIndex = firstBeat; beatIndex <= lastBeat; beatIndex += 1) {
            const timeSeconds = normalizeEditorSeconds(
                segment.startSeconds + beatIndex * step,
            );
            if (timeSeconds >= end && segmentIndex < tempoMap.length - 1) continue;
            lines.push({
                timeSeconds,
                kind: beatIndex % (segment.meter.numerator * displayDivisor) === 0
                    ? 'measure'
                    : beatIndex % displayDivisor === 0 ? 'beat' : 'subdivision',
                segmentId: segment.id,
                divisor: divisorForIndex(beatIndex, displayDivisor),
            });
        }
    });
    return lines;
};

export const insertTempoBoundary = (
    tempoMap: readonly TempoSegmentV1[],
    startSeconds: number,
    createId: () => string,
): TempoSegmentV1[] => {
    const seconds = normalizeEditorSeconds(startSeconds);
    if (
        seconds <= 0
        || tempoMap.some((segment) => segment.startSeconds === seconds)
    ) return [...tempoMap];
    const inherited = segmentAtTime(tempoMap, seconds);
    const inserted: TempoSegmentV1 = inherited.mode === 'metered'
        ? {
            ...cloneTempoSegment(inherited),
            id: createId(),
            startSeconds: seconds,
        }
        : { id: createId(), startSeconds: seconds, mode: 'single-beat' };
    return [...tempoMap, inserted].sort(
        (left, right) => left.startSeconds - right.startSeconds,
    );
};

export const moveTempoBoundary = (
    tempoMap: readonly TempoSegmentV1[],
    id: string,
    startSeconds: number,
    durationSeconds: number,
): TempoSegmentV1[] => {
    const index = tempoMap.findIndex((segment) => segment.id === id);
    if (index <= 0) return [...tempoMap];
    const minimum = (tempoMap[index - 1]?.startSeconds ?? 0) + 1e-6;
    const maximum = (tempoMap[index + 1]?.startSeconds ?? durationSeconds) - 1e-6;
    const seconds = normalizeEditorSeconds(Math.max(minimum, Math.min(maximum, startSeconds)));
    return tempoMap.map((segment) => segment.id === id
        ? { ...segment, startSeconds: seconds }
        : cloneTempoSegment(segment));
};

export const removeTempoBoundary = (
    tempoMap: readonly TempoSegmentV1[],
    id: string,
): TempoSegmentV1[] => {
    const index = tempoMap.findIndex((segment) => segment.id === id);
    if (index <= 0) return tempoMap.map(cloneTempoSegment);
    return tempoMap
        .filter((segment) => segment.id !== id)
        .map(cloneTempoSegment);
};

export type TempoSegmentPresentation = 'full' | 'summary' | 'hidden';

export const resolveTempoSegmentPresentation = (
    availableWidth: number,
    fullRequiredWidth: number,
    summaryRequiredWidth: number,
): TempoSegmentPresentation => {
    const available = Number.isFinite(availableWidth)
        ? Math.max(0, availableWidth)
        : 0;
    const full = Number.isFinite(fullRequiredWidth)
        ? Math.max(0, fullRequiredWidth)
        : Number.POSITIVE_INFINITY;
    const summary = Number.isFinite(summaryRequiredWidth)
        ? Math.max(0, summaryRequiredWidth)
        : Number.POSITIVE_INFINITY;
    if (available >= full) return 'full';
    if (available >= summary) return 'summary';
    return 'hidden';
};

export type TempoInputResult =
    | { ok: true; segment: TempoSegmentV1 }
    | { ok: false; message: string };

export const applyBpmInput = (
    segment: TempoSegmentV1,
    input: string,
): TempoInputResult => {
    const value = Number(input.trim());
    if (input.trim() === '' || !Number.isFinite(value) || value < 0) {
        return { ok: false, message: 'BPM 必须是 0–300 的数字。' };
    }
    if (value > EDITOR_MAX_BPM) {
        return { ok: false, message: `BPM 不得高于 ${EDITOR_MAX_BPM}。` };
    }
    if (value < EDITOR_MIN_METERED_BPM) {
        return {
            ok: true,
            segment: {
                id: segment.id,
                startSeconds: segment.startSeconds,
                mode: 'single-beat',
            },
        };
    }
    const meter = segment.mode === 'metered'
        ? segment.meter
        : { numerator: 4, denominator: 4 as MeterDenominator };
    return {
        ok: true,
        segment: {
            id: segment.id,
            startSeconds: segment.startSeconds,
            mode: 'metered',
            bpm: value,
            bpmSource: 'user',
            meter,
        },
    };
};

export const applyMeterInput = (
    segment: TempoSegmentV1,
    numerator: number,
    denominator: number,
): TempoInputResult => {
    if (segment.mode !== 'metered') {
        return { ok: false, message: '单拍区间不能修改拍号。' };
    }
    if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32) {
        return { ok: false, message: '每小节拍数必须是 1–32 的整数。' };
    }
    if (![1, 2, 4, 8, 16, 32].includes(denominator)) {
        return { ok: false, message: '拍号分母必须是 1、2、4、8、16 或 32。' };
    }
    return {
        ok: true,
        segment: {
            ...segment,
            meter: {
                numerator,
                denominator: denominator as MeterDenominator,
            },
        },
    };
};

export const useEstimatedBpm = (
    segment: TempoSegmentV1,
    bpm: number,
): MeteredTempoSegmentV1 | null => {
    if (
        segment.mode !== 'metered'
        || segment.bpm !== null
        || segment.bpmSource !== 'unset'
        || !Number.isFinite(bpm)
        || bpm < EDITOR_MIN_METERED_BPM
        || bpm > EDITOR_MAX_BPM
    ) return null;
    return { ...segment, bpm, bpmSource: 'estimated' };
};
