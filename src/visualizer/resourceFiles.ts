import type { DirectoryFileAccess } from '../platform/directoryFiles';
import type { LocalDirectoryReference } from '../platform/fileContracts';
import { browserDirectoryFiles } from '../platform/webDirectoryFiles';
export type { BrowserDirectoryHandle as ResourceDirectoryHandle } from '../platform/webDirectoryFiles';

export function resourcePath(input: unknown): string {
    if (typeof input !== 'string' || !input.trim()) throw Error('资源路径不能为空。');
    if (/[\\:%?#\x00-\x1f]/.test(input) || input.split('/').some(s => !s || s === '.' || s === '..'))
        throw Error('资源路径必须位于自身文件夹内。');
    return input;
}

export async function resourceFile(
    root: LocalDirectoryReference,
    path: string,
    signal: AbortSignal,
    access: DirectoryFileAccess = browserDirectoryFiles,
) {
    return access.read(root, resourcePath(path), signal);
}
