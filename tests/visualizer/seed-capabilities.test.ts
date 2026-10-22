import { expect, test } from 'vitest';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { validateResourceSnapshot } from '../../src/visualizer/resourceCodec';
import { resourceHash } from '../../src/visualizer/resourceIdentity';

const seeded = [
    'spectral-strings',
    'starfield',
    'radial-spectrum',
    'orbit-solids',
    'wireform',
    'point-line-horizontal',
    'point-line-vertical',
    'fy-ember-choir',
].sort();

test('only elements with existing seed-driven effects declare the capability', () => {
    expect(
        elementRegistry
            .list()
            .filter(e => e.usesSeed)
            .map(e => e.id)
            .sort(),
    ).toEqual(seeded);
    for (const id of [
        'solid',
        'spectral-dots',
        'reactive-rings',
        'arc-lattice',
        'light-tunnel',
        'blur',
        'scale',
        'fade',
        'fy-corona-veil',
        'fy-solar-grade',
    ]) {
        expect(elementRegistry.get(id)).not.toHaveProperty('usesSeed');
    }
});

test('capability metadata is validated and covered by the resource identity', () => {
    const definition = structuredClone(elementRegistry.get('starfield'));
    const snapshot = { algorithms: elementRegistry.algorithms, elements: [definition], presets: [] };
    expect(validateResourceSnapshot(snapshot).elements[0]!.usesSeed).toBe(true);
    delete definition.usesSeed;
    expect(() => validateResourceSnapshot(snapshot)).toThrow(/SHA/);
    Object.assign(definition, { usesSeed: false });
    definition.hash = resourceHash(definition);
    expect(() => validateResourceSnapshot(snapshot)).toThrow(/Seed/);
});
