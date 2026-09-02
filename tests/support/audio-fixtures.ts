import { createHash } from 'node:crypto';

export const SAMPLE_RATE = 48_000;
export const FORMAT_MASTER_DURATION_SECONDS = 4;
export const FORMAT_MASTER_SAMPLE_COUNT = SAMPLE_RATE * FORMAT_MASTER_DURATION_SECONDS;
export const GENERATOR_VERSION = 'm3-audio-fixtures-v1';
export const VISUALIZER_V3_DURATION_SECONDS = 6;
export const VISUALIZER_V3_SAMPLE_COUNT = SAMPLE_RATE * VISUALIZER_V3_DURATION_SECONDS;
export const VISUALIZER_V3_GENERATOR_VERSION = 'visualizer-v3-lines-fixture-v1';
export const VISUALIZER_V4_DURATION_SECONDS = 6;
export const VISUALIZER_V4_SAMPLE_COUNT = SAMPLE_RATE * VISUALIZER_V4_DURATION_SECONDS;
export const VISUALIZER_V4_GENERATOR_VERSION = 'visualizer-v4-cube-swarm-fixture-v1';

const TAU = Math.PI * 2;

export function createSilence(length = 4_096): Float32Array {
    return new Float32Array(length);
}

export function createSine(
    frequencyHz: number,
    length = 4_096,
    amplitude = 0.5,
    phaseRadians = 0,
): Float32Array {
    const output = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
        output[index] = amplitude * Math.sin(TAU * frequencyHz * index / SAMPLE_RATE + phaseRadians);
    }
    return output;
}

export function createDualTone(
    firstFrequencyHz: number,
    secondFrequencyHz: number,
    length = 4_096,
    amplitudePerTone = 0.25,
): Float32Array {
    const output = new Float32Array(length);
    for (let index = 0; index < length; index += 1) {
        const time = index / SAMPLE_RATE;
        output[index] = amplitudePerTone * (
            Math.sin(TAU * firstFrequencyHz * time)
            + Math.sin(TAU * secondFrequencyHz * time)
        );
    }
    return output;
}

export function createImpulse(length: number, position: number, amplitude = 1): Float32Array {
    if (position < 0 || position >= length) {
        throw new RangeError(`Impulse position ${position} is outside 0..${length - 1}`);
    }
    const output = new Float32Array(length);
    output[position] = amplitude;
    return output;
}

export function createHarmonicRich(
    fundamentalHz: number,
    length: number,
    peakAmplitude = 0.5,
): Float32Array {
    const output = new Float32Array(length);
    const harmonicWeightSum = 1 + 1 / 2 + 1 / 3 + 1 / 4 + 1 / 5;
    for (let index = 0; index < length; index += 1) {
        const time = index / SAMPLE_RATE;
        let sample = 0;
        for (let harmonic = 1; harmonic <= 5; harmonic += 1) {
            sample += Math.sin(TAU * fundamentalHz * harmonic * time) / harmonic;
        }
        output[index] = peakAmplitude * sample / harmonicWeightSum;
    }
    return output;
}

export function createFormatMaster(): Float32Array {
    const output = new Float32Array(FORMAT_MASTER_SAMPLE_COUNT);
    const sineStart = Math.round(0.5 * SAMPLE_RATE);
    const dualStart = Math.round(1.5 * SAMPLE_RATE);
    const harmonicStart = Math.round(2.5 * SAMPLE_RATE);

    output.set(createSine(440, dualStart - sineStart, 0.25), sineStart);
    output.set(createDualTone(261.625565, 329.627557, harmonicStart - dualStart, 0.25), dualStart);
    output.set(
        createHarmonicRich(440, FORMAT_MASTER_SAMPLE_COUNT - harmonicStart, 0.5),
        harmonicStart,
    );
    return output;
}

export function createVisualizerV3LinesFixture(): Float32Array {
    const output = new Float32Array(VISUALIZER_V3_SAMPLE_COUNT);
    const addTone = (
        startSeconds: number,
        endSeconds: number,
        frequencyHz: number,
        amplitude: number,
    ) => {
        const start = Math.round(startSeconds * SAMPLE_RATE);
        const end = Math.round(endSeconds * SAMPLE_RATE);
        const tone = createSine(frequencyHz, end - start, amplitude);
        for (let index = start; index < end; index += 1) {
            output[index] = Math.max(-1, Math.min(1, output[index]! + tone[index - start]!));
        }
    };
    const addImpulse = (seconds: number, amplitude = 0.9) => {
        const position = Math.min(output.length - 1, Math.round(seconds * SAMPLE_RATE));
        output[position] = Math.max(-1, Math.min(1, output[position]! + amplitude));
    };

    addTone(0, 0.5, 220, 0.2);
    addTone(0.5, 2, 440, 0.35);
    addTone(2, 3, 330, 0.28);
    addTone(3, 4, 550, 0.32);
    addTone(4, 5.5, 440, 0.25);
    addTone(4, 5.5, 660, 0.18);
    addImpulse(0.02);
    addImpulse(1);
    addImpulse(2.5);
    addImpulse(3);
    addImpulse(4);
    addImpulse(5.98);
    return output;
}

export function createVisualizerV4CubeSwarmFixture(): Float32Array {
    const output = new Float32Array(VISUALIZER_V4_SAMPLE_COUNT);
    const addTone = (
        startSeconds: number,
        endSeconds: number,
        frequencyHz: number,
        amplitude: number,
    ) => {
        const start = Math.round(startSeconds * SAMPLE_RATE);
        const end = Math.round(endSeconds * SAMPLE_RATE);
        const tone = createSine(frequencyHz, end - start, amplitude);
        for (let index = start; index < end; index += 1) {
            output[index] = Math.max(-1, Math.min(1, output[index]! + tone[index - start]!));
        }
    };
    const addImpulse = (seconds: number, amplitude = 0.9) => {
        const position = Math.min(output.length - 1, Math.round(seconds * SAMPLE_RATE));
        output[position] = Math.max(-1, Math.min(1, output[position]! + amplitude));
    };

    // 0–0.5s is intentionally silent apart from the boundary impulse.
    addTone(0.5, 2, 180, 0.08);
    addTone(0.5, 2, 360, 0.04);
    addTone(2, 4, 440, 0.42);
    addTone(2, 4, 660, 0.28);
    addTone(4, 5.5, 220, 0.2);
    addTone(4, 5.5, 550, 0.16);
    addTone(4, 5.5, 880, 0.12);
    addImpulse(0.02);
    addImpulse(1);
    addImpulse(2.5);
    addImpulse(4);
    addImpulse(5.98);
    return output;
}

export function float32ToLittleEndianBuffer(samples: Float32Array): Buffer {
    const buffer = Buffer.allocUnsafe(samples.length * Float32Array.BYTES_PER_ELEMENT);
    samples.forEach((sample, index) => {
        buffer.writeFloatLE(sample, index * Float32Array.BYTES_PER_ELEMENT);
    });
    return buffer;
}

export function sha256Bytes(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

export function sha256Float32(samples: Float32Array): string {
    return sha256Bytes(float32ToLittleEndianBuffer(samples));
}
