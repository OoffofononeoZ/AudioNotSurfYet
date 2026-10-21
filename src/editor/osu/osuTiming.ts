import { normalizeEditorSeconds } from '../projectCodec';
import { EDITOR_MIN_METERED_BPM, EDITOR_MAX_BPM } from '../editorConfig';
import type { MeteredTempoSegmentV2 } from '../types';
import { OsuImportError, type OsuControlPoint, type OsuTimingPoint } from './osuTypes';

/** Same-time legacy points: first red timing survives; last green overrides red SV/effects. */
export function osuControlPoints(points: readonly OsuTimingPoint[]): OsuControlPoint[] {
    const groups = new Map<number, OsuTimingPoint[]>();
    for (const point of points) {
        const group = groups.get(point.timeMs) ?? [];
        group.push(point);
        groups.set(point.timeMs, group);
    }
    return [...groups]
        .sort(([a], [b]) => a - b)
        .map(([timeMs, group]) => {
            const timing = group.find(p => p.uninherited);
            const effect = group.filter(p => !p.uninherited).slice(-1)[0] ?? timing!;
            const sliderVelocity =
                effect.beatLengthMs < 0 ? Math.max(0.1, Math.min(10, -100 / effect.beatLengthMs)) : 1;
            return { timeMs, timing, sliderVelocity, kiai: effect.kiai };
        });
}

export function osuTempoMap(
    points: readonly OsuTimingPoint[],
    durationSeconds: number,
    createId: () => string,
): MeteredTempoSegmentV2[] {
    const timing = osuControlPoints(points).flatMap(p => (p.timing ? [p.timing] : []));
    if (!timing.length) throw new OsuImportError('谱面没有有效的 BPM 时间点。');
    const atZero = timing.filter(p => p.timeMs <= 0).slice(-1)[0] ?? timing[0]!;
    const selected = [atZero, ...timing.filter(p => p.timeMs > 0 && p.timeMs / 1000 < durationSeconds)];
    const segments: MeteredTempoSegmentV2[] = [];
    for (let index = 0; index < selected.length; index++) {
        const point = selected[index]!;
        const bpm = 60000 / point.beatLengthMs;
        if (!Number.isFinite(bpm) || bpm < EDITOR_MIN_METERED_BPM - 1e-9 || bpm > EDITOR_MAX_BPM + 1e-9) {
            throw new OsuImportError(`第 ${point.line} 行：BPM ${bpm} 超出 10–1200。`);
        }
        const startSeconds = index === 0 ? 0 : normalizeEditorSeconds(point.timeMs / 1000);
        if (startSeconds >= durationSeconds) continue;
        if (segments.slice(-1)[0]?.startSeconds === startSeconds)
            throw new OsuImportError('BPM 时间点在微秒规范化后重合。');
        segments.push({
            id: createId(),
            startSeconds,
            mode: 'metered',
            beatOriginSeconds: normalizeEditorSeconds(point.timeMs / 1000),
            bpm: Math.max(EDITOR_MIN_METERED_BPM, Math.min(EDITOR_MAX_BPM, bpm)),
            bpmSource: 'imported',
            meter: { numerator: point.meter, denominator: 4 },
        });
    }
    return segments;
}

export function osuSliderEnd(
    timeMs: number,
    length: number,
    spans: number,
    multiplier: number,
    mode: 0 | 1 | 3,
    controls: readonly OsuControlPoint[],
): number {
    const timing =
        controls.filter(p => p.timing && p.timeMs <= timeMs).slice(-1)[0]?.timing ??
        controls.find(p => p.timing)?.timing;
    if (!timing) throw new OsuImportError('滑条缺少 BPM 定时。');
    const velocity = controls.filter(p => p.timeMs <= timeMs).slice(-1)[0]?.sliderVelocity ?? 1;
    // osu standard intentionally uses float precision for the legacy SV beat-length multiplier.
    const adjustedBeatLength =
        mode === 0
            ? (timing.beatLengthMs * Math.max(10, Math.min(1000, Math.fround(100 / velocity)))) / 100
            : timing.beatLengthMs / velocity;
    return timeMs + (spans * length * adjustedBeatLength) / (100 * multiplier);
}
