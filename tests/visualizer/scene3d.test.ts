import { expect, test } from 'vitest';
import { scene3dFixture } from '../support/scene3d-fixture';
import { cameraPoseAt, validateSceneCamera } from '../../src/visualizer/scene3dCodec';
import { defaultCamera } from '../../src/visualizer/scene3dTypes';
import {
    validateComposition,
    encodeComposition,
    decodeComposition,
    validateCompositionDraft,
} from '../../src/visualizer/compositionCodec';
import { validateAlgorithmDefinition } from '../../src/visualizer/algorithmCodec';
import { resourceHash } from '../../src/visualizer/resourceIdentity';
import { sceneGroups } from '../../src/visualizer/scene3dModel';
import { createRealtimeStyle, validateRealtimeStyle, realtimeRenderModel } from '../../src/visualizer/realtimeStyle';
import { effectiveElements, removeCompositionElement, reorderComposition } from '../../src/visualizer/compositionModel';
import { worldFragment } from '../../src/visualizer/worldDrawState';
import { moveWorldElement, updateScene3d } from '../../src/visualizer/scene3dActions';
import { preparePresetExport } from '../../src/visualizer/presetExport';
import { instantiatePreset } from '../../src/visualizer/compositionPresets';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { inspectRealtimeProject, inspectRealtimePreset } from '../../src/visualizer/realtimeCapabilities';
import { appendStandaloneElements } from '../../src/visualizer/compositionModel';

test('camera tracks use independent seconds, interpolation, looping and last-frame hold', () => {
    const c = validateSceneCamera({
        ...defaultCamera(),
        animation: {
            durationSeconds: 10,
            loop: false,
            keyframes: [
                { timeSeconds: 0, position: [0, 2, 6], target: [0, 0, 0], fov: 50 },
                { timeSeconds: 10, position: [4, 2, 6], target: [0, 0, 0], fov: 70 },
            ],
        },
    });
    expect(cameraPoseAt(c, 5)).toMatchObject({ position: [2, 2, 6], fov: 60 });
    expect(cameraPoseAt(c, 20)).toMatchObject({ position: [4, 2, 6], fov: 70 });
    c.animation!.loop = true;
    expect(cameraPoseAt(c, 15)).toEqual(cameraPoseAt(c, 5));
    expect(cameraPoseAt(c, -1)).toEqual(cameraPoseAt(c, 0));
    for (const patch of [{ near: 0 }, { far: 0.01 }, { fov: 180 }, { target: [0, 2, 6] }, { up: [0, 0, 0] }])
        expect(() => validateSceneCamera({ ...c, ...patch })).toThrow();
    c.animation!.keyframes[1]!.timeSeconds = 0;
    expect(() => validateSceneCamera(c)).toThrow();
});
test('V6 world geometry, camera and transforms survive independent project and realtime snapshots', () => {
    const p = scene3dFixture();
    expect(decodeComposition(encodeComposition(p).buffer as ArrayBuffer)).toEqual(p);
    const style = createRealtimeStyle(p, '共享镜头');
    expect(style.schemaVersion).toBe(2);
    expect(style.scenes3d).toHaveLength(1);
    expect(validateRealtimeStyle(JSON.parse(JSON.stringify(style)))).toEqual(style);
    expect(sceneGroups(realtimeRenderModel(style))[0]!.camera).toEqual(sceneGroups(p)[0]!.camera);
});
test('explicit V5 and V1 migrations preserve the complete original resource snapshot', () => {
    const p = appendStandaloneElements(
        { ...scene3dFixture(), elements: [], items: [], resources: { algorithms: [], elements: [], presets: [] } },
        [elementRegistry.create('radial-spectrum', 20, 0)],
    );
    const old = { ...p, schemaVersion: 5 };
    expect(validateComposition(old)).toEqual(p);
    expect(old.schemaVersion).toBe(5);
    expect(validateCompositionDraft({ schemaVersion: 5, savedAt: p.createdAt, project: old }).schemaVersion).toBe(6);
    const current = createRealtimeStyle(p, '旧样式');
    const style = { ...current, schemaVersion: 1 };
    expect(validateRealtimeStyle(style)).toEqual(current);
    expect(validateRealtimeStyle(style).resources).toEqual(p.resources);
    expect(style.schemaVersion).toBe(1);
});
test('world ownership rejects missing, duplicate and screen-space membership', () => {
    const p = scene3dFixture();
    expect(() => validateComposition({ ...p, items: p.elements.map(e => ({ kind: 'element', id: e.id })) })).toThrow();
    const scenes = sceneGroups(p);
    expect(() =>
        validateComposition({ ...p, items: [{ ...scenes[0], children: [p.elements[0]!.id, p.elements[0]!.id] }] }),
    ).toThrow();
    expect(() => validateComposition({ ...p, items: [{ ...scenes[0], endSeconds: 21 }] })).toThrow();
    scenes[0]!.enabled = false;
    expect(effectiveElements(p).every(e => !e.enabled)).toBe(true);
});
test('scene deletion and member sorting retain ownership and remove empty containers', () => {
    const p = scene3dFixture(),
        scene = sceneGroups(p)[0]!;
    const sorted = reorderComposition(p, [...scene.children], scene.id);
    expect(sceneGroups(sorted)[0]!.children).toEqual([...scene.children].reverse());
    const one = removeCompositionElement(p, p.elements[0]!.id);
    expect(sceneGroups(one)[0]!.children).toHaveLength(1);
    expect(removeCompositionElement(one, one.elements[0]!.id).items).toEqual([]);
    expect(removeCompositionElement(p, scene.id).elements).toEqual([]);
});
test('ABI 4 requires world geometry and owns opaque/cutout output semantics', () => {
    const p = scene3dFixture(),
        a = structuredClone(p.resources.algorithms[0]!);
    expect(validateAlgorithmDefinition(a).apiVersion).toBe(4);
    a.programs.mesh!.alphaMode = 'mask';
    a.programs.mesh!.alphaCutoff = 0.4;
    a.hash = resourceHash(a);
    expect(validateAlgorithmDefinition(a).programs.mesh!.alphaCutoff).toBe(0.4);
    expect(worldFragment(a.programs.mesh!)).toContain('discard');
    expect(worldFragment(a.programs.mesh!)).toContain('vec4(color.rgb, 1.0)');
    const source = structuredClone(a);
    source.programs.mesh!.uniforms.input = { type: 'source' };
    source.hash = resourceHash(source);
    expect(() => validateAlgorithmDefinition(source)).toThrow('二维效果输入');
    a.programs.mesh!.geometry = 'quad';
    a.hash = resourceHash(a);
    expect(() => validateAlgorithmDefinition(a)).toThrow();
});

