import type { NativeResult } from './fileContracts';

export const TRANSFER_FORMATS = {
    'editor-project': { description: 'AudioNotSurfYet Editor JSON', accept: { 'application/json': ['.json'] } },
    'visualizer-project': { description: 'AudioNotSurfYet Visualizer JSON', accept: { 'application/json': ['.json'] } },
    video: { description: 'WebM video', accept: { 'video/webm': ['.webm'] } },
    wav: { description: 'WAV audio', accept: { 'audio/wav': ['.wav'] } },
} as const;
export type TransferPurpose = keyof typeof TRANSFER_FORMATS;
export type ProjectFilePurpose = 'editor-project' | 'visualizer-project';

export interface FileTransferAccess {
    open(purpose: ProjectFilePurpose, signal?: AbortSignal): Promise<File | null>;
    save(
        purpose: TransferPurpose,
        suggestedName: string,
        data: Blob | Uint8Array,
        signal?: AbortSignal,
    ): Promise<'saved' | 'cancelled'>;
}

/** Both producer and host enforce this transport bound; it is not a file-size limit. */
export const SAVE_CHUNK_BYTES = 1024 * 1024;
export class FileTransferUnsupportedError extends Error {}
export interface NativeSaveReference {
    saveId: string;
    name: string;
}
export interface DesktopSaveBridge {
    beginSave(
        purpose: TransferPurpose,
        suggestedName: string,
        size: number,
    ): Promise<NativeResult<NativeSaveReference | null>>;
    writeSave(saveId: string, chunk: Uint8Array): Promise<NativeResult<void>>;
    commitSave(saveId: string): Promise<NativeResult<void>>;
    abortSave(saveId: string): Promise<NativeResult<void>>;
}
