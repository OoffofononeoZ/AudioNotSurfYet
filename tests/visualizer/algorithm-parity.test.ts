import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { elementRegistry, findResource } from '../../src/visualizer/elementRegistry';
import { createTestAlgorithm } from './algorithm-runtime-fixture';
import type { AlgorithmFrame } from '../../src/visualizer/algorithmTypes';

const golden = JSON.parse(
    readFileSync(new URL('../fixtures/visualizer-algorithm-parity-v1.json', import.meta.url), 'utf8'),
);
const hash = (...arrays: Float32Array[]) => {
    const digest = createHash('sha256');
    for (const values of arrays) digest.update(Buffer.from(values.buffer, values.byteOffset, values.byteLength));
    return digest.digest('hex');
};
const frame = (id: string, time: number): AlgorithmFrame => ({
    time,
    seed: golden.seed,
    revision: 'baseline',
    width: golden.width,
    height: golden.height,
    range: null,
    parameters: Object.fromEntries(
        elementRegistry
            .get(id)
            .parameters.map(p => [p.id, { value: p.id === 'spectrum' ? golden.spectrum : p.defaultValue }]),
    ),
});
test('resource geometry retains the pre-migration vertex, color and antialiasing buffers', async () => {
    for (const id of Object.keys(golden.geometry)) {
        const definition = elementRegistry.get(id),
            algorithm = findResource(elementRegistry.algorithms, definition.algorithm);
        const instance = await createTestAlgorithm(algorithm);
        for (const expected of golden.geometry[id]) {
            const packet = await instance.prepareFrame(frame(id, expected.time), {
                history: async () => [],
                markers: async () => {
                    throw Error('ABI 1 fixture does not query markers');
                },
            });
            const mesh = packet.passes[0]!.mesh!;
            expect(mesh.positions.length / 3).toBe(expected.count);
            expect(hash(mesh.positions, mesh.colors, mesh.edges)).toBe(expected.hash);
        }
        instance.dispose?.();
    }
});
test('resource string integration retains pre-migration history across chunk boundaries and backward seeking', async () => {
    const definition = elementRegistry.get('spectral-strings');
    const instance = await createTestAlgorithm(findResource(elementRegistry.algorithms, definition.algorithm));
    const history = async (r: { startTick: number; endTick: number }) =>
        Array.from({ length: r.endTick - r.startTick }, (_, i) => ({
            time: (r.startTick + i) / 60,
            value: golden.spectrum,
        }));
    for (const expected of [...golden.strings, golden.strings[1], golden.strings[2]]) {
        const packet = await instance.prepareFrame(frame('spectral-strings', expected.time), {
            history,
            markers: async () => {
                throw Error('ABI 1 fixture does not query markers');
            },
        });
        expect(hash(Float32Array.from(packet.passes[0]!.uniforms.uMotion as number[]))).toBe(expected.hash);
    }
    instance.dispose?.();
});
