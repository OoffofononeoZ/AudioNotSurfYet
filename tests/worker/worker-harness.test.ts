import { Worker } from 'node:worker_threads';
import { describe, expect, test } from 'vitest';

function createWorker(): Worker {
    return new Worker(new URL('./probe.worker.mjs', import.meta.url));
}

function nextMessage(worker: Worker): Promise<unknown> {
    return new Promise((resolve, reject) => {
        worker.once('message', resolve);
        worker.once('error', reject);
    });
}

describe('Worker harness', () => {
    test('transfers ArrayBuffer ownership and receives a result', async () => {
        const worker = createWorker();
        const buffer = Uint8Array.from([1, 2, 3, 4]).buffer;
        worker.postMessage({ type: 'transfer', jobId: 'transfer-1', buffer }, [buffer]);

        expect(buffer.byteLength).toBe(0);
        await expect(nextMessage(worker)).resolves.toEqual({
            type: 'result',
            jobId: 'transfer-1',
            sum: 10,
        });
        await worker.terminate();
    });

    test('exposes cooperative cancellation behavior', async () => {
        const worker = createWorker();
        worker.postMessage({ type: 'delayed', jobId: 'cancel-1', delayMs: 20 });
        worker.postMessage({ type: 'cancel', jobId: 'cancel-1' });

        await expect(nextMessage(worker)).resolves.toEqual({
            type: 'cancelled',
            jobId: 'cancel-1',
        });
        await worker.terminate();
    });

    test('surfaces a worker exception', async () => {
        const worker = createWorker();
        const error = new Promise<Error>((resolve) => {
            worker.once('error', resolve);
        });
        worker.postMessage({ type: 'fail' });

        await expect(error).resolves.toMatchObject({
            message: 'intentional worker failure',
        });
        await worker.terminate();
    });
});
