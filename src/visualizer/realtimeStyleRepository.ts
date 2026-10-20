import { validateRealtimeStyle, type RealtimeStyleV1 } from './realtimeStyle';

/** Immutable, independent snapshots. Song drafts and resource-directory permissions are untouched. */
export class RealtimeStyleRepository {
    private database: Promise<IDBDatabase> | null = null;
    private factory: IDBFactory;
    private name: string;
    constructor(factory: IDBFactory = window.indexedDB, name = 'audionotsurfyet-realtime-styles') {
        this.factory = factory;
        this.name = name;
    }
    private open() {
        if (!this.database)
            this.database = new Promise<IDBDatabase>((resolve, reject) => {
                const request = this.factory.open(this.name, 1);
                request.onupgradeneeded = () => request.result.createObjectStore('styles', { keyPath: 'id' });
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error ?? Error('无法打开样式存储。'));
                request.onblocked = () => reject(Error('样式存储被其他页面占用。'));
            }).catch(error => {
                this.database = null;
                throw error;
            });
        return this.database;
    }
    async save(style: RealtimeStyleV1) {
        const validated = validateRealtimeStyle(style),
            db = await this.open();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('styles', 'readwrite');
            tx.objectStore('styles').add(validated);
            tx.oncomplete = () => resolve();
            tx.onabort = tx.onerror = () => reject(tx.error ?? Error('保存实时样式失败。'));
        });
    }
    async read(id: string): Promise<RealtimeStyleV1 | null> {
        const db = await this.open();
        const input = await new Promise<unknown>((resolve, reject) => {
            const tx = db.transaction('styles', 'readonly'),
                request = tx.objectStore('styles').get(id);
            let value: unknown;
            request.onsuccess = () => {
                value = request.result;
            };
            tx.oncomplete = () => resolve(value);
            tx.onabort = tx.onerror = () => reject(tx.error ?? Error('读取实时样式失败。'));
        });
        return input === undefined ? null : validateRealtimeStyle(input);
    }
    close() {
        void this.database?.then(db => db.close()).catch(() => {});
        this.database = null;
    }
}
