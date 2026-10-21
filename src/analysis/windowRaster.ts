import type { AnalysisWindowSeries } from './windowTypes';
import { payloadMaximum } from './plotPeaks';
import { plotTimeX, sampleTime } from './renderGeometry';
import type { PersistedTimelineViewport } from '../types/session';

type RasterPayload = Extract<
    AnalysisWindowSeries['payload'],
    { kind: 'frequency-u16' | 'category-u16' | 'loudness' | 'complex-derived' }
>;
interface Raster {
    rows: number;
    signed: boolean;
    magnitude: HTMLCanvasElement;
    phase?: HTMLCanvasElement;
}
const rasters = new WeakMap<RasterPayload, Raster>();

function hsl(hue: number, saturation: number, lightness: number): number[] {
    const a = saturation * Math.min(lightness, 1 - lightness);
    return [0, 8, 4].map(n => {
        const k = (n + hue / 30) % 12;
        return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    });
}
const palettes = {
    positive: Array.from({ length: 256 }, (_, i) => hsl(155 - (i / 255) * 80, 0.9, (8 + (i / 255) * 62) / 100)),
    signedPositive: Array.from({ length: 256 }, (_, i) => hsl(145, 0.88, (8 + (i / 255) * 60) / 100)),
    negative: Array.from({ length: 256 }, (_, i) => hsl(265, 0.82, (8 + (i / 255) * 58) / 100)),
};

function writePhase(target: Uint8ClampedArray, offset: number, encoded: number, sounding: boolean) {
    let red = 12,
        green = 20,
        blue = 16;
    if (sounding) {
        const hue = ((Math.max(-1, Math.min(1, encoded / 32767)) / 2 + 1) % 1) * 6;
        const sector = Math.floor(hue),
            fraction = hue - sector;
        const rising = Math.round(48 + 184 * fraction),
            falling = Math.round(232 - 184 * fraction);
        switch (sector) {
            case 0:
                red = 232;
                green = rising;
                blue = 48;
                break;
            case 1:
                red = falling;
                green = 232;
                blue = 48;
                break;
            case 2:
                red = 48;
                green = 232;
                blue = rising;
                break;
            case 3:
                red = 48;
                green = falling;
                blue = 232;
                break;
            case 4:
                red = rising;
                green = 48;
                blue = 232;
                break;
            default:
                red = 232;
                green = 48;
                blue = falling;
        }
    }
    target[offset] = red;
    target[offset + 1] = green;
    target[offset + 2] = blue;
    target[offset + 3] = 255;
}
function surface(image: ImageData): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw Error('Window raster Canvas unavailable.');
    context.putImageData(image, 0, 0);
    return canvas;
}
function raster(series: AnalysisWindowSeries, payload: RasterPayload, rows: number, signed: boolean): Raster {
    const cached = rasters.get(payload);
    if (cached?.rows === rows && cached.signed === signed) return cached;
    const columns = series.sampleCount;
    const image = new ImageData(columns, rows);
    const phase = payload.kind === 'complex-derived' ? new ImageData(columns, rows) : null;
    const bins =
        payload.kind === 'loudness' ? payload.bands : payload.kind === 'complex-derived' ? payload.bins : payload.width;
    const maximum = payloadMaximum(payload);
    for (let column = 0; column < columns; column++)
        for (let row = 0; row < rows; row++) {
            let value = 0,
                selected = column * bins + Math.floor((row * bins) / rows);
            for (let bin = Math.floor((row * bins) / rows); bin < Math.floor(((row + 1) * bins) / rows); bin++) {
                const index = column * bins + bin;
                const candidate =
                    payload.kind === 'complex-derived'
                        ? payload.magnitude[index]! * payload.magnitudeScale
                        : payload.kind === 'loudness'
                          ? payload.specific[index]! * payload.scale + payload.offset
                          : payload.values[index]! * payload.scale + payload.offset;
                if (signed ? Math.abs(candidate) > Math.abs(value) : candidate > value) {
                    value = candidate;
                    selected = index;
                }
            }
            const target = ((rows - 1 - row) * columns + column) * 4;
            const intensity = Math.sqrt(Math.min(1, Math.abs(value) / maximum));
            if (phase && payload.kind === 'complex-derived') {
                image.data[target] = Math.round(7 + intensity * 118);
                image.data[target + 1] = Math.round(16 + intensity * 239);
                image.data[target + 2] = Math.round(12 + intensity * 167);
                writePhase(phase.data, target, payload.phase[selected]!, value !== 0);
            } else {
                const palette = signed ? (value < 0 ? palettes.negative : palettes.signedPositive) : palettes.positive;
                const color = palette[Math.round(intensity * 255)]!;
                image.data[target] = color[0]!;
                image.data[target + 1] = color[1]!;
                image.data[target + 2] = color[2]!;
            }
            image.data[target + 3] = 255;
        }
    const result = { rows, signed, magnitude: surface(image), phase: phase ? surface(phase) : undefined };
    rasters.set(payload, result);
    return result;
}

/** Rasterize bounded native window data once, then move it using the song clock. */
export function drawWindowRaster(
    series: AnalysisWindowSeries,
    viewport: PersistedTimelineViewport,
    width: number,
    top: number,
    height: number,
    dpr: number,
    context: CanvasRenderingContext2D,
    signed = false,
    phase = false,
    rasterHeight = height,
): boolean {
    const payload = series.payload;
    if (
        !['frequency-u16', 'category-u16', 'loudness', 'complex-derived'].includes(payload.kind) ||
        series.sampleCount <= 0
    )
        return false;
    const data = payload as RasterPayload;
    const bins = data.kind === 'loudness' ? data.bands : data.kind === 'complex-derived' ? data.bins : data.width;
    const rows =
        data.kind === 'category-u16' || data.kind === 'loudness'
            ? bins
            : Math.min(bins, Math.max(1, Math.floor(rasterHeight * dpr)));
    const cached = raster(series, data, rows, signed);
    const canvas = phase ? cached.phase : cached.magnitude;
    if (!canvas) return false;
    const first = plotTimeX(series.startTimeSeconds, viewport, width);
    const last = plotTimeX(sampleTime(series, series.sampleCount - 1), viewport, width);
    const end = plotTimeX(series.endTimeSeconds, viewport, width);
    context.imageSmoothingEnabled = false;
    if (series.sampleCount > 1)
        context.drawImage(canvas, 0, 0, series.sampleCount - 1, rows, first, top, last - first, height);
    context.drawImage(canvas, series.sampleCount - 1, 0, 1, rows, last, top, end - last, height);
    return true;
}
