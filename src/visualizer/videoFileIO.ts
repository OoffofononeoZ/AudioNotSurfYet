type WritableVideoHandle = FileSystemFileHandle & {
    createWritable(): Promise<FileSystemWritableFileStream>;
};
export interface VisualizerVideoFileGateway {
    save(suggestedName: string, blob: Blob): Promise<'saved' | 'cancelled'>;
}

export class VisualizerVideoFileGatewayError extends Error {
    readonly code: 'save-unsupported' | 'save-failed';

    constructor(code: VisualizerVideoFileGatewayError['code'], message: string) {
        super(message);
        this.name = 'VisualizerVideoFileGatewayError';
        this.code = code;
    }
}

const isAbortError = (error: unknown): boolean =>
    error instanceof DOMException && error.name === 'AbortError';

export class NativeVisualizerVideoFileGateway implements VisualizerVideoFileGateway {
    async save(
        suggestedName: string,
        blob: Blob,
    ): Promise<'saved' | 'cancelled'> {
        const picker = (
            window as typeof window & {
                showSaveFilePicker?: (
                    options: Record<string, unknown>,
                ) => Promise<WritableVideoHandle>;
            }
        ).showSaveFilePicker;
        if (!picker) {
            throw new VisualizerVideoFileGatewayError(
                'save-unsupported',
                '当前浏览器不支持原生 WebM 保存，请使用最新版 Chrome 或 Edge。',
            );
        }
        let writable: FileSystemWritableFileStream | null = null;
        try {
            const handle = await picker({
                suggestedName,
                excludeAcceptAllOption: true,
                types: [{
                    description: 'WebM video',
                    accept: { 'video/webm': ['.webm'] },
                }],
            });
            writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return 'saved';
        } catch (error) {
            if (isAbortError(error)) return 'cancelled';
            try {
                await writable?.abort?.(error);
            } catch {
                // Preserve the original save failure.
            }
            throw new VisualizerVideoFileGatewayError(
                'save-failed',
                error instanceof Error ? error.message : '保存 WebM 失败。',
            );
        }
    }
}

export const visualizerVideoFileName = (input: {
    fileName: string;
    templateId: string;
    resolution: string;
    frameRate: number;
}): string => {
    const track = input.fileName.replace(/\.[^.]+$/, '').trim() || 'visualizer';
    const safe = `${track}-${input.templateId}-${input.resolution}${input.frameRate}fps`
        .replace(/[^\p{L}\p{N}._-]+/gu, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return `${safe || 'visualizer'}.webm`;
};
