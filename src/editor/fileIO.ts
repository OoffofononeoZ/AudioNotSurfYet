import type { FileTransferAccess } from '../platform/transferContracts';
import { FileTransferUnsupportedError } from '../platform/transferContracts';
import { BrowserFileTransfers } from '../platform/webFileTransfers';
import type { EditorFormatCodec } from './projectCodec';

export interface EditorOpenedFile {
    name: string;
    bytes: ArrayBuffer;
}

export interface EditorFileGateway {
    open(codec: EditorFormatCodec, signal?: AbortSignal): Promise<EditorOpenedFile | null>;
    save(
        codec: EditorFormatCodec,
        suggestedName: string,
        bytes: Uint8Array,
        signal?: AbortSignal,
    ): Promise<'saved' | 'cancelled'>;
}

export class EditorFileGatewayError extends Error {
    readonly code: 'unsupported' | 'read-failed' | 'write-failed';

    constructor(code: 'unsupported' | 'read-failed' | 'write-failed', message: string) {
        super(message);
        this.name = 'EditorFileGatewayError';
        this.code = code;
    }
}

const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

export class NativeEditorFileGateway implements EditorFileGateway {
    private readonly files: FileTransferAccess;
    constructor(files: FileTransferAccess = new BrowserFileTransfers()) {
        this.files = files;
    }
    async open(_codec: EditorFormatCodec, signal?: AbortSignal): Promise<EditorOpenedFile | null> {
        try {
            const file = await this.files.open('editor-project', signal);
            if (!file) return null;
            const bytes = await file.arrayBuffer();
            signal?.throwIfAborted();
            return { name: file.name, bytes };
        } catch (error) {
            if (isAbortError(error)) return null;
            throw new EditorFileGatewayError(
                error instanceof FileTransferUnsupportedError ? 'unsupported' : 'read-failed',
                error instanceof Error ? error.message : '读取工程文件失败。',
            );
        }
    }
    async save(
        _codec: EditorFormatCodec,
        name: string,
        bytes: Uint8Array,
        signal?: AbortSignal,
    ): Promise<'saved' | 'cancelled'> {
        try {
            return await this.files.save('editor-project', name, bytes, signal);
        } catch (error) {
            if (isAbortError(error)) return 'cancelled';
            throw new EditorFileGatewayError(
                error instanceof FileTransferUnsupportedError ? 'unsupported' : 'write-failed',
                error instanceof Error ? error.message : '保存工程文件失败。',
            );
        }
    }
}

export const editorProjectFileName = (fileName: string, codec: EditorFormatCodec): string => {
    const base = fileName.replace(/\.[^.]+$/, '').trim() || 'editor-project';
    return `${base}${codec.extension}`;
};
