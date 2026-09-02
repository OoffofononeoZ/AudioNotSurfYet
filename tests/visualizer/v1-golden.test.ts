import { describe, expect, test } from 'vitest';
import {
    createInitialVisualizerProject,
    validateVisualizerProjectV1,
} from '../../src/visualizer/projectCodec';

const makeGolden = () => createInitialVisualizerProject({
    track: {
        contentHash: '1'.repeat(64),
        fileName: 'visualizer-v1.wav',
        durationSeconds: 8,
        sampleRate: 48_000,
    },
    createId: () => '00000000-0000-4000-8000-000000000101',
    createSeed: () => 101,
    now: () => new Date('2026-09-02T00:00:00.000Z'),
});
describe('Visualizer V1 golden examples', () => {
    test('keeps the default candidate complete and constant-only', () => {
        const golden = makeGolden();
        expect(validateVisualizerProjectV1(golden)).toEqual(golden);
        expect(golden.scene.bindings.every(
            (binding) => binding.source.kind === 'constant',
        )).toBe(true);
    });

    test.each([
        ['unknown field', (value: any) => { value.output.extra = 1; }],
        ['bad output', (value: any) => { value.output.frameRate = 24; }],
        ['bad seed', (value: any) => { value.scene.seed = -1; }],
        ['bad binding kind', (value: any) => { value.scene.bindings[1].source.kind = 'code'; }],
    ])('rejects golden failure: %s', (_name, mutate) => {
        const value = structuredClone(makeGolden()) as any;
        mutate(value);
        expect(() => validateVisualizerProjectV1(value)).toThrow();
    });
});
