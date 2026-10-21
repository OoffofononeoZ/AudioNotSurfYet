import {
    cursorSampleIndex,
    loudnessAt,
    scalarPlotDomain,
    signedVectorMaximum,
    vectorAt,
    visibleSampleRange,
    waveformEnvelopeAt,
} from './rendererData';
import { timeToCanvasX } from './timelineViewport';
import { plotColumns, plotTimeX, sampleTime } from './renderGeometry';
import { drawWallpaperHeatmap, drawWallpaperCursor } from './wallpaperCanvas';
import type { AnalysisCursorValueResult, AnalysisSeries, FeatureDefinition } from './types';
import type { PersistedTimelineViewport } from '../types/session';

export interface EditorRenderRequest {
    feature: FeatureDefinition;
    series: AnalysisSeries | null;
    viewport: PersistedTimelineViewport;
    widthCssPixels: number;
    heightCssPixels: number;
    devicePixelRatio: number;
    durationSeconds?: number;
}

export interface EditorRendererAdapter {
    drawStatic(request: EditorRenderRequest, target: CanvasRenderingContext2D): void;
    drawCursor(
        request: EditorRenderRequest,
        cursorSeconds: number,
        exactValue: AnalysisCursorValueResult | null,
        target: CanvasRenderingContext2D,
    ): void;
}

