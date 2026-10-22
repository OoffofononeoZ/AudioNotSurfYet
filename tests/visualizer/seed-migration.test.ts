import { expect, test } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import {
    createComposition,
    validateComposition,
    encodeComposition,
    decodeComposition,
} from '../../src/visualizer/compositionCodec';
import { appendStandaloneElements, synchronizeLayers } from '../../src/visualizer/compositionModel';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { instantiatePreset } from '../../src/visualizer/compositionPresets';
import { createRealtimeStyle, validateRealtimeStyle } from '../../src/visualizer/realtimeStyle';
import { RealtimeStyleRepository } from '../../src/visualizer/realtimeStyleRepository';
import { CompositionDraftRepository } from '../../src/visualizer/compositionDraftRepository';
import { resourceKey, resourceHash, resourceRef } from '../../src/visualizer/resourceIdentity';
import type { ResourceRef } from '../../src/visualizer/resourceTypes';

const track = { contentHash: 'a'.repeat(64), fileName: 'seed.wav', durationSeconds: 3, sampleRate: 48000 };
const project = () =>
    appendStandaloneElements(createComposition(track), [
        elementRegistry.create('starfield', 3, 0),
        elementRegistry.create('solid', 3, 1),
    ]);

/** Reconstruct the exact pre-capability representation, including nested resource references. */
function legacy(input: object, seed: number | null): any {
    const v = structuredClone(input) as any;
    const refs = new Map<string, ResourceRef>();
    const replace = (ref: ResourceRef) => refs.get(resourceKey(ref)) ?? ref;
    for (const d of v.resources.elements)
        if (d.usesSeed) {
            const key = resourceKey(d);
            delete d.usesSeed;
            d.version--;
            d.hash = resourceHash(d);
            refs.set(key, resourceRef(d));
        }
    for (const p of v.resources.presets) {
        const key = resourceKey(p);
        if (!p.elements.some((e: any) => refs.has(resourceKey(e.element)))) continue;
        for (const e of p.elements) e.element = replace(e.element);
        p.version--;
        p.hash = resourceHash(p);
        refs.set(key, resourceRef(p));
    }
    for (const e of v.elements) {
        e.resource = replace(e.resource);
        delete e.seed;
    }
    for (const item of v.items ?? []) if (item.kind === 'preset') item.resource = replace(item.resource);
    v.seed = seed;
    return v;
}

test.each([null, 0, 42, 0xffffffff])('new JSON and old global seed %s round-trip only on supported elements', seed => {
    const p = project();
    p.elements[0]!.seed = seed;
    const current = decodeComposition(encodeComposition(p).buffer as ArrayBuffer, track);
    expect(current).not.toHaveProperty('seed');
    expect(current.elements[0]!.seed).toBe(seed);
    expect(current.elements[1]).not.toHaveProperty('seed');
    const old = legacy(p, seed),
        before = JSON.stringify(old);
    const migrated = validateComposition(old, track);
    expect(migrated).toEqual(p);
    expect(JSON.stringify(old)).toBe(before);
    expect(migrated.resources.algorithms).toEqual(p.resources.algorithms);
});

test('legacy presets retain ownership, controls and precise resource references', () => {
    const added = instantiatePreset('prismatic-voyage', 3);
    const p = synchronizeLayers({
        ...createComposition(track),
        elements: added.elements,
        items: [added.group],
        resources: added.resources,
    });
    for (const e of p.elements) if (e.seed !== undefined) e.seed = 42;
    expect(validateComposition(legacy(p, 42), track)).toEqual(p);
});

test('mixed layouts, non-seeded fields, invalid values and unrecognized old algorithms are rejected', () => {
    const p = project();
    expect(() => validateComposition({ ...p, seed: 42 })).toThrow(/混用/);
    p.elements[1]!.seed = null;
    expect(() => validateComposition(p)).toThrow(/不使用/);
    delete p.elements[1]!.seed;
    for (const seed of [undefined, -1, 4294967296, 1.5, NaN, Infinity, '123', false]) {
        Object.assign(p.elements[0]!, { seed });
        expect(() => validateComposition(p)).toThrow();
    }
    const old = legacy(project(), 42);
    const algorithm = old.resources.algorithms.find((a: any) => a.id === 'starfield');
    algorithm.source += '\n// unreviewed custom change';
    algorithm.hash = resourceHash(algorithm);
    const d = old.resources.elements.find((d: any) => d.id === 'starfield');
    d.algorithm = resourceRef(algorithm);
    d.hash = resourceHash(d);
    old.elements[0].resource = resourceRef(d);
    expect(() => validateComposition(old)).toThrow(/自定义资源/);
});

function rawStore(name: string, store: string, value: any, read = false): Promise<any> {
    return new Promise((resolve, reject) => {
        const open = indexedDB.open(name, 1);
        open.onupgradeneeded = () =>
            open.result.createObjectStore(store, { keyPath: store === 'draft' ? 'key' : 'id' });
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result,
                tx = db.transaction(store, read ? 'readonly' : 'readwrite');
            const request = read ? tx.objectStore(store).get(value) : tx.objectStore(store).put(value);
            tx.oncomplete = () => {
                db.close();
                resolve(request.result);
            };
            tx.onabort = tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        };
    });
}

test('draft migration is staged for the normal writer and leaves raw data untouched before activation', async () => {
    const name = 'seed-draft-' + crypto.randomUUID(),
        p = project(),
        old = legacy(p, 42);
    const envelope = { schemaVersion: 5, savedAt: p.updatedAt, project: old };
    await rawStore(name, 'draft', { key: 'latest', envelope });
    const repository = new CompositionDraftRepository(indexedDB, name);
    const restored = await repository.restore();
    expect(restored?.kind === 'current' && restored.needsSave).toBe(true);
    expect((await rawStore(name, 'draft', 'latest', true)).envelope).toEqual(envelope);
    if (restored?.kind === 'current') await repository.replace(restored.draft);
    expect((await rawStore(name, 'draft', 'latest', true)).envelope.project).not.toHaveProperty('seed');
    repository.close();
});

test('style migration atomically keeps its address and only writes canonical element seeds', async () => {
    const p = project(),
        style = createRealtimeStyle(p, 'Migrated'),
        old = legacy(style, 42);
    const name = 'seed-style-' + crypto.randomUUID();
    await rawStore(name, 'styles', old);
    const repository = new RealtimeStyleRepository(indexedDB, name);
    const migrated = await repository.read(style.id);
    expect(migrated?.id).toBe(style.id);
    expect(migrated?.elements[0]!.seed).toBe(42);
    expect(migrated?.elements[1]).not.toHaveProperty('seed');
    expect(await rawStore(name, 'styles', style.id, true)).toEqual(migrated);
    expect(validateRealtimeStyle(migrated!)).toEqual(migrated);
    await expect(repository.save(migrated!)).rejects.toBeDefined();
    repository.close();
});

test('invalid style migration aborts without replacing the original record', async () => {
    const style = createRealtimeStyle(project(), 'Invalid migration'),
        old = legacy(style, 42);
    old.elements[0].seed = null;
    const name = 'seed-style-invalid-' + crypto.randomUUID();
    await rawStore(name, 'styles', old);
    const repository = new RealtimeStyleRepository(indexedDB, name);
    await expect(repository.read(style.id)).rejects.toThrow(/混用/);
    expect(await rawStore(name, 'styles', style.id, true)).toEqual(old);
    repository.close();
});
