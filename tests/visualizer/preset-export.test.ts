import { beforeEach, expect, test, vi } from 'vitest';
import { createComposition } from '../../src/visualizer/compositionCodec';
import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { instantiatePreset } from '../../src/visualizer/compositionPresets';
import { preparePresetExport } from '../../src/visualizer/presetExport';
import { savePresetDirectory } from '../../src/visualizer/presetDirectoryWriter';
import { readResourceDirectory, type ResourceDirectoryHandle } from '../../src/visualizer/resourceDirectory';
import { resourceRef, resourceHash } from '../../src/visualizer/resourceIdentity';
import { validateResourcePackage } from '../../src/visualizer/resourceCodec';
import { hashBytes } from '../../src/processing/sha256';
const track = { contentHash: 'a'.repeat(64), fileName: 'export.wav', durationSeconds: 10, sampleRate: 48000 };
const cover = new Blob(['png'], { type: 'image/png' });
const details = { title: '我的预设', description: '说明', creator: '测试作者' };
function project() {
    return appendStandaloneElements(
        createComposition(track),
        ['solid', 'starfield', 'blur'].map((id, i) => elementRegistry.create(id, 10, i)),
    );
}

test('exports active standalone and grouped leaves with exact values, seeds and effect references', () => {
    const p = project();
    p.elements[1]!.seed = 123;
    p.elements[2]!.targets = { kind: 'elements', ids: [p.elements[1]!.id] };
    const grouped = instantiatePreset('geometric-0.6', 10, p.elements.length);
    p.elements.push(...grouped.elements);
    p.items.push(grouped.group);
    p.resources.algorithms.push(...grouped.resources.algorithms);
    p.resources.elements.push(...grouped.resources.elements);
    p.resources.presets.push(...grouped.resources.presets);
    grouped.elements[1]!.enabled = false;
    const before = structuredClone(p);
    const result = preparePresetExport(p, details, cover),
        preset = result.package.presets[0]!;
    expect(p).toEqual(before);
    expect(preset.elements).toHaveLength(p.elements.length - 1);
    expect(preset.elements[1]!.seed).toBe(123);
    expect(preset.elements[2]!.targets).toEqual({ kind: 'elements', ids: ['element-1'] });
    expect(preset.elements[1]!.bindings).toEqual(p.elements[1]!.bindings);
    expect(preset.elements.every(e => e.timing.kind === 'relative' && e.timing.start === 0 && e.timing.end === 1)).toBe(
        true,
    );
    expect(preset.controls).toEqual([]);
    expect(result.package.algorithms).toEqual([]);
    expect(result.package.elements).toEqual([]);
    expect(result.info).toMatchObject({
        kind: 'preset',
        title: details.title,
        creator: details.creator,
        previewPath: 'preview.png',
    });
    const hidden = {
        ...p,
        items: p.items.map(item => (item.id === grouped.group.id ? { ...grouped.group, enabled: false } : item)),
    };
    expect(preparePresetExport(hidden, details, cover).package.presets[0]!.elements).toHaveLength(3);
});

test('uses realtime browser eligibility and rejects song-only or empty content', () => {
    const p = project();
    p.elements[0]!.timing = { kind: 'manual', startSeconds: 1, endSeconds: 10 };
    expect(() => preparePresetExport(p, details, cover)).toThrow(/局部分镜/);
    p.elements.forEach(e => (e.enabled = false));
    expect(() => preparePresetExport(p, details, cover)).toThrow(/没有启用/);
    expect(() => preparePresetExport(project(), { ...details, title: ' ' }, cover)).toThrow(/名称/);
    expect(() => preparePresetExport(project(), details, new Blob())).toThrow(/封面/);
});

