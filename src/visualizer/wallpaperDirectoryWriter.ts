import type { WallpaperExportFile } from './wallpaperExport';

interface ExportDirectory extends FileSystemDirectoryHandle {
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}
export interface WallpaperDirectoryResult {
    status: 'saved' | 'cancelled';
    folderName?: string;
}
export class WallpaperDirectoryCleanupError extends Error {}
export class WallpaperDirectoryWriter {
    private picker: () => Promise<ExportDirectory>;
    constructor(
        picker = () => {
            const select = (
                window as Window & { showDirectoryPicker?: (options: { mode: string }) => Promise<ExportDirectory> }
            ).showDirectoryPicker;
            if (!select) throw Error('当前浏览器不支持目录导出，请使用 Chrome 或 Edge。');
            return select({ mode: 'readwrite' });
        },
    ) {
        this.picker = picker;
    }
    async save(files: WallpaperExportFile[], signal?: AbortSignal): Promise<WallpaperDirectoryResult> {
        signal?.throwIfAborted();
        // Output is prepared before prompting; resume activation with a second explicit save click in the UI.
        let parent: ExportDirectory;
        try {
            parent = await this.picker();
        } catch (error) {
            if ((error as DOMException).name === 'AbortError') return { status: 'cancelled' };
            throw error;
        }
        signal?.throwIfAborted();
        const folderName = 'audiosurf-' + crypto.randomUUID();
        try {
            await parent.getDirectoryHandle(folderName);
            throw Error('导出目录已存在，请重试。');
        } catch (error) {
            if ((error as DOMException).name !== 'NotFoundError') throw error;
        }
        let created = false;
        try {
            const output = await parent.getDirectoryHandle(folderName, { create: true });
            created = true;
            for (const file of [
                ...files.filter(f => f.name !== 'project.json'),
                ...files.filter(f => f.name === 'project.json'),
            ]) {
                if (!/^[a-zA-Z0-9_.-]+$/.test(file.name) || file.name === '.' || file.name === '..')
                    throw Error('导出文件名无效。');
                signal?.throwIfAborted();
                const handle = await output.getFileHandle(file.name, { create: true }),
                    writer = await handle.createWritable();
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
            return { status: 'saved', folderName };
        } catch (error) {
            if (created) {
                try {
                    await parent.removeEntry(folderName, { recursive: true });
                } catch {
                    throw new WallpaperDirectoryCleanupError(
                        `导出未完成，无法清理 ${parent.name}/${folderName}，请手动移除。`,
                    );
                }
            }
            if ((error as DOMException).name === 'AbortError') return { status: 'cancelled' };
            throw error;
        }
    }
}
