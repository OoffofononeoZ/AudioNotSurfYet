import { browserDirectory } from './webDirectoryFiles';
import type { LocalDirectoryReference } from './fileContracts';
import { DirectoryExportCleanupError, type DirectoryExportAccess, type DirectoryExportFile } from './bundleContracts';

export type DirectoryExportPicker = () => Promise<FileSystemDirectoryHandle>;
export class BrowserDirectoryExports implements DirectoryExportAccess {
    private readonly picker: DirectoryExportPicker;
    constructor(
        picker: DirectoryExportPicker = () => {
            const choose = (
                window as typeof window & {
                    showDirectoryPicker?: (options: { mode: string }) => Promise<FileSystemDirectoryHandle>;
                }
            ).showDirectoryPicker;
            if (!choose) throw Error('当前浏览器不支持目录导出，请使用 Chrome 或 Edge。');
            return choose({ mode: 'readwrite' });
        },
    ) {
        this.picker = picker;
    }
    async preparePreset(root: LocalDirectoryReference, signal: AbortSignal) {
        if ((await browserDirectory(root).requestPermission({ mode: 'readwrite' })) !== 'granted')
            throw Error('未获得资源文件夹的写入权限。');
        signal.throwIfAborted();
    }
    async savePreset(
        root: LocalDirectoryReference,
        id: string,
        files: DirectoryExportFile[],
        signal: AbortSignal,
    ): Promise<'saved'> {
        const parent = await browserDirectory(root).getDirectoryHandle('presets');
        await this.writeNewDirectory(parent, id, files, signal, `${root.name}/presets`);
        return 'saved';
    }
    async saveWallpaper(files: DirectoryExportFile[], signal?: AbortSignal) {
        signal?.throwIfAborted();
        let parent: FileSystemDirectoryHandle;
        try {
            parent = await this.picker();
        } catch (error) {
            if ((error as Error).name === 'AbortError') return { status: 'cancelled' as const };
            throw error;
        }
        signal?.throwIfAborted();
        const folderName = 'audiosurf-' + crypto.randomUUID();
        try {
            await this.writeNewDirectory(
                parent,
                folderName,
                [...files.filter(f => f.name !== 'project.json'), ...files.filter(f => f.name === 'project.json')],
                signal,
            );
        } catch (error) {
            if ((error as Error).name === 'AbortError') return { status: 'cancelled' as const };
            throw error;
        }
        return { status: 'saved' as const, folderName };
    }
    private async writeNewDirectory(
        parent: FileSystemDirectoryHandle,
        name: string,
        files: DirectoryExportFile[],
        signal?: AbortSignal,
        displayParent = parent.name,
    ) {
        signal?.throwIfAborted();
        try {
            await parent.getDirectoryHandle(name);
            throw Error('导出目录已存在，请重试。');
        } catch (error) {
            if ((error as Error).name !== 'NotFoundError') throw error;
        }
        let created = false;
        try {
            const output = await parent.getDirectoryHandle(name, { create: true });
            created = true;
            for (const file of files) {
                if (
                    !/^(?:source\/)?[a-zA-Z0-9_.-]+$/.test(file.name) ||
                    file.name.split('/').some(part => part === '.' || part === '..')
                )
                    throw Error('导出文件名无效。');
                signal?.throwIfAborted();
                const parts = file.name.split('/');
                const folder =
                    parts.length === 2 ? await output.getDirectoryHandle(parts[0]!, { create: true }) : output;
                const writer = await (
                    await folder.getFileHandle(parts[parts.length - 1]!, { create: true })
                ).createWritable();
                try {
                    await writer.write(file.content);
                    signal?.throwIfAborted();
                    await writer.close();
                } catch (error) {
                    await writer.abort().catch(() => {});
                    throw error;
                }
            }
            signal?.throwIfAborted();
        } catch (error) {
            if (created) {
                try {
                    await parent.removeEntry(name, { recursive: true });
                } catch {
                    throw new DirectoryExportCleanupError(
                        `导出未完成，无法清理 ${displayParent}/${name}，请手动移除。`,
                    );
                }
            }
            throw error;
        }
    }
}
