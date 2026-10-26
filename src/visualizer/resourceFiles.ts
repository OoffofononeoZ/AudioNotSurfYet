export type ResourceDirectoryHandle = FileSystemDirectoryHandle & {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    queryPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
};

export function resourcePath(input: unknown): string {
    if (typeof input !== 'string' || !input.trim()) throw Error('资源路径不能为空。');
    if (/[\\:%?#\x00-\x1f]/.test(input) || input.split('/').some(s => !s || s === '.' || s === '..'))
        throw Error('资源路径必须位于自身文件夹内。');
    return input;
}

export async function resourceFile(root: FileSystemDirectoryHandle, path: string, signal: AbortSignal) {
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
