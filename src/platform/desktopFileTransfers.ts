import type { DesktopFileBridge } from './fileContracts';
import { DesktopAudioFiles, nativeValue } from './desktopAudioFiles';
import {
    SAVE_CHUNK_BYTES,
    type DesktopSaveBridge,
    type FileTransferAccess,
    type InputFilePurpose,
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
    async open(purpose: InputFilePurpose, signal?: AbortSignal) {
        return (await this.openMany(purpose, false, signal))[0] ?? null;
    }
    async openMany(purpose: InputFilePurpose, multiple: boolean, signal?: AbortSignal) {
        signal?.throwIfAborted();
        const references = nativeValue(await this.files.chooseFiles(purpose, multiple));
        try {
            const files: File[] = [];
            for (const reference of references) files.push(await this.reader.read(reference, signal));
            signal?.throwIfAborted();
            return files;
        } finally {
            const results = await Promise.allSettled(
                references.map(reference => this.files.releaseInput(reference.grantId).then(nativeValue)),
            );
            const failure = results.find(result => result.status === 'rejected');
            if (failure?.status === 'rejected') throw failure.reason;
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
