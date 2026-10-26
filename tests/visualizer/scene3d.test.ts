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
    const p = scene3dFixture();
    p.elements = [];
    p.items = [];
    p.resources = { algorithms: [], elements: [], presets: [] };
    const old = { ...p, schemaVersion: 5 };
    expect(validateComposition(old)).toEqual(p);
    expect(old.schemaVersion).toBe(5);
    expect(validateCompositionDraft({ schemaVersion: 5, savedAt: p.createdAt, project: old }).schemaVersion).toBe(6);
    const style = {
        format: 'audiosurf-realtime-style',
        schemaVersion: 1,
        id: p.projectId,
        name: '旧样式',
        createdAt: p.createdAt,
        frameRate: 30,
        elements: [],
        resources: p.resources,
    };
    // Empty styles are rejected by their original content capability boundary as well.
    expect(() => validateRealtimeStyle(style)).toThrow('视觉元素');
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
    a.programs.mesh!.geometry = 'quad';
    a.hash = resourceHash(a);
    expect(() => validateAlgorithmDefinition(a)).toThrow();
});
