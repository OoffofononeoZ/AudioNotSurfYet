import { expect, test } from 'vitest';
import { tooltipField } from '../../src/visualizer/attributeMetadata';
import { validateResourcePackage } from '../../src/visualizer/resourceCodec';
import { resourceHash, resourceRef } from '../../src/visualizer/resourceIdentity';
import { validateMarkerDefinitions } from '../../src/visualizer/editorMarkerValidation';
import { validateMediaDefinitions } from '../../src/visualizer/mediaCodec';
import { validateLyricDefinitions } from '../../src/visualizer/lyricCodec';
import { validateAlgorithmContract } from '../../src/visualizer/algorithmCodec';
import { createComposition, encodeComposition, decodeComposition } from '../../src/visualizer/compositionCodec';
import { instantiatePreset } from '../../src/visualizer/compositionPresets';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { synchronizeLayers } from '../../src/visualizer/compositionModel';

const seal = <T extends object>(value: T) => ({ ...value, hash: resourceHash(value) });
function resource(tooltip?: unknown) {
    const meta = tooltip === undefined ? {} : { tooltip };
    const parameter = {
        id: 'amount',
        valueKind: 'number',
        allowedSourceKinds: ['constant'],
        range: { min: 0, max: 2 },
    };
    const algorithm = seal({
        id: 'tooltip-test',
        version: 1,
        apiVersion: 1,
        contract: { kind: 'visual', parameters: [parameter], sharedParameters: ['amount'], historyParameters: [] },
        source: 'export function create(){return {prepareFrame(){return {passes:[]}}}}',
        programs: { draw: { vertex: 'void main(){}', fragment: 'void main(){}', geometry: 'quad', uniforms: {} } },
    });
    const element = seal({
        id: 'tooltip-test',
        version: 1,
        algorithm: resourceRef(algorithm),
        kind: 'visual',
        title: '测试',
        icon: 'square',
        parameters: [{ ...parameter, label: '强度', defaultValue: 1, ...meta }],
    });
    const preset = seal({
        id: 'tooltip-preset',
        version: 1,
        title: '测试预设',
        description: '测试',
        preview: 'geometric',
        elements: [
            {
                key: 'one',
                element: resourceRef(element),
                name: '测试',
                enabled: true,
                bindings: [{ parameterId: 'amount', source: { kind: 'constant', value: 1 } }],
                timing: { kind: 'relative', start: 0, end: 1 },
            },
        ],
        controls: [
            {
                id: 'amount',
                label: '共同强度',
                kind: 'value',
                parameterId: 'amount',
                targets: ['one'],
                value: 1,
                ...meta,
            },
        ],
    });
    return {
        format: 'audiosurf-visualizer-resource',
        schemaVersion: 2,
        id: 'tooltip-test',
        version: 1,
        algorithms: [algorithm],
        elements: [element],
        presets: [preset],
    };
}
const marker = { id: 'points', eventKind: 'point' as const, selectionModes: ['single' as const] };
const media = { id: 'image', kinds: ['image' as const], multiple: false };
const lyrics = { id: 'lyrics' };
const definitions = [
    (tooltip: unknown) => validateMarkerDefinitions([{ ...marker, label: '标记', tooltip }], [marker]),
    (tooltip: unknown) => validateMediaDefinitions([{ ...media, label: '媒体', tooltip }], [media]),
    (tooltip: unknown) => validateLyricDefinitions([{ ...lyrics, label: '歌词', tooltip }], [lyrics]),
];

test('all attribute definitions preserve exact plain text including whitespace, line breaks and markup', () => {
    for (const tooltip of ['', '  ', ' 原始说明\n<b>只是文本</b> ']) {
        const pack = resource(tooltip);
        expect(validateResourcePackage(pack)).toEqual(pack);
        for (const read of definitions) expect(read(tooltip)![0]!.tooltip).toBe(tooltip);
    }
    expect(tooltipField(undefined)).toEqual({});
    const legacy = resource();
    expect(validateResourcePackage(legacy)).toEqual(legacy);
    expect(legacy.elements[0]!.parameters[0]).not.toHaveProperty('tooltip');
    expect(legacy.presets[0]!.controls[0]).not.toHaveProperty('tooltip');
});

test('non-string tooltip values are rejected rather than silently discarded', () => {
    for (const tooltip of [null, 0, true, [], {}]) {
        expect(() => validateResourcePackage(resource(tooltip))).toThrow(/tooltip/);
        for (const read of definitions) expect(() => read(tooltip)).toThrow(/tooltip/);
        const pack = resource('valid');
        pack.presets[0]!.controls[0]!.tooltip = tooltip;
        pack.presets[0]!.hash = resourceHash(pack.presets[0]!);
        expect(() => validateResourcePackage(pack)).toThrow(/tooltip/);
    }
});

test('tooltip belongs to resource identity and never expands the algorithm contract', () => {
    const pack = resource('before');
    pack.elements[0]!.parameters[0]!.tooltip = 'after';
    expect(() => validateResourcePackage(pack)).toThrow(/SHA-256/);
    const contract = resource().algorithms[0]!.contract;
    expect(() =>
        validateAlgorithmContract({ ...contract, parameters: [{ ...contract.parameters[0], tooltip: 'invalid' }] }),
    ).toThrow();
});

test('preset instantiation, project encoding and restoration retain parameter and common-control help', () => {
    const snapshot = {
        algorithms: structuredClone(elementRegistry.algorithms),
        elements: structuredClone(elementRegistry.list()),
        presets: structuredClone(elementRegistry.presets),
    };
    try {
        const pack = validateResourcePackage(resource('持久说明\n第二行'));
        elementRegistry.replace(pack);
        const added = instantiatePreset('tooltip-preset', 3);
        const project = synchronizeLayers({
            ...createComposition({
                contentHash: 'a'.repeat(64),
                fileName: 'test.wav',
                durationSeconds: 3,
                sampleRate: 48000,
            }),
            resources: added.resources,
            elements: added.elements,
            items: [added.group],
        });
        const restored = decodeComposition(encodeComposition(project).buffer as ArrayBuffer);
        expect(restored).toEqual(project);
        expect(restored.resources.elements[0]!.parameters[0]!.tooltip).toBe('持久说明\n第二行');
        expect(restored.items[0]).toMatchObject({ controls: [{ tooltip: '持久说明\n第二行' }] });
    } finally {
        elementRegistry.replace(snapshot);
    }
});
