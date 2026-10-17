import type { VisualizerFrameRate, VisualizerResolution } from './types';
import type { VisualizerExportCapability, VisualizerExportPreset } from './exportTypes';

export const getVisualizerExportPreset = (resolution: VisualizerResolution, frameRate: VisualizerFrameRate): VisualizerExportPreset => ({
    resolution, frameRate, width: resolution === '720p' ? 1280 : 1920,
    height: resolution === '720p' ? 720 : 1080,
    videoBitsPerSecond: resolution === '720p' ? frameRate === 30 ? 6_000_000 : 9_000_000
        : frameRate === 30 ? 10_000_000 : 16_000_000,
    audioBitsPerSecond: 192_000,
});

/** Probe the same configuration that the offline encoder will use. No UA table. */
export async function probeVisualizerExport(preset: VisualizerExportPreset): Promise<VisualizerExportCapability> {
    const no = (reason: string): VisualizerExportCapability => ({ available: false, codec: null, reason });
    if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') return no('当前浏览器不支持离线音视频编码，请使用最新版 Chrome 或 Edge。');
    if (!navigator.storage?.getDirectory || !navigator.locks) return no('当前浏览器不支持导出所需的临时文件存储。');
    try {
        await navigator.storage.getDirectory();
        const { canEncodeVideo, canEncodeAudio, Quality } = await import('mediabunny');
        if (!await canEncodeAudio('opus', { sampleRate: 48000, numberOfChannels: 2, quality: new Quality({ bitrate: preset.audioBitsPerSecond }) })) return no('当前浏览器不能编码 Opus 音轨。');
        for (const codec of ['vp9', 'vp8'] as const) {
            if (await canEncodeVideo(codec, { width: preset.width, height: preset.height,
                quality: new Quality({ bitrate: preset.videoBitsPerSecond }), frameRate: preset.frameRate,
                latencyMode: 'quality', hardwareAcceleration: 'no-preference' })) {
                return { available: true, codec, reason: null };
            }
        }
        return no('当前设备不支持此分辨率与帧率的离线编码。');
    } catch (error) { return no(error instanceof Error ? error.message : '无法检查离线导出能力。'); }
}
