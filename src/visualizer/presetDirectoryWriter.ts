import { readResourceDirectory } from './resourceDirectory';
import type { LocalDirectoryReference } from '../platform/fileContracts';
import { BrowserDirectoryExports } from '../platform/webDirectoryExports';
import { browserDirectoryFiles } from '../platform/webDirectoryFiles';
import type { DirectoryFileAccess } from '../platform/directoryFiles';
import { DirectoryExportCleanupError, type DirectoryExportAccess } from '../platform/bundleContracts';
import { sameResource, resourceKey } from './resourceIdentity';
import { validateResourcePackage } from './resourceCodec';
import type { PreparedPresetExport } from './presetExport';

export class PresetDirectoryCleanupError extends Error {}

/** Owns only the new presets/<id> directory; existing files and element dependencies stay untouched. */
export async function savePresetDirectory(
    reference: LocalDirectoryReference,
    prepared: PreparedPresetExport,
    signal: AbortSignal,
    ports: { files: DirectoryFileAccess; exports: DirectoryExportAccess } = {
        files: browserDirectoryFiles,
        exports: new BrowserDirectoryExports(),
    },
) {
    signal.throwIfAborted();
    await ports.exports.preparePreset(reference, signal);
    const candidate = await readResourceDirectory(reference, signal, ports.files);
    const missing = prepared.info.dependencies.filter(
        ref => !candidate.resources.elements.some(e => sameResource(e, ref)),
    );
    if (missing.length) throw Error('目标资源库缺少精确版本的元素依赖：\n' + missing.map(resourceKey).join('\n'));
    const pack = validateResourcePackage(prepared.package, candidate.resources);
    const id = pack.id;
    if (!/^user-preset-[a-f0-9-]+$/.test(id) || prepared.info.resource.id !== id) throw Error('导出预设身份无效。');
    const json = JSON.stringify(pack, null, 2) + '\n';
    try {
        const result = await ports.exports.savePreset(
            reference,
            id,
            [
                { name: 'source/resource.json', content: json },
                { name: 'resource-package.json', content: json },
                { name: prepared.info.previewPath!, content: prepared.cover },
                { name: 'resource-info.json', content: JSON.stringify(prepared.info, null, 2) + '\n' },
            ],
            signal,
        );
        return result === 'saved' ? 'presets/' + id : null;
    } catch (error) {
        if (error instanceof DirectoryExportCleanupError) throw new PresetDirectoryCleanupError(error.message);
        throw error;
    }
}
