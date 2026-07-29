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

    constructor(
        code: 'empty-input' | 'length-mismatch' | 'stale',
        message: string,
    ) {
        super(message);
        this.name = 'PcmCopyError';
        this.code = code;
    }
}

export const averageToMono = (
    channels: readonly Float32Array[],
): Float32Array => {
    if (channels.length === 0) {
        throw new PcmCopyError(
            'empty-input',
            'At least one PCM channel is required.',
        );
    }
    const length = channels[0]?.length ?? 0;
    if (length === 0) {
        throw new PcmCopyError(
            'empty-input',
            'PCM channels must not be empty.',
        );
    }
    if (channels.some((channel) => channel.length !== length)) {
        throw new PcmCopyError(
            'length-mismatch',
            'PCM channel lengths must match.',
        );
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
    } = {},
): Promise<{
    descriptor: DecodedAudioDescriptor;
    pcm: Float32Array;
}> => {
    const descriptor = engine.getDecodedAudioDescriptor();
    if (!descriptor || descriptor.length <= 0 || descriptor.channelCount <= 0) {
        throw new PcmCopyError(
            'empty-input',
            'Decoded audio is not available.',
        );
    }
    const chunkSize = options.chunkSize ?? 16_384;
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
        throw new RangeError('PCM copy chunk size must be positive.');
    }
    const yieldControl = options.yieldControl
        ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
    const pcm = new Float32Array(descriptor.length);

    for (let start = 0; start < descriptor.length; start += chunkSize) {
        const length = Math.min(chunkSize, descriptor.length - start);
        const accumulator = new Float32Array(length);
        for (
            let channel = 0;
            channel < descriptor.channelCount;
            channel += 1
        ) {
            const values = engine.copyDecodedChannelRange({
                revision: descriptor.revision,
                channel,
                start,
                length,
            });
            if (!values) {
                throw new PcmCopyError(
                    'stale',
                    'Decoded audio changed while PCM was being copied.',
                );
            }
            if (values.length !== length) {
                throw new PcmCopyError(
                    'length-mismatch',
                    'Decoded audio returned an unexpected channel length.',
                );
            }
            for (let index = 0; index < length; index += 1) {
                accumulator[index] =
                    (accumulator[index] ?? 0) + (values[index] ?? 0);
            }
        }
        const divisor = descriptor.channelCount;
        for (let index = 0; index < length; index += 1) {
            accumulator[index] = (accumulator[index] ?? 0) / divisor;
        }
        pcm.set(accumulator, start);
        await yieldControl();
        const current = engine.getDecodedAudioDescriptor();
        if (!current || current.revision !== descriptor.revision) {
            throw new PcmCopyError(
                'stale',
                'Decoded audio changed while PCM was being copied.',
            );
        }
    }

    return { descriptor, pcm };
};
