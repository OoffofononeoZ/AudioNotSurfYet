import type { DecodedAudioCopyPort } from '../analysis/pcm';
import { analysisFrameCount, cursorFrameIndex } from '../analysis/frames';

export const WAVEFORM_FRAME_SIZE = 1024;
const HOP_SIZE = 512;
const CACHE_FRAMES = 16;
// Float32 coefficients match Meyda's hanning window exactly, without running an FFT.
const HANNING_WINDOW = Float32Array.from({ length: WAVEFORM_FRAME_SIZE }, (_, i) =>
    .5 - .5 * Math.cos(2 * Math.PI * i / (WAVEFORM_FRAME_SIZE - 1)));

/** Bounded reads from the existing decoded buffer, owned by AudioEngine. */
export class VisualizerWaveformSource {
    private identity = '';
    private frames = new Map<number, readonly number[]>();
    private readonly source: DecodedAudioCopyPort;
    constructor(source: DecodedAudioCopyPort) { this.source = source; }
    reset() { this.identity = ''; this.frames.clear(); }

    read(trackId: string, timeSeconds: number): readonly number[] | null {
        const descriptor = this.source.getDecodedAudioDescriptor();
        if (!descriptor || descriptor.trackId !== trackId || descriptor.length <= 0 || descriptor.channelCount <= 0) {
            this.reset();
            return null;
        }
        const identity = [trackId, descriptor.revision, descriptor.sampleRate, descriptor.length, descriptor.channelCount].join(':');
        if (identity !== this.identity) { this.reset(); this.identity = identity; }
        const config = { frameSize: WAVEFORM_FRAME_SIZE, hopSize: HOP_SIZE, sampleRate: descriptor.sampleRate } as const;
        const index = cursorFrameIndex(timeSeconds, descriptor.durationSeconds,
            analysisFrameCount(descriptor.length, config.frameSize, config.hopSize), config);
        const cached = this.frames.get(index);
        if (cached) {
            this.frames.delete(index); this.frames.set(index, cached);
            return cached;
        }
        const start = index * HOP_SIZE, length = Math.min(WAVEFORM_FRAME_SIZE, descriptor.length - start);
        const mono = new Float32Array(WAVEFORM_FRAME_SIZE);
        for (let channel = 0; channel < descriptor.channelCount; channel++) {
            const values = this.source.copyDecodedChannelRange({ revision: descriptor.revision, channel, start, length });
            if (!values) { this.reset(); return null; }
            if (values.length !== length) throw new Error('波形帧长度不匹配。');
            for (let i = 0; i < length; i++) mono[i] = mono[i]! + values[i]!;
        }
        const current = this.source.getDecodedAudioDescriptor();
        if (!current || current.trackId !== trackId || current.revision !== descriptor.revision) {
            this.reset(); return null;
        }
        const frame = Array.from(mono, (value, i) => Math.fround(value / descriptor.channelCount) * HANNING_WINDOW[i]!);
        this.frames.set(index, frame);
        if (this.frames.size > CACHE_FRAMES) this.frames.delete(this.frames.keys().next().value!);
        return frame;
    }
}
