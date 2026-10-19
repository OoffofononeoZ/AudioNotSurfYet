import type { ResourceDirectoryHandle } from './resourceDirectory';
export interface ResourceDirectoryRepository {
    read(): Promise<ResourceDirectoryHandle | null>;
    save(handle: ResourceDirectoryHandle): Promise<void>;
}
/** Owns only the directory handle. No resource packages or previews are persisted here. */
export class IndexedDbResourceDirectoryRepository implements ResourceDirectoryRepository {
    private factory: IDBFactory;
    constructor(factory: IDBFactory = indexedDB) {
        this.factory = factory;
    }
    private async access<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            let failed = false;
            const request = this.factory.open('audionotsurfyet-resource-directory', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('directory');
            request.onsuccess = () => {
                if (failed) request.result.close();
                else resolve(request.result);
            };
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
                failed = true;
                reject(Error('资源目录记录被其他页面占用。'));
            };
        });
        try {
            return await new Promise<T>((resolve, reject) => {
                const transaction = db.transaction('directory', mode);
                const request = action(transaction.objectStore('directory'));
                transaction.oncomplete = () => resolve(request.result);
                transaction.onabort = () => reject(transaction.error ?? request.error ?? Error('资源目录记录失败。'));
                transaction.onerror = () => reject(transaction.error ?? request.error);
            });
        } finally {
            db.close();
        }
    }
    async read() {
        return (
            ((await this.access('readonly', store => store.get('assets'))) as ResourceDirectoryHandle | null) ?? null
        );
    }
    async save(handle: ResourceDirectoryHandle) {
        await this.access('readwrite', store => store.put(handle, 'assets'));
    }
}