test('media and configured seeds survive V2 validation and adding to a different song', () => {
    const p = appendStandaloneElements(createComposition(track), [
        elementRegistry.create('circular-background', 10, 0),
        elementRegistry.create('starfield', 10, 1),
    ]);
    const bytes = new Uint8Array([1, 2, 3]);
    const asset = { id: hashBytes(bytes), name: 'test.png', mimeType: 'image/png' as const, data: 'AQID' };
    p.mediaAssets = [asset];
    p.elements[1]!.seed = 77;
    const input = p.resources.elements.find(e => e.id === 'circular-background')!.mediaInputs![0]!.id;
    p.elements[0]!.mediaBindings![input] = {
        kind: 'media',
        assetIds: [asset.id],
        fit: 'contain',
        intervalSeconds: 7,
        crossfadeSeconds: 0.5,
    };
    const pack = preparePresetExport(p, details, cover).package;
    const preset = validateResourcePackage(pack, p.resources).presets[0]!;
    expect(preset.mediaAssets).toEqual([asset]);
    const snapshot = structuredClone({
        algorithms: elementRegistry.algorithms,
        elements: elementRegistry.list(),
        presets: elementRegistry.presets,
    });
    try {
        elementRegistry.replace({ ...snapshot, presets: [...snapshot.presets, preset] });
        const added = instantiatePreset(preset, 25);
        expect(added.elements[0]!.timing).toEqual({ kind: 'manual', startSeconds: 0, endSeconds: 25 });
        expect(added.elements[0]!.mediaBindings).toEqual(p.elements[0]!.mediaBindings);
        expect(added.elements[1]!.seed).toBe(77);
        expect(added.mediaAssets).toEqual([asset]);
        const old = structuredClone(preset);
        delete old.elements[1]!.seed;
        old.hash = resourceHash(old);
        elementRegistry.replace({ ...snapshot, presets: [...snapshot.presets, old] });
        expect(instantiatePreset(old, 20).elements[1]!.seed).toBeNull();
    } finally {
        elementRegistry.replace(snapshot);
    }
});

