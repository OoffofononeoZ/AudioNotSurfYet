import { readFileSync } from 'node:fs';
import { indexedDB } from 'fake-indexeddb';
import { describe, expect, test, vi } from 'vitest';
import { elementRegistry, ElementRegistry } from '../../src/visualizer/elementRegistry';
import { instantiatePreset } from '../../src/visualizer/compositionPresets';
import {
    createComposition,
    decodeComposition,
    encodeComposition,
    validateComposition,
} from '../../src/visualizer/compositionCodec';
import {
    appendStandaloneElements,
    compositionIssues,
    effectiveElements,
    planCompositionFeatures,
    removeCompositionElement,
    reorderComposition,
    synchronizeLayers,
} from '../../src/visualizer/compositionModel';
import { applyCommonControl, changedControlElements } from '../../src/visualizer/commonControls';
import { mergeResources, validateResourcePackage } from '../../src/visualizer/resourceCodec';
import { resourceHash, resourceRef } from '../../src/visualizer/resourceIdentity';
import { VisualizerResourceLibrary } from '../../src/visualizer/resourceLibrary';
import { ResourceRepository, type ResourceRepositoryPort } from '../../src/visualizer/resourceRepository';
import type { PresetInstance, VisualizerResourcePackageV1 } from '../../src/visualizer/resourceTypes';
import type { VisualizerProjectV4 } from '../../src/visualizer/compositionTypes';

