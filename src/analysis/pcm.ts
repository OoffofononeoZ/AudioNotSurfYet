import { createBudgetYield } from './taskScheduler';
import type { DecodedAudioDescriptor } from '../types/audio';

export interface DecodedAudioCopyPort {
    getDecodedAudioDescriptor(): DecodedAudioDescriptor | null;
    copyDecodedChannelRange(input: {
        revision: number;
        channel: number;
        start: number;
        length: number;
    }): Float32Array | null;
}

export class PcmCopyError extends Error {
    readonly code: 'empty-input' | 'length-mismatch' | 'stale';

    constructor(code: 'empty-input' | 'length-mismatch' | 'stale', message: string) {
        super(message);
        this.name = 'PcmCopyError';
        this.code = code;
    }
}

export const averageToMono = (channels: readonly Float32Array[]): Float32Array => {
    if (channels.length === 0) {
        throw new PcmCopyError('empty-input', 'At least one PCM channel is required.');
    }
    const length = channels[0]?.length ?? 0;
    if (length === 0) {
        throw new PcmCopyError('empty-input', 'PCM channels must not be empty.');
    }
    if (channels.some(channel => channel.length !== length)) {
        throw new PcmCopyError('length-mismatch', 'PCM channel lengths must match.');
    }
    if (channels.length === 1) {
        return new Float32Array(channels[0]!);
    }

    const mono = new Float32Array(length);
    for (const channel of channels) {
        for (let index = 0; index < length; index += 1) {
            mono[index] = (mono[index] ?? 0) + (channel[index] ?? 0);
        }
    }
    const divisor = channels.length;
    for (let index = 0; index < mono.length; index += 1) {
        mono[index] = (mono[index] ?? 0) / divisor;
    }
    return mono;
};

export const copyDecodedAudioToMono = async (
    engine: DecodedAudioCopyPort,
    options: {
        chunkSize?: number;
        yieldControl?: () => Promise<void>;
        stereo?: boolean;
        copyMono?: boolean;
        isCancelled?: () => boolean;
    } = {},
): Promise<{
    descriptor: DecodedAudioDescriptor;
    pcm: Float32Array;
    stereoPcm?: readonly [Float32Array, Float32Array];
}> => {
    const descriptor = engine.getDecodedAudioDescriptor();
    if (!descriptor || descriptor.length <= 0 || descriptor.channelCount <= 0) {
        throw new PcmCopyError('empty-input', 'Decoded audio is not available.');
    }
    const chunkSize = options.chunkSize ?? 16_384;
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
        throw new RangeError('PCM copy chunk size must be positive.');
    }
    const yieldControl = options.yieldControl ?? createBudgetYield();
    const pcm = new Float32Array(options.copyMono === false ? 0 : descriptor.length);
    const stereoPcm = options.stereo
        ? ([new Float32Array(descriptor.length), new Float32Array(descriptor.length)] as const)
        : undefined;

    for (let start = 0; start < descriptor.length; start += chunkSize) {
        if (options.isCancelled?.()) throw new PcmCopyError('stale', 'PCM copy cancelled.');
        const length = Math.min(chunkSize, descriptor.length - start);
        const accumulator = new Float32Array(length);
        const channels: Float32Array[] = [];
        for (let channel = 0; channel < descriptor.channelCount; channel += 1) {
            const values = engine.copyDecodedChannelRange({
                revision: descriptor.revision,
                channel,
                start,
                length,
            });
            if (!values) {
                throw new PcmCopyError('stale', 'Decoded audio changed while PCM was being copied.');
            }
            if (values.length !== length) {
                throw new PcmCopyError('length-mismatch', 'Decoded audio returned an unexpected channel length.');
            }
            if (stereoPcm) channels.push(values);
            for (let index = 0; options.copyMono !== false && index < length; index += 1) {
                accumulator[index] = (accumulator[index] ?? 0) + (values[index] ?? 0);
            }
        }
        const divisor = descriptor.channelCount;
        for (let index = 0; options.copyMono !== false && index < length; index += 1) {
            accumulator[index] = (accumulator[index] ?? 0) / divisor;
        }
        if (options.copyMono !== false) pcm.set(accumulator, start);
        if (stereoPcm) {
            const [left, right] = speakersToStereo(channels);
            stereoPcm[0].set(left, start);
            stereoPcm[1].set(right, start);
        }
        await yieldControl();
        const current = engine.getDecodedAudioDescriptor();
        if (!current || current.revision !== descriptor.revision) {
            throw new PcmCopyError('stale', 'Decoded audio changed while PCM was being copied.');
        }
    }

    return { descriptor, pcm, stereoPcm };
};

/** Web Audio speakers downmix: mono, stereo, quad and 5.1; other counts use discrete. */
export function speakersToStereo(channels: readonly Float32Array[]): readonly [Float32Array, Float32Array] {
    if (!channels.length || !channels[0]?.length || channels.some(c => c.length !== channels[0]!.length))
        throw new PcmCopyError('length-mismatch', 'PCM channels must have equal nonzero lengths.');
    const left = new Float32Array(channels[0]!),
        right = new Float32Array(channels[1] ?? channels[0]!);
    for (let i = 0; i < left.length; i++) {
        if (channels.length === 4) {
            left[i] = (channels[0]![i]! + channels[2]![i]!) * 0.5;
            right[i] = (channels[1]![i]! + channels[3]![i]!) * 0.5;
        } else if (channels.length === 6) {
            left[i] = channels[0]![i]! + Math.SQRT1_2 * (channels[2]![i]! + channels[4]![i]!);
            right[i] = channels[1]![i]! + Math.SQRT1_2 * (channels[2]![i]! + channels[5]![i]!);
        }
    }
    return [left, right];
}
