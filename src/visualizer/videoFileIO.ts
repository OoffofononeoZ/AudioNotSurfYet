import type { FileTransferAccess } from '../platform/transferContracts';
import { FileTransferUnsupportedError } from '../platform/transferContracts';
import { BrowserFileTransfers } from '../platform/webFileTransfers';
export interface VisualizerVideoFileGateway {
    save(suggestedName: string, blob: Blob, signal?: AbortSignal): Promise<'saved' | 'cancelled'>;
}

export class VisualizerVideoFileGatewayError extends Error {
    readonly code: 'save-unsupported' | 'save-failed';

    constructor(code: VisualizerVideoFileGatewayError['code'], message: string) {
        super(message);
        this.name = 'VisualizerVideoFileGatewayError';
        this.code = code;
    }
}

const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

export class NativeVisualizerVideoFileGateway implements VisualizerVideoFileGateway {
    private readonly files: FileTransferAccess;
    constructor(files: FileTransferAccess = new BrowserFileTransfers()) {
        this.files = files;
    }
    async save(name: string, blob: Blob, signal?: AbortSignal): Promise<'saved' | 'cancelled'> {
        try {
            return await this.files.save('video', name, blob, signal);
        } catch (error) {
            if (isAbortError(error)) return 'cancelled';
            throw new VisualizerVideoFileGatewayError(
                error instanceof FileTransferUnsupportedError ? 'save-unsupported' : 'save-failed',
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