const root = new URL('../../public/visualizer-resources/v1/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const track = { contentHash: 'a'.repeat(64), fileName: 'resources.wav', durationSeconds: 12, sampleRate: 48000 };
const request = vi.fn(
    async (url: RequestInfo | URL) => new Response(JSON.stringify(read(String(url).replace('/resources/', '')))),
) as unknown as typeof fetch;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer;
const seal = <T extends object>(value: T): T & { hash: string } => ({ ...value, hash: resourceHash(value) });
function customPack(): VisualizerResourcePackageV1 {
    const definition = seal({
        ...structuredClone(elementRegistry.get('wireform')),
        id: 'custom-wire',
        title: '自定义线框',
    });
    return {
        format: 'audiosurf-visualizer-resource',
        schemaVersion: 1,
        id: 'custom-pack',
        version: 1,
        elements: [definition],
        presets: [],
    };
}
function addPreset(p: VisualizerProjectV4, id = 'geometric-0.6') {
    const added = instantiatePreset(id, p.track.durationSeconds, p.elements.length);
    return synchronizeLayers({
        ...p,
        elements: [...p.elements, ...added.elements],
        items: [...p.items, added.group],
        resources: mergeResources(p.resources, added.resources),
    });
}
const group = (p: VisualizerProjectV4, index = 0) =>
    p.items.filter((i): i is PresetInstance => i.kind === 'preset')[index]!;

describe('V4 preset ownership and bulk controls', () => {
    test('separate shared smoothing fields tolerate an independently changed child source', () => {
        const leaf = elementRegistry.create('reactive-rings', 12, 0);
        const controls = [
            {
                id: 'attack',
                label: 'Attack',
                kind: 'transform' as const,
                parameterId: 'amount',
                field: 'attackSeconds' as const,
                targets: ['rings'],
                value: 0.04,
            },
            {
                id: 'release',
                label: 'Release',
                kind: 'transform' as const,
                parameterId: 'amount',
                field: 'releaseSeconds' as const,
                targets: ['rings'],
                value: 0.2,
            },
        ];
        const definition = seal({
            id: 'shared-smoothing',
            version: 1,
            title: 'Shared smoothing',
            description: 'Input mapping',
            preview: 'geometric' as const,
            elements: [
                {
                    key: 'rings',
                    element: leaf.resource,
                    name: leaf.name,
                    enabled: true,
                    bindings: structuredClone(leaf.bindings),
                    timing: { kind: 'relative' as const, start: 0, end: 1 },
                },
            ],
            controls,
        });
        const p = appendStandaloneElements(createComposition(track), [leaf]);
        p.resources.presets = [definition];
        p.items = [
            {
                kind: 'preset',
                id: crypto.randomUUID(),
                resource: resourceRef(definition),
                name: definition.title,
                enabled: true,
                children: [leaf.id],
                controls: controls.map(c => ({ ...c, targets: [leaf.id] })),
            },
        ];
        expect(() => validateComposition(p)).not.toThrow();
        p.elements[0]!.bindings[0] = { parameterId: 'amount', source: { kind: 'constant', value: 0.3 } };
        expect(() => validateComposition(p)).not.toThrow();
        expect(changedControlElements(p, group(p).controls[0]!)).toHaveLength(1);
        const before = structuredClone(p);
        expect(() => applyCommonControl(p, group(p), 'attack', 0.1)).toThrow(/映射/);
        expect(p).toEqual(before);
    });
    test('two independent presets and three leaves remain five top-level items and round trip with embedded resources', () => {
        const p = appendStandaloneElements(
            addPreset(addPreset(createComposition(track)), 'prismatic-voyage'),
            ['solid', 'blur', 'spectral-strings'].map((id, i) => elementRegistry.create(id, 12, i)),
        );
        expect(p.items).toHaveLength(5);
        expect(new Set(p.elements.map(e => e.id)).size).toBe(p.elements.length);
        const encoded = encodeComposition(p);
        expect(decodeComposition(encoded.buffer as ArrayBuffer)).toEqual(p);
        expect(() => validateComposition({ ...p, schemaVersion: 3 })).toThrow(/V4/);
        const invalid = structuredClone(p);
        group(invalid).children.push(p.items.at(-1)!.id);
        expect(() => validateComposition(invalid)).toThrow(/只能/);
    });
    test('bulk writes, child differences, manual restoration and reapply persist independently', () => {
        let p = addPreset(addPreset(createComposition(track)));
        const id = group(p).id,
            second = structuredClone(group(p, 1));
        p = validateComposition(applyCommonControl(p, group(p), 'sensitivity', 1.2));
        const control = group(p).controls.find(c => c.id === 'sensitivity')!,
            target = p.elements.find(e => e.id === control.targets[0])!;
        target.bindings.find(b => b.parameterId === 'sensitivity')!.source = { kind: 'constant', value: 0.8 };
        expect(changedControlElements(p, control).map(e => e.id)).toEqual([target.id]);
        p = decodeComposition(encodeComposition(p).buffer as ArrayBuffer);
        expect(group(p).id).toBe(id);
        expect(changedControlElements(p, group(p).controls[0]!)).toHaveLength(1);
        p = validateComposition(applyCommonControl(p, group(p), 'sensitivity', 1.2));
        expect(changedControlElements(p, group(p).controls[0]!)).toEqual([]);
        expect(group(p, 1)).toEqual(second);
        p.elements.find(e => e.id === target.id)!.bindings.find(b => b.parameterId === 'sensitivity')!.source = {
            kind: 'constant',
            value: 1.2,
        };
        expect(changedControlElements(p, group(p).controls[0]!)).toEqual([]);
    });
    test('group visibility gates children and analysis without changing their own switches', () => {
        const p = addPreset(createComposition(track));
        const first = p.elements.find(e => e.type !== 'solid')!;
        first.enabled = false;
        const hidden = structuredClone(p);
        group(hidden).enabled = false;
        expect(effectiveElements(hidden).every(e => !e.enabled)).toBe(true);
        expect(planCompositionFeatures(hidden)).toEqual([]);
        expect(compositionIssues(hidden)).toEqual([]);
        const shown = structuredClone(hidden);
        group(shown).enabled = true;
        expect(shown.elements.find(e => e.id === first.id)!.enabled).toBe(false);
        expect(planCompositionFeatures(shown)).toHaveLength(2);
    });
    test('moves entire blocks, prunes deleted control targets and removes empty groups', () => {
        const p = appendStandaloneElements(addPreset(createComposition(track)), [
                elementRegistry.create('blur', 12, 11),
            ]),
            g = group(p),
            effect = p.elements.at(-1)!;
        effect.targets = { kind: 'elements', ids: [g.children[1]!] };
        const moved = reorderComposition(p, [g.id, effect.id]);
        expect(moved.elements.at(-1)!.id).toBe(g.children.at(-1));
        const reversed = reorderComposition(moved, [...g.children], g.id);
        expect(group(reversed).children).toEqual([...g.children].reverse());
        const removed = removeCompositionElement(p, g.children[1]!);
        expect(removed.elements.at(-1)!.targets).toEqual({ kind: 'elements', ids: [] });
        expect(group(removed).controls.every(c => !c.targets.includes(g.children[1]!))).toBe(true);
        expect(() => validateComposition(removed)).not.toThrow();
        const all = removeCompositionElement(p, g.id);
        expect(all.items).toHaveLength(1);
        expect(all.elements).toHaveLength(1);
    });
    test('rejects style controls, overlapping fields, unknown kernels, missing dependencies and content tampering', () => {
        const p = addPreset(createComposition(track)),
            bad = structuredClone(p);
        group(bad).controls[0]!.parameterId = 'size';
        expect(() => validateComposition(bad)).toThrow();
        const pack = customPack();
        pack.elements[0]!.title = 'tampered';
        expect(() => validateResourcePackage(pack)).toThrow(/SHA/);
        pack.elements[0] = seal({ ...pack.elements[0]!, kernelId: 'unknown' as never });
        expect(() => validateResourcePackage(pack)).toThrow(/内核/);
        expect(() => validateResourcePackage(read('presets/geometric-0.6.json'))).toThrow(/缺少/);
        const wider = customPack();
        wider.elements[0]!.parameters = wider.elements[0]!.parameters.map(p =>
            p.id === 'size' ? { ...p, range: { min: 0, max: 1e10 } } : p,
        );
        wider.elements[0] = seal(wider.elements[0]!);
        expect(() => validateResourcePackage(wider)).toThrow(/范围/);
    });
    test('validates a bulk candidate without modifying the original on failure', () => {
        const p = addPreset(createComposition(track)),
            before = structuredClone(p);
        expect(() => applyCommonControl(p, group(p), 'sensitivity', 100)).toThrow();
        expect(p).toEqual(before);
        const result = applyCommonControl(p, group(p), 'input-0', {
            source: { kind: 'native', featureId: 'frequency' },
        });
        expect(() => validateComposition(result)).not.toThrow();
        expect(p).toEqual(before);
    });
});

describe('JSON library requests, local files and persistence', () => {
    test('resource defaults respect declared editing precision while saved instance values are preserved', () => {
        const pack = customPack();
        pack.elements[0]!.parameters = pack.elements[0]!.parameters.map(p =>
            p.id === 'sensitivity' ? { ...p, defaultValue: 0.12345 } : p,
        );
        pack.elements[0] = seal(pack.elements[0]!);
        expect(() => validateResourcePackage(pack)).toThrow(/精度/);
        const p = appendStandaloneElements(createComposition(track), [elementRegistry.create('wireform', 12, 0)]);
        p.elements[0]!.bindings.find(b => b.parameterId === 'sensitivity')!.source = {
            kind: 'constant',
            value: 0.12345,
        };
        const saved = decodeComposition(encodeComposition(p).buffer as ArrayBuffer);
        expect(saved.elements[0]!.bindings.find(b => b.parameterId === 'sensitivity')!.source).toEqual({
            kind: 'constant',
            value: 0.12345,
        });
    });
    test('loads static packages, persists a file, deduplicates it, removes it and leaves an embedded project readable', async () => {
        const repo = new ResourceRepository(indexedDB, 'resources-' + crypto.randomUUID()),
            registry = new ElementRegistry();
        const library = new VisualizerResourceLibrary(repo, request, registry, '/resources/');
        await library.load();
        expect(library.snapshot().status).toBe('ready');
        expect(registry.list()).toHaveLength(13);
        const pack = customPack();
        await library.import(bytes(pack));
        await library.import(bytes(pack));
        expect(library.snapshot().imported).toHaveLength(1);
        const saved = appendStandaloneElements(createComposition(track), [elementRegistry.create('wireform', 12, 0)]);
        saved.elements[0]!.resource = resourceRef(pack.elements[0]!);
        saved.resources.elements = structuredClone(pack.elements);
        const encoded = encodeComposition(saved);
        await library.load();
        expect(registry.get('custom-wire').title).toBe('自定义线框');
        await library.remove(pack.id, pack.version);
        expect(() => registry.get('custom-wire')).toThrow();
        expect(decodeComposition(encoded.buffer as ArrayBuffer)).toEqual(saved);
        library.dispose();
    });
    test('failed writes and conflicts do not register partial resources', async () => {
        let fail = false;
        const stored: unknown[] = [];
        const repository: ResourceRepositoryPort = {
            read: async () => stored,
            write: async p => {
                if (fail) throw Error('quota');
                stored.splice(0, stored.length, ...structuredClone(p));
            },
            close() {},
        };
        const registry = new ElementRegistry(),
            library = new VisualizerResourceLibrary(repository, request, registry, '/resources/');
        await library.load();
        fail = true;
        await expect(library.import(bytes(customPack()))).rejects.toThrow('quota');
        expect(registry.list()).toHaveLength(13);
        expect(stored).toEqual([]);
        fail = false;
        await library.import(bytes(customPack()));
        const conflict = customPack();
        conflict.elements[0] = seal({ ...conflict.elements[0]!, title: '冲突内容' });
        await expect(library.import(bytes(conflict))).rejects.toThrow(/不同内容/);
        expect(registry.get('custom-wire').title).toBe('自定义线框');
        library.dispose();
    });
    test('request failure is retryable and late requests cannot repopulate a disposed library', async () => {
        const repository: ResourceRepositoryPort = { read: async () => [], write: async () => {}, close() {} };
        let reject = true,
            resolve: (value: Response) => void = () => {};
        const network = vi.fn(async (url: RequestInfo | URL) => {
            if (reject) return new Response('', { status: 503 });
            return request(url);
        }) as unknown as typeof fetch;
        const registry = new ElementRegistry(),
            library = new VisualizerResourceLibrary(repository, network, registry, '/resources/');
        await library.load();
        expect(library.snapshot().status).toBe('error');
        reject = false;
        await library.load();
        expect(library.snapshot().status).toBe('ready');
        library.dispose();
        const delayed = new VisualizerResourceLibrary(
            repository,
            () => new Promise<Response>(done => (resolve = done)),
            new ElementRegistry(),
            '/resources/',
        );
        const load = delayed.load();
        delayed.dispose();
        resolve(new Response(JSON.stringify(read('catalog.json'))));
        await load;
        expect(delayed.snapshot().elements).toEqual([]);
    });
});
