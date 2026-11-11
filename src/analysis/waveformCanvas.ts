import type { PlotColumn } from './renderGeometry';

export const WAVEFORM_COLOR = '#65ffa9';
export const WAVEFORM_OPACITY = 0.9;
export const WAVEFORM_VERTICAL_PADDING_PX = 6;
export interface WaveformVerticalGeometry {
    centerY: number;
    amplitude: number;
    padding: number;
}
export function waveformVerticalGeometry(height: number): WaveformVerticalGeometry {
    const safe = Number.isFinite(height) ? Math.max(0, height) : 0;
    return {
        centerY: safe / 2,
        amplitude: Math.max(0, (safe - WAVEFORM_VERTICAL_PADDING_PX * 2) / 2),
        padding: WAVEFORM_VERTICAL_PADDING_PX,
    };
}

export function drawWaveformBackdrop(context: CanvasRenderingContext2D, width: number, height: number) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(12, 35, 23, 0.9)');
    gradient.addColorStop(1, 'rgba(2, 8, 5, 0.96)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(101, 255, 169, 0.14)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();
}

/** Shared visual style; caller supplies true-time cells and the correct value semantics. */
export function drawWaveformColumns(
    context: CanvasRenderingContext2D,
    columns: PlotColumn[],
    height: number,
    dpr: number,
    peak: (column: PlotColumn) => { min: number; max: number },
    maximum = 1,
) {
    const { centerY, amplitude } = waveformVerticalGeometry(height);
    const toY = (value: number) => centerY - Math.max(-1, Math.min(1, value / maximum)) * amplitude;
    context.save();
    context.strokeStyle = WAVEFORM_COLOR;
    context.globalAlpha = WAVEFORM_OPACITY;
    context.lineCap = 'butt';
    for (const column of columns) {
        const value = peak(column),
            x = (column.left + column.right) / 2;
        context.lineWidth = Math.max(1 / dpr, column.right - column.left);
        context.beginPath();
        context.moveTo(x, toY(value.max));
        context.lineTo(x, toY(value.min));
        context.stroke();
    }
    context.restore();
}
