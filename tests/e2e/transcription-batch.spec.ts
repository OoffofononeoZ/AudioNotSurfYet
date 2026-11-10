import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('ADT WebGPU batch and tail retain independent sequences and explicit truncation', async ({ page }, info) => {
    test.setTimeout(600000);
    await page.goto('/tests/transcription/index.html');
    const answer = await page.evaluate(
        () =>
            new Promise<any>((resolve, reject) => {
                const worker = new Worker('/tests/transcription/batch-probe.worker.ts', { type: 'module' });
                worker.onmessage = event => {
                    document.querySelector('#status')!.textContent = JSON.stringify(
                        event.data.type === 'progress' ? event.data : { type: event.data.type },
                    );
                    if (event.data.type === 'progress') return;
                    worker.terminate();
                    resolve(event.data);
                };
                worker.onerror = error => {
                    worker.terminate();
                    reject(Error(error.message));
                };
                worker.postMessage({});
            }),
    );
    await fs.mkdir('artifacts/evals/transcription-optimization', { recursive: true });
    await fs.writeFile(
        `artifacts/evals/transcription-optimization/${info.project.name}-batch-probe-${Date.now()}.json`,
        JSON.stringify(answer, null, 2),
        'utf8',
    );
    expect(answer.type, JSON.stringify(answer)).toBe('result');
    const { rows, limited, cpu, wasmRows } = answer.result;
    expect(answer.result.backend).toBe('webgpu');
    expect(rows).toHaveLength(3);
    expect(rows[0].diagnostic.termination).toBe('eos');
    expect(rows[1].diagnostic.tokens).toEqual(rows[0].diagnostic.tokens);
    expect(rows[2].diagnostic.tokens).toEqual(rows[0].diagnostic.tokens);
    expect(rows[0].diagnostic.featureHash).toBe(cpu.diagnostic.featureHash);
    expect(rows[0].hits.length).toBeGreaterThan(0);
    expect(limited[0].diagnostic.termination).toBe('limit');
    expect(limited[0].diagnostic.tokenCount).toBe(4);
    // Preserve both raw outputs: numeric differences may change greedy tokens.
    expect(cpu.hits.length).toBeGreaterThan(0);
    expect(answer.result.wasmBackend).toBe('wasm');
    expect(wasmRows).toHaveLength(3);
    for (const row of wasmRows) {
        expect(row.diagnostic.termination).toBe('eos');
        expect(row.diagnostic.featureHash).toBe(cpu.diagnostic.featureHash);
        expect(row.diagnostic.tokens).toEqual(wasmRows[0].diagnostic.tokens);
        expect(row.hits.length).toBeGreaterThan(0);
    }
});
