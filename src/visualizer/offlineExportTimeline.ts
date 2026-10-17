import type { DecodedAudioDescriptor } from '../types/audio';
import type { VisualizerFrameRate } from './types';

export function exportTimeline(descriptor: DecodedAudioDescriptor, frameRate: VisualizerFrameRate) {
    if (!Number.isSafeInteger(descriptor.length) || descriptor.length <= 0
        || !Number.isFinite(descriptor.sampleRate) || descriptor.sampleRate <= 0) throw Error('无效的导出 PCM。');
    const durationSeconds = descriptor.length / descriptor.sampleRate;
    const durationUs = Math.round(durationSeconds * 1e6);
    const totalFrames = Math.ceil(descriptor.length * frameRate / descriptor.sampleRate);
    return {
        durationSeconds, totalFrames,
        frame(index: number) {
            if (!Number.isInteger(index) || index < 0 || index >= totalFrames) throw RangeError('Invalid export frame.');
            const timestampUs = Math.round(index * 1e6 / frameRate);
            const endUs = Math.min(durationUs, Math.round((index + 1) * 1e6 / frameRate));
            return { timeSeconds: index / frameRate, timestampUs, durationUs: endUs - timestampUs };
        },
    };
}
