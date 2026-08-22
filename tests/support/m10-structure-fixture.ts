import Meyda from 'meyda';
import {
    createImpulse,
    createSilence,
    createSine,
    SAMPLE_RATE,
    sha256Float32,
} from './audio-fixtures.ts';

export const M10_STRUCTURE_GENERATOR_VERSION = 'm10-structures-fixtures-v1';

export const M10_TEST_CONFIG = {
    schemaVersion: 1,
    frameSize: 1024,
    hopSize: 512,
    windowingFunction: 'hanning',
    numberOfMFCCCoefficients: 13,
    channelMode: 'average-mono',
    sampleRate: SAMPLE_RATE,
    configHash: 'm10-fixture-only-config',
} as const;

export interface M10StructureFrame {
    id:
        | 'silence'
        | 'low-tone'
        | 'high-tone'
        | 'phase-zero'
        | 'phase-quarter'
        | 'positive-impulse'
        | 'negative-impulse';
    label: string;
    frame: Float32Array;
}

export const createM10StructureFrames = (): M10StructureFrame[] => {
    const length = M10_TEST_CONFIG.frameSize;
    return [
        { id: 'silence', label: 'Silence', frame: createSilence(length) },
        {
            id: 'low-tone',
            label: '220 Hz tone',
            frame: createSine(220, length, 0.35),
        },
        {
            id: 'high-tone',
            label: '4 kHz tone at matched amplitude',
            frame: createSine(4_000, length, 0.35),
        },
        {
            id: 'phase-zero',
            label: '440 Hz tone at phase 0',
            frame: createSine(440, length, 0.35, 0),
        },
        {
            id: 'phase-quarter',
            label: '440 Hz tone at phase pi over two',
            frame: createSine(440, length, 0.35, Math.PI / 2),
        },
        {
            id: 'positive-impulse',
            label: 'Positive impulse',
            frame: createImpulse(length, 256, 0.8),
        },
        {
            id: 'negative-impulse',
            label: 'Negative impulse',
            frame: createImpulse(length, 256, -0.8),
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

export const buildM10StructureGolden = () => ({
    schemaVersion: 1,
    generatedAt: '2026-08-23',
    generatorVersion: M10_STRUCTURE_GENERATOR_VERSION,
    meydaVersion: '5.6.3',
    analysisConfig: M10_TEST_CONFIG,
    cases: createM10StructureFrames().map((entry) => {
        Meyda.bufferSize = M10_TEST_CONFIG.frameSize;
        Meyda.sampleRate = M10_TEST_CONFIG.sampleRate;
        Meyda.windowingFunction = M10_TEST_CONFIG.windowingFunction;
        Meyda.numberOfMFCCCoefficients =
            M10_TEST_CONFIG.numberOfMFCCCoefficients;
        const result = Meyda.extract([
            'loudness',
            'complexSpectrum',
        ], entry.frame);
        if (!result) throw new Error(`Meyda did not extract ${entry.id}.`);
        const loudness = result.loudness as {
            total?: unknown;
            specific?: unknown;
        };
        const complex = result.complexSpectrum as {
            real?: unknown;
            imag?: unknown;
        };
        if (typeof loudness?.total !== 'number' || !Number.isFinite(loudness.total)) {
            throw new Error(`${entry.id}.loudness.total was not finite.`);
        }
        return {
            id: entry.id,
            label: entry.label,
            fixtureHash: sha256Float32(entry.frame),
            expected: {
                loudness: {
                    total: Object.is(loudness.total, -0) ? 0 : loudness.total,
                    specific: finiteVector(
                        loudness.specific,
                        24,
                        `${entry.id}.loudness.specific`,
                    ),
                },
                complexSpectrum: {
                    real: finiteVector(
                        complex.real,
                        M10_TEST_CONFIG.frameSize,
                        `${entry.id}.complexSpectrum.real`,
                    ),
                    imag: finiteVector(
                        complex.imag,
                        M10_TEST_CONFIG.frameSize,
                        `${entry.id}.complexSpectrum.imag`,
                    ),
                },
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

export const createM10StructurePcm = (): Float32Array => {
    const segmentLength = SAMPLE_RATE;
    return concatenate(createM10StructureFrames().map(({ frame }) => {
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
