import type { VisualizerFrameRate, VisualizerResolution } from './types';

export const AUDIO_VIDEO_OFFSET_MS = { min: -500, max: 1000, step: 10 } as const;
export function isAudioVideoOffsetMs(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= AUDIO_VIDEO_OFFSET_MS.min &&
        value <= AUDIO_VIDEO_OFFSET_MS.max &&
        value % AUDIO_VIDEO_OFFSET_MS.step === 0
    );
}

export interface VisualizerExportPreset {
    readonly resolution: VisualizerResolution;
    readonly frameRate: VisualizerFrameRate;
    readonly width: number;
    readonly height: number;
    readonly videoBitsPerSecond: number;
    readonly audioBitsPerSecond: 192_000;
}
export type ExportVideoCodec = 'vp9' | 'vp8';
export interface VisualizerExportCapability {
    readonly available: boolean;
    readonly codec: ExportVideoCodec | null;
    readonly reason: string | null;
}
export type VisualizerExportErrorCode =
    | 'export-busy'
    | 'output-pending'
    | 'track-mismatch'
    | 'analysis-not-ready'
    | 'binding-invalid'
    | 'renderer-unavailable'
    | 'context-lost'
    | 'export-unsupported'
    | 'storage-unavailable'
    | 'storage-full'
    | 'encode-failed'
    | 'identity-changed'
    | 'empty-output';
export class VisualizerExportError extends Error {
    readonly code: VisualizerExportErrorCode;
    constructor(code: VisualizerExportErrorCode, message: string) {
        super(message);
        this.name = 'VisualizerExportError';
        this.code = code;
    }
}
export type VisualizerExportState =
    | { status: 'idle' }
    | { status: 'preparing' }
    | { status: 'exporting'; framesDone: number; totalFrames: number }
    | { status: 'finalizing' }
    | { status: 'ready'; mimeType: string; byteLength: number }
    | { status: 'error'; code: VisualizerExportErrorCode; message: string };

export const checkExportCancelled = (signal: AbortSignal): void => signal.throwIfAborted();
