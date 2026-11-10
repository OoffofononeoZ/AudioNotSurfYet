import { ACOUSTIC_CONFIG_HASH, validAcousticIndex } from '../acousticIndex';
import type { AcousticIndex } from '../acousticIndex';
import { Sha256 } from '../../processing/sha256';
import { checkCapacity } from '../../processing/storage';
import { checkCancelled, ProcessingError } from '../../processing/modelManifest';
import { exampleHash, indexArrays, validateExampleProfile } from './types';
import type { ExampleProfile, ExampleSource } from './types';

const databaseName = 'editor-sound-examples';
async function database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('profiles');
            request.result.createObjectStore('indices');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function transact<T>(
    store: string,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
    signal?: AbortSignal,
): Promise<T> {
    if (signal) checkCancelled(signal);
    const db = await database();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(store, mode),
                cancel = () => tx.abort();
            signal?.addEventListener('abort', cancel, { once: true });
            const request = action(tx.objectStore(store));
            tx.oncomplete = () => {
                signal?.removeEventListener('abort', cancel);
                resolve(request.result);
            };
            tx.onabort = tx.onerror = () => {
                signal?.removeEventListener('abort', cancel);
                reject(tx.error ?? new ProcessingError('job-cancelled', '示例缓存操作已取消。'));
            };
            if (signal?.aborted) cancel();
        });
    } finally {
        db.close();
    }
}
interface IndexRecord {
    version: 1;
    sourceKey: string;
    configHash: string;
    index: AcousticIndex;
    checksum: string;
}
function indexChecksum(record: Omit<IndexRecord, 'checksum'>): string {
    const { index, ...identity } = record,
        hash = new Sha256();
    hash.update(
        new TextEncoder().encode(
            JSON.stringify({
                ...identity,
                sourceFrames: index.sourceFrames,
                sourceSampleRate: index.sourceSampleRate,
                durationSeconds: index.durationSeconds,
                frameCount: index.frameCount,
                configHash: index.configHash,
            }),
        ),
    );
    for (const view of indexArrays(index)) hash.update(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    return hash.hex();
}
export class ExampleRepository {
    async profiles(songHash: string, signal: AbortSignal): Promise<ExampleProfile[]> {
        const records = await transact<Array<{ profile: ExampleProfile; checksum: string }>>(
            'profiles',
            'readonly',
            s => s.getAll(),
            signal,
        );
        checkCancelled(signal);
        return records
            .filter(record => record.profile?.songHash === songHash)
            .map(record => {
                validateExampleProfile(record.profile);
                if (record.checksum !== exampleHash(record.profile))
                    throw new ProcessingError('result-invalid', '声音示例缓存校验失败，请显式清理后重建。');
                return record.profile;
            });
    }
    async save(profile: ExampleProfile, signal: AbortSignal, cacheLimit: number): Promise<void> {
        validateExampleProfile(profile);
        checkCancelled(signal);
        const record = { profile, checksum: exampleHash(profile) };
        await checkCapacity(new TextEncoder().encode(JSON.stringify(record)).byteLength, cacheLimit);
        checkCancelled(signal);
        await transact('profiles', 'readwrite', s => s.put(record, profile.id), signal);
    }
    async removeProfile(id: string, signal: AbortSignal): Promise<void> {
        await transact('profiles', 'readwrite', s => s.delete(id), signal);
    }
    async restoreIndex(source: ExampleSource, signal: AbortSignal): Promise<AcousticIndex | null> {
        const key = `${source.key}:${ACOUSTIC_CONFIG_HASH}`,
            record = await transact<IndexRecord | undefined>('indices', 'readonly', s => s.get(key), signal);
        checkCancelled(signal);
        if (!record) return null;
        const { checksum, ...body } = record;
        if (
            record.version !== 1 ||
            record.sourceKey !== source.key ||
            record.configHash !== ACOUSTIC_CONFIG_HASH ||
            !validAcousticIndex(record.index) ||
            record.index.sourceFrames !== source.frames ||
            record.index.sourceSampleRate !== source.sampleRate ||
            indexChecksum(body) !== checksum
        )
            throw new ProcessingError('result-invalid', '声学索引缓存校验失败，请显式清理后重建。');
        return record.index;
    }
    async publishIndex(
        source: ExampleSource,
        index: AcousticIndex,
        signal: AbortSignal,
        cacheLimit: number,
    ): Promise<void> {
        checkCancelled(signal);
        if (
            !validAcousticIndex(index) ||
            index.sourceFrames !== source.frames ||
            index.sourceSampleRate !== source.sampleRate
        )
            throw new ProcessingError('result-invalid', '无法保存来源不符的声学索引。');
        await checkCapacity(indexArrays(index).reduce((sum, a) => sum + a.byteLength, 0) + 1024, cacheLimit);
        checkCancelled(signal);
        const body = { version: 1 as const, sourceKey: source.key, configHash: ACOUSTIC_CONFIG_HASH, index },
            record: IndexRecord = { ...body, checksum: indexChecksum(body) };
        await transact('indices', 'readwrite', s => s.put(record, `${source.key}:${ACOUSTIC_CONFIG_HASH}`), signal);
    }
    async clearIndex(sourceKey: string): Promise<void> {
        const keys = await transact<IDBValidKey[]>('indices', 'readonly', s => s.getAllKeys());
        for (const key of keys)
            if (typeof key === 'string' && key.startsWith(`${sourceKey}:`))
                await transact('indices', 'readwrite', s => s.delete(key));
    }
    async clearAll(): Promise<void> {
        await transact('profiles', 'readwrite', s => s.clear());
        await transact('indices', 'readwrite', s => s.clear());
    }
}
