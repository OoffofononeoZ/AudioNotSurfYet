import type { EditorFormatCodec } from './projectCodec';

type WritableFileHandle = FileSystemFileHandle & {
    createWritable(): Promise<FileSystemWritableFileStream>;
};

export interface EditorOpenedFile {
    name: string;
    bytes: ArrayBuffer;
}

export interface EditorFileGateway {
    open(codec: EditorFormatCodec): Promise<EditorOpenedFile | null>;
    save(
        codec: EditorFormatCodec,
        suggestedName: string,
        bytes: Uint8Array,
    ): Promise<'saved' | 'cancelled'>;
}

export class EditorFileGatewayError extends Error {
    readonly code: 'unsupported' | 'read-failed' | 'write-failed';

    constructor(
        code: 'unsupported' | 'read-failed' | 'write-failed',
        message: string,
    ) {
        super(message);
        this.name = 'EditorFileGatewayError';
        this.code = code;
    }
}

const isAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === 'AbortError';

export class NativeEditorFileGateway implements EditorFileGateway {
    async open(codec: EditorFormatCodec): Promise<EditorOpenedFile | null> {
        const picker = (
            window as typeof window & {
                showOpenFilePicker?: (
                    options: Record<string, unknown>,
                ) => Promise<FileSystemFileHandle[]>;
            }
        ).showOpenFilePicker;
        if (!picker) {
            throw new EditorFileGatewayError(
                'unsupported',
                '当前浏览器不支持原生工程文件选择，请使用最新版 Chrome 或 Edge。',
            );
        }
        try {
            const handles = await picker({
                multiple: false,
                excludeAcceptAllOption: true,
                types: [{
                    description: 'AudioNotSurfYet Editor JSON',
                    accept: { [codec.mimeType]: [codec.extension] },
                }],
            });
            const handle = handles[0];
            if (!handle) return null;
            const file = await handle.getFile();
            return { name: file.name, bytes: await file.arrayBuffer() };
        } catch (error) {
            if (isAbortError(error)) return null;
            throw new EditorFileGatewayError(
                'read-failed',
                error instanceof Error ? error.message : '读取工程文件失败。',
            );
        }
    }

    async save(
        codec: EditorFormatCodec,
        suggestedName: string,
        bytes: Uint8Array,
    ): Promise<'saved' | 'cancelled'> {
        const picker = (
            window as typeof window & {
                showSaveFilePicker?: (
                    options: Record<string, unknown>,
                ) => Promise<WritableFileHandle>;
            }
        ).showSaveFilePicker;
        if (!picker) {
            throw new EditorFileGatewayError(
                'unsupported',
                '当前浏览器不支持原生工程文件保存，请使用最新版 Chrome 或 Edge。',
            );
        }
        let writable: FileSystemWritableFileStream | null = null;
        try {
            const handle = await picker({
                suggestedName,
                excludeAcceptAllOption: true,
                types: [{
                    description: 'AudioNotSurfYet Editor JSON',
                    accept: { [codec.mimeType]: [codec.extension] },
                }],
            });
            writable = await handle.createWritable();
            await writable.write(
                bytes.buffer.slice(
                    bytes.byteOffset,
                    bytes.byteOffset + bytes.byteLength,
                ) as ArrayBuffer,
            );
            await writable.close();
            return 'saved';
        } catch (error) {
            if (isAbortError(error)) return 'cancelled';
            try {
                await writable?.abort?.(error);
            } catch {
                // The original write error remains the user-facing cause.
            }
            throw new EditorFileGatewayError(
                'write-failed',
                error instanceof Error ? error.message : '保存工程文件失败。',
            );
        }
    }
}

export const editorProjectFileName = (
    fileName: string,
    codec: EditorFormatCodec,
): string => {
    const base = fileName.replace(/\.[^.]+$/, '').trim() || 'editor-project';
    return `${base}${codec.extension}`;
};
