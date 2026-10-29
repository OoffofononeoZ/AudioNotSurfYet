import type {
    DesktopFileBridge,
    LocalDirectoryReference,
    NativeDirectoryReference,
    NativeFileReference,
} from './fileContracts';
import type { DirectoryFileAccess } from './directoryFiles';
import { directoryPath } from './directoryFiles';
import { DesktopAudioFiles, nativeValue } from './desktopAudioFiles';

function nativeDirectory(root: LocalDirectoryReference): NativeDirectoryReference {
    const reference = root as NativeDirectoryReference;
    if (reference.kind !== 'directory' || reference.platform !== 'electron' || typeof reference.grantId !== 'string')
        throw new DOMException('文件夹引用不属于当前桌面应用。', 'NotAllowedError');
    return reference;
}

export class DesktopDirectoryFiles implements DirectoryFileAccess {
    private readonly files: DesktopAudioFiles;
    private readonly bridge: DesktopFileBridge;
    constructor(bridge: DesktopFileBridge, fetchFile?: typeof fetch) {
        this.bridge = bridge;
        this.files = new DesktopAudioFiles(bridge, fetchFile);
    }
    async chooseResourceDirectory() {
        return nativeValue(await this.bridge.chooseResourceDirectory());
    }
    async queryPermission(root: LocalDirectoryReference) {
        return nativeValue(await this.bridge.filePermission(nativeDirectory(root).grantId));
    }
    async requestPermission(root: LocalDirectoryReference) {
        // Expired grants require a new native selection; renderer cannot grant paths itself.
        return this.queryPermission(root);
    }
    async list(root: LocalDirectoryReference, path: string, signal: AbortSignal) {
        signal.throwIfAborted();
        const entries = nativeValue(
            await this.bridge.listDirectory(nativeDirectory(root).grantId, directoryPath(path)),
        );
        signal.throwIfAborted();
        return entries;
    }
    async read(root: LocalDirectoryReference, path: string, signal: AbortSignal) {
        directoryPath(path);
        if (!path) throw new DOMException('文件路径不能为空。', 'DataError');
        const reference = nativeDirectory(root);
        const parts = path.split('/');
        const file: NativeFileReference = {
            kind: 'file',
            platform: 'electron',
            grantId: reference.grantId,
            relativePath: path,
            name: parts[parts.length - 1]!,
        };
        return this.files.read(file, signal);
    }
}
