import { record, keys, text, integer } from './projectValidation';
import {
    mergeResources,
    validateResourcePackage,
    validateResourceRef,
    validateResourceSnapshot,
} from './resourceCodec';
import { resourceKey, sameResource } from './resourceIdentity';
import type { ResourceRef, ResourceSnapshot } from './resourceTypes';
import { resourceFile as fileAt, resourcePath } from './resourceFiles';
import type { LocalDirectoryReference } from '../platform/fileContracts';
import type { DirectoryFileAccess } from '../platform/directoryFiles';
import { browserDirectoryFiles } from '../platform/webDirectoryFiles';
import { readResourcePreview } from './resourcePreview';
export { resourcePath, type ResourceDirectoryHandle } from './resourceFiles';

export interface ResourceInfo {
    schemaVersion: 1;
    resource: ResourceRef;
    kind: 'visual' | 'modifier' | 'transition' | 'preset';
    title: string;
    description: string;
    creator: string;
    createdAt: string;
    previewPath?: string;
    sourceEntry: string;
    packagePath: string;
    dependencies: ResourceRef[];
    order: number;
}
export interface DirectoryCandidate {
    resources: ResourceSnapshot;
    entries: Array<{ info: ResourceInfo; preview: Blob | null }>;
}
export function validateResourceInfo(input: unknown): ResourceInfo {
    const v = record(input, '资源信息');
    keys(
        v,
        [
            'schemaVersion',
            'resource',
            'kind',
            'title',
            'description',
            'creator',
            'createdAt',
            'sourceEntry',
            'packagePath',
            'dependencies',
            'order',
        ],
        ['previewPath'],
    );
    if (v.schemaVersion !== 1 || !['visual', 'modifier', 'transition', 'preset'].includes(String(v.kind)))
        throw Error('资源信息版本或类型无效。');
    const resource = validateResourceRef(v.resource);
    for (const key of ['title', 'description', 'creator', 'createdAt']) text(v[key], key);
    if (
        !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(String(v.createdAt)) ||
        !Number.isFinite(Date.parse(String(v.createdAt)))
    )
        throw Error('资源创建时间无效。');
    for (const key of ['sourceEntry', 'packagePath']) resourcePath(v[key]);
    if (v.previewPath !== undefined) resourcePath(v.previewPath);
    if (!String(v.sourceEntry).startsWith('source/')) throw Error('资源源码入口或预览路径无效。');
    const order = integer(v.order, '显示顺序');
    if (!Number.isSafeInteger(order) || order < 0 || !Array.isArray(v.dependencies))
        throw Error('资源依赖或显示顺序无效。');
    const dependencies = v.dependencies.map(validateResourceRef);
    if (new Set(dependencies.map(resourceKey)).size !== dependencies.length) throw Error('资源依赖重复。');
    return { ...v, resource, dependencies, order } as unknown as ResourceInfo;
}
/** Reads a complete candidate; never mutates the live registry or external files. */
export async function readResourceDirectory(
    root: LocalDirectoryReference,
    signal: AbortSignal,
    access: DirectoryFileAccess = browserDirectoryFiles,
): Promise<DirectoryCandidate> {
    const rows: Array<{ info: ResourceInfo; preview: Blob | null; raw: Record<string, unknown> }> = [];
    for (const category of ['elements', 'presets']) {
        signal.throwIfAborted();
        for (const { name, kind } of await access.list(root, category, signal)) {
            signal.throwIfAborted();
            if (kind !== 'directory' || !/^[a-z0-9][a-z0-9._-]*$/.test(name))
                throw Error('资源目录包含无效条目：' + name);
            const path = category + '/' + name;
            const read = (file: string) => fileAt(root, path + '/' + resourcePath(file), signal, access);
            const info = validateResourceInfo(JSON.parse(await (await read('resource-info.json')).text()));
            if (info.resource.id !== name || (info.kind === 'preset') !== (category === 'presets'))
                throw Error('资源信息与目录身份不匹配。');
            // Prove source entry exists, but do not copy or execute editable source.
            await read(info.sourceEntry);
            const raw = record(JSON.parse(await (await read(info.packagePath)).text()), '资源包');
            const preview = await readResourcePreview(root, info.previewPath, signal, undefined, { access, path });
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
