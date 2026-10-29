import type { LocalDirectoryReference, NativeDirectoryEntry } from './fileContracts';

/** Relative paths stay within one explicitly selected root; implementations own concrete handles. */
export interface DirectoryFileAccess {
    chooseResourceDirectory(): Promise<LocalDirectoryReference | null>;
    queryPermission(root: LocalDirectoryReference): Promise<PermissionState>;
    requestPermission(root: LocalDirectoryReference): Promise<PermissionState>;
    list(root: LocalDirectoryReference, path: string, signal: AbortSignal): Promise<NativeDirectoryEntry[]>;
    read(root: LocalDirectoryReference, path: string, signal: AbortSignal): Promise<File>;
}

export function directoryPath(path: string): string {
    if (
        typeof path !== 'string' ||
        /[\\:%?#\x00-\x1f]/.test(path) ||
        (path !== '' && path.split('/').some(part => !part || part === '.' || part === '..'))
    )
        throw new DOMException('路径必须位于选定的文件夹内。', 'DataError');
    return path;
}

export function joinDirectoryPath(parent: string, child: string): string {
    return directoryPath([parent, child].filter(Boolean).join('/'));
}
