import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

test('drum GPU unavailable and actual owned-device loss fail without returning CPU results', async ({ page }, info) => {
    test.setTimeout(180000);
    await page.goto('/tests/transcription/index.html');
    const results = [];
    for (const mode of ['unavailable', 'device-lost']) {
        const result = await page.evaluate(
            mode =>
                new Promise<any>((resolve, reject) => {
                    const worker = new Worker('/tests/transcription/gpu-failure-probe.worker.ts', { type: 'module' }),
                        timeout = setTimeout(() => {
                            worker.terminate();
                            reject(Error('GPU failure probe did not settle.'));
                        }, 120000);
                    worker.onmessage = event => {
                        if (event.data.type === 'progress') return;
                        clearTimeout(timeout);
                        worker.terminate();
                        if (event.data.type === 'error') reject(Error(event.data.message));
                        else resolve(event.data);
                    };
                    worker.onerror = error => {
                        clearTimeout(timeout);
                        worker.terminate();
                        reject(Error(error.message));
                    };
                    worker.postMessage({ mode });
                }),
            mode,
        );
        results.push(result);
    }
    const directory = path.resolve('artifacts/evals/transcription-optimization/failures');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
        path.join(directory, `${info.project.name}-${Date.now()}.json`),
        JSON.stringify({ results, userAgent: await page.evaluate(() => navigator.userAgent) }, null, 2),
        'utf8',
    );
    expect(results[0]).toMatchObject({
        mode: 'unavailable',
        code: 'webgpu-unavailable',
        requestedBackend: 'webgpu',
        outputCount: 0,
    });
    expect(results[1]).toMatchObject({
        mode: 'device-lost',
        backend: 'webgpu',
        destroyed: true,
        lostReason: 'destroyed',
        outputCount: 0,
        sessionsReleased: true,
    });
    expect(results[1].caught).toBeTruthy();
});