export const prepareCanvasSurface = (
    canvas: HTMLCanvasElement,
    widthCssPixels: number,
    heightCssPixels: number,
    devicePixelRatio: number,
): CanvasRenderingContext2D => {
    const width = Math.max(1, Math.round(widthCssPixels));
    const height = Math.max(1, Math.round(heightCssPixels));
    const dpr = Math.max(1, Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器未提供 Canvas 2D context。');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    return context;
};

const size = (request: EditorRenderRequest) => ({
    width: Math.max(1, Math.round(request.widthCssPixels)),
    height: Math.max(1, Math.round(request.heightCssPixels)),
});

const drawGrid = (context: CanvasRenderingContext2D, width: number, height: number) => {
    context.fillStyle = '#07100c';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(104, 255, 167, 0.12)';
    context.lineWidth = 1;
    for (let index = 1; index < 5; index += 1) {
        const x = Math.round((width * index) / 5) + 0.5;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
    }
    for (let index = 1; index < 4; index += 1) {
        const y = Math.round((height * index) / 4) + 0.5;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
    }
};

const drawScalar = (request: EditorRenderRequest, context: CanvasRenderingContext2D) => {
    const series = request.series;
    if (!series || series.payload.kind !== 'scalar-f32') {
        throw new Error('标量数据形态与 renderer 不匹配。');
    }
    const { width, height } = size(request);
    const range = visibleSampleRange(series, request.viewport);
    const values = series.payload.values.subarray(range.startIndex, range.endIndex);
    const domain = scalarPlotDomain(values, request.feature.range);
    const toY = (value: number) => height - 6 - ((value - domain.min) / (domain.max - domain.min)) * (height - 12);
    if (request.feature.range.signed) {
        context.strokeStyle = 'rgba(248, 255, 135, 0.45)';
        context.beginPath();
        context.moveTo(0, toY(0) + 0.5);
        context.lineTo(width, toY(0) + 0.5);
        context.stroke();
    }
    context.strokeStyle = '#7dffb3';
    context.lineWidth = 2;
    context.beginPath();
    values.forEach((value, localIndex) => {
        const sampleIndex = range.startIndex + localIndex;
        const x = plotTimeX(sampleTime(series, sampleIndex), request.viewport, width);
        const y = toY(value);
        if (localIndex === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    });
    context.stroke();
};

const heatColor = (value: number, maximum: number): string => {
    const intensity = maximum <= 0 ? 0 : Math.sqrt(Math.max(0, value) / maximum);
    return `hsl(${155 - intensity * 80} 90% ${8 + intensity * 62}%)`;
};

const signedHeatColor = (value: number, maximum: number): string => {
    const intensity = Math.sqrt(Math.min(1, Math.abs(value) / maximum));
    return value < 0 ? `hsl(265 82% ${8 + intensity * 58}%)` : `hsl(145 88% ${8 + intensity * 60}%)`;
};

const drawHeatmap = (request: EditorRenderRequest, context: CanvasRenderingContext2D) => {
    const series = request.series;
    if (!series || (series.payload.kind !== 'frequency-u16' && series.payload.kind !== 'category-u16')) {
        throw new Error('向量数据形态与 renderer 不匹配。');
    }
    const { width, height } = size(request);
    const payload = series.payload;
    const topHeight = Math.floor(height * 0.7);
    const columns = plotColumns(series, request.viewport, width, request.devicePixelRatio, request.durationSeconds);
    const rows = payload.kind === 'category-u16' ? payload.width : Math.min(128, payload.width);
    const signed = request.feature.id === 'mfcc';
    let maximum = 0;
    for (const encoded of payload.values) {
        const value = encoded * payload.scale + payload.offset;
        maximum = Math.max(maximum, signed ? Math.abs(value) : value);
    }
    maximum = Math.max(maximum, 0.000001);
    for (const column of columns) {
        const sampleIndex = column.startIndex;
        const values = vectorAt(payload, sampleIndex);
        const x0 = column.left;
        const x1 = column.right;
        for (let row = 0; row < rows; row += 1) {
            const bin =
                payload.kind === 'category-u16'
                    ? row
                    : Math.min(payload.width - 1, Math.floor((row * payload.width) / rows));
            const value = values[bin] ?? 0;
            context.fillStyle = signed ? signedHeatColor(value, maximum) : heatColor(value, maximum);
            const y = topHeight - Math.ceil(((row + 1) * topHeight) / rows);
            context.fillRect(x0, y, x1 - x0, Math.ceil(topHeight / rows) + 1);
        }
    }
    context.strokeStyle = 'rgba(132, 255, 185, 0.35)';
    context.beginPath();
    context.moveTo(0, topHeight + 0.5);
    context.lineTo(width, topHeight + 0.5);
    context.stroke();
};

const drawWaveform = (request: EditorRenderRequest, context: CanvasRenderingContext2D) => {
    const series = request.series;
    if (!series || series.payload.kind !== 'waveform-envelope') {
        throw new Error('波形数据形态与 renderer 不匹配。');
    }
    const { width, height } = size(request);
    const columns = plotColumns(series, request.viewport, width, request.devicePixelRatio, request.durationSeconds);
    const toY = (value: number) => height / 2 - value * (height / 2 - 7);
    context.strokeStyle = 'rgba(248, 255, 135, 0.45)';
    context.beginPath();
    context.moveTo(0, Math.round(height / 2) + 0.5);
    context.lineTo(width, Math.round(height / 2) + 0.5);
    context.stroke();
    context.strokeStyle = '#7dffb3';
    context.lineWidth = 1.5;
    for (const column of columns) {
        const sampleIndex = column.startIndex;
        const envelope = waveformEnvelopeAt(series.payload, sampleIndex);
        const x = (column.left + column.right) / 2;
        context.lineWidth = column.right - column.left;
        context.beginPath();
        context.moveTo(x, toY(envelope.max));
        context.lineTo(x, toY(envelope.min));
        context.stroke();
    }
};

const drawLoudness = (request: EditorRenderRequest, context: CanvasRenderingContext2D) => {
    const series = request.series;
    if (!series || series.payload.kind !== 'loudness') {
        throw new Error('响度数据形态与 renderer 不匹配。');
    }
    const { width, height } = size(request);
    const payload = series.payload;
    const range = visibleSampleRange(series, request.viewport);
    const heatmapHeight = Math.floor(height * 0.68);
    const columns = plotColumns(series, request.viewport, width, request.devicePixelRatio, request.durationSeconds);
    let maximum = 0;
    for (const value of payload.specific) {
        maximum = Math.max(maximum, value * payload.scale + payload.offset);
    }
    maximum = Math.max(maximum, 0.000001);
    for (const column of columns) {
        const sampleIndex = column.startIndex;
        const current = loudnessAt(payload, sampleIndex);
        const x0 = column.left;
        const x1 = column.right;
        current.specific.forEach((value, band) => {
            context.fillStyle = heatColor(value, maximum);
            const y = heatmapHeight - Math.ceil(((band + 1) * heatmapHeight) / payload.bands);
            context.fillRect(x0, y, x1 - x0, Math.ceil(heatmapHeight / payload.bands) + 1);
        });
    }
    const totals = payload.total.subarray(range.startIndex, range.endIndex);
    const domain = scalarPlotDomain(totals, { min: 0 });
    const top = heatmapHeight + 8;
    const bottom = height - 7;
    const toY = (value: number) => bottom - ((value - domain.min) / (domain.max - domain.min)) * (bottom - top);
    context.strokeStyle = '#7dffb3';
    context.lineWidth = 2;
    context.beginPath();
    totals.forEach((value, localIndex) => {
        const sampleIndex = range.startIndex + localIndex;
        const x = plotTimeX(sampleTime(series, sampleIndex), request.viewport, width);
        if (localIndex === 0) context.moveTo(x, toY(value));
        else context.lineTo(x, toY(value));
    });
    context.stroke();
    context.fillStyle = '#d5ffe5';
    context.font = '11px ui-monospace, monospace';
    context.fillText('24 Bark bands', 8, 15);
    context.fillText('Total loudness', 8, heatmapHeight + 16);
};

const phaseRgb = (phase: number): [number, number, number] => {
    const hue = ((phase / (Math.PI * 2) + 1) % 1) * 6;
    const sector = Math.floor(hue);
    const fraction = hue - sector;
    const high = 232;
    const low = 48;
    const rising = Math.round(low + (high - low) * fraction);
    const falling = Math.round(high - (high - low) * fraction);
    switch (sector) {
        case 0:
            return [high, rising, low];
        case 1:
            return [falling, high, low];
        case 2:
            return [low, high, rising];
        case 3:
            return [low, falling, high];
        case 4:
            return [rising, low, high];
        default:
            return [high, low, falling];
    }
};

const drawComplex = (request: EditorRenderRequest, context: CanvasRenderingContext2D) => {
    const series = request.series;
    if (!series || series.payload.kind !== 'complex-derived') {
        throw new Error('复频谱数据形态与 renderer 不匹配。');
    }
    const { width, height } = size(request);
    const payload = series.payload;
    const geometry = plotColumns(series, request.viewport, width, request.devicePixelRatio, request.durationSeconds);
    const columns = geometry.length;
    if (!columns) return;
    const bins = payload.bins;
    const magnitudeImage = new ImageData(columns, bins);
    const phaseImage = new ImageData(columns, bins);
    let maximum = 0;
    for (const value of payload.magnitude) {
        maximum = Math.max(maximum, value * payload.magnitudeScale);
    }
    maximum = Math.max(maximum, 0.000001);
    for (let column = 0; column < columns; column += 1) {
        const sampleIndex = geometry[column]!.startIndex;
        const sourceOffset = sampleIndex * bins;
        for (let bin = 0; bin < bins; bin += 1) {
            const sourceIndex = sourceOffset + bin;
            const target = ((bins - 1 - bin) * columns + column) * 4;
            const magnitude = (payload.magnitude[sourceIndex] ?? 0) * payload.magnitudeScale;
            const intensity = Math.sqrt(magnitude / maximum);
            magnitudeImage.data[target] = Math.round(7 + intensity * 118);
            magnitudeImage.data[target + 1] = Math.round(16 + intensity * 239);
            magnitudeImage.data[target + 2] = Math.round(12 + intensity * 167);
            magnitudeImage.data[target + 3] = 255;
            if (magnitude === 0) {
                phaseImage.data[target] = 12;
                phaseImage.data[target + 1] = 20;
                phaseImage.data[target + 2] = 16;
            } else {
                const phase = Math.max(-1, Math.min(1, (payload.phase[sourceIndex] ?? 0) / 32_767)) * Math.PI;
                const [red, green, blue] = phaseRgb(phase);
                phaseImage.data[target] = red;
                phaseImage.data[target + 1] = green;
                phaseImage.data[target + 2] = blue;
            }
            phaseImage.data[target + 3] = 255;
        }
    }
    const source = document.createElement('canvas');
    source.width = columns;
    source.height = bins;
    const sourceContext = source.getContext('2d');
    if (!sourceContext) throw new Error('复频谱离屏 Canvas 不可用。');
    const divider = Math.floor(height / 2);
    context.imageSmoothingEnabled = false;
    sourceContext.putImageData(magnitudeImage, 0, 0);
    geometry.forEach((column, index) =>
        context.drawImage(source, index, 0, 1, bins, column.left, 0, column.right - column.left, divider - 2),
    );
    sourceContext.putImageData(phaseImage, 0, 0);
    geometry.forEach((column, index) =>
        context.drawImage(
            source,
            index,
            0,
            1,
            bins,
            column.left,
            divider + 2,
            column.right - column.left,
            height - divider - 2,
        ),
    );
    context.strokeStyle = 'rgba(132, 255, 185, 0.45)';
    context.beginPath();
    context.moveTo(0, divider + 0.5);
    context.lineTo(width, divider + 0.5);
    context.stroke();
    context.fillStyle = '#f2fff7';
    context.font = '11px ui-monospace, monospace';
    context.fillText('Magnitude · bins 0–1023', 8, 15);
    context.fillText('Phase · −π…π', 8, divider + 17);
};

const exactVector = (exactValue: AnalysisCursorValueResult | null): number[] =>
    Array.isArray(exactValue?.value) ? exactValue.value : [];

const cursorVector = (
    request: EditorRenderRequest,
    cursorSeconds: number,
    exactValue: AnalysisCursorValueResult | null,
): number[] => {
    const exact = exactVector(exactValue);
    if (exact.length > 0) return exact;
    const series = request.series;
    if (!series || (series.payload.kind !== 'frequency-u16' && series.payload.kind !== 'category-u16')) return [];
    return vectorAt(series.payload, cursorSampleIndex(series, cursorSeconds));
};

const drawLoudnessCursor = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    exactValue: AnalysisCursorValueResult | null,
) => {
    const value = exactValue?.value;
    if (
        !value ||
        Array.isArray(value) ||
        typeof value === 'number' ||
        !('specific' in value) ||
        value.specific.length !== 24
    )
        return;
    const panelWidth = Math.min(190, Math.max(120, width * 0.28));
    const left = width - panelWidth;
    const panelHeight = Math.floor(height * 0.68);
    const maximum = Math.max(0.000001, ...value.specific);
    context.fillStyle = 'rgba(2, 8, 5, 0.88)';
    context.fillRect(left, 0, panelWidth, panelHeight);
    const rowHeight = panelHeight / value.specific.length;
    value.specific.forEach((entry, index) => {
        const barWidth = Math.max(1, (entry / maximum) * (panelWidth - 34));
        const y = panelHeight - (index + 1) * rowHeight;
        context.fillStyle = '#7dffb3';
        context.fillRect(left + 30, y + 1, barWidth, Math.max(1, rowHeight - 2));
    });
};

const drawBufferCursor = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    values: readonly number[],
) => {
    const top = Math.floor(height * 0.7);
    const bottom = height - 4;
    const baseline = (top + bottom) / 2;
    const amplitude = (bottom - top) / 2 - 2;
    context.fillStyle = 'rgba(2, 8, 5, 0.86)';
    context.fillRect(0, top, width, bottom - top + 1);
    context.strokeStyle = '#7dffb3';
    context.beginPath();
    values.forEach((value, index) => {
        const x = (index / Math.max(1, values.length - 1)) * width;
        const y = baseline - Math.max(-1, Math.min(1, value)) * amplitude;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    });
    context.stroke();
};

