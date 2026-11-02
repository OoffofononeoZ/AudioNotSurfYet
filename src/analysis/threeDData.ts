import type { AnalysisSeries, AnalysisCursorValueResult } from './types';
import type { PersistedTimelineViewport } from '../types/session';
import { decodeQuantizedValue, signedFftBinFrequency, visibleSampleRange } from './rendererData';
import { createBudgetYield } from './taskScheduler';

export type ComplexView = 'magnitude' | 'phase';
export interface ThreeDGrid {
    viewport: PersistedTimelineViewport;
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

export function componentCount(series: AnalysisSeries): number {
    const p = series.payload;
    if (p.kind === 'frequency-u16' || p.kind === 'category-u16' || p.kind === 'stereo-spectrum-f32') return p.width;
    if (p.kind === 'loudness') return p.bands + 1;
    if (p.kind === 'complex-derived') return p.bins;
    return 0;
}

export function componentValue(series: AnalysisSeries, frame: number, index: number, view: ComplexView): number {
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
export function componentLabel(series: AnalysisSeries, index: number, sampleRate: number): string {
    if (series.featureId === 'wallpaperEngineSpectrum') return `${index < 64 ? '左 L' : '右 R'} / ${index % 64}`;
    if (series.featureId === 'chroma') return CHROMA[index] ?? String(index);
    if (series.featureId === 'mfcc') return `MFCC ${index}`;
    if (series.featureId === 'loudness') return index === 24 ? '总响度' : `Bark ${index}`;
    const bins = series.payload.kind === 'complex-derived' ? series.payload.bins : (series.dimensions[0] ?? 512) * 2;
    const hz = signedFftBinFrequency(index, bins, sampleRate);
    return `${index} · ${Math.round(hz)} Hz`;
}

export function componentAxisLabel(series: AnalysisSeries): string {
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
export async function buildThreeDGrid(
    series: AnalysisSeries,
    viewport: PersistedTimelineViewport,
    options: {
        view: ComplexView;
        selected: number | null;
        cancelled: () => boolean;
        yieldControl?: () => Promise<void>;
    },
): Promise<ThreeDGrid | null> {
    const count = componentCount(series);
    const range = visibleSampleRange(series, viewport);
    if (!count || range.endIndex <= range.startIndex) return null;
    const slice = options.selected !== null;
    const rowStride = Math.max(1, Math.ceil(count / 256));
    const components = slice
        ? [Math.max(0, Math.min(count - 1, options.selected!))]
        : Array.from({ length: Math.ceil(count / rowStride) }, (_, i) => i * rowStride);
    const stride = Math.max(1, Math.ceil((range.endIndex - range.startIndex) / 512));
    const columns = Math.ceil((range.endIndex - range.startIndex) / stride);
    const times = new Float64Array(columns);
    const values = new Float32Array(columns * components.length);
    const minimums = new Float32Array(values.length),
        maximums = new Float32Array(values.length);
    let min = 0,
        max = 0;
    const checkpoint = createBudgetYield(options.yieldControl);
    for (let column = 0; column < columns; column++) {
        const first = range.startIndex + column * stride;
        const end = Math.min(range.endIndex, first + stride);
        times[column] = series.startTimeSeconds + first * series.sampleStepSeconds;
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
