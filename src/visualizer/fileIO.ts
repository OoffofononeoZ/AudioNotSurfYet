export interface VisualizerFileFormat {
    extension: string;
    mimeType: string;
}

type WritableFileHandle = FileSystemFileHandle & {
    createWritable(): Promise<FileSystemWritableFileStream>;
};

export interface VisualizerOpenedFile {
    name: string;
    bytes: ArrayBuffer;
}
export interface VisualizerFileGateway {
    open(codec: VisualizerFileFormat): Promise<VisualizerOpenedFile | null>;
    save(codec: VisualizerFileFormat, suggestedName: string, bytes: Uint8Array): Promise<'saved' | 'cancelled'>;
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
    async open(codec: VisualizerFileFormat): Promise<VisualizerOpenedFile | null> {
        const picker = (
            window as typeof window & {
                showOpenFilePicker?: (options: Record<string, unknown>) => Promise<FileSystemFileHandle[]>;
            }
        ).showOpenFilePicker;
        if (!picker) {
            throw new VisualizerFileGatewayError(
                'unsupported',
                '当前浏览器不支持原生可视化工程选择，请使用最新版 Chrome 或 Edge。',
            );
        }
        try {
            const handles = await picker({
                multiple: false,
                excludeAcceptAllOption: true,
                types: [
                    {
                        description: 'AudioNotSurfYet Visualizer JSON',
                        accept: { [codec.mimeType]: ['.json'] },
                    },
                ],
            });
            const handle = handles[0];
            if (!handle) return null;
            const file = await handle.getFile();
            return { name: file.name, bytes: await file.arrayBuffer() };
        } catch (error) {
            if (isAbortError(error)) return null;
            throw new VisualizerFileGatewayError(
                'read-failed',
                error instanceof Error ? error.message : '读取可视化工程失败。',
            );
        }
    }

    async save(codec: VisualizerFileFormat, suggestedName: string, bytes: Uint8Array): Promise<'saved' | 'cancelled'> {
        const picker = (
            window as typeof window & {
                showSaveFilePicker?: (options: Record<string, unknown>) => Promise<WritableFileHandle>;
            }
        ).showSaveFilePicker;
        if (!picker) {
            throw new VisualizerFileGatewayError(
                'unsupported',
                '当前浏览器不支持原生可视化工程保存，请使用最新版 Chrome 或 Edge。',
            );
        }
        let writable: FileSystemWritableFileStream | null = null;
        try {
            const handle = await picker({
                suggestedName,
                excludeAcceptAllOption: true,
                types: [
                    {
                        description: 'AudioNotSurfYet Visualizer JSON',
                        accept: { [codec.mimeType]: ['.json'] },
                    },
                ],
            });
            writable = await handle.createWritable();
            await writable.write(
                bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
            );
            await writable.close();
            return 'saved';
        } catch (error) {
            if (isAbortError(error)) return 'cancelled';
            try {
                await writable?.abort?.(error);
            } catch {
                // Preserve the original file write failure.
            }
            throw new VisualizerFileGatewayError(
                'write-failed',
                error instanceof Error ? error.message : '保存可视化工程失败。',
            );
        }
    }
}
