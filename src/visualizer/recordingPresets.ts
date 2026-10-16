import type {
    VisualizerFrameRate,
    VisualizerResolution,
} from './types';

export interface VisualizerRecordingPreset {
    readonly resolution: VisualizerResolution;
    readonly frameRate: VisualizerFrameRate;
    readonly width: number;
    readonly height: number;
    readonly videoBitsPerSecond: number;
    readonly audioBitsPerSecond: 192_000;
}

export const VISUALIZER_RECORDING_MIME_TYPES = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
] as const;

const PRESETS: Record<
    `${VisualizerResolution}-${VisualizerFrameRate}`,
    VisualizerRecordingPreset
> = {
    '720p-30': {
        resolution: '720p',
        frameRate: 30,
        width: 1280,
        height: 720,
        videoBitsPerSecond: 6_000_000,
        audioBitsPerSecond: 192_000,
    },
    '720p-60': {
        resolution: '720p',
        frameRate: 60,
        width: 1280,
        height: 720,
        videoBitsPerSecond: 9_000_000,
        audioBitsPerSecond: 192_000,
    },
    '1080p-30': {
        resolution: '1080p',
        frameRate: 30,
        width: 1920,
        height: 1080,
        videoBitsPerSecond: 10_000_000,
        audioBitsPerSecond: 192_000,
    },
    '1080p-60': {
        resolution: '1080p',
        frameRate: 60,
        width: 1920,
        height: 1080,
        videoBitsPerSecond: 16_000_000,
        audioBitsPerSecond: 192_000,
    },
};

export const getVisualizerRecordingPreset = (
    resolution: VisualizerResolution,
    frameRate: VisualizerFrameRate,
): VisualizerRecordingPreset => PRESETS[`${resolution}-${frameRate}`];

export const selectVisualizerRecordingMimeType = (
    isTypeSupported: (mimeType: string) => boolean,
): string | null => VISUALIZER_RECORDING_MIME_TYPES.find(isTypeSupported) ?? null;

export interface VisualizerRecordingAvailability {
    readonly available: boolean;
    readonly reason: string | null;
}
const UNVERIFIED = { available: false, reason: '该档位尚未通过录制稳定性验证。' } as const;
// Keep the established default. Optional profiles need both browsers to pass,
// including the first recording in a fresh browser, before being enabled.
const AVAILABILITY: Record<`${VisualizerResolution}-${VisualizerFrameRate}`, VisualizerRecordingAvailability> = {
    '720p-30': { available: true, reason: null },
    '720p-60': UNVERIFIED,
    '1080p-30': UNVERIFIED,
    '1080p-60': UNVERIFIED,
};
export const getVisualizerRecordingAvailability = (
    resolution: VisualizerResolution,
    frameRate: VisualizerFrameRate,
): VisualizerRecordingAvailability => AVAILABILITY[`${resolution}-${frameRate}`];

export const isReliableVisualizerRecordingPreset = (
    preset: VisualizerRecordingPreset,
    _userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): boolean => getVisualizerRecordingAvailability(preset.resolution, preset.frameRate).available;
