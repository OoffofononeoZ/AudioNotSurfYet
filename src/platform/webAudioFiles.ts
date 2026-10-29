import type { AudioFileAccess, LocalFileReference } from './fileContracts';

interface PermissionedFileHandle extends FileSystemFileHandle {
    queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

export class BrowserAudioFiles implements AudioFileAccess {
    readonly restoreFromReferenceFirst = false;
    async choose({
        multiple,
        purpose = 'audio',
    }: {
        multiple: boolean;
        purpose?: 'audio' | 'osu-audio';
    }): Promise<LocalFileReference[]> {
        const picker = (
            window as unknown as {
                showOpenFilePicker?: (options: Record<string, unknown>) => Promise<FileSystemFileHandle[]>;
            }
        ).showOpenFilePicker;
        if (!picker)
            throw Error(
                '当前浏览器或页面环境不支持本地文件句柄，请使用最新版 Chrome/Edge 并通过 HTTPS 或 localhost 访问。',
            );
        return picker({
            multiple,
            excludeAcceptAllOption: true,
            types: [
                {
                    description: 'Audio files',
                    accept: {
                        'audio/*':
                            purpose === 'osu-audio'
                                ? ['.mp3', '.wav', '.flac', '.ogg', '.m4a']
                                : ['.mp3', '.wav', '.flac'],
                    },
                },
            ],
        });
    }
    async read(reference: LocalFileReference, signal?: AbortSignal) {
        signal?.throwIfAborted();
        const file = await (reference as FileSystemFileHandle).getFile();
        signal?.throwIfAborted();
        return file;
    }
    async queryPermission(reference: LocalFileReference): Promise<PermissionState> {
        const handle = reference as PermissionedFileHandle;
        return handle.queryPermission ? handle.queryPermission({ mode: 'read' }) : 'granted';
    }
    async requestPermission(reference: LocalFileReference): Promise<PermissionState> {
        const handle = reference as PermissionedFileHandle;
        return handle.requestPermission ? handle.requestPermission({ mode: 'read' }) : 'granted';
    }
}
