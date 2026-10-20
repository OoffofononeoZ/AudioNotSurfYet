import { expect, test } from 'vitest';
import { markerFixture } from './marker-input-fixture';
import { createEditorMarkerReader } from '../../src/visualizer/editorMarkerReader';
import { validateComposition, decodeComposition, encodeComposition } from '../../src/visualizer/compositionCodec';
import { validateAlgorithmDefinition } from '../../src/visualizer/algorithmCodec';
import { validateResourcePackage, validateResourceSnapshot } from '../../src/visualizer/resourceCodec';
import { resourceHash } from '../../src/visualizer/resourceIdentity';
import { compositionIssues } from '../../src/visualizer/compositionModel';
import { defaultMarkerBindings } from '../../src/visualizer/editorMarkerValidation';
import { resourceRef } from '../../src/visualizer/resourceIdentity';
import type { MarkerQuery } from '../../src/visualizer/editorMarkerTypes';

test('single-category grants can narrow a collection but cannot be widened, omitted or bound to multiple categories', async () => {
    const { project, pointLane, classA, classB } = markerFixture();
    const algorithm = project.resources.algorithms[0]!,
        definition = project.resources.elements[0]!,
        element = project.elements[0]!;
    definition.markerInputs![0]!.categorySelection = 'single';
    definition.hash = resourceHash(definition);
    element.resource = resourceRef(definition);
    expect(validateComposition(project).resources.elements[0]!.markerInputs![0]!.categorySelection).toBe('single');
    algorithm.contract.markerInputs![0]!.categorySelection = 'single';
    algorithm.hash = resourceHash(algorithm);
    definition.algorithm = resourceRef(algorithm);
    definition.hash = resourceHash(definition);
    element.resource = resourceRef(definition);
    expect(decodeComposition(encodeComposition(validateComposition(project)).buffer as ArrayBuffer)).toEqual(project);
    for (const innerClassIds of [undefined, [], [classA, classB]]) {
        const bad = structuredClone(project);
        bad.elements[0]!.markerBindings!.points = {
            kind: 'collection',
            laneId: pointLane,
            ...(innerClassIds ? { innerClassIds } : {}),
        };
        expect(() => validateComposition(bad)).toThrow(/一个分类/);
        await expect(
            createEditorMarkerReader(bad, () => true)(element.id, {
                inputId: 'points',
                startSeconds: 0,
                endSeconds: 1,
            }),
        ).rejects.toThrow(/一个分类/);
    }
    const widened = structuredClone(project.resources);
    delete widened.elements[0]!.markerInputs![0]!.categorySelection;
    widened.elements[0]!.hash = resourceHash(widened.elements[0]!);
    expect(() => validateResourceSnapshot(widened)).toThrow(/超出/);
    const malformed = structuredClone(algorithm);
    malformed.contract.markerInputs![0]!.selectionModes = ['single'];
    malformed.hash = resourceHash(malformed);
    expect(() => validateAlgorithmDefinition(malformed)).toThrow(/集合/);
});

test('point collections optionally include the right endpoint and cursors bind this option; other query kinds reject it', async () => {
    const { project, element, classA } = markerFixture();
    const lane = project.editorSnapshot!.project.lanes[0]!;
    if (lane.eventKind !== 'point') throw Error('Expected point fixture');
    lane.events.push({ id: crypto.randomUUID(), innerClassId: classA, atSeconds: 12 });
    const read = createEditorMarkerReader(project, () => true);
    expect((await read(element.id, { inputId: 'points', startSeconds: 11, endSeconds: 12 })).events).toEqual([]);
    expect(
        (await read(element.id, { inputId: 'points', startSeconds: 11, endSeconds: 12, includeEnd: true })).events,
    ).toEqual([lane.events.at(-1)]);
    const page = await read(element.id, { inputId: 'points', startSeconds: 0, endSeconds: 12, includeEnd: true });
    await expect(
        read(element.id, { inputId: 'points', startSeconds: 0, endSeconds: 12, cursor: page.nextCursor! }),
    ).rejects.toThrow(/游标/);
    const last = await read(element.id, {
        inputId: 'points',
        startSeconds: 0,
        endSeconds: 12,
        includeEnd: true,
        cursor: page.nextCursor!,
    });
    expect(last.events).toHaveLength(50);
    expect(last.events.at(-1)).toEqual(lane.events.at(-1));
    for (const query of [
        { inputId: 'points', startSeconds: 0, endSeconds: 1, includeEnd: 'yes' },
        { inputId: 'ranges', includeEnd: true },
    ])
        await expect(read(element.id, query as MarkerQuery)).rejects.toThrow();
    project.elements[0]!.markerBindings!.ranges = {
        kind: 'collection',
        laneId: project.editorSnapshot!.project.lanes[1]!.id,
    };
    await expect(
        createEditorMarkerReader(project, () => true)(element.id, {
            inputId: 'ranges',
            startSeconds: 0,
            endSeconds: 1,
            includeEnd: false,
        }),
    ).rejects.toThrow(/仅允许点集合/);
});

