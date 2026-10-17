import { VisualizerExportError } from './exportTypes';

const DIRECTORY = 'visualizer-export';
const ownsName = (name: string) => /^[a-f0-9-]{36}\.webm$/.test(name);
const lockName = (name: string) => `${DIRECTORY}:${name}`;
export interface ExportArtifact {
    readonly writable: FileSystemWritableFileStream;
    file(): Promise<File>;
    discard(): Promise<void>;
}

/** Active and ready files keep their Web Lock, including across other tabs' cleanup. */
export async function createExportArtifact(): Promise<ExportArtifact> {
    if (!navigator.storage?.getDirectory || !navigator.locks) throw new VisualizerExportError('storage-unavailable', '导出临时文件存储不可用。');
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(DIRECTORY, { create: true });
    const iterable = directory as FileSystemDirectoryHandle & { keys(): AsyncIterableIterator<string> };
    for await (const name of iterable.keys()) {
        if (!ownsName(name)) continue;
        await navigator.locks.request(lockName(name), { ifAvailable: true }, async lock => {
            if (lock) await directory.removeEntry(name).catch(error => { if (error.name !== 'NotFoundError') throw error; });
        });
    }
    const name = `${crypto.randomUUID()}.webm`;
    let unlock!: () => void, acquired!: () => void, failed!: (error: unknown) => void;
    const held = new Promise<void>(resolve => { unlock = resolve; });
    const ready = new Promise<void>((resolve, reject) => { acquired = resolve; failed = reject; });
    const lock = navigator.locks.request(lockName(name), async () => { acquired(); await held; });
    void lock.catch(failed);
    await ready;
    try {
        const handle = await directory.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        let discarded = false;
        return { writable, file: () => handle.getFile(), async discard() {
            if (discarded) return;
            discarded = true;
            try { await writable.abort().catch(() => undefined); await directory.removeEntry(name); }
            finally { unlock(); await lock; }
        } };
    } catch (error) {
        await directory.removeEntry(name).catch(() => undefined);
        unlock(); await lock; throw error;
    }
}
