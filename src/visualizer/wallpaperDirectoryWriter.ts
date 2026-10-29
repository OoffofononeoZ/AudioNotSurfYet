import type { WallpaperExportFile } from './wallpaperExport';
import {
    DirectoryExportCleanupError,
    type DirectoryExportAccess,
    type DirectoryExportResult,
} from '../platform/bundleContracts';
import { BrowserDirectoryExports } from '../platform/webDirectoryExports';
export type WallpaperDirectoryResult = DirectoryExportResult;
export class WallpaperDirectoryCleanupError extends Error {}
export class WallpaperDirectoryWriter {
    private readonly exports: DirectoryExportAccess;
    constructor(exports: DirectoryExportAccess = new BrowserDirectoryExports()) {
        this.exports = exports;
    }
    async save(files: WallpaperExportFile[], signal?: AbortSignal): Promise<WallpaperDirectoryResult> {
        try {
            return await this.exports.saveWallpaper(files, signal);
        } catch (error) {
            if (error instanceof DirectoryExportCleanupError) throw new WallpaperDirectoryCleanupError(error.message);
            throw error;
        }
    }
}
