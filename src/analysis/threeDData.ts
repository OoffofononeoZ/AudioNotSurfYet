import type { AnalysisSeries, AnalysisCursorValueResult } from './types';
import type { PersistedTimelineViewport } from '../types/session';
import { decodeQuantizedValue, signedFftBinFrequency, visibleSampleRange } from './rendererData';
import { createBudgetYield } from './taskScheduler';
import type { RenderAnalysisSeries, AnalysisWindowSeries } from './windowTypes';

export interface ThreeDGridOptions {
    view: ComplexView;
    selected: number | null;
    cancelled: () => boolean;
    yieldControl?: () => Promise<void>;
    durationSeconds?: number;
    visible?: { startSeconds: number; endSeconds: number } | null;
    detail?: AnalysisWindowSeries | null;
}
const overviews = new WeakMap<AnalysisSeries, { key: string; grid: ThreeDGrid }>();

/** Re-bin cached extrema rather than scanning the entire song during camera gestures. */
function coarsePart(grid: ThreeDGrid, start: number, end: number): ThreeDGrid | null {
    const indices = Array.from(grid.times, (_, i) => i).filter(i => grid.ends[i]! > start && grid.times[i]! < end);
    if (!indices.length) return null;
    const stride = Math.max(1, Math.ceil(indices.length / 64));
    const columns = Math.ceil(indices.length / stride);
    const times = new Float64Array(columns),
        ends = new Float64Array(columns);
    const minimums = new Float32Array(columns * grid.components.length),
        maximums = new Float32Array(minimums.length);
    const values = new Float32Array(minimums.length);
    for (let c = 0; c < columns; c++) {
        const group = indices.slice(c * stride, (c + 1) * stride);
        times[c] = Math.max(start, grid.times[group[0]!]!);
        ends[c] = Math.min(end, grid.ends[group[group.length - 1]!]!);
        for (let r = 0; r < grid.components.length; r++) {
            let low = Infinity,
                high = -Infinity;
            for (const i of group) {
                low = Math.min(low, grid.minimums[r * grid.times.length + i]!);
                high = Math.max(high, grid.maximums[r * grid.times.length + i]!);
            }
            const offset = r * columns + c;
            minimums[offset] = low;
            maximums[offset] = high;
            values[offset] = Math.abs(low) > Math.abs(high) ? low : high;
        }
    }
    return { ...grid, times, ends, values, minimums, maximums };
}

function joinParts(parts: ThreeDGrid[], viewport: PersistedTimelineViewport, duration: number): ThreeDGrid {
    const base = parts[0]!;
    const count = parts.reduce((sum, part) => sum + part.times.length, 0);
    // Close the last time cell at its actual end rather than truncating one overview bucket early.
    const columns = count + 1;
    const times = new Float64Array(columns),
        ends = new Float64Array(columns);
    const values = new Float32Array(columns * base.components.length);
    const minimums = new Float32Array(values.length),
        maximums = new Float32Array(values.length);
    let offset = 0,
        min = 0,
        max = 0;
    for (const part of parts) {
        times.set(part.times, offset);
        ends.set(part.ends, offset);
        min = Math.min(min, part.min);
        max = Math.max(max, part.max);
        for (let row = 0; row < base.components.length; row++) {
            const from = row * part.times.length,
                to = from + part.times.length;
            values.set(part.values.subarray(from, to), row * columns + offset);
            minimums.set(part.minimums.subarray(from, to), row * columns + offset);
            maximums.set(part.maximums.subarray(from, to), row * columns + offset);
        }
        offset += part.times.length;
    }
    times[count] = ends[count] = Math.min(duration, ends[count - 1]!);
    for (let row = 0; row < base.components.length; row++) {
        const i = row * columns + count;
        values[i] = values[i - 1]!;
        minimums[i] = minimums[i - 1]!;
        maximums[i] = maximums[i - 1]!;
    }
    return {
        ...base,
        viewport: { ...viewport },
        durationSeconds: duration,
        times,
        ends,
        values,
        minimums,
        maximums,
        min,
        max,
    };
}

