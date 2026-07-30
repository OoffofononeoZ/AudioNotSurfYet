import {
    createDualTone,
    createHarmonicRich,
    createSine,
    SAMPLE_RATE,
    sha256Float32,
} from './audio-fixtures.ts';
import {
    ANALYSIS_CONFIG,
    extractFirstSlice,
    type FirstSliceResult,
} from './meyda-golden.ts';

export const M7_LEARNING_GENERATOR_VERSION = 'm7-learning-fixtures-v1';

export interface M7LearningFrame {
    id: string;
    learningSegment: 'L1' | 'L2' | 'L3';
    label: string;
    frame: Float32Array;
}

const rms = (samples: Float32Array): number =>
    Math.sqrt(
        samples.reduce((sum, sample) => sum + sample * sample, 0)
        / samples.length,
    );

const normalizeRms = (
    samples: Float32Array,
    targetRms: number,
): Float32Array => {
    const sourceRms = rms(samples);
    const scale = sourceRms <= 0 ? 0 : targetRms / sourceRms;
    return Float32Array.from(samples, (sample) => sample * scale);
};

export const createM7LearningFrames = (): M7LearningFrame[] => {
    const length = ANALYSIS_CONFIG.frameSize;
    const l3Sine = createSine(440, length, 0.35);
    const l3Rich = normalizeRms(
        createHarmonicRich(440, length, 0.7),
        rms(l3Sine),
    );
    return [
        {
            id: 'l1-a4-low',
            learningSegment: 'L1',
            label: 'A4 low level',
            frame: createSine(440, length, 0.15),
        },
        {
            id: 'l1-a4-high',
            learningSegment: 'L1',
            label: 'A4 high level',
            frame: createSine(440, length, 0.45),
        },
        {
            id: 'l2-c4-e4',
            learningSegment: 'L2',
            label: 'C4 + E4',
            frame: createDualTone(261.625565, 329.627557, length, 0.25),
        },
        {
            id: 'l2-g4-b4',
            learningSegment: 'L2',
            label: 'G4 + B4',
            frame: createDualTone(391.995436, 493.883301, length, 0.25),
        },
        {
            id: 'l3-a4-sine',
            learningSegment: 'L3',
            label: 'A4 sine',
            frame: l3Sine,
        },
        {
            id: 'l3-a4-harmonic-rich',
            learningSegment: 'L3',
            label: 'A4 harmonic rich',
            frame: l3Rich,
        },
    ];
};

export interface M7LearningGoldenCase {
    id: string;
    learningSegment: 'L1' | 'L2' | 'L3';
    label: string;
    fixtureHash: string;
    expected: FirstSliceResult;
}

export const buildM7LearningGolden = () => ({
    schemaVersion: 1,
    generatedAt: '2026-07-30',
    generatorVersion: M7_LEARNING_GENERATOR_VERSION,
    meydaVersion: '5.6.3',
    analysisConfig: ANALYSIS_CONFIG,
    cases: createM7LearningFrames().map((entry): M7LearningGoldenCase => ({
        id: entry.id,
        learningSegment: entry.learningSegment,
        label: entry.label,
        fixtureHash: sha256Float32(entry.frame),
        expected: extractFirstSlice(entry.frame),
    })),
});

const concatenate = (
    chunks: readonly Float32Array[],
): Float32Array => {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Float32Array(total);
    let offset = 0;
    chunks.forEach((chunk) => {
        output.set(chunk, offset);
        offset += chunk.length;
    });
    return output;
};

export const createM7LearningPcm = (): Float32Array => {
    const frames = createM7LearningFrames();
    const segmentLength = SAMPLE_RATE * 2;
    return concatenate(frames.map(({ frame }) => {
        const repeated = new Float32Array(segmentLength);
        for (let offset = 0; offset < segmentLength; offset += frame.length) {
            repeated.set(
                frame.subarray(0, Math.min(frame.length, segmentLength - offset)),
                offset,
            );
        }
        return repeated;
    }));
};

export const encodeMonoWav = (
    samples: Float32Array,
    sampleRate = SAMPLE_RATE,
): Uint8Array => {
    const bytesPerSample = 2;
    const dataLength = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    const writeAscii = (offset: number, value: string) => {
        for (let index = 0; index < value.length; index += 1) {
            view.setUint8(offset + index, value.charCodeAt(index));
        }
    };
    writeAscii(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeAscii(8, 'WAVE');
    writeAscii(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeAscii(36, 'data');
    view.setUint32(40, dataLength, true);
    samples.forEach((sample, index) => {
        const clipped = Math.max(-1, Math.min(1, sample));
        view.setInt16(
            44 + index * bytesPerSample,
            Math.round(clipped * (clipped < 0 ? 32768 : 32767)),
            true,
        );
    });
    return new Uint8Array(buffer);
};