class Directory {
    kind = 'directory' as const;
    children = new Map<
        string,
        Directory | { kind: 'file'; getFile(): Promise<File>; createWritable(): Promise<unknown> }
    >();
    requestPermission = vi.fn(async () => 'granted');
    queryPermission = vi.fn(async () => 'granted');
    failWrite = '';
    cleanupFailure = false;
    abort?: AbortController;
    name: string;
    private owner?: Directory;
    constructor(name: string, owner?: Directory) {
        this.name = name;
        this.owner = owner;
    }
    async *entries() {
        yield* this.children.entries();
    }
    async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<Directory> {
        let entry = this.children.get(name);
        if (!entry && options?.create) {
            entry = new Directory(name, this.owner ?? this);
            this.children.set(name, entry);
        }
        if (!entry || entry.kind !== 'directory') throw new DOMException('missing', 'NotFoundError');
        return entry;
    }
    async getFileHandle(name: string, options?: { create?: boolean }) {
        let entry = this.children.get(name);
        if (!entry && options?.create) {
            let content: string | Blob = '';
            const owner = this.owner ?? this;
            entry = {
                kind: 'file',
                getFile: async () => new File([content], name),
                createWritable: async () => ({
                    write: async (value: string | Blob) => {
                        if (owner.failWrite === name) throw Error('disk full');
                        content = value;
                        owner.abort?.abort();
                    },
                    close: async () => {},
                    abort: async () => {},
                }),
            };
            this.children.set(name, entry);
        }
        if (!entry || entry.kind !== 'file') throw new DOMException('missing', 'NotFoundError');
        return entry as {
            getFile(): Promise<File>;
            createWritable(): Promise<{ write(value: string | Blob): Promise<void>; close(): Promise<void> }>;
        };
    }
    async removeEntry(name: string) {
        if ((this.owner ?? this).cleanupFailure) throw Error('denied');
        this.children.delete(name);
    }
    handle() {
        return this as unknown as ResourceDirectoryHandle;
    }
}
async function target(p = project()) {
    const root = new Directory('assets'),
        elements = await root.getDirectoryHandle('elements', { create: true });
    await root.getDirectoryHandle('presets', { create: true });
    for (const e of p.resources.elements) {
        const directory = await elements.getDirectoryHandle(e.id, { create: true });
        const source = await directory.getDirectoryHandle('source', { create: true });
        for (const [dir, name, value] of [
            [
                directory,
                'resource-package.json',
                {
                    format: 'audiosurf-visualizer-resource',
                    schemaVersion: 2,
                    id: e.id,
                    version: e.version,
                    elements: [e],
                    algorithms: p.resources.algorithms.filter(a => a.hash === e.algorithm.hash),
                    presets: [],
                },
            ],
            [
                directory,
                'resource-info.json',
                {
                    schemaVersion: 1,
                    resource: resourceRef(e),
                    kind: e.kind,
                    title: e.title,
                    description: e.title,
                    creator: 'default',
                    createdAt: p.createdAt,
                    sourceEntry: 'source/resource.json',
                    packagePath: 'resource-package.json',
                    dependencies: [],
                    order: 0,
                },
            ],
            [source, 'resource.json', {}],
        ] as const) {
            const writer = await (await dir.getFileHandle(name, { create: true })).createWritable();
            await writer.write(JSON.stringify(value));
            await writer.close();
        }
    }
    return root;
}
beforeEach(() => vi.restoreAllMocks());
test('saved preset is visible through the normal directory reader and existing elements stay unchanged', async () => {
    const root = await target(),
        before = await readResourceDirectory(root.handle(), new AbortController().signal);
    const prepared = preparePresetExport(project(), details, cover),
        signal = new AbortController().signal;
    expect(await savePresetDirectory(root.handle(), prepared, signal)).toBe('presets/' + prepared.package.id);
    const after = await readResourceDirectory(root.handle(), signal);
    expect(after.resources.elements).toEqual(before.resources.elements);
    expect(after.resources.presets).toEqual(prepared.package.presets);
    await expect(savePresetDirectory(root.handle(), prepared, signal)).rejects.toThrow(/已存在/);
});
test('permission refusal, missing or mismatched dependencies do not create a preset', async () => {
    const prepared = preparePresetExport(project(), details, cover);
    for (const kind of ['permission', 'missing', 'mismatch']) {
        const root = await target();
        if (kind === 'permission') root.requestPermission.mockResolvedValue('denied');
        if (kind === 'missing') (await root.getDirectoryHandle('elements')).children.delete('starfield');
        if (kind === 'mismatch')
            prepared.info.dependencies = prepared.info.dependencies.map(e => ({ ...e, version: e.version + 1 }));
        await expect(savePresetDirectory(root.handle(), prepared, new AbortController().signal)).rejects.toThrow(
            kind === 'permission' ? /权限/ : /依赖/,
        );
        expect((await root.getDirectoryHandle('presets')).children.size).toBe(0);
    }
});
test('write failure or cancellation removes only the new directory and cleanup failure reports its path', async () => {
    for (const kind of ['write', 'abort', 'cleanup']) {
        const root = await target(),
            controller = new AbortController();
        const presets = await root.getDirectoryHandle('presets');
        const existing = preparePresetExport(project(), details, cover);
        await savePresetDirectory(root.handle(), existing, new AbortController().signal);
        if (kind === 'abort') root.abort = controller;
        else root.failWrite = 'resource-package.json';
        root.cleanupFailure = kind === 'cleanup';
        await expect(
            savePresetDirectory(root.handle(), preparePresetExport(project(), details, cover), controller.signal),
        ).rejects.toThrow(
            kind === 'cleanup' ? /assets\/presets\/user-preset-/ : kind === 'abort' ? /abort/i : /disk full/,
        );
        expect(presets.children.has(existing.package.id)).toBe(true);
        if (kind !== 'cleanup') expect(presets.children.size).toBe(1);
    }
});
