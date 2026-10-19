import { record, keys, text, integer } from './projectValidation';
import {
    mergeResources,
    validateResourcePackage,
    validateResourceRef,
    validateResourceSnapshot,
} from './resourceCodec';
import { resourceKey, sameResource } from './resourceIdentity';
import type { ResourceRef, ResourceSnapshot } from './resourceTypes';

export interface ResourceInfo {
    schemaVersion: 1;
    resource: ResourceRef;
    kind: 'visual' | 'modifier' | 'transition' | 'preset';
    title: string;
    description: string;
    creator: string;
    createdAt: string;
    previewPath: string;
    sourceEntry: string;
    packagePath: string;
    dependencies: ResourceRef[];
    order: number;
}
export type ResourceDirectoryHandle = FileSystemDirectoryHandle & {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    queryPermission(options: { mode: 'read' }): Promise<PermissionState>;
    requestPermission(options: { mode: 'read' }): Promise<PermissionState>;
};
export interface DirectoryCandidate {
    resources: ResourceSnapshot;
    entries: Array<{ info: ResourceInfo; preview: Blob }>;
}
export function resourcePath(input: unknown): string {
    const path = text(input, '资源路径');
    if (/[\\:%?#\x00-\x1f]/.test(path) || path.split('/').some(s => !s || s === '.' || s === '..'))
        throw Error('资源路径必须位于自身文件夹内。');
    return path;
}
export function validateResourceInfo(input: unknown): ResourceInfo {
    const v = record(input, '资源信息');
    keys(v, [
        'schemaVersion',
        'resource',
        'kind',
        'title',
        'description',
        'creator',
        'createdAt',
        'previewPath',
        'sourceEntry',
        'packagePath',
        'dependencies',
        'order',
    ]);
    if (v.schemaVersion !== 1 || !['visual', 'modifier', 'transition', 'preset'].includes(String(v.kind)))
        throw Error('资源信息版本或类型无效。');
    const resource = validateResourceRef(v.resource);
    for (const key of ['title', 'description', 'creator', 'createdAt']) text(v[key], key);
    if (
        !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(String(v.createdAt)) ||
        !Number.isFinite(Date.parse(String(v.createdAt)))
    )
        throw Error('资源创建时间无效。');
    for (const key of ['previewPath', 'sourceEntry', 'packagePath']) resourcePath(v[key]);
    if (!String(v.sourceEntry).startsWith('source/') || !String(v.previewPath).endsWith('.svg'))
        throw Error('资源源码入口或预览路径无效。');
    const order = integer(v.order, '显示顺序');
    if (!Number.isSafeInteger(order) || order < 0 || !Array.isArray(v.dependencies))
        throw Error('资源依赖或显示顺序无效。');
    const dependencies = v.dependencies.map(validateResourceRef);
    if (new Set(dependencies.map(resourceKey)).size !== dependencies.length) throw Error('资源依赖重复。');
    return { ...v, resource, dependencies, order } as unknown as ResourceInfo;
}
async function fileAt(root: FileSystemDirectoryHandle, path: string, signal: AbortSignal) {
    const parts = resourcePath(path).split('/');
    let dir = root;
    for (const part of parts.slice(0, -1)) {
        signal.throwIfAborted();
        dir = await dir.getDirectoryHandle(part);
    }
    signal.throwIfAborted();
    const file = await (await dir.getFileHandle(parts[parts.length - 1]!)).getFile();
    signal.throwIfAborted();
    return file;
}
function previewSvg(source: string): Blob {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
        throw Error('资源预览不是有效 SVG。');
    const allowed = new Set([
        'svg',
        'g',
        'path',
        'rect',
        'circle',
        'ellipse',
        'line',
        'polyline',
        'polygon',
        'title',
        'desc',
    ]);
    for (const node of [doc.documentElement, ...doc.documentElement.querySelectorAll('*')]) {
        if (node.namespaceURI !== 'http://www.w3.org/2000/svg' || !allowed.has(node.localName))
            throw Error('预览必须是独立 SVG 图形。');
        for (const attr of node.attributes)
            if (/^on|href|style/i.test(attr.name) || /url\s*\(/i.test(attr.value))
                throw Error('预览不允许脚本或外部引用。');
    }
    return new Blob([source], { type: 'image/svg+xml' });
}
/** Reads a complete candidate; never mutates the live registry or external files. */
export async function readResourceDirectory(
    root: ResourceDirectoryHandle,
    signal: AbortSignal,
): Promise<DirectoryCandidate> {
    const rows: Array<{ info: ResourceInfo; preview: Blob; raw: Record<string, unknown> }> = [];
    for (const category of ['elements', 'presets']) {
        signal.throwIfAborted();
        const folder = (await root.getDirectoryHandle(category)) as ResourceDirectoryHandle;
        for await (const [name, handle] of folder.entries()) {
            signal.throwIfAborted();
            if (handle.kind !== 'directory' || !/^[a-z0-9][a-z0-9._-]*$/.test(name))
                throw Error('资源目录包含无效条目：' + name);
            const dir = handle as ResourceDirectoryHandle;
            const info = validateResourceInfo(
                JSON.parse(await (await fileAt(dir, 'resource-info.json', signal)).text()),
            );
            if (info.resource.id !== name || (info.kind === 'preset') !== (category === 'presets'))
                throw Error('资源信息与目录身份不匹配。');
            // Prove source entry exists, but do not copy or execute editable source.
            await fileAt(dir, info.sourceEntry, signal);
            const raw = record(JSON.parse(await (await fileAt(dir, info.packagePath, signal)).text()), '资源包');
            const preview = previewSvg(await (await fileAt(dir, info.previewPath, signal)).text());
            rows.push({ info, raw, preview });
        }
    }
    signal.throwIfAborted();
    const combined = validateResourceSnapshot({
        algorithms: rows.flatMap(r => (Array.isArray(r.raw.algorithms) ? r.raw.algorithms : [])),
        elements: rows.flatMap(r => (Array.isArray(r.raw.elements) ? r.raw.elements : [])),
        presets: rows.flatMap(r => (Array.isArray(r.raw.presets) ? r.raw.presets : [])),
    });
    const ids = new Set<string>();
    rows.sort((a, b) => a.info.order - b.info.order || a.info.resource.id.localeCompare(b.info.resource.id));
    const packages = rows.map(({ info, raw }) => {
        const pack = validateResourcePackage(raw, combined);
        const preset = info.kind === 'preset';
        if (
            preset
                ? pack.algorithms.length || pack.elements.length || pack.presets.length !== 1
                : pack.presets.length || pack.elements.length !== 1 || pack.algorithms.length !== 1
        )
            throw Error('预设只能包含组合定义，元素只能包含自身及算法。');
        const definition = preset ? pack.presets[0]! : pack.elements[0]!;
        if (
            !sameResource(info.resource, definition) ||
            info.title !== definition.title ||
            (!preset && info.kind !== pack.elements[0]!.kind)
        )
            throw Error('资源信息与运行包身份不匹配。');
        if (ids.has(info.resource.id)) throw Error('资源 ID 重复。');
        ids.add(info.resource.id);
        const expected = preset
            ? new Set(pack.presets[0]!.elements.map(e => resourceKey(e.element)))
            : new Set<string>();
        if (expected.size !== info.dependencies.length || info.dependencies.some(d => !expected.has(resourceKey(d))))
            throw Error('资源精确依赖不完整。');
        if (!preset && !sameResource(pack.elements[0]!.algorithm, pack.algorithms[0]!))
            throw Error('元素算法依赖不匹配。');
        return pack;
    });
    return { resources: mergeResources(...packages), entries: rows.map(({ info, preview }) => ({ info, preview })) };
}
