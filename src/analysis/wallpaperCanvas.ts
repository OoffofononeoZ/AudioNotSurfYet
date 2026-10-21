import type { EditorRenderRequest } from './canvasRenderer';
import { cursorSampleIndex, vectorAt } from './rendererData';
import type { AnalysisCursorValueResult, StereoSpectrumPayload } from './types';
import { plotColumns } from './renderGeometry';

const maxima = new WeakMap<StereoSpectrumPayload, number>();
function maximum(payload: StereoSpectrumPayload): number {
    let max = maxima.get(payload);
    if (max === undefined) {
        max = 1;
        for (const value of payload.values) max = Math.max(max, value);
        maxima.set(payload, max);
    }
    return max;
}

export function drawWallpaperHeatmap(request: EditorRenderRequest, context: CanvasRenderingContext2D): void {
    const series = request.series;
    if (!series || series.payload.kind !== 'stereo-spectrum-f32') return;
    const payload = series.payload,
        max = maximum(payload);
    const width = Math.max(1, Math.round(request.widthCssPixels)),
        height = request.heightCssPixels;
    const columns = plotColumns(series, request.viewport, width, request.devicePixelRatio, request.durationSeconds);
    const panel = height * 0.34,
        labelHeight = 14;
    for (let channel = 0; channel < 2; channel++) {
        const top = channel * panel;
        for (const column of columns) {
            const sample = column.startIndex;
            for (let band = 0; band < 64; band++) {
                const value = payload.values[sample * 128 + channel * 64 + band] ?? 0;
                const intensity = Math.sqrt(value / max);
                context.fillStyle = `hsl(${channel ? 205 - intensity * 30 : 155 - intensity * 70} 90% ${8 + intensity * 62}%)`;
                context.fillRect(
                    column.left,
                    top + labelHeight + ((63 - band) / 64) * (panel - labelHeight),
                    column.right - column.left,
                    Math.ceil((panel - labelHeight) / 64),
                );
            }
        }
        context.fillStyle = '#c2dace';
        context.font = '10px sans-serif';
        context.fillText(`${channel ? '右 R · 64–127' : '左 L · 0–63'} · 低频 ↓ 高频 ↑`, 6, top + 11);
    }
}

export function drawWallpaperCursor(
    request: EditorRenderRequest,
    time: number,
    exact: AnalysisCursorValueResult | null,
    context: CanvasRenderingContext2D,
): void {
    const series = request.series;
    if (!series || series.payload.kind !== 'stereo-spectrum-f32') return;
    const values = Array.isArray(exact?.value)
        ? exact.value
        : vectorAt(series.payload, cursorSampleIndex(series, time));
    const width = request.widthCssPixels,
        height = request.heightCssPixels,
        top = height * 0.69;
    const max = Math.max(1, ...values),
        panelWidth = width / 2,
        barWidth = (panelWidth - 8) / 64;
    for (let channel = 0; channel < 2; channel++) {
        context.fillStyle = channel ? '#7acaff' : '#7dffb3';
        context.font = '10px sans-serif';
        context.fillText(
            `${channel ? '右 R · 64–127' : '左 L · 0–63'} · 0–${max.toPrecision(3)}`,
            channel * panelWidth + 4,
            top + 12,
        );
        for (let band = 0; band < 64; band++) {
            const barHeight = ((height - top - 22) * (values[channel * 64 + band] ?? 0)) / max;
            context.fillRect(
                channel * panelWidth + 4 + band * barWidth,
                height - 7 - barHeight,
                Math.max(0.5, barWidth - 0.6),
                barHeight,
            );
        }
        context.fillText('低频 → 高频', channel * panelWidth + 4, height - 1);
    }
}