test('ABI 2 explicitly declares marker inputs and ABI 1 cannot request them', () => {
    const { algorithm } = markerFixture();
    expect(validateAlgorithmDefinition(algorithm)).toEqual(algorithm);
    for (const mutate of [
        (a: typeof algorithm) => (a.apiVersion = 1),
        (a: typeof algorithm) => (a.contract.markerInputs = []),
        (a: typeof algorithm) => (a.contract.markerInputs![0]!.selectionModes = []),
        (a: typeof algorithm) => (a.contract.timingInput = 'points'),
    ]) {
        const bad = structuredClone(algorithm);
        mutate(bad);
        bad.hash = resourceHash(bad);
        expect(() => validateAlgorithmDefinition(bad)).toThrow();
    }
});
test('element definitions cannot widen input grants and resource templates never contain actual project references', () => {
    const { project, definition, algorithm, element } = markerFixture();
    const bad = structuredClone(definition);
    bad.markerInputs![0]!.eventKind = 'range';
    bad.hash = resourceHash(bad);
    expect(() => validateResourceSnapshot({ ...project.resources, elements: [bad] })).toThrow();
    const preset = {
        id: 'marker-preset',
        version: 1,
        hash: '',
        title: 'Fixture',
        description: 'Fixture',
        preview: 'geometric',
        elements: [
            {
                key: 'fixture',
                element: element.resource,
                name: element.name,
                enabled: true,
                timing: { kind: 'relative', start: 0, end: 1 },
                bindings: [],
                markerBindings: element.markerBindings,
            },
        ],
        controls: [],
    };
    preset.hash = resourceHash(preset);
    const pack = {
        format: 'audiosurf-visualizer-resource',
        schemaVersion: 2,
        id: 'marker-preset',
        version: 1,
        algorithms: [],
        elements: [],
        presets: [preset],
    };
    expect(() => validateResourcePackage(pack, project.resources)).toThrow(/资源包不能/);
    preset.elements[0]!.markerBindings = defaultMarkerBindings(definition.markerInputs)!;
    preset.hash = resourceHash(preset);
    expect(validateResourcePackage(pack, project.resources).presets).toHaveLength(1);
    expect(algorithm.apiVersion).toBe(2);
});
test('V5 snapshots carry marker selections, validate lane/class/event references and preserve the previous project on failure', () => {
    const { project } = markerFixture(),
        before = structuredClone(project);
    const bytes = encodeComposition(project);
    expect(decodeComposition(bytes.buffer as ArrayBuffer)).toEqual(project);
    for (const mutate of [
        (p: typeof project) => delete p.editorSnapshot,
        (p: typeof project) => p.editorSnapshot!.project.lanes.splice(0, 1),
        (p: typeof project) =>
            (p.elements[0]!.markerBindings!.points = {
                kind: 'collection',
                laneId: p.editorSnapshot!.project.lanes[0]!.id,
                innerClassIds: ['missing'],
            }),
    ]) {
        const bad = structuredClone(project);
        mutate(bad);
        expect(() => validateComposition(bad)).toThrow();
        expect(project).toEqual(before);
    }
    const unbound = structuredClone(project);
    unbound.elements[0]!.markerBindings!.points = { kind: 'unbound' };
    expect(compositionIssues(validateComposition(unbound))).toContain('标记测试：标记输入未配置');
});
test('single range queries return only the selected event and cannot name another input or lane', async () => {
    const { project, element } = markerFixture(),
        read = createEditorMarkerReader(project, () => true);
    const page = await read(element.id, { inputId: 'ranges' });
    expect(page).toMatchObject({ eventKind: 'range', nextCursor: null });
    expect(page.events).toHaveLength(1);
    expect(page.events[0]).toMatchObject({ startSeconds: 2, endSeconds: 3 });
    await expect(read(element.id, { inputId: 'unknown' })).rejects.toThrow(/未声明/);
    await expect(read('other-instance', { inputId: 'ranges' })).rejects.toThrow(/元素不存在/);
    await expect(read(element.id, { inputId: 'ranges', startSeconds: 0, endSeconds: 12 })).rejects.toThrow();
    (page.events[0] as { startSeconds: number }).startSeconds = 99;
    expect((await read(element.id, { inputId: 'ranges' })).events[0]).toMatchObject({ startSeconds: 2 });
});
test('collection queries filter classes, paginate without omissions and reject other-owner/window/revision cursors', async () => {
    const { project, element } = markerFixture(),
        read = createEditorMarkerReader(project, () => true);
    const first = await read(element.id, { inputId: 'points', startSeconds: 0, endSeconds: 12 });
    expect(first.events).toHaveLength(256);
    expect(first.nextCursor).toBeTruthy();
    const second = await read(element.id, {
        inputId: 'points',
        startSeconds: 0,
        endSeconds: 12,
        cursor: first.nextCursor!,
    });
    expect(second.events).toHaveLength(49);
    expect(second.nextCursor).toBeNull();
    const all = [...first.events, ...second.events];
    expect(new Set(all.map(e => e.id)).size).toBe(305);
    expect(all.every(e => e.innerClassId === project.editorSnapshot!.project.lanes[0]!.innerClasses[0]!.id)).toBe(true);
    const window = await read(element.id, { inputId: 'points', startSeconds: 0.5, endSeconds: 1 });
    expect(window.events).toHaveLength(25);
    await expect(
        read(element.id, { inputId: 'points', startSeconds: 0, endSeconds: 1, cursor: first.nextCursor! }),
    ).rejects.toThrow(/游标/);
    await expect(
        createEditorMarkerReader(project, () => true)(element.id, {
            inputId: 'points',
            startSeconds: 0,
            endSeconds: 12,
            cursor: first.nextCursor!,
        }),
    ).rejects.toThrow(/游标/);
    project.elements.push({ ...structuredClone(element), id: crypto.randomUUID() });
    await expect(
        read(project.elements[1]!.id, {
            inputId: 'points',
            startSeconds: 0,
            endSeconds: 12,
            cursor: first.nextCursor!,
        }),
    ).rejects.toThrow(/游标/);
});

