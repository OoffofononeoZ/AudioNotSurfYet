import Meyda from 'meyda';
import {
    createHarmonicRich,
    createSilence,
    createSine,
    SAMPLE_RATE,
    sha256Float32,
} from './audio-fixtures.ts';

export const M8_SCALAR_GENERATOR_VERSION = 'm8-scalars-fixtures-v1';

export const M8_SCALAR_FEATURE_IDS = [
    'zcr',
    'energy',
    'spectralCentroid',
    'spectralFlatness',
    'spectralFlux',
    'spectralSlope',
    'spectralRolloff',
    'spectralSpread',
    'spectralSkewness',
    'spectralKurtosis',
    'spectralCrest',
    'perceptualSpread',
    'perceptualSharpness',
] as const;
export type M8ScalarFeatureId = typeof M8_SCALAR_FEATURE_IDS[number];

export const M8_TEST_CONFIG = {
    schemaVersion: 1,
    frameSize: 1024,
    hopSize: 512,
    windowingFunction: 'hanning',
    numberOfMFCCCoefficients: 13,
    channelMode: 'average-mono',
    sampleRate: SAMPLE_RATE,
    configHash: 'fixture-only-config',
} as const;

export interface M8ScalarFrame {
    id: 'silence' | 'pure-tone' | 'harmonic-rich' | 'noise-transient';
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

const createDeterministicNoiseTransient = (
    length: number,
): Float32Array => {
    let state = 0x4d385631;
    const output = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        const noise = state / 0xffffffff * 2 - 1;
        output[index] = noise * 0.24;
    }
    output[Math.floor(length / 2)] = 0.95;
    return output;
};

export const createM8ScalarFrames = (): M8ScalarFrame[] => {
    const length = M8_TEST_CONFIG.frameSize;
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
            id: 'noise-transient',
            label: 'Deterministic noise with transient',
            frame: createDeterministicNoiseTransient(length),
        },
    ];
};

export interface M8ScalarGoldenCase {
    id: M8ScalarFrame['id'];
    label: string;
    fixtureHash: string;
    expected: Record<M8ScalarFeatureId, number>;
}

export const buildM8ScalarGolden = () => {
    let previousAmplitudeSpectrum: number[] | undefined;
    const cases = createM8ScalarFrames().map((entry): M8ScalarGoldenCase => {
        Meyda.bufferSize = M8_TEST_CONFIG.frameSize;
        Meyda.sampleRate = M8_TEST_CONFIG.sampleRate;
        Meyda.windowingFunction = M8_TEST_CONFIG.windowingFunction;
        Meyda.numberOfMFCCCoefficients =
            M8_TEST_CONFIG.numberOfMFCCCoefficients;
        const directFeatures = M8_SCALAR_FEATURE_IDS.filter(
            (featureId) => featureId !== 'spectralFlux',
        );
        const direct = Meyda.extract(
            [...directFeatures, 'amplitudeSpectrum'],
            entry.frame,
        );
        if (!direct?.amplitudeSpectrum) {
            throw new Error(`Meyda did not extract ${entry.id}.`);
        }
        const amplitudeSpectrum = Array.from(direct.amplitudeSpectrum);
        const zeroEnergy = direct.energy === 0;
        const expected = Object.fromEntries(M8_SCALAR_FEATURE_IDS.map(
            (featureId) => {
                if (zeroEnergy) return [featureId, 0];
                if (featureId === 'spectralFlux') {
                    if (!previousAmplitudeSpectrum) return [featureId, 0];
                    return [featureId, amplitudeSpectrum.reduce(
                        (sum, value, index) => sum + Math.max(
                            0,
                            value - (previousAmplitudeSpectrum?.[index] ?? 0),
                        ),
                        0,
                    )];
                }
                const value = direct[featureId];
                if (typeof value !== 'number' || !Number.isFinite(value)) {
                    throw new Error(`${featureId} was not finite for ${entry.id}.`);
                }
                return [featureId, value];
            },
        )) as Record<M8ScalarFeatureId, number>;
        previousAmplitudeSpectrum = amplitudeSpectrum;
        return {
            id: entry.id,
            label: entry.label,
            fixtureHash: sha256Float32(entry.frame),
            expected,
        };
    });
    return {
        schemaVersion: 1,
        generatedAt: '2026-08-21',
        generatorVersion: M8_SCALAR_GENERATOR_VERSION,
        meydaVersion: '5.6.3',
        fluxFormula: 'sum(max(0,currentAmplitude[k]-previousAmplitude[k]))',
        cases,
    };
};

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

export const createM8ScalarPcm = (): Float32Array => {
    const segmentLength = SAMPLE_RATE * 3;
    return concatenate(createM8ScalarFrames().map(({ frame }) => {
        const segment = new Float32Array(segmentLength);
        for (let offset = 0; offset < segment.length; offset += frame.length) {
            segment.set(
                frame.subarray(0, Math.min(frame.length, segment.length - offset)),
                offset,
            );
        }
        return segment;
    }));
};
