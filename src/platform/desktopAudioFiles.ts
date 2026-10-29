import type {
    AudioFileAccess,
    DesktopFileBridge,
    LocalFileReference,
    NativeFileReference,
    NativeResult,
} from './fileContracts';

export function nativeValue<T>(result: NativeResult<T>): T {
    if (result.ok) return result.value;
    const names = {
        'file-missing': 'NotFoundError',
        'permission-denied': 'NotAllowedError',
        'invalid-request': 'DataError',
        'store-invalid': 'InvalidStateError',
        'io-error': 'NotReadableError',
    };
    throw new DOMException(result.error.message, names[result.error.code]);
}

function nativeReference(reference: LocalFileReference): NativeFileReference {
    const native = reference as NativeFileReference;
    if (native.platform !== 'electron' || native.kind !== 'file' || typeof native.grantId !== 'string') {
        throw new DOMException('文件引用不属于当前桌面应用。', 'NotAllowedError');
    }
    return native;
}

export class DesktopAudioFiles implements AudioFileAccess {
    readonly restoreFromReferenceFirst = true;
    private readonly bridge: DesktopFileBridge;
    private readonly fetchFile: typeof fetch;
    constructor(bridge: DesktopFileBridge, fetchFile: typeof fetch = globalThis.fetch.bind(globalThis)) {
        this.bridge = bridge;
        this.fetchFile = fetchFile;
    }
    async choose({ multiple }: { multiple: boolean }) {
        return nativeValue(await this.bridge.chooseAudio(multiple));
    }
    async read(reference: LocalFileReference, signal?: AbortSignal) {
        signal?.throwIfAborted();
        const native = nativeReference(reference);
        const describe = () =>
            native.relativePath === undefined
                ? this.bridge.describeFile(native.grantId)
                : this.bridge.describeDirectoryFile(native.grantId, native.relativePath);
        const descriptor = nativeValue(await describe());
        signal?.throwIfAborted();
        const response = await this.fetchFile(descriptor.readUrl, { signal, cache: 'no-store' });
        if (!response.ok)
            throw new DOMException(
                '无法读取选定的文件，请重新选择。',
                response.status === 404 ? 'NotFoundError' : 'NotReadableError',
            );
        const blob = await response.blob();
        signal?.throwIfAborted();
        const latest = nativeValue(await describe());
        if (latest.revision !== descriptor.revision || blob.size !== descriptor.size) {
            throw new DOMException('读取期间文件内容发生变化，请重试。', 'NotReadableError');
        }
        signal?.throwIfAborted();
        return new File([blob], descriptor.reference.name, {
            type: descriptor.mimeType,
            lastModified: descriptor.lastModified,
        });
    }
    async queryPermission(reference: LocalFileReference) {
        return nativeValue(await this.bridge.filePermission(nativeReference(reference).grantId));
    }
    async requestPermission(reference: LocalFileReference) {
        return this.queryPermission(reference);
    }
}
