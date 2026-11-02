import { expect, test } from 'vitest';
import {
    createComposition,
    validateComposition,
    encodeComposition,
    decodeComposition,
} from '../../src/visualizer/compositionCodec';
import { appendStandaloneElements, synchronizeLayers, effectiveElements } from '../../src/visualizer/compositionModel';
import { instantiatePreset } from '../../src/visualizer/compositionPresets';
import { mergeResources } from '../../src/visualizer/resourceCodec';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { scene3dFixture } from '../support/scene3d-fixture';
import { sceneGroups } from '../../src/visualizer/scene3dModel';
import { compositionList } from '../../src/visualizer/compositionList';
import {
    canMoveComposition,
    compositionDropMove,
    compositionStepMove,
    moveComposition,
} from '../../src/visualizer/compositionMovement';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';
import { preparePresetExport } from '../../src/visualizer/presetExport';

function addPreset(p: VisualizerProjectV6) {
    const added = instantiatePreset('geometric-0.6', p.track.durationSeconds, p.elements.length);
    return {
        group: added.group,
        project: synchronizeLayers({
            ...p,
            elements: [...p.elements, ...added.elements],
            items: [...p.items, added.group],
            resources: mergeResources(p.resources, added.resources),
        }),
    };
}
function fixture() {
    const p = createComposition({
        contentHash: 'a'.repeat(64),
        fileName: 'layers.wav',
        durationSeconds: 20,
        sampleRate: 48000,
    });
    const first = addPreset(p),
        second = addPreset(first.project);
    const external = elementRegistry.create('starfield', 20, second.project.elements.length);
    external.seed = 123;
    return { p: appendStandaloneElements(second.project, [external]), a: first.group, b: second.group, external };
}
function checked(p: VisualizerProjectV6) {
    expect(validateComposition(p)).toEqual(p);
    expect(decodeComposition(encodeComposition(p).buffer as ArrayBuffer)).toEqual(p);
    expect(new Set(p.items.flatMap(i => (i.kind === 'element' ? [i.id] : i.children))).size).toBe(p.elements.length);
    expect(p.elements.map(e => e.layer)).toEqual(p.elements.map((_, i) => i));
    return p;
}

test('cross-preset insertion keeps all identities, configuration and effect references without mutating the source', () => {
    const { p, a, b, external } = fixture();
    const effect = elementRegistry.create('blur', 20, p.elements.length);
    effect.targets = { kind: 'elements', ids: [external.id] };
    const original = appendStandaloneElements(p, [effect]),
        before = structuredClone(original);
    const target = compositionList(original).find(n => n.id === a.id)!.children[1]!;
    const request = compositionDropMove(original, external.id, target.id, 'before')!;
    const moved = checked(moveComposition(original, request));
    expect(original).toEqual(before);
    expect(moved.elements.find(e => e.id === external.id)).toMatchObject({ ...external, layer: expect.any(Number) });
    expect(moved.elements.find(e => e.id === effect.id)!.targets).toEqual(effect.targets);
    const owner = moved.items.find(i => i.id === a.id)!;
    expect(owner.kind).toBe('preset');
    if (owner.kind !== 'preset') throw Error('preset');
    expect(owner.children).toContain(external.id);
    expect(owner.controls).toEqual(a.controls);
    const transferred = checked(moveComposition(moved, { id: external.id, parentId: b.id, beforeId: null }));
    expect(transferred.items.find(i => i.id === a.id)).not.toMatchObject({
        children: expect.arrayContaining([external.id]),
    });
    checked(moveComposition(transferred, { id: external.id, parentId: null, beforeId: b.id }));
});

test('departing elements leave shared controls; empty groups and empty controls are removed, never the elements', () => {
    let { p, a } = fixture();
    const controlled = a.controls[0]!.targets[0]!;
    const originalIds = p.elements.map(e => e.id).sort();
    p = checked(moveComposition(p, { id: controlled, parentId: null, beforeId: a.id }));
    const group = p.items.find(i => i.id === a.id)!;
    if (group.kind !== 'preset') throw Error('preset');
    expect(group.controls.every(c => c.targets.length && !c.targets.includes(controlled))).toBe(true);
    for (const id of [...group.children]) p = checked(moveComposition(p, { id, parentId: null, beforeId: a.id }));
    expect(p.items.some(i => i.id === a.id)).toBe(false);
    expect(p.elements.map(e => e.id).sort()).toEqual(originalIds);
});

test('buttons enter a neighboring preset, exit at its edges and move whole presets without nesting', () => {
    const { p, a, b, external } = fixture();
    // Root display is external, B, A. Down enters B at its first displayed child.
    const enter = compositionStepMove(p, external.id, 1)!;
    expect(enter).toMatchObject({ parentId: b.id, beforeId: [...b.children].reverse()[0] });
    let moved = checked(moveComposition(p, enter));
    const leave = compositionStepMove(moved, external.id, -1)!;
    expect(leave).toEqual({ id: external.id, parentId: null, beforeId: b.id });
    moved = checked(moveComposition(moved, leave));
    expect(compositionStepMove(moved, external.id, -1)).toBeNull();
    const groupStep = compositionStepMove(moved, b.id, 1)!;
    expect(groupStep.parentId).toBeNull();
    moved = checked(moveComposition(moved, groupStep));
    expect(compositionList(moved).map(i => i.id)).toEqual([external.id, a.id, b.id]);
    const bottom = [...a.children][0]!;
    const exitBottom = compositionStepMove(moved, bottom, 1)!;
    expect(exitBottom).toEqual({ id: bottom, parentId: null, beforeId: b.id });
    checked(moveComposition(moved, exitBottom));
});