test('single points are exact and collections return only permitted categories even when empty', async () => {
    const { project, element, pointLane, classB } = markerFixture();
    const lane = project.editorSnapshot!.project.lanes[0]!;
    element.markerBindings!.points = { kind: 'single', laneId: pointLane, eventId: lane.events[1]!.id };
    project.elements[0]!.markerBindings = element.markerBindings;
    expect((await createEditorMarkerReader(project, () => true)(element.id, { inputId: 'points' })).events).toEqual([
        lane.events[1],
    ]);
    project.elements[0]!.markerBindings!.points = { kind: 'collection', laneId: pointLane, innerClassIds: [classB] };
    lane.events = [];
    expect(
        (
            await createEditorMarkerReader(project, () => true)(element.id, {
                inputId: 'points',
                startSeconds: 0,
                endSeconds: 12,
            })
        ).events,
    ).toEqual([]);
});
test('range collection windows use half-open overlap, legal empty collections remain ready, stale reads reject', async () => {
    const { project, element, rangeLane } = markerFixture();
    project.elements[0]!.markerBindings!.ranges = { kind: 'collection', laneId: rangeLane };
    let current = true;
    const read = createEditorMarkerReader(project, () => current);
    expect((await read(element.id, { inputId: 'ranges', startSeconds: 2, endSeconds: 3 })).events).toHaveLength(1);
    expect((await read(element.id, { inputId: 'ranges', startSeconds: 5, endSeconds: 6 })).events).toEqual([]);
    for (const query of [
        { inputId: 'points', startSeconds: -1, endSeconds: 1 },
        { inputId: 'points', startSeconds: 1, endSeconds: 1 },
        { inputId: 'points', startSeconds: 0, endSeconds: 13 },
    ])
        await expect(read(element.id, query)).rejects.toThrow(/越界/);
    const pending = read(element.id, { inputId: 'ranges', startSeconds: 0, endSeconds: 4 });
    current = false;
    await expect(pending).rejects.toThrow(/失效/);
});