/** Full-song coverage with a bounded, denser visible interval. Durable payloads stay untouched. */
export async function buildThreeDGrid(
    series: AnalysisSeries,
    viewport: PersistedTimelineViewport,
    options: ThreeDGridOptions,
): Promise<ThreeDGrid | null> {
    if (options.cancelled() || !series.sampleCount) return null;
    const duration =
        options.durationSeconds ??
        Math.max(viewport.endSeconds, series.startTimeSeconds + series.sampleCount * series.sampleStepSeconds);
    const full = { startSeconds: 0, endSeconds: duration, zoom: 1 };
    const key = `${options.view}:${options.selected}:${duration}`;
    let overview = overviews.get(series)?.key === key ? overviews.get(series)!.grid : null;
    if (!overview) {
        overview = await aggregateGrid(series, full, options);
        if (!overview || options.cancelled()) return null;
        overviews.set(series, { key, grid: overview });
    }
    const visible = options.visible === undefined ? viewport : options.visible;
    if (!visible || (!options.detail && visible.startSeconds <= 0 && visible.endSeconds >= duration))
        return joinParts([overview], viewport, duration);
    const start = Math.max(0, visible.startSeconds),
        end = Math.min(duration, visible.endSeconds);
    if (end <= start) return joinParts([overview], viewport, duration);
    const left = coarsePart(overview, 0, start),
        right = coarsePart(overview, end, duration);
    const columns = 511 - (left?.times.length ?? 0) - (right?.times.length ?? 0);
    const detail = options.detail;
    const source =
        detail &&
        detail.trackHash === series.trackHash &&
        detail.configHash === series.configHash &&
        detail.featureId === series.featureId &&
        detail.startTimeSeconds <= start &&
        detail.endTimeSeconds >= end
            ? detail
            : series;
    const middle = await aggregateGrid(
        source,
        { startSeconds: start, endSeconds: end, zoom: 1 },
        { ...options, columns },
    );
    if (options.cancelled()) return null;
    return joinParts(
        [left, middle, right].filter((part): part is ThreeDGrid => !!part),
        viewport,
        duration,
    );
}

export type ComplexView = 'magnitude' | 'phase';
export interface ThreeDGrid {
    viewport: PersistedTimelineViewport;
    durationSeconds: number;
    ends: Float64Array;
    times: Float64Array;
    components: number[];
    values: Float32Array;
    minimums: Float32Array;
    maximums: Float32Array;
    min: number;
    max: number;
    componentCount: number;
    slice: boolean;
    phase: boolean;
}

export function componentCount(series: RenderAnalysisSeries): number {
    const p = series.payload;
    if (p.kind === 'frequency-u16' || p.kind === 'category-u16' || p.kind === 'stereo-spectrum-f32') return p.width;
    if (p.kind === 'loudness') return p.bands + 1;
    if (p.kind === 'complex-derived') return p.bins;
    return 0;
}

export function componentValue(series: RenderAnalysisSeries, frame: number, index: number, view: ComplexView): number {
    const p = series.payload;
    if (p.kind === 'stereo-spectrum-f32') return p.values[frame * p.width + index] ?? 0;
    if (p.kind === 'frequency-u16' || p.kind === 'category-u16')
        return decodeQuantizedValue(p.values[frame * p.width + index] ?? 0, p.scale, p.offset);
    if (p.kind === 'loudness')
        return index === p.bands
            ? (p.total[frame] ?? 0)
            : decodeQuantizedValue(p.specific[frame * p.bands + index] ?? 0, p.scale, p.offset);
    if (p.kind === 'complex-derived')
        return view === 'phase'
            ? Math.max(-1, Math.min(1, (p.phase[frame * p.bins + index] ?? 0) / 32767)) * Math.PI
            : (p.magnitude[frame * p.bins + index] ?? 0) * p.magnitudeScale;
    return 0;
}

const CHROMA = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export function componentLabel(series: RenderAnalysisSeries, index: number, sampleRate: number): string {
    if (series.featureId === 'wallpaperEngineSpectrum') return `${index < 64 ? '左 L' : '右 R'} / ${index % 64}`;
    if (series.featureId === 'chroma') return CHROMA[index] ?? String(index);
    if (series.featureId === 'mfcc') return `MFCC ${index}`;
    if (series.featureId === 'loudness') return index === 24 ? '总响度' : `Bark ${index}`;
    const bins = series.payload.kind === 'complex-derived' ? series.payload.bins : (series.dimensions[0] ?? 512) * 2;
    const hz = signedFftBinFrequency(index, bins, sampleRate);
    return `${index} · ${Math.round(hz)} Hz`;
}

export function componentAxisLabel(series: RenderAnalysisSeries): string {
    if (series.featureId === 'chroma') return '音级';
    if (series.featureId === 'mfcc') return '系数';
    if (series.featureId === 'loudness') return 'Bark 频带';
    if (series.featureId === 'wallpaperEngineSpectrum') return '声道 / 频段';
    return '频率 / bin';
}

