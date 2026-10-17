import { speakersToStereo, type DecodedAudioCopyPort } from '../analysis/pcm';
import type { DecodedAudioDescriptor } from '../types/audio';
import { VisualizerExportError } from './exportTypes';

export function assertExportAudio(source: DecodedAudioCopyPort, expected: DecodedAudioDescriptor): void {
    const current = source.getDecodedAudioDescriptor();
    if (!current || current.trackId !== expected.trackId || current.revision !== expected.revision
        || current.length !== expected.length || current.sampleRate !== expected.sampleRate
        || current.channelCount !== expected.channelCount) throw new VisualizerExportError('identity-changed', '导出期间音频身份已变化。');
}

/** At most one second of source PCM is copied. Resampling is continuous in AudioSampleSource. */
export function exportAudioChunk(source: DecodedAudioCopyPort, descriptor: DecodedAudioDescriptor, start: number, length: number) {
    assertExportAudio(source, descriptor);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length <= 0
        || length > Math.ceil(descriptor.sampleRate) || start + length > descriptor.length) throw RangeError('Invalid export PCM range.');
    const channels = Array.from({ length: descriptor.channelCount }, (_, channel) => {
        const values = source.copyDecodedChannelRange({ revision: descriptor.revision, channel, start, length });
        if (!values || values.length !== length) throw new VisualizerExportError('identity-changed', '导出音频读取失效。');
        return values;
    });
    const [left, right] = speakersToStereo(channels);
    const data = new Float32Array(length * 2); data.set(left); data.set(right, length);
    return { data, format: 'f32-planar' as const, numberOfChannels: 2, sampleRate: descriptor.sampleRate,
        timestamp: Math.round(start * 1e6 / descriptor.sampleRate) / 1e6 };
}
