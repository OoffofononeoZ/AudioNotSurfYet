import type { NativeResult } from './fileContracts';

export const TRANSFER_FORMATS = {
    'editor-project': { description: 'AudioNotSurfYet Editor JSON', accept: { 'application/json': ['.json'] } },
    'visualizer-project': { description: 'AudioNotSurfYet Visualizer JSON', accept: { 'application/json': ['.json'] } },
    video: { description: 'WebM video', accept: { 'video/webm': ['.webm'] } },
    wav: { description: 'WAV audio', accept: { 'audio/wav': ['.wav'] } },
} as const;
export type TransferPurpose = keyof typeof TRANSFER_FORMATS;
export const INPUT_FORMATS = {
    'editor-project': TRANSFER_FORMATS['editor-project'],
    'visualizer-project': TRANSFER_FORMATS['visualizer-project'],
    'osu-source': { description: 'osu 谱面', accept: { 'application/octet-stream': ['.osu', '.osz'] } },
    image: {
        description: '图片',
        accept: { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'] },
    },
    'video-media': { description: '视频素材', accept: { 'video/webm': ['.webm'], 'video/mp4': ['.mp4'] } },
    media: {
        description: '图片或视频素材',
        accept: {
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/webp': ['.webp'],
            'video/webm': ['.webm'],
            'video/mp4': ['.mp4'],
        },
    },
    lyrics: { description: 'LRC 歌词', accept: { 'text/plain': ['.lrc'] } },
} as const;
export type InputFilePurpose = keyof typeof INPUT_FORMATS;

export interface FileTransferAccess {
    open(purpose: InputFilePurpose, signal?: AbortSignal): Promise<File | null>;
    openMany(purpose: InputFilePurpose, multiple: boolean, signal?: AbortSignal): Promise<File[]>;
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
