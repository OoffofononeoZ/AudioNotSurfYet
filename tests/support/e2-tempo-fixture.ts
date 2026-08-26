import {
    SAMPLE_RATE,
    sha256Float32,
} from './audio-fixtures.ts';
import { encodeMonoWav } from './m7-learning-fixture.ts';

export const E2_TEMPO_GENERATOR_VERSION = 'editor-e2-tempo-v1';
export const E2_TEMPO_DURATION_SECONDS = 12;

const hashNoise = (index: number): number => {
    let value = (index + 1) * 0x9e3779b1;
    value ^= value >>> 16;
    value = Math.imul(value, 0x85ebca6b);
    value ^= value >>> 13;
    return ((value >>> 0) / 0xffffffff) * 2 - 1;
};

export const createClickTrack = (
    bpm: number,
    durationSeconds = E2_TEMPO_DURATION_SECONDS,
): Float32Array => {
    const length = Math.round(durationSeconds * SAMPLE_RATE);
    const output = new Float32Array(length);
    const interval = SAMPLE_RATE * 60 / bpm;
    for (let beat = 0; ; beat += 1) {
        const start = Math.round(beat * interval);
        if (start >= length) break;
        for (let offset = 0; offset < 240 && start + offset < length; offset += 1) {
            const envelope = Math.exp(-offset / 42);
            output[start + offset] = envelope * Math.sin(2 * Math.PI * 2_000 * offset / SAMPLE_RATE);
        }
    }
    return output;
};

export const createSeededNoise = (
    durationSeconds = E2_TEMPO_DURATION_SECONDS,
): Float32Array => Float32Array.from(
    { length: Math.round(durationSeconds * SAMPLE_RATE) },
    (_, index) => hashNoise(index) * 0.08,
);

export const createAmbiguousTempo = (): Float32Array => {
    const first = createClickTrack(100);
    const second = createClickTrack(127.5);
    return Float32Array.from(first, (value, index) =>
        value * 0.55 + (second[index] ?? 0) * 0.55);
};

export const E2_TEMPO_CASES = [
    { id: 'tempo-60', bpm: 60, pcm: createClickTrack(60), expected: 'reliable' },
    { id: 'tempo-100', bpm: 100, pcm: createClickTrack(100), expected: 'reliable' },
    { id: 'tempo-128', bpm: 128, pcm: createClickTrack(128), expected: 'reliable' },
    { id: 'tempo-127-5', bpm: 127.5, pcm: createClickTrack(127.5), expected: 'reliable' },
    { id: 'silence', pcm: new Float32Array(SAMPLE_RATE * 4), expected: 'low-confidence' },
    { id: 'seeded-noise', pcm: createSeededNoise(4), expected: 'low-confidence' },
    { id: 'ambiguous', pcm: createAmbiguousTempo(), expected: 'low-confidence' },
] as const;

export const buildE2TempoGolden = () => ({
    schemaVersion: 1,
    generatedAt: '2026-08-27',
    generatorVersion: E2_TEMPO_GENERATOR_VERSION,
    sampleRate: SAMPLE_RATE,
    frameSize: 1024,
    hopSize: 512,
    cases: E2_TEMPO_CASES.map((entry) => ({
        id: entry.id,
        fixtureHash: sha256Float32(entry.pcm),
        expectedState: entry.expected,
        ...('bpm' in entry ? { expectedBpm: entry.bpm } : {}),
    })),
});

export const createE2Tempo100Wav = (): Uint8Array =>
    encodeMonoWav(createClickTrack(100));
