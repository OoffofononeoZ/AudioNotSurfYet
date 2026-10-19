import { resourcePack as read } from '../support/visualizer-assets.mjs';
import { describe, expect, test } from 'vitest';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
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
import type { PresetInstance, VisualizerResourcePackageV2 } from '../../src/visualizer/resourceTypes';
import type { VisualizerProjectV5 } from '../../src/visualizer/compositionTypes';

const track = { contentHash: 'a'.repeat(64), fileName: 'resources.wav', durationSeconds: 12, sampleRate: 48000 };
const seal = <T extends object>(value: T): T & { hash: string } => ({ ...value, hash: resourceHash(value) });
function customPack(): VisualizerResourcePackageV2 {
    const definition = seal({
        ...structuredClone(elementRegistry.get('wireform')),
        id: 'custom-wire',
        title: '自定义线框',
    });
    return {
        format: 'audiosurf-visualizer-resource',
        schemaVersion: 2,
        algorithms: [structuredClone(elementRegistry.algorithms.find(a => a.hash === definition.algorithm.hash)!)],
        id: 'custom-pack',
        version: 1,
        elements: [definition],
        presets: [],
    };
}
function addPreset(p: VisualizerProjectV5, id = 'geometric-0.6') {
    const added = instantiatePreset(id, p.track.durationSeconds, p.elements.length);
    return synchronizeLayers({
        ...p,
        elements: [...p.elements, ...added.elements],
        items: [...p.items, added.group],
        resources: mergeResources(p.resources, added.resources),
    });
}
const group = (p: VisualizerProjectV5, index = 0) =>
    p.items.filter((i): i is PresetInstance => i.kind === 'preset')[index]!;

describe('V5 preset ownership and bulk controls', () => {
    for (const [id, previousNames] of [
        [
            'geometric-0.6',
            [
                '纯黑背景',
                '外环 · 双重复频谱',
                '内环 · 四重复频谱',
                '十二频段方块',
                '十九条旋转弧',
                '中心响应方块',
                '中心棱锥',
                '三颗游移棱锥',
                '主旋转环',
                '交错环 A',
                '交错环 B',
            ],
        ],
        [
            'prismatic-voyage',
            [
                '深空背景',
                '跃迁星尘',
                '序幕 · 光轨隧道',
                '推进 · 光轨隧道',
                '高潮 · 光轨隧道',
                '尾声 · 光轨隧道',
                '远端频谱光环',
                '导航弧簇',
                '棱镜核心',
                '倾斜光环 A',
                '倾斜光环 B',
                '轨道信标',
            ],
        ],
    ] as const)
        test(`${id} preserves saved names and edits alongside the renamed preset version`, () => {
            const previous = structuredClone(instantiatePreset(id, track.durationSeconds));
            const definition = previous.resources.presets[0]!;
            expect(definition.elements).toHaveLength(previousNames.length);
            previous.resources.presets[0] = seal({
                ...definition,
                version: 2,
                elements: definition.elements.map((e, index) => ({ ...e, name: previousNames[index]! })),
            });
            previous.group.resource = resourceRef(previous.resources.presets[0]);
            previous.elements.forEach((e, index) => {
                e.name = previousNames[index]!;
            });
            previous.elements[0]!.name = '我的背景';
            previous.elements[0]!.bindings.find(b => b.parameterId === 'opacity')!.source = {
                kind: 'constant',
                value: 0.75,
            };
            const saved = validateComposition(
                synchronizeLayers({
                    ...createComposition(track),
                    elements: previous.elements,
                    items: [previous.group],
                    resources: previous.resources,
                }),
            );
            const encoded = encodeComposition(saved);
            const restored = decodeComposition(encoded.buffer as ArrayBuffer);
            const added = addPreset(restored, id);
            expect(added.elements.slice(0, saved.elements.length)).toEqual(saved.elements);
            expect(added.resources.presets.map(p => p.version)).toEqual([2, 3]);
            const fresh = added.elements.slice(saved.elements.length);
            for (const element of fresh) expect(element.name).toBe(elementRegistry.get(element.resource).title);
            expect(new Set(added.elements.map(e => e.id)).size).toBe(added.elements.length);
            const result = encodeComposition(added);
            expect(decodeComposition(result.buffer as ArrayBuffer)).toEqual(added);
        });
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
        expect(() => validateComposition({ ...p, schemaVersion: 3 })).toThrow(/V5/);
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
        const first = p.elements.find(e => e.resource.id !== 'solid')!;
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
        pack.elements[0] = seal({ ...pack.elements[0]!, algorithm: { ...pack.elements[0]!.algorithm, id: 'unknown' } });
        expect(() => validateResourcePackage(pack)).toThrow(/算法/);
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
