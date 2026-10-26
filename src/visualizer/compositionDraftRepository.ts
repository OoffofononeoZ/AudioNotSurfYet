import { validateCompositionDraft } from './compositionCodec';
import type { CompositionDraft } from './compositionTypes';
import { hasLegacySeed } from './seedMigration';

export type RestoredComposition =
    { kind: 'current'; draft: CompositionDraft; needsSave?: true } | { kind: 'unsupported'; raw: unknown } | null;
export interface CompositionDraftRepositoryPort {
    restore(): Promise<RestoredComposition>;
    replace(draft: CompositionDraft): Promise<void>;
    close(): void;
}
const request = <T>(r: IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error ?? new Error('无法读取草稿。'));
    });
const done = (tx: IDBTransaction) =>
    new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('草稿事务失败。'));
    });
/** V5 shares the draft key; older envelopes are intentionally ignored. */
export class CompositionDraftRepository implements CompositionDraftRepositoryPort {
    private database: Promise<IDBDatabase> | null = null;
    private readonly factory: IDBFactory;
    private readonly name: string;
    constructor(factory: IDBFactory = window.indexedDB, name = 'audionotsurfyet-visualizer') {
        this.factory = factory;
        this.name = name;
    }
    private open() {
        if (!this.database)
            this.database = new Promise<IDBDatabase>((resolve, reject) => {
                const r = this.factory.open(this.name, 1);
                r.onupgradeneeded = () => {
                    if (!r.result.objectStoreNames.contains('draft'))
                        r.result.createObjectStore('draft', { keyPath: 'key' });
                };
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => reject(r.error);
                r.onblocked = () => reject(new Error('草稿数据库被其他页面占用。'));
            }).catch(error => {
                this.database = null;
                throw error;
            });
        return this.database;
    }
    async restore(): Promise<RestoredComposition> {
        const db = await this.open();
        const tx = db.transaction('draft', 'readonly');
        const complete = done(tx);
        const stored = await request(tx.objectStore('draft').get('latest'));
        await complete;
        if (!stored || ![5, 6].includes(stored.envelope?.schemaVersion)) return null;
        try {
            return {
                kind: 'current',
                draft: validateCompositionDraft(stored.envelope),
                ...(hasLegacySeed(stored.envelope.project) || stored.envelope.schemaVersion === 5
                    ? { needsSave: true as const }
                    : {}),
            };
        } catch {
            return { kind: 'unsupported', raw: structuredClone(stored.envelope) };
        }
    }
    async replace(draft: CompositionDraft) {
        const envelope = validateCompositionDraft(draft);
        const db = await this.open();
        const tx = db.transaction('draft', 'readwrite');
        const complete = done(tx);
        tx.objectStore('draft').put({ key: 'latest', envelope });
        await complete;
    }
    close() {
        void this.database?.then(db => db.close());
        this.database = null;
    }
}
