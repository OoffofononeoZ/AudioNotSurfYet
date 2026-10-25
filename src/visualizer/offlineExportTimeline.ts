import type { DecodedAudioDescriptor } from '../types/audio';
import type { VisualizerFrameRate } from './types';
import { isAudioVideoOffsetMs } from './exportTypes';

export function exportTimeline(
    descriptor: DecodedAudioDescriptor,
    frameRate: VisualizerFrameRate,
    audioVideoOffsetMs = 0,
) {
    if (
        !Number.isSafeInteger(descriptor.length) ||
        descriptor.length <= 0 ||
        !Number.isFinite(descriptor.sampleRate) ||
        descriptor.sampleRate <= 0
    )
        throw Error('无效的导出 PCM。');
    if (!isAudioVideoOffsetMs(audioVideoOffsetMs)) throw RangeError('无效的音画同步补偿。');
    const sourceFrames = Math.ceil((descriptor.length * frameRate) / descriptor.sampleRate);
    const lastSourceTime = (sourceFrames - 1) / frameRate;
    const videoStartSeconds = Math.max(-audioVideoOffsetMs, 0) / 1000;
    const audioStartSample = Math.round((Math.max(audioVideoOffsetMs, 0) * descriptor.sampleRate) / 1000);
    const totalAudioSamples =
        descriptor.length + Math.round((Math.abs(audioVideoOffsetMs) * descriptor.sampleRate) / 1000);
    const durationSeconds = descriptor.length / descriptor.sampleRate + Math.abs(audioVideoOffsetMs) / 1000;
    const durationUs = Math.round(durationSeconds * 1e6);
    const totalFrames = Math.ceil(
        ((descriptor.length + (Math.abs(audioVideoOffsetMs) * descriptor.sampleRate) / 1000) * frameRate) /
            descriptor.sampleRate,
    );
    return {
        durationSeconds,
        totalFrames,
        audioStartSample,
        totalAudioSamples,
        frame(index: number) {
            if (!Number.isInteger(index) || index < 0 || index >= totalFrames)
                throw RangeError('Invalid export frame.');
            const timestampUs = Math.round((index * 1e6) / frameRate);
            const endUs = Math.min(durationUs, Math.round(((index + 1) * 1e6) / frameRate));
            const timeSeconds = Math.max(0, Math.min(lastSourceTime, index / frameRate - videoStartSeconds));
            return { timeSeconds, timestampUs, durationUs: endUs - timestampUs };
        },
    };
}
