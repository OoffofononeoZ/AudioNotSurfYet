import Meyda from 'meyda';
import {
    createHarmonicRich,
    createSilence,
    createSine,
    SAMPLE_RATE,
    sha256Float32,
} from './audio-fixtures.ts';

export const M9_VECTOR_GENERATOR_VERSION = 'm9-vectors-fixtures-v1';

export const M9_TEST_CONFIG = {
    schemaVersion: 1,
    frameSize: 1024,
    hopSize: 512,
    windowingFunction: 'hanning',
    numberOfMFCCCoefficients: 13,
    channelMode: 'average-mono',
    sampleRate: SAMPLE_RATE,
    configHash: 'm9-fixture-only-config',
} as const;

export interface M9VectorFrame {
    id: 'silence' | 'pure-tone' | 'harmonic-rich' | 'noise-impulse';
    label: string;
    frame: Float32Array;
}

const rms = (samples: Float32Array): number => Math.sqrt(
    samples.reduce((sum, sample) => sum + sample * sample, 0)
    / samples.length,
);

const normalizeRms = (
    samples: Float32Array,
    target: number,
): Float32Array => {
    const source = rms(samples);
    return Float32Array.from(
        samples,
        (sample) => source === 0 ? 0 : sample * target / source,
    );
};

const createNoiseImpulse = (length: number): Float32Array => {
    let state = 0x4d395631;
    const output = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        output[index] = (state / 0xffffffff * 2 - 1) * 0.18;
    }
    output[Math.floor(length / 3)] = 0.92;
    output[Math.floor(length * 2 / 3)] = -0.88;
    return output;
};

export const createM9VectorFrames = (): M9VectorFrame[] => {
    const length = M9_TEST_CONFIG.frameSize;
    const pure = createSine(440, length, 0.35);
    return [
        { id: 'silence', label: 'Silence', frame: createSilence(length) },
        { id: 'pure-tone', label: 'A4 pure tone', frame: pure },
        {
            id: 'harmonic-rich',
            label: 'A4 harmonic rich at matched RMS',
            frame: normalizeRms(
                createHarmonicRich(440, length, 0.7),
                rms(pure),
            ),
        },
        {
            id: 'noise-impulse',
            label: 'Deterministic noise with positive and negative impulses',
            frame: createNoiseImpulse(length),
        },
    ];
};

const finiteVector = (
    value: unknown,
    width: number,
    label: string,
): number[] => {
    if (!(value instanceof Float32Array) && !Array.isArray(value)) {
        throw new Error(`${label} did not return a vector.`);
    }
    const output = Array.from(value);
    if (output.length !== width || output.some((entry) => !Number.isFinite(entry))) {
        throw new Error(`${label} returned invalid dimensions.`);
    }
    return output.map((entry) => Object.is(entry, -0) ? 0 : entry);
};

export const buildM9VectorGolden = () => ({
    schemaVersion: 1,
    generatedAt: '2026-08-21',
    generatorVersion: M9_VECTOR_GENERATOR_VERSION,
    meydaVersion: '5.6.3',
    analysisConfig: M9_TEST_CONFIG,
    cases: createM9VectorFrames().map((entry) => {
        Meyda.bufferSize = M9_TEST_CONFIG.frameSize;
        Meyda.sampleRate = M9_TEST_CONFIG.sampleRate;
        Meyda.windowingFunction = M9_TEST_CONFIG.windowingFunction;
        Meyda.numberOfMFCCCoefficients =
            M9_TEST_CONFIG.numberOfMFCCCoefficients;
        const result = Meyda.extract([
            'amplitudeSpectrum',
            'powerSpectrum',
            'mfcc',
            'buffer',
        ], entry.frame);
        if (!result) throw new Error(`Meyda did not extract ${entry.id}.`);
        return {
            id: entry.id,
            label: entry.label,
            fixtureHash: sha256Float32(entry.frame),
            expected: {
                amplitudeSpectrum: finiteVector(
                    result.amplitudeSpectrum,
                    M9_TEST_CONFIG.frameSize / 2,
                    `${entry.id}.amplitudeSpectrum`,
                ),
                powerSpectrum: finiteVector(
                    result.powerSpectrum,
                    M9_TEST_CONFIG.frameSize / 2,
                    `${entry.id}.powerSpectrum`,
                ),
                mfcc: finiteVector(
                    result.mfcc,
                    M9_TEST_CONFIG.numberOfMFCCCoefficients,
                    `${entry.id}.mfcc`,
                ),
                buffer: finiteVector(
                    result.buffer,
                    M9_TEST_CONFIG.frameSize,
                    `${entry.id}.buffer`,
                ),
            },
        };
    }),
});

const concatenate = (chunks: readonly Float32Array[]): Float32Array => {
    const output = new Float32Array(
        chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
    }
    return output;
};

export const createM9VectorPcm = (): Float32Array => {
    const segmentLength = SAMPLE_RATE * 2;
    const segments = createM9VectorFrames().map(({ frame }) => {
        const segment = new Float32Array(segmentLength);
        for (let offset = 0; offset < segment.length; offset += frame.length) {
            segment.set(
                frame.subarray(0, Math.min(frame.length, segment.length - offset)),
                offset,
            );
        }
        return segment;
    });
    const tail = new Float32Array(333);
    tail[0] = 0.8;
    tail[166] = -0.9;
    tail[332] = 0.7;
    return concatenate([...segments, tail]);
};
