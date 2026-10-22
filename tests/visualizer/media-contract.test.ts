import { test, expect } from 'vitest';
import { hashBytes } from '../../src/processing/sha256';
import {
    validateMediaAssets,
    validateMediaBindings,
    validateMediaDefinitions,
    defaultMediaBindings,
} from '../../src/visualizer/mediaCodec';
import { validateAlgorithmDefinition } from '../../src/visualizer/algorithmCodec';
import { validateDrawPacket } from '../../src/visualizer/drawPacket';
import { resourceHash, resourceRef } from '../../src/visualizer/resourceIdentity';
import { validateResourceSnapshot } from '../../src/visualizer/resourceCodec';
import {
    createComposition,
    validateComposition,
    encodeComposition,
    decodeComposition,
} from '../../src/visualizer/compositionCodec';
import { createDefinitionElement } from '../../src/visualizer/elementRegistry';
import { createRealtimeStyle, validateRealtimeStyle } from '../../src/visualizer/realtimeStyle';
import { inspectRealtimeContent } from '../../src/visualizer/realtimeCapabilities';
import { mediaSelection, videoTime } from '../../src/visualizer/mediaTimeline';
import type { AlgorithmDefinition } from '../../src/visualizer/algorithmTypes';
import type { MediaInputDefinition, MediaAsset } from '../../src/visualizer/mediaTypes';
const input: MediaInputDefinition = { id: 'background', label: '背景', kinds: ['image', 'video'], multiple: true };
const bytes = new Uint8Array([1, 2, 3]);
const asset: MediaAsset = { id: hashBytes(bytes), name: 'picture.png', mimeType: 'image/png', data: 'AQID' };
const binding = {
    kind: 'media' as const,
    assetIds: [asset.id],
    fit: 'cover' as const,
    intervalSeconds: 10,
    crossfadeSeconds: 1,
};
const seal = <T extends object>(v: T) => ({ ...v, hash: resourceHash(v) });
function algorithm() {
    return seal({
        id: 'media-fixture',
        version: 1,
        apiVersion: 3,
        contract: {
            kind: 'visual',
            parameters: [],
            sharedParameters: [],
            historyParameters: [],
            mediaInputs: [{ id: input.id, kinds: input.kinds, multiple: true }],
            executionModes: ['timeline', 'realtime'],
        },
        source: 'export function create(){return {prepareFrame(){return {passes:[]}}}}',
        programs: {
            draw: {
                vertex: 'void main(){}',
                fragment: 'void main(){}',
                geometry: 'quad',
                uniforms: { uImage: { type: 'media', inputId: 'background', slot: 'current' } },
            },
        },
    }) as AlgorithmDefinition;
}
function project() {
    const a = algorithm();
    const e = seal({
        id: 'media-fixture',
        version: 1,
        algorithm: resourceRef(a),
        kind: 'visual',
        title: '媒体',
        icon: 'square',
        parameters: [],
        mediaInputs: [input],
    });
    const resources = validateResourceSnapshot({ algorithms: [a], elements: [e], presets: [] });
    const p = createComposition({
        contentHash: 'a'.repeat(64),
        fileName: 'song.wav',
        durationSeconds: 12,
        sampleRate: 48000,
    });
    const element = createDefinitionElement(resources.elements[0]!, 12, 0);
    element.mediaBindings = { background: binding };
    return validateComposition({
        ...p,
        resources,
        elements: [element],
        items: [{ kind: 'element', id: element.id }],
        mediaAssets: [asset],
    });
}
test('ABI 3 media contract is hash-bound and cannot grant undeclared texture access', () => {
    expect(validateAlgorithmDefinition(algorithm()).apiVersion).toBe(3);
    const a = algorithm();
    a.programs.draw!.uniforms.uImage!.inputId = 'private';
    a.hash = resourceHash(a);
    expect(() => validateAlgorithmDefinition(a)).toThrow(/声明/);
    const old = algorithm();
    old.apiVersion = 2;
    old.hash = resourceHash(old);
    expect(() => validateAlgorithmDefinition(old)).toThrow();
    expect(() =>
        validateMediaDefinitions(
            [{ ...input, kinds: ['image', 'video'] }],
            [{ id: input.id, kinds: ['image'], multiple: true }],
        ),
    ).toThrow();
});
test('media shader packets can only name the declared input', () => {
    const a = algorithm();
    expect(
        validateDrawPacket({ passes: [{ program: 'draw', uniforms: { uImage: 'background' } }] }, a).passes,
    ).toHaveLength(1);
    for (const value of ['private', 'https://example.com/a.png', { input: 'background' }])
        expect(() => validateDrawPacket({ passes: [{ program: 'draw', uniforms: { uImage: value } }] }, a)).toThrow();
});
test('portable media rejects corrupt bytes, duplicate IDs and undeclared fields', () => {
    expect(validateMediaAssets([asset])![0]!.id).toBe(asset.id);
    for (const raw of [
        [{ ...asset, data: 'AQIE' }],
        [asset, asset],
        [{ ...asset, url: 'file:///secret' }],
        [{ ...asset, data: '!!!!' }],
    ])
        expect(() => validateMediaAssets(raw)).toThrow();
});
test('bindings distinguish intentional empty media from missing or invalid input', () => {
    expect(defaultMediaBindings([input])).toEqual({ background: { kind: 'none' } });
    expect(() => validateMediaBindings(undefined, [input])).toThrow();
    expect(() => validateMediaBindings({ background: binding }, [input], [])).toThrow(/缺失/);
    expect(() => validateMediaBindings({ background: binding }, [input], [asset], true)).toThrow();
    expect(() => validateMediaBindings({ background: { ...binding, crossfadeSeconds: 11 } }, [input], [asset])).toThrow(
        /时间/,
    );
    expect(() => validateMediaBindings({ background: binding }, undefined, [asset])).toThrow();
});
test('media snapshots roundtrip independently of external files and retain no optional fields in old projects', () => {
    const p = project(),
        restored = decodeComposition(encodeComposition(p).buffer as ArrayBuffer);
    expect(restored.mediaAssets).toEqual([asset]);
    expect(restored.elements[0]!.mediaBindings).toEqual({ background: binding });
    const style = createRealtimeStyle(restored, '媒体样式');
    expect(validateRealtimeStyle(JSON.parse(JSON.stringify(style))).mediaAssets).toEqual([asset]);
    const missing = structuredClone(p);
    delete missing.mediaAssets;
    expect(() => validateComposition(missing)).toThrow(/缺失/);
    const plain = createComposition(p.track);
    expect(plain).not.toHaveProperty('mediaAssets');
});
test('only explicitly dual-mode ABI 3 history algorithms enter realtime mode', () => {
    const p = project(),
        a = p.resources.algorithms[0]!;
    a.contract.historyParameters = [];
    expect(inspectRealtimeContent(p.elements, p.resources, 12).wallpaper).toBe(true);
    a.contract.executionModes = ['timeline'];
    expect(inspectRealtimeContent(p.elements, p.resources, 12).browser).toBe(false);
});
test('slideshow boundaries and loop timestamps are determined by absolute time', () => {
    const b = { ...binding, assetIds: ['a', 'b', 'c'] };
    expect(mediaSelection(b, 0)).toEqual({ current: 0, next: 1, mix: 0 });
    expect(mediaSelection(b, 9.5)).toEqual({ current: 0, next: 1, mix: 0.5 });
    expect(mediaSelection(b, 10)).toEqual({ current: 1, next: 2, mix: 0 });
    expect(mediaSelection(b, 30)).toEqual({ current: 0, next: 1, mix: 0 });
    expect(videoTime(8, 3)).toBe(2);
    expect(videoTime(3, 3)).toBe(0);
    expect(() => videoTime(0, 0)).toThrow();
});
