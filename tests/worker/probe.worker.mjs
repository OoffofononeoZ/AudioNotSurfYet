import { parentPort } from 'node:worker_threads';

const cancelledJobs = new Set();

parentPort?.on('message', (message) => {
    if (message.type === 'transfer') {
        const values = new Uint8Array(message.buffer);
        const sum = values.reduce((total, value) => total + value, 0);
        parentPort?.postMessage({ type: 'result', jobId: message.jobId, sum });
        return;
    }
    if (message.type === 'cancel') {
        cancelledJobs.add(message.jobId);
        return;
    }
    if (message.type === 'delayed') {
        setTimeout(() => {
            parentPort?.postMessage({
                type: cancelledJobs.has(message.jobId) ? 'cancelled' : 'result',
                jobId: message.jobId,
            });
        }, message.delayMs);
        return;
    }
    if (message.type === 'fail') {
        throw new Error('intentional worker failure');
    }
});
