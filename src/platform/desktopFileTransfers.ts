import type { DesktopFileBridge } from './fileContracts';
import { DesktopAudioFiles, nativeValue } from './desktopAudioFiles';
import {
    SAVE_CHUNK_BYTES,
    type DesktopSaveBridge,
    type FileTransferAccess,
    type ProjectFilePurpose,
    type TransferPurpose,
} from './transferContracts';

export class DesktopFileTransfers implements FileTransferAccess {
    private readonly files: DesktopFileBridge;
    private readonly saves: DesktopSaveBridge;
    private readonly reader: DesktopAudioFiles;
    constructor(files: DesktopFileBridge, saves: DesktopSaveBridge, fetchFile?: typeof fetch) {
        this.files = files;
        this.saves = saves;
        this.reader = new DesktopAudioFiles(files, fetchFile);
    }
    async open(purpose: ProjectFilePurpose, signal?: AbortSignal) {
        signal?.throwIfAborted();
        const reference = nativeValue(await this.files.chooseProject(purpose));
        if (!reference) return null;
        try {
            return await this.reader.read(reference, signal);
        } finally {
            nativeValue(await this.files.releaseProject(reference.grantId));
        }
    }
    async save(
        purpose: TransferPurpose,
        suggestedName: string,
        data: Blob | Uint8Array,
        signal?: AbortSignal,
    ): Promise<'saved' | 'cancelled'> {
        if (signal?.aborted) return 'cancelled';
        const size = data instanceof Uint8Array ? data.byteLength : data.size;
        const reference = nativeValue(await this.saves.beginSave(purpose, suggestedName, size));
        if (!reference) return 'cancelled';
        let abortTask: Promise<void> | null = null;
        const abort = () => {
            abortTask ??= this.saves.abortSave(reference.saveId).then(nativeValue);
            void abortTask.catch(() => {});
        };
        signal?.addEventListener('abort', abort, { once: true });
        try {
            signal?.throwIfAborted();
            for (let offset = 0; offset < size; offset += SAVE_CHUNK_BYTES) {
                signal?.throwIfAborted();
                const end = Math.min(size, offset + SAVE_CHUNK_BYTES);
                const chunk =
                    data instanceof Uint8Array
                        ? data.subarray(offset, end)
                        : new Uint8Array(await data.slice(offset, end).arrayBuffer());
                signal?.throwIfAborted();
                nativeValue(await this.saves.writeSave(reference.saveId, chunk));
            }
            signal?.throwIfAborted();
            nativeValue(await this.saves.commitSave(reference.saveId));
            // A successful atomic publication wins over cancellation arriving during that commit.
            return 'saved';
        } catch (error) {
            abort();
            await abortTask;
            if (signal?.aborted) return 'cancelled';
            throw error;
        } finally {
            signal?.removeEventListener('abort', abort);
        }
    }
}
