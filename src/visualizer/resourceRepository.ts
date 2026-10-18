import type { VisualizerResourcePackageV1 } from './resourceTypes';

export interface ResourceRepositoryPort {
    read(): Promise<unknown[]>;
    write(packages: VisualizerResourcePackageV1[], signal: AbortSignal): Promise<void>;
    close(): void;
}
export class ResourceRepository implements ResourceRepositoryPort {
    private database: Promise<IDBDatabase> | null = null;
    private factory: IDBFactory;
    private name: string;
    constructor(factory: IDBFactory = window.indexedDB, name = 'audionotsurfyet-visualizer-resources') {
        this.factory = factory;
        this.name = name;
    }
    private open() {
        if (!this.database)
            this.database = new Promise<IDBDatabase>((resolve, reject) => {
                const r = this.factory.open(this.name, 1);
                r.onupgradeneeded = () => r.result.createObjectStore('library');
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => reject(r.error);
                r.onblocked = () => reject(Error('资源库被其他页面占用。'));
            }).catch(error => {
                this.database = null;
                throw error;
            });
        return this.database;
    }
    async read(): Promise<unknown[]> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('library', 'readonly'),
                request = tx.objectStore('library').get('packages');
            tx.oncomplete = () => {
                if (request.result !== undefined && !Array.isArray(request.result))
                    reject(Error('本地资源库格式无效。'));
                else resolve(request.result ?? []);
            };
            tx.onabort = tx.onerror = () => reject(tx.error ?? Error('读取资源库失败。'));
        });
    }
    async write(packages: VisualizerResourcePackageV1[], signal: AbortSignal) {
        const db = await this.open();
        signal.throwIfAborted();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('library', 'readwrite'),
                abort = () => tx.abort();
            signal.addEventListener('abort', abort, { once: true });
            const cleanup = () => signal.removeEventListener('abort', abort);
            tx.objectStore('library').put(structuredClone(packages), 'packages');
            tx.oncomplete = () => {
                cleanup();
                resolve();
            };
            tx.onabort = tx.onerror = () => {
                cleanup();
                reject(tx.error ?? signal.reason ?? Error('保存资源库失败。'));
            };
        });
    }
    close() {
        void this.database?.then(
            db => db.close(),
            () => {},
        );
        this.database = null;
    }
}
