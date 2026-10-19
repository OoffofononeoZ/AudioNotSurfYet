import { describe, expect, test } from 'vitest';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { parameterKey } from '../../src/visualizer/compositionEffects';
import { GeometricBatch, geometricSpectrum } from '../../resources/visualizer/shared/geometry.js';
import { buildGeometricElement } from '../../resources/visualizer/shared/geometry.js';
type ElementType = string;
import type { VisualizerResolvedParameterMap } from '../../src/visualizer/rendererTypes';
import { Matrix4, Vector3 } from 'three';
import { compositionPresets, createPresetElements } from '../../src/visualizer/compositionPresets';

function harness(type: ElementType, spectrum: number[]) {
    const e = elementRegistry.create(type, 10, 0),
        batch = new GeometricBatch(),
        levels = new Float32Array(128);
    const values: VisualizerResolvedParameterMap = new Map(
        e.bindings.map(b => [
            parameterKey(e.id, b.parameterId),
            {
                parameterId: b.parameterId,
                state: 'ready',
                value: b.source.kind === 'constant' ? b.source.value : spectrum,
            },
        ]),
    );
    const at = (time: number) => {
        buildGeometricElement(
            batch,
            { ...e, type: elementRegistry.get(e.resource).algorithm.id },
            values,
            time,
            314159,
            16 / 9,
            levels,
        );
        return [...batch.positions.subarray(0, batch.count * 3), ...batch.colors.subarray(0, batch.count * 4)];
    };
    return { at, batch };
}
describe('geometric atoms', () => {
    test('reference pyramid has three base corners and rotates around the translated p5 pivot', () => {
        const template = compositionPresets.find(p => p.id === 'geometric-0.6')!;
        const e = createPresetElements('geometric-0.6', 10)[template.elements.findIndex(e => e.key === 'element-6')]!,
            batch = new GeometricBatch();
        const values: VisualizerResolvedParameterMap = new Map(
            e.bindings.map(b => [
                parameterKey(e.id, b.parameterId),
                {
                    parameterId: b.parameterId,
                    state: 'ready',
                    value: b.source.kind === 'constant' ? b.source.value : [],
                },
            ]),
        );
        const time = 1.7,
            a = time * 0.9;
        buildGeometricElement(
            batch,
            { ...e, type: elementRegistry.get(e.resource).algorithm.id },
            values,
            time,
            1,
            16 / 9,
            new Float32Array(128),
        );
        expect(batch.count).toBe(36);
        const model = new Matrix4()
            .makeRotationY(a)
            .multiply(new Matrix4().makeRotationX(a))
            .multiply(new Matrix4().makeRotationZ(a))
            .multiply(new Matrix4().makeTranslation(0, 20 / 1600, 0));
        const apex = new Vector3(0, 84.85 / 3200, 0).applyMatrix4(model),
            projection = 0.8660254 / (0.8660254 - apex.z);
        const start = [
            (batch.positions[0]! + batch.positions[15]!) / 2,
            (batch.positions[1]! + batch.positions[16]!) / 2,
        ];
        expect(start[0]).toBeCloseTo(apex.x * projection, 7);
        expect(start[1]).toBeCloseTo(-apex.y * projection, 7);
    });
    for (const type of [
        'radial-spectrum',
        'orbit-solids',
        'wireform',
        'arc-lattice',
        'light-tunnel',
        'starfield',
    ] as const) {
        test(type + ' preserves an idle outline and responds deterministically to music', () => {
            const idle = harness(type, []),
                active = harness(
                    type,
                    Array.from({ length: 512 }, (_, i) => (i % 17 === 0 ? 64 : 2)),
                );
            const frame = active.at(3);
            expect(frame.every(Number.isFinite)).toBe(true);
            expect(idle.at(3).length).toBeGreaterThan(0);
            expect(frame).not.toEqual(idle.at(3));
            active.at(0.5);
            expect(active.at(3)).toEqual(frame);
            expect(active.batch.count).toBeLessThan(65536);
        });
    }
    test('spectrum response uses a fixed reference and exact user sensitivity', () => {
        expect([...geometricSpectrum([], 0.6)]).toEqual(Array(128).fill(0));
        const full = geometricSpectrum(Array(512).fill(128), 0.6);
        expect(full[0]).toBeCloseTo(0.6);
        expect(full[127]).toBeCloseTo(0.6);
        expect(geometricSpectrum(Array(512).fill(128), 0)[0]).toBe(0);
        const asymmetric = geometricSpectrum(
            Array.from({ length: 512 }, (_, i) => (i < 8 ? 128 : 0)),
            0.6,
        );
        expect(asymmetric[0]).toBeCloseTo(0.6);
        expect(asymmetric[1]).toBe(0);
        expect([...asymmetric.slice(0, 64)]).toEqual([...asymmetric.slice(64)]);
    });
    test('maximum count and sweep remain inside the shared geometry capacity', () => {
        for (const type of ['arc-lattice', 'light-tunnel', 'starfield'] as const) {
            const e = elementRegistry.create(type, 10, 0),
                batch = new GeometricBatch();
            const values: VisualizerResolvedParameterMap = new Map(
                elementRegistry.get(type).parameters.map(p => [
                    parameterKey(e.id, p.id),
                    {
                        parameterId: p.id,
                        state: 'ready',
                        value:
                            p.id === 'spectrum'
                                ? Array(512).fill(128)
                                : p.valueKind === 'number'
                                  ? Number(p.range?.max ?? p.defaultValue)
                                  : (p.defaultValue as number | string | boolean | number[]),
                    },
                ]),
            );
            buildGeometricElement(
                batch,
                { ...e, type: elementRegistry.get(e.resource).algorithm.id },
                values,
                3,
                314159,
                16 / 9,
                new Float32Array(128),
            );
            expect(batch.count).toBeGreaterThan(0);
            expect(batch.count).toBeLessThan(65536);
            expect([...batch.positions.subarray(0, batch.count * 3)].every(Number.isFinite)).toBe(true);
        }
    });
});
