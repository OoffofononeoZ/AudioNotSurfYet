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
    readonly warning: string | null;
}
const AVAILABLE_WITH_FRAME_DROPS = { available: true, reason: null, warning: '首次录制可能短暂掉帧。' } as const;
// DEC-080 permits cadence warnings after timeline checks pass in both browsers.
// Genuine A/V drift remains unavailable; this is not a full smoothness claim.
const AVAILABILITY: Record<`${VisualizerResolution}-${VisualizerFrameRate}`, VisualizerRecordingAvailability> = {
    '720p-30': AVAILABLE_WITH_FRAME_DROPS,
    '720p-60': { available: false, reason: '该档位存在音画时间偏移，暂不可用。', warning: null },
    '1080p-30': { available: false, reason: '该档位存在音画时间偏移，暂不可用。', warning: null },
    '1080p-60': AVAILABLE_WITH_FRAME_DROPS,
};
export const getVisualizerRecordingAvailability = (
    resolution: VisualizerResolution,
    frameRate: VisualizerFrameRate,
): VisualizerRecordingAvailability => AVAILABILITY[`${resolution}-${frameRate}`];

export const isVisualizerRecordingPresetAvailable = (
    preset: VisualizerRecordingPreset,
    _userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): boolean => getVisualizerRecordingAvailability(preset.resolution, preset.frameRate).available;
