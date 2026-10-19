import { describe, expect, test } from 'vitest';
import { validateDrawPacket } from '../../src/visualizer/drawPacket';
import type { AlgorithmDefinition } from '../../src/visualizer/algorithmTypes';
const definition = {
    programs: {
        draw: { geometry: 'quad', uniforms: { amount: { type: 'number' }, image: { type: 'source' } } },
        mesh: { geometry: 'triangles', uniforms: {} },
    },
} as unknown as AlgorithmDefinition;
describe('host draw packet boundary', () => {
    test('accepts only declared programs, complete uniforms and the current effect input', () => {
        expect(
            validateDrawPacket({ passes: [{ program: 'draw', uniforms: { amount: 1, image: 'source' } }] }, definition)
                .passes,
        ).toHaveLength(1);
        for (const pass of [
            { program: 'missing', uniforms: {} },
            { program: 'draw', uniforms: { amount: NaN, image: 'source' } },
            { program: 'draw', uniforms: { amount: 1, image: 'https://example.com/private' } },
            { program: 'draw', uniforms: { amount: 1, image: 'source', extra: true } },
        ])
            expect(() => validateDrawPacket({ passes: [pass] }, definition)).toThrow();
    });
    test('rejects malformed, oversized and nonfinite geometry before GPU allocation', () => {
        const mesh = { positions: new Float32Array(9), colors: new Float32Array(12), edges: new Float32Array(6) };
        expect(
            validateDrawPacket({ passes: [{ program: 'mesh', uniforms: {}, mesh }] }, definition).passes,
        ).toHaveLength(1);
        for (const invalid of [
            { ...mesh, positions: new Float32Array(65538 * 3) },
            { ...mesh, colors: new Float32Array(4) },
            { ...mesh, positions: new Float32Array([NaN, 0, 0, 0, 0, 0, 0, 0, 0]) },
            { ...mesh, positions: Array(9).fill(0) },
        ])
            expect(() =>
                validateDrawPacket({ passes: [{ program: 'mesh', uniforms: {}, mesh: invalid }] }, definition),
            ).toThrow();
    });
});
