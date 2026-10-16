import type { AnalysisConfig } from './types';

export const analysisFrameCount = (
    pcmLength: number,
    frameSize = 1024,
    hopSize = 512,
): number => {
    if (
        !Number.isInteger(pcmLength)
        || pcmLength < 0
        || !Number.isInteger(frameSize)
        || frameSize <= 0
        || !Number.isInteger(hopSize)
        || hopSize <= 0
    ) {
        throw new RangeError('Invalid PCM or frame configuration.');
    }
    return Math.max(
        1,
        1 + Math.ceil((pcmLength - frameSize) / hopSize),
    );
};

export const createAnalysisFrame = (
    pcm: Float32Array,
    frameIndex: number,
    config: Pick<AnalysisConfig, 'frameSize' | 'hopSize'>,
): Float32Array => {
    const count = analysisFrameCount(
        pcm.length,
        config.frameSize,
        config.hopSize,
    );
    if (
        !Number.isInteger(frameIndex)
        || frameIndex < 0
        || frameIndex >= count
    ) {
        throw new RangeError(`Frame index ${frameIndex} is out of range.`);
    }
    const start = frameIndex * config.hopSize;
    const frame = new Float32Array(config.frameSize);
    frame.set(pcm.subarray(start, start + config.frameSize));
    return frame;
};

export const frameStartSeconds = (
    frameIndex: number,
    config: Pick<AnalysisConfig, 'hopSize' | 'sampleRate'>,
): number => frameIndex * config.hopSize / config.sampleRate;

export const cursorFrameIndex = (
    timeSeconds: number,
    durationSeconds: number,
    totalFrames: number,
    config: Pick<AnalysisConfig, 'hopSize' | 'sampleRate'>,
): number => {
    if (
        !Number.isFinite(timeSeconds)
        || !Number.isFinite(durationSeconds)
        || durationSeconds < 0
        || !Number.isInteger(totalFrames)
        || totalFrames <= 0
    ) {
        throw new RangeError('Invalid cursor frame request.');
    }
    if (timeSeconds >= durationSeconds) return totalFrames - 1;
    const clamped = Math.max(0, timeSeconds);
    return Math.min(
        totalFrames - 1,
        Math.floor(clamped * config.sampleRate / config.hopSize),
    );
};

export const analysisAggregationFactor = (
    sampleRate: number,
    hopSize: number,
): number => Math.max(1, Math.ceil(sampleRate / (hopSize * 30)));
