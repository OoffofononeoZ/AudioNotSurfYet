import {
    TRANSFER_FORMATS,
    INPUT_FORMATS,
    FileTransferUnsupportedError,
    type FileTransferAccess,
    type InputFilePurpose,
    type TransferPurpose,
} from './transferContracts';

const aborted = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
export class BrowserFileTransfers implements FileTransferAccess {
    async open(purpose: InputFilePurpose, signal?: AbortSignal) {
        return (await this.openMany(purpose, false, signal))[0] ?? null;
    }
    async openMany(purpose: InputFilePurpose, multiple: boolean, signal?: AbortSignal) {
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
                multiple,
                excludeAcceptAllOption: true,
                types: [INPUT_FORMATS[purpose]],
            });
            signal?.throwIfAborted();
            const files: File[] = [];
            for (const handle of handles) {
                signal?.throwIfAborted();
                files.push(await handle.getFile());
            }
            signal?.throwIfAborted();
            return files;
        } catch (error) {
            if (aborted(error)) return [];
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