test('realtime conversion excludes hidden scene targets and classifies partial preset scenes', () => {
    let p = scene3dFixture();
    const scene = sceneGroups(p)[0]!;
    const screen = elementRegistry.create('radial-spectrum', 20, 2);
    const effect = elementRegistry.create('blur', 20, 3);
    effect.targets = { kind: 'scenes3d', ids: [scene.id] };
    p = appendStandaloneElements(p, [screen, effect]);
    sceneGroups(p)[0]!.enabled = false;
    sceneGroups(p)[0]!.endSeconds = 10;
    expect(inspectRealtimeProject(p).browser).toBe(true);
    const style = createRealtimeStyle(p, '隐藏场景');
    expect(style.scenes3d).toBeUndefined();
    expect(style.elements.find(e => e.id === effect.id)!.targets).toEqual({ kind: 'scenes3d', ids: [] });
    p = updateScene3d(p, scene.id, { enabled: true, endSeconds: 20 });
    const exported = preparePresetExport(
        p,
        { title: '时段', description: '场景范围', creator: 'default' },
        new Blob(['image'], { type: 'image/png' }),
    );
    const preset = exported.package.presets[0]!;
    preset.scenes3d![0]!.enabled = false;
    preset.scenes3d![0]!.end = 0.5;
    const previous = {
        algorithms: [...elementRegistry.algorithms],
        elements: [...elementRegistry.list()],
        presets: [...elementRegistry.presets],
    };
    try {
        elementRegistry.replace({ ...p.resources, presets: [preset] });
        expect(inspectRealtimePreset(preset).browser).toBe(true);
        preset.scenes3d![0]!.enabled = true;
        expect(inspectRealtimePreset(preset).browserIssues).toContain('三维场景需要覆盖完整歌曲。');
        const instance = instantiatePreset(preset.id, 20);
        const hidden = { ...p, elements: instance.elements, items: [{ ...instance.group, enabled: false }] };
        const withScreen = appendStandaloneElements(hidden, [screen]);
        expect(inspectRealtimeProject(withScreen).browser).toBe(true);
    } finally {
        elementRegistry.replace(previous);
    }
});

test('moving a world member preserves transforms and independent cameras; exported presets remap scenes', () => {
    const p = scene3dFixture(),
        original = sceneGroups(p)[0]!;
    const split = validateComposition(moveWorldElement(p, p.elements[0]!.id, null));
    expect(sceneGroups(split)).toHaveLength(2);
    const joined = validateComposition(moveWorldElement(split, p.elements[0]!.id, original.id));
    expect(sceneGroups(joined)).toHaveLength(1);
    const changed = validateComposition(
        updateScene3d(joined, original.id, { camera: { ...original.camera, fov: 65 } }),
    );
    expect(sceneGroups(p)[0]!.camera.fov).toBe(50);
    const exported = preparePresetExport(
        changed,
        { title: '共享镜头', description: '两元素', creator: 'default' },
        new Blob(['image'], { type: 'image/png' }),
    );
    const preset = exported.package.presets[0]!;
    expect(preset.scenes3d![0]!.camera.fov).toBe(65);
    expect(preset.scenes3d![0]!.children).toEqual(['element-0', 'element-1']);
    const previous = {
        algorithms: structuredClone(elementRegistry.algorithms),
        elements: structuredClone(elementRegistry.list()),
        presets: structuredClone(elementRegistry.presets),
    };
    try {
        elementRegistry.replace({ ...changed.resources, presets: [preset] });
        const a = instantiatePreset(preset.id, 20),
            b = instantiatePreset(preset.id, 20);
        expect(a.group.scenes3d![0]!.id).not.toBe(b.group.scenes3d![0]!.id);
        expect(a.group.scenes3d![0]!.children).toEqual(a.elements.map(e => e.id));
        expect(a.group.scenes3d![0]!.camera.fov).toBe(65);
    } finally {
        elementRegistry.replace(previous);
    }
});
