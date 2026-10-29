import type { LocalDirectoryReference } from './fileContracts';
import { directoryPath, type DirectoryFileAccess } from './directoryFiles';

export type BrowserDirectoryHandle = FileSystemDirectoryHandle & {
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    queryPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(options: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
};

export function browserDirectory(root: LocalDirectoryReference): BrowserDirectoryHandle {
    if ('platform' in root || typeof (root as BrowserDirectoryHandle).getDirectoryHandle !== 'function')
        throw new DOMException('此操作需要浏览器文件夹访问接口。', 'NotSupportedError');
    return root as BrowserDirectoryHandle;
}

export class BrowserDirectoryFiles implements DirectoryFileAccess {
    async chooseResourceDirectory(): Promise<LocalDirectoryReference> {
        const host = window as unknown as {
            showDirectoryPicker?: (options: { id: string; mode: 'read' }) => Promise<BrowserDirectoryHandle>;
        };
        if (!host.showDirectoryPicker) throw Error('当前浏览器不支持选择资源文件夹。');
        return host.showDirectoryPicker({ id: 'visualizer-assets', mode: 'read' });
    }
    async queryPermission(root: LocalDirectoryReference) {
        return (root as BrowserDirectoryHandle).queryPermission({ mode: 'read' });
    }
    async requestPermission(root: LocalDirectoryReference) {
        return (root as BrowserDirectoryHandle).requestPermission({ mode: 'read' });
    }
    private async directory(root: LocalDirectoryReference, path: string, signal: AbortSignal) {
        directoryPath(path);
        let handle = root as BrowserDirectoryHandle;
        for (const part of path ? path.split('/') : []) {
            signal.throwIfAborted();
            handle = (await handle.getDirectoryHandle(part)) as BrowserDirectoryHandle;
        }
        signal.throwIfAborted();
        return handle;
    }
    async list(root: LocalDirectoryReference, path: string, signal: AbortSignal) {
        const handle = await this.directory(root, path, signal);
        const entries: Array<{ name: string; kind: 'file' | 'directory' }> = [];
        for await (const [name, child] of handle.entries()) {
            signal.throwIfAborted();
            entries.push({ name, kind: child.kind });
        }
        signal.throwIfAborted();
        return entries;
    }
    async read(root: LocalDirectoryReference, path: string, signal: AbortSignal) {
        const parts = directoryPath(path).split('/');
        if (!path) throw new DOMException('文件路径不能为空。', 'DataError');
        const directory = await this.directory(root, parts.slice(0, -1).join('/'), signal);
        const file = await (await directory.getFileHandle(parts[parts.length - 1]!)).getFile();
        signal.throwIfAborted();
        return file;
    }
}

export const browserDirectoryFiles = new BrowserDirectoryFiles();
