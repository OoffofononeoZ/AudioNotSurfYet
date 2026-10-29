import type { LocalDirectoryReference, NativeDirectoryReference } from './fileContracts';
import { nativeValue } from './desktopAudioFiles';
import { SAVE_CHUNK_BYTES } from './transferContracts';
import {
    DirectoryExportCleanupError,
    type DesktopBundleBridge,
    type DirectoryExportAccess,
    type DirectoryExportFile,
    type NativeBundleReference,
} from './bundleContracts';

const blobOf = (file: DirectoryExportFile) =>
    typeof file.content === 'string' ? new Blob([file.content]) : file.content;
export class DesktopDirectoryExports implements DirectoryExportAccess {
    private readonly bridge: DesktopBundleBridge;
    constructor(bridge: DesktopBundleBridge) {
        this.bridge = bridge;
    }
    async preparePreset(root: LocalDirectoryReference, signal: AbortSignal) {
        signal.throwIfAborted();
        const native = root as NativeDirectoryReference;
        if (native.platform !== 'electron' || native.kind !== 'directory' || typeof native.grantId !== 'string')
            throw new DOMException('资源库引用不属于当前桌面应用。', 'NotAllowedError');
    }
    async savePreset(root: LocalDirectoryReference, id: string, files: DirectoryExportFile[], signal: AbortSignal) {
        await this.preparePreset(root, signal);
        const data = files.map(blobOf),
            entries = files.map((file, index) => ({ name: file.name, size: data[index]!.size }));
        const reference = nativeValue(
            await this.bridge.beginPreset((root as NativeDirectoryReference).grantId, id, entries),
        );
        return this.write(reference, data, signal);
    }
    async saveWallpaper(files: DirectoryExportFile[], signal?: AbortSignal) {
        signal?.throwIfAborted();
        const ordered = [
                ...files.filter(file => file.name !== 'project.json'),
                ...files.filter(file => file.name === 'project.json'),
            ],
            data = ordered.map(blobOf);
        const reference = nativeValue(
            await this.bridge.beginWallpaper(
                ordered.map((file, index) => ({ name: file.name, size: data[index]!.size })),
            ),
        );
        const status = await this.write(reference, data, signal);
        return { status, ...(status === 'saved' && reference ? { folderName: reference.folderName } : {}) };
    }
    private async write(
        reference: NativeBundleReference | null,
        data: Blob[],
        signal?: AbortSignal,
    ): Promise<'saved' | 'cancelled'> {
        if (!reference) return 'cancelled';
        let abortTask: Promise<void> | null = null;
        const abort = () => {
            abortTask ??= this.bridge.abort(reference.bundleId).then(nativeValue);
            void abortTask.catch(() => {});
        };
        signal?.addEventListener('abort', abort, { once: true });
        try {
            signal?.throwIfAborted();
            for (const blob of data) {
                signal?.throwIfAborted();
                nativeValue(await this.bridge.beginFile(reference.bundleId));
                for (let offset = 0; offset < blob.size; offset += SAVE_CHUNK_BYTES) {
                    const chunk = new Uint8Array(await blob.slice(offset, offset + SAVE_CHUNK_BYTES).arrayBuffer());
                    signal?.throwIfAborted();
                    nativeValue(await this.bridge.writeFile(reference.bundleId, chunk));
                }
                signal?.throwIfAborted();
                nativeValue(await this.bridge.closeFile(reference.bundleId));
            }
            signal?.throwIfAborted();
            nativeValue(await this.bridge.commit(reference.bundleId));
            return 'saved';
        } catch (error) {
            abort();
            try {
                await abortTask;
            } catch (cleanup) {
                throw new DirectoryExportCleanupError((cleanup as Error).message);
            }
            if (signal?.aborted) return 'cancelled';
            throw error;
        } finally {
            signal?.removeEventListener('abort', abort);
        }
    }
}
