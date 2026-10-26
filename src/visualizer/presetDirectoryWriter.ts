import { readResourceDirectory, type ResourceDirectoryHandle } from './resourceDirectory';
import { sameResource, resourceKey } from './resourceIdentity';
import { validateResourcePackage } from './resourceCodec';
import type { PreparedPresetExport } from './presetExport';

export class PresetDirectoryCleanupError extends Error {}

/** Owns only the new presets/<id> directory; existing files and element dependencies stay untouched. */
export async function savePresetDirectory(
    root: ResourceDirectoryHandle,
    prepared: PreparedPresetExport,
    signal: AbortSignal,
) {
    signal.throwIfAborted();
    // Must be invoked directly by the visible save button, before any asynchronous preparation.
    if ((await root.requestPermission({ mode: 'readwrite' })) !== 'granted')
        throw Error('未获得资源文件夹的写入权限。');
    signal.throwIfAborted();
    const candidate = await readResourceDirectory(root, signal);
    const missing = prepared.info.dependencies.filter(
        ref => !candidate.resources.elements.some(e => sameResource(e, ref)),
    );
    if (missing.length) throw Error('目标资源库缺少精确版本的元素依赖：\n' + missing.map(resourceKey).join('\n'));
    const pack = validateResourcePackage(prepared.package, candidate.resources);
    const id = pack.id;
    if (!/^user-preset-[a-f0-9-]+$/.test(id) || prepared.info.resource.id !== id) throw Error('导出预设身份无效。');
    const parent = await root.getDirectoryHandle('presets');
    signal.throwIfAborted();
    try {
        await parent.getDirectoryHandle(id);
        throw Error('预设目录已存在，请重新打开导出弹窗。');
    } catch (error) {
        if ((error as Error).name !== 'NotFoundError') throw error;
    }
    let created = false;
    try {
        const directory = await parent.getDirectoryHandle(id, { create: true });
        created = true;
        const source = await directory.getDirectoryHandle('source', { create: true });
        const json = JSON.stringify(pack, null, 2) + '\n';
        const files: [FileSystemDirectoryHandle, string, string | Blob][] = [
            [source, 'resource.json', json],
            [directory, 'resource-package.json', json],
            [directory, prepared.info.previewPath!, prepared.cover],
            // Commit marker: readers never accept a directory without complete resource information.
            [directory, 'resource-info.json', JSON.stringify(prepared.info, null, 2) + '\n'],
        ];
        for (const [dir, name, content] of files) {
            signal.throwIfAborted();
            const writer = await (await dir.getFileHandle(name, { create: true })).createWritable();
            try {
                await writer.write(content);
                signal.throwIfAborted();
                await writer.close();
            } catch (error) {
                await writer.abort().catch(() => {});
                throw error;
            }
        }
        signal.throwIfAborted();
        return 'presets/' + id;
    } catch (error) {
        if (created) {
            try {
                await parent.removeEntry(id, { recursive: true });
            } catch {
                throw new PresetDirectoryCleanupError(`导出未完成，无法清理 ${root.name}/presets/${id}，请手动移除。`);
            }
        }
        throw error;
    }
}
