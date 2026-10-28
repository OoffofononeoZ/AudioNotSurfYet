import { test, expect } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { createComposition } from '../../src/visualizer/compositionCodec';
import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { createRealtimeStyle, validateRealtimeStyle } from '../../src/visualizer/realtimeStyle';
import { RealtimeStyleRepository } from '../../src/visualizer/realtimeStyleRepository';
import { RealtimeResolver } from '../../src/visualizer/realtimeResolver';
import { parameterKey } from '../../src/visualizer/compositionEffects';
const track = { contentHash: 'a'.repeat(64), fileName: 'private-song.wav', durationSeconds: 10, sampleRate: 48000 };
function style(seed?: number | null) {
    const p = appendStandaloneElements(createComposition(track), [
        elementRegistry.create('radial-spectrum', 10, 0),
        elementRegistry.create('blur', 10, 1),
    ]);
    if (seed !== undefined) p.elements[0]!.seed = seed;
    return createRealtimeStyle(p, '测试实时样式');
}
test.each([null, 0, 42, 0xffffffff])('realtime snapshots preserve seed %s', seed => {
    const s = style(seed);
    expect(s).not.toHaveProperty('seed');
    expect(s.elements[0]!.seed).toBe(seed);
    expect(s.elements[1]).not.toHaveProperty('seed');
    expect(validateRealtimeStyle(JSON.parse(JSON.stringify(s))).elements[0]!.seed).toBe(seed);
});

test('styles are independent snapshots without song, timing, editor or catalog dependencies', () => {
    const s = style();
    expect(validateRealtimeStyle(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(JSON.stringify(s)).not.toContain('private-song.wav');
    expect(s).not.toHaveProperty('track');
    expect(s.elements[0]).not.toHaveProperty('timing');
    expect(s.resources.presets).toEqual([]);
    expect(() => validateRealtimeStyle({ ...s, track })).toThrow();
    const invalid = structuredClone(s);
    invalid.elements[1]!.targets = { kind: 'elements', ids: ['missing'] };
    expect(() => validateRealtimeStyle(invalid)).toThrow(/目标/);
    invalid.elements[0]!.resource.hash = 'f'.repeat(64);
    expect(() => validateRealtimeStyle(invalid)).toThrow();
});

test('realtime styles still exclude hidden content and its effect references', () => {
    const p = appendStandaloneElements(
        createComposition(track),
        ['solid', 'starfield', 'blur'].map((id, i) => elementRegistry.create(id, 10, i)),
    );
    p.elements[1]!.enabled = false;
    p.elements[2]!.targets = { kind: 'elements', ids: [p.elements[1]!.id] };
    const s = createRealtimeStyle(p, '可见内容');
    expect(s.elements.map(e => e.resource.id)).toEqual(['solid', 'blur']);
    expect(s.elements[1]!.targets).toEqual({ kind: 'elements', ids: [] });
    expect(s.resources.elements.some(e => e.id === 'starfield')).toBe(false);
});
test('local snapshots survive repository reopening and cannot overwrite an existing address', async () => {
    const name = 'realtime-' + crypto.randomUUID(),
        s = style(null);
    const a = new RealtimeStyleRepository(indexedDB, name);
    await a.save(s);
    await expect(a.save({ ...s, name: 'replacement' })).rejects.toBeDefined();
    a.close();
    const b = new RealtimeStyleRepository(indexedDB, name);
    expect(await b.read(s.id)).toEqual(s);
    expect(await b.read('missing')).toBeNull();
    b.close();
});
test('WE realtime projection preserves stereo slots, strength above one and numeric mapping', () => {
    const s = style(),
        e = s.elements[0]!,
        b = e.bindings.find(b => b.parameterId === 'spectrum')!;
    b.source = { kind: 'analysis', featureId: 'wallpaperEngineSpectrum', projection: { kind: 'full' } };
    const values = Array.from({ length: 128 }, (_, i) => i / 20);
    expect(
        new RealtimeResolver()
            .resolve(s, 1, { wallpaperEngineSpectrum: values }, null)
            .get(parameterKey(e.id, 'spectrum')),
    ).toMatchObject({ value: values, unit: 'we-strength', channelLayout: 'stereo-64' });
    expect(new RealtimeResolver().resolve(s, 1, {}, null).get(parameterKey(e.id, 'spectrum'))!.value).toEqual(
        Array(128).fill(0),
    );
});
