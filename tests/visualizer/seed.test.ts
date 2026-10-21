import { afterEach, expect, test, vi } from 'vitest';
import { resolveSessionSeed, validateSeed } from '../../src/visualizer/seed';
import {
    createComposition,
    decodeComposition,
    encodeComposition,
    validateComposition,
} from '../../src/visualizer/compositionCodec';
import { validateRealtimeStyle } from '../../src/visualizer/realtimeStyle';

afterEach(() => vi.restoreAllMocks());
const track = { contentHash: 'a'.repeat(64), fileName: 'seed.wav', durationSeconds: 3, sampleRate: 48000 };

test('zero and maximum seeds remain fixed, while null generates a numeric session seed', () => {
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => {
        (array as Uint32Array)[0] = 123456789;
        return array;
    });
    expect(resolveSessionSeed(0)).toBe(0);
    expect(resolveSessionSeed(0xffffffff)).toBe(0xffffffff);
    expect(random).not.toHaveBeenCalled();
    expect(resolveSessionSeed(null)).toBe(123456789);
    expect(random).toHaveBeenCalledOnce();
});

test.each([null, 0, 42, 0xffffffff])('project JSON preserves seed %s', seed => {
    const project = { ...createComposition(track), seed };
    expect(decodeComposition(encodeComposition(project).buffer as ArrayBuffer, track).seed).toBe(seed);
    expect(validateSeed(seed)).toBe(seed);
});

test.each([undefined, -1, 4294967296, 1.5, NaN, Infinity, '123', false])('rejects invalid seed %s', seed => {
    expect(() => validateSeed(seed)).toThrow();
    expect(() => validateComposition({ ...createComposition(track), seed })).toThrow();
    expect(() =>
        validateRealtimeStyle({
            format: 'audiosurf-realtime-style',
            schemaVersion: 1,
            id: crypto.randomUUID(),
            name: 'Seed',
            createdAt: new Date().toISOString(),
            seed,
            frameRate: 30,
            elements: [],
            resources: { algorithms: [], elements: [], presets: [] },
        }),
    ).toThrow();
});