test('moving into a hidden preset preserves own visibility; its new owner controls effective visibility', () => {
    const { p, a, external } = fixture();
    const owner = p.items.find(i => i.id === a.id)!;
    if (owner.kind !== 'preset') throw Error('preset');
    owner.enabled = false;
    const moved = checked(moveComposition(p, { id: external.id, parentId: a.id, beforeId: null }));
    expect(moved.elements.find(e => e.id === external.id)!.enabled).toBe(true);
    expect(effectiveElements(moved).find(e => e.id === external.id)!.enabled).toBe(false);
    const outside = checked(moveComposition(moved, { id: external.id, parentId: null, beforeId: a.id }));
    expect(effectiveElements(outside).find(e => e.id === external.id)!.enabled).toBe(true);
});

test('whole scenes transfer between root and presets with cameras, depth membership and effect targets intact', () => {
    const initial = addPreset(scene3dFixture()),
        scene = sceneGroups(initial.project)[0]!;
    scene.enabled = false;
    const fx = elementRegistry.create('blur', 20, initial.project.elements.length);
    fx.targets = { kind: 'scenes3d', ids: [scene.id] };
    const p = appendStandaloneElements(initial.project, [fx]);
    const moved = checked(moveComposition(p, { id: scene.id, parentId: initial.group.id, beforeId: null }));
    expect(sceneGroups(moved)[0]).toEqual(scene);
    expect(moved.elements.find(e => e.id === fx.id)!.targets).toEqual(fx.targets);
    const restored = checked(moveComposition(moved, { id: scene.id, parentId: null, beforeId: initial.group.id }));
    expect(sceneGroups(restored)[0]).toEqual(scene);
    for (const id of scene.children)
        expect(restored.elements.find(e => e.id === id)).toMatchObject({
            ...p.elements.find(e => e.id === id)!,
            layer: expect.any(Number),
        });
});

test('invalid parents, nesting, scene member escapes and stale targets cannot change the project', () => {
    const { p, a, b, external } = fixture();
    const before = structuredClone(p);
    for (const request of [
        { id: a.id, parentId: b.id, beforeId: null },
        { id: a.id, parentId: a.id, beforeId: null },
        { id: external.id, parentId: 'missing', beforeId: null },
        { id: external.id, parentId: a.id, beforeId: b.id },
        { id: 'missing', parentId: null, beforeId: null },
    ]) {
        expect(canMoveComposition(p, request)).toBe(false);
        expect(() => moveComposition(p, request)).toThrow();
    }
    expect(p).toEqual(before);
    expect(moveComposition(p, { id: external.id, parentId: null, beforeId: p.items.at(-2)!.id })).toBe(p);
    const world = scene3dFixture(),
        scene = sceneGroups(world)[0]!;
    expect(canMoveComposition(world, { id: world.elements[0]!.id, parentId: null, beforeId: scene.id })).toBe(false);
    expect(compositionStepMove(world, [...scene.children].reverse()[0]!, -1)).toBeNull();
    const withScreen = appendStandaloneElements(world, [external]);
    expect(canMoveComposition(withScreen, { id: external.id, parentId: scene.id, beforeId: null })).toBe(false);
    const request = compositionStepMove(world, [...scene.children].reverse()[0]!, 1)!;
    checked(moveComposition(world, request));
});

test('exported user presets restore moved element order, hidden state, bindings and seeds', () => {
    const { p, a, external } = fixture();
    external.enabled = false;
    const moved = moveComposition(p, { id: external.id, parentId: a.id, beforeId: null });
    const definition = preparePresetExport(
        moved,
        { title: '跨组后的预设', description: '', creator: '' },
        new Blob(['png'], { type: 'image/png' }),
    ).package.presets[0]!;
    const previous = {
        algorithms: structuredClone(elementRegistry.algorithms),
        elements: structuredClone(elementRegistry.list()),
        presets: structuredClone(elementRegistry.presets),
    };
    try {
        elementRegistry.replace({ ...previous, presets: [...previous.presets, definition] });
        const restored = instantiatePreset(definition, 20);
        expect(restored.elements.map(e => e.name)).toEqual(moved.elements.map(e => e.name));
        expect(restored.elements.map(e => e.enabled)).toEqual(moved.elements.map(e => e.enabled));
        expect(restored.elements.map(e => e.bindings)).toEqual(moved.elements.map(e => e.bindings));
        expect(restored.elements.find(e => e.resource.id === external.resource.id)!.seed).toBe(123);
    } finally {
        elementRegistry.replace(previous);
    }
});