export function exactComponent(
    result: AnalysisCursorValueResult | null,
    index: number,
    view: ComplexView,
): number | null {
    const value = result?.value;
    if (Array.isArray(value)) return value[index] ?? null;
    if (!value || typeof value === 'number') return null;
    if ('specific' in value) return index === 24 ? value.total : (value.specific[index] ?? null);
    const real = value.real[index],
        imag = value.imag[index];
    return real === undefined || imag === undefined
        ? null
        : view === 'phase'
          ? Math.atan2(imag, real)
          : Math.hypot(real, imag);
}

/** The last loudness lane has a two-band gap and never joins the specific surface. */
export const componentPosition = (index: number, count: number, loudness: boolean): number =>
    -2.6 + (5.2 * (loudness && index === 24 ? 26 : index)) / Math.max(1, loudness ? 26 : count - 1);

/** Display-only aggregation. The compact series and exact cursor remain untouched. */
async function aggregateGrid(
    series: RenderAnalysisSeries,
    viewport: PersistedTimelineViewport,
    options: {
        view: ComplexView;
        selected: number | null;
        cancelled: () => boolean;
        yieldControl?: () => Promise<void>;
        columns?: number;
    },
): Promise<ThreeDGrid | null> {
    const count = componentCount(series);
    const range = visibleSampleRange(series, viewport);
    range.endIndex = Math.min(
        range.endIndex,
        Math.ceil((viewport.endSeconds - series.startTimeSeconds) / series.sampleStepSeconds),
    );
    if (!count || range.endIndex <= range.startIndex) return null;
    const slice = options.selected !== null;
    const rowStride = Math.max(1, Math.ceil(count / 256));
    const components = slice
        ? [Math.max(0, Math.min(count - 1, options.selected!))]
        : Array.from({ length: Math.ceil(count / rowStride) }, (_, i) => i * rowStride);
    const stride = Math.max(1, Math.ceil((range.endIndex - range.startIndex) / (options.columns ?? 511)));
    const columns = Math.ceil((range.endIndex - range.startIndex) / stride);
    const times = new Float64Array(columns);
    const ends = new Float64Array(columns);
    const values = new Float32Array(columns * components.length);
    const minimums = new Float32Array(values.length),
        maximums = new Float32Array(values.length);
    let min = 0,
        max = 0;
    const checkpoint = createBudgetYield(options.yieldControl);
    for (let column = 0; column < columns; column++) {
        const first = range.startIndex + column * stride;
        const end = Math.min(range.endIndex, first + stride);
        times[column] = Math.max(viewport.startSeconds, series.startTimeSeconds + first * series.sampleStepSeconds);
        ends[column] = Math.min(
            viewport.endSeconds,
            'endTimeSeconds' in series ? series.endTimeSeconds : Infinity,
            end === series.sampleCount
                ? 'endTimeSeconds' in series
                    ? series.endTimeSeconds
                    : viewport.endSeconds
                : series.startTimeSeconds + end * series.sampleStepSeconds,
        );
        for (let row = 0; row < components.length; row++) {
            const component = components[row]!;
            const until = slice ? component + 1 : Math.min(count, component + rowStride);
            let low = Infinity,
                high = -Infinity;
            for (let frame = first; frame < end; frame++) {
                for (let band = component; band < until; band++) {
                    const value = componentValue(series, frame, band, options.view);
                    if (!Number.isFinite(value)) throw Error('图表数据包含非有限值。');
                    low = Math.min(low, value);
                    high = Math.max(high, value);
                }
                if ((frame - first) % 64 === 63) {
                    await checkpoint();
                    if (options.cancelled()) return null;
                }
            }
            const offset = row * columns + column;
            minimums[offset] = low;
            maximums[offset] = high;
            values[offset] = Math.abs(low) > Math.abs(high) ? low : high;
            min = Math.min(min, low);
            max = Math.max(max, high);
        }
        await checkpoint();
        if (options.cancelled()) return null;
    }
    const phase = series.featureId === 'complexSpectrum' && options.view === 'phase';
    if (phase) {
        min = -Math.PI;
        max = Math.PI;
    }
    if (series.featureId === 'chroma') {
        min = 0;
        max = 1;
    }
    if (max <= min) max = min + 1;
    return {
        viewport: { ...viewport },
        times,
        ends,
        durationSeconds: viewport.endSeconds,
        components,
        values,
        minimums,
        maximums,
        min,
        max,
        componentCount: count,
        slice,
        phase,
    };
}
