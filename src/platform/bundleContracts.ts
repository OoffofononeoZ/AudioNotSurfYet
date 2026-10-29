import type { LocalDirectoryReference, NativeResult } from './fileContracts';

export interface DirectoryExportFile {
    name: string;
    content: string | Blob;
}
export interface DirectoryExportResult {
    status: 'saved' | 'cancelled';
    folderName?: string;
}
export class DirectoryExportCleanupError extends Error {}
export interface DirectoryExportAccess {
    preparePreset(root: LocalDirectoryReference, signal: AbortSignal): Promise<void>;
    savePreset(
        root: LocalDirectoryReference,
        id: string,
        files: DirectoryExportFile[],
        signal: AbortSignal,
    ): Promise<'saved' | 'cancelled'>;
    saveWallpaper(files: DirectoryExportFile[], signal?: AbortSignal): Promise<DirectoryExportResult>;
}
export interface BundleEntry {
    name: string;
    size: number;
}
export interface NativeBundleReference {
    bundleId: string;
    folderName: string;
}
export interface DesktopBundleBridge {
    beginPreset(
        grantId: string,
        id: string,
        entries: BundleEntry[],
    ): Promise<NativeResult<NativeBundleReference | null>>;
    beginWallpaper(entries: BundleEntry[]): Promise<NativeResult<NativeBundleReference | null>>;
    beginFile(bundleId: string): Promise<NativeResult<void>>;
    writeFile(bundleId: string, chunk: Uint8Array): Promise<NativeResult<void>>;
    closeFile(bundleId: string): Promise<NativeResult<void>>;
    commit(bundleId: string): Promise<NativeResult<void>>;
    abort(bundleId: string): Promise<NativeResult<void>>;
}
