import 'fake-indexeddb/auto';
import { afterEach, describe, expect, test } from 'vitest';

const DATABASE_NAME = 'audionotsurfyet-m3-harness';

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('session');
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(DATABASE_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
});

describe('isolated IndexedDB harness', () => {
    test('persists and reads a controlled record', async () => {
        const database = await openDatabase();
        const write = database.transaction('session', 'readwrite');
        write.objectStore('session').put({ trackId: 'fixture-track' }, 'current');
        await new Promise<void>((resolve) => {
            write.oncomplete = () => resolve();
        });

        const read = database.transaction('session', 'readonly');
        const value = await requestResult<{ trackId: string }>(
            read.objectStore('session').get('current'),
        );
        expect(value).toEqual({ trackId: 'fixture-track' });
        database.close();
    });

    test('keeps the previous value when a transaction aborts', async () => {
        const database = await openDatabase();
        const initial = database.transaction('session', 'readwrite');
        initial.objectStore('session').put('stable', 'state');
        await new Promise<void>((resolve) => {
            initial.oncomplete = () => resolve();
        });

        const aborted = database.transaction('session', 'readwrite');
        aborted.objectStore('session').put('partial', 'state');
        aborted.abort();
        await new Promise<void>((resolve) => {
            aborted.onabort = () => resolve();
        });

        const read = database.transaction('session', 'readonly');
        expect(await requestResult(read.objectStore('session').get('state'))).toBe('stable');
        database.close();
    });
});
