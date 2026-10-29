import type { FileTransferAccess } from '../platform/transferContracts';
import { FileTransferUnsupportedError } from '../platform/transferContracts';
import { BrowserFileTransfers } from '../platform/webFileTransfers';
export interface VisualizerFileFormat {
    extension: string;
    mimeType: string;
}

export interface VisualizerOpenedFile {
    name: string;
    bytes: ArrayBuffer;
}
export interface VisualizerFileGateway {
    open(codec: VisualizerFileFormat, signal?: AbortSignal): Promise<VisualizerOpenedFile | null>;
    save(
        codec: VisualizerFileFormat,
        suggestedName: string,
        bytes: Uint8Array,
        signal?: AbortSignal,
    ): Promise<'saved' | 'cancelled'>;
}

export class VisualizerFileGatewayError extends Error {
    readonly code: 'unsupported' | 'read-failed' | 'write-failed';

    constructor(code: 'unsupported' | 'read-failed' | 'write-failed', message: string) {
        super(message);
        this.name = 'VisualizerFileGatewayError';
        this.code = code;
    }
}

const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

export class NativeVisualizerFileGateway implements VisualizerFileGateway {
    private readonly files: FileTransferAccess;
    constructor(files: FileTransferAccess = new BrowserFileTransfers()) {
        this.files = files;
    }
    async open(_codec: VisualizerFileFormat, signal?: AbortSignal): Promise<VisualizerOpenedFile | null> {
        try {
            const file = await this.files.open('visualizer-project', signal);
            if (!file) return null;
            const bytes = await file.arrayBuffer();
            signal?.throwIfAborted();
            return { name: file.name, bytes };
        } catch (error) {
            if (isAbortError(error)) return null;
            throw new VisualizerFileGatewayError(
                error instanceof FileTransferUnsupportedError ? 'unsupported' : 'read-failed',
                error instanceof Error ? error.message : '读取工程文件失败。',
            );
        }
    }
    async save(
        _codec: VisualizerFileFormat,
        name: string,
        bytes: Uint8Array,
        signal?: AbortSignal,
    ): Promise<'saved' | 'cancelled'> {
        try {
            return await this.files.save('visualizer-project', name, bytes, signal);
        } catch (error) {
            if (isAbortError(error)) return 'cancelled';
            throw new VisualizerFileGatewayError(
                error instanceof FileTransferUnsupportedError ? 'unsupported' : 'write-failed',
                error instanceof Error ? error.message : '保存工程文件失败。',
            );
        }
    }
}
