import Meyda from 'meyda';

export const ANALYSIS_CONFIG = {
    sampleRate: 48_000,
    frameSize: 1_024,
    hopSize: 512,
    windowingFunction: 'hanning',
    numberOfMFCCCoefficients: 13,
    channelMode: 'average-mono',
} as const;

export const FIRST_SLICE_FEATURES = ['rms', 'amplitudeSpectrum', 'chroma'] as const;

export interface FirstSliceResult {
    rms: number;
    amplitudeSpectrum: number[];
    chroma: number[];
}

export function extractFirstSlice(frame: Float32Array): FirstSliceResult {
    if (frame.length !== ANALYSIS_CONFIG.frameSize) {
        throw new RangeError(
            `Expected frame length ${ANALYSIS_CONFIG.frameSize}, received ${frame.length}`,
        );
    }

    Meyda.bufferSize = ANALYSIS_CONFIG.frameSize;
    Meyda.sampleRate = ANALYSIS_CONFIG.sampleRate;
    Meyda.windowingFunction = ANALYSIS_CONFIG.windowingFunction;
    Meyda.numberOfMFCCCoefficients = ANALYSIS_CONFIG.numberOfMFCCCoefficients;

    const result = Meyda.extract([...FIRST_SLICE_FEATURES], frame);
    if (
        !result
        || typeof result.rms !== 'number'
        || !result.amplitudeSpectrum
        || !result.chroma
    ) {
        throw new Error('Meyda did not return the first-slice result');
    }

    return {
        rms: result.rms,
        amplitudeSpectrum: Array.from(result.amplitudeSpectrum),
        chroma: Array.from(result.chroma),
    };
}
