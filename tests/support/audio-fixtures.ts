import { createHash } from 'node:crypto';

export const SAMPLE_RATE = 48_000;
export const FORMAT_MASTER_DURATION_SECONDS = 4;
export const FORMAT_MASTER_SAMPLE_COUNT = SAMPLE_RATE * FORMAT_MASTER_DURATION_SECONDS;
export const GENERATOR_VERSION = 'm3-audio-fixtures-v1';

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
