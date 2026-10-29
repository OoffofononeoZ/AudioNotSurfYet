import {
    TRANSFER_FORMATS,
    FileTransferUnsupportedError,
    type FileTransferAccess,
    type ProjectFilePurpose,
    type TransferPurpose,
} from './transferContracts';

const aborted = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
export class BrowserFileTransfers implements FileTransferAccess {
    async open(purpose: ProjectFilePurpose, signal?: AbortSignal) {
        const picker = (
            window as typeof window & {
                showOpenFilePicker?: (options: Record<string, unknown>) => Promise<FileSystemFileHandle[]>;
            }
        ).showOpenFilePicker;
        if (!picker)
            throw new FileTransferUnsupportedError('当前浏览器不支持原生工程文件选择，请使用最新版 Chrome 或 Edge。');
        try {
            signal?.throwIfAborted();
            const handles = await picker({
                multiple: false,
                excludeAcceptAllOption: true,
                types: [TRANSFER_FORMATS[purpose]],
            });
            signal?.throwIfAborted();
            const file = handles[0] ? await handles[0].getFile() : null;
            signal?.throwIfAborted();
            return file;
        } catch (error) {
            if (aborted(error)) return null;
            throw error;
        }
    }
    async save(
        purpose: TransferPurpose,
        suggestedName: string,
        data: Blob | Uint8Array,
        signal?: AbortSignal,
    ): Promise<'saved' | 'cancelled'> {
        const picker = (
            window as typeof window & {
                showSaveFilePicker?: (options: Record<string, unknown>) => Promise<FileSystemFileHandle>;
            }
        ).showSaveFilePicker;
        if (!picker)
            throw new FileTransferUnsupportedError('当前浏览器不支持原生文件保存，请使用最新版 Chrome 或 Edge。');
        let writable: FileSystemWritableFileStream | null = null;
        try {
            signal?.throwIfAborted();
            const handle = await picker({
                suggestedName,
                excludeAcceptAllOption: true,
                types: [TRANSFER_FORMATS[purpose]],
            });
            signal?.throwIfAborted();
            writable = await handle.createWritable();
            signal?.throwIfAborted();
            await writable.write(
                data instanceof Uint8Array
                    ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
                    : data,
            );
            signal?.throwIfAborted();
            await writable.close();
            return 'saved';
        } catch (error) {
            try {
                await writable?.abort(error);
            } catch {
                /* Preserve the original failure. */
            }
            if (aborted(error)) return 'cancelled';
            throw error;
        }
    }
}