const drawMfccCursor = (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    values: readonly number[],
) => {
    const top = Math.floor(height * 0.72);
    const bottom = height - 4;
    const baseline = (top + bottom) / 2;
    const maximum = signedVectorMaximum(values);
    const barWidth = width / Math.max(1, values.length);
    values.forEach((value, index) => {
        const barHeight = ((Math.abs(value) / maximum) * (bottom - top)) / 2;
        context.fillStyle = value < 0 ? '#b58cff' : '#7dffb3';
        context.fillRect(
            index * barWidth + 1,
            value < 0 ? baseline : baseline - barHeight,
            Math.max(1, barWidth - 2),
            barHeight,
        );
    });
};

export const analysisCanvasRenderer: EditorRendererAdapter = {
    drawStatic(request, context) {
        const { width, height } = size(request);
        drawGrid(context, width, height);
        if (!request.series) return;
        const left = Math.max(0, plotTimeX(0, request.viewport, width));
        const right = Math.min(width, plotTimeX(request.durationSeconds ?? Infinity, request.viewport, width));
        if (right <= left) return;
        context.save();
        context.beginPath();
        context.rect(left, 0, right - left, height);
        context.clip();
        try {
            if (request.feature.id === 'wallpaperEngineSpectrum') {
                drawWallpaperHeatmap(request, context);
                return;
            }
            switch (request.feature.outputShape) {
                case 'scalar':
                    drawScalar(request, context);
                    break;
                case 'waveform':
                    drawWaveform(request, context);
                    break;
                case 'loudness-structure':
                    drawLoudness(request, context);
                    break;
                case 'complex-spectrum':
                    drawComplex(request, context);
                    break;
                default:
                    drawHeatmap(request, context);
            }
        } finally {
            context.restore();
        }
    },
    drawCursor(request, cursorSeconds, exactValue, context) {
        const { width, height } = size(request);
        const x = timeToCanvasX(cursorSeconds, request.viewport, width);
        context.strokeStyle = '#ffffff';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, height);
        context.stroke();
        if (request.feature.outputShape === 'scalar') return;
        if (request.feature.id === 'wallpaperEngineSpectrum') {
            drawWallpaperCursor(request, cursorSeconds, exactValue, context);
            return;
        }
        if (request.feature.id === 'loudness') {
            drawLoudnessCursor(context, width, height, exactValue);
            return;
        }
        if (request.feature.id === 'complexSpectrum') return;
        const values = cursorVector(request, cursorSeconds, exactValue);
        if (values.length === 0) return;
        if (request.feature.id === 'buffer') {
            drawBufferCursor(context, width, height, values);
            return;
        }
        if (request.feature.id === 'mfcc') {
            drawMfccCursor(context, width, height, values);
            return;
        }
        const baseline = Math.floor(height * 0.72);
        const chartHeight = height - baseline - 6;
        const maximum = Math.max(0.000001, ...values.map(Math.abs));
        if (request.feature.id === 'chroma') {
            const barWidth = width / values.length;
            values.forEach((value, index) => {
                const barHeight = (chartHeight * Math.max(0, value)) / maximum;
                context.fillStyle = '#7dffb3';
                context.fillRect(index * barWidth + 1, height - barHeight - 3, Math.max(1, barWidth - 2), barHeight);
            });
            return;
        }
        context.strokeStyle = '#7dffb3';
        context.lineWidth = 1.5;
        context.beginPath();
        values.forEach((value, index) => {
            const px = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
            const py = height - 3 - (Math.max(0, value) / maximum) * chartHeight;
            if (index === 0) context.moveTo(px, py);
            else context.lineTo(px, py);
        });
        context.stroke();
    },
};
