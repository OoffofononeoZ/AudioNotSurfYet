import type { DesktopSaveBridge, ProjectFilePurpose } from './transferContracts';

/** Opaque to domain code. Web persists its existing browser handles unchanged. */
export interface LocalFileReference {
    readonly kind: 'file';
    readonly name: string;
}

export interface NativeFileReference extends LocalFileReference {
    readonly platform: 'electron';
    readonly grantId: string;
    readonly relativePath?: string;
}

export interface LocalDirectoryReference {
    readonly kind: 'directory';
    readonly name: string;
}

export interface NativeDirectoryReference extends LocalDirectoryReference {
    readonly platform: 'electron';
    readonly grantId: string;
}

export interface AudioFileAccess {
    readonly restoreFromReferenceFirst: boolean;
    choose(options: { multiple: boolean }): Promise<LocalFileReference[]>;
    read(reference: LocalFileReference, signal?: AbortSignal): Promise<File>;
    queryPermission(reference: LocalFileReference): Promise<PermissionState>;
    requestPermission(reference: LocalFileReference): Promise<PermissionState>;
}

export type NativeFileErrorCode =
    | 'permission-denied'
    | 'file-missing'
    | 'file-changed'
    | 'cleanup-failed'
    | 'invalid-request'
    | 'store-invalid'
    | 'io-error';
export type NativeResult<T> =
    { ok: true; value: T } | { ok: false; error: { code: NativeFileErrorCode; message: string } };

export interface NativeFileDescriptor {
    reference: NativeFileReference;
    size: number;
    lastModified: number;
    mimeType: string;
    revision: string;
    readUrl: string;
}

export interface NativeDirectoryEntry {
    name: string;
    kind: 'file' | 'directory';
}

export interface DesktopFileBridge {
    chooseProject(purpose: ProjectFilePurpose): Promise<NativeResult<NativeFileReference | null>>;
    releaseProject(grantId: string): Promise<NativeResult<void>>;
    chooseAudio(multiple: boolean): Promise<NativeResult<NativeFileReference[]>>;
    chooseResourceDirectory(): Promise<NativeResult<NativeDirectoryReference | null>>;
    describeFile(grantId: string): Promise<NativeResult<NativeFileDescriptor>>;
    filePermission(grantId: string): Promise<NativeResult<PermissionState>>;
    listDirectory(grantId: string, relativePath: string): Promise<NativeResult<NativeDirectoryEntry[]>>;
    describeDirectoryFile(grantId: string, relativePath: string): Promise<NativeResult<NativeFileDescriptor>>;
}

export interface DesktopBridge {
    readonly platform: 'electron';
    readonly apiVersion: 1;
    readonly files: DesktopFileBridge;
    readonly saves: DesktopSaveBridge;
}

declare global {
    interface Window {
        audiosurfDesktop?: DesktopBridge;
    }
}
