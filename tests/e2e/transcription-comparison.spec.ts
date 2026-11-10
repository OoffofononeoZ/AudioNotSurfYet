import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const stem = process.env.TRANSCRIPTION_BENCH_STEM,
    baselinePath = process.env.TRANSCRIPTION_BASELINE_REPORT;
test('same frozen PCM and fourteen exact starts: legacy WASM versus batched WebGPU', async ({ page }, info) => {
    test.skip(!stem || !baselinePath, 'Opt-in exact-start comparison against the completed local WASM baseline.');
    test.setTimeout(900000);
    const baseline = JSON.parse(await fs.readFile(baselinePath!, 'utf8'));
    const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
    const stemHash = sha(await fs.readFile(stem!));
    expect(stemHash).toBe(baseline.stemHash);
    await page.goto('/tests/transcription/benchmark.html');
    await page.locator('#stem').setInputFiles(stem!);
    const answer = await page.evaluate(async (starts: number[]) => {
        const file = document.querySelector<HTMLInputElement>('#stem')!.files![0]!,
            context = new AudioContext({ sampleRate: 44100 });
        let pcm: Float32Array<ArrayBuffer>;
        try {
            const buffer = await context.decodeAudioData(await file.arrayBuffer());
            pcm = new Float32Array(buffer.length);
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                const values = buffer.getChannelData(channel);
                for (let i = 0; i < pcm.length; i++) pcm[i] = pcm[i]! + values[i]! / buffer.numberOfChannels;
            }
        } finally {
            await context.close();
        }
        return new Promise<any>((resolve, reject) => {
            const worker = new Worker('/tests/transcription/drum-comparison.worker.ts', { type: 'module' });
            worker.onmessage = event => {
                if (event.data.type === 'progress') {
                    document.querySelector('#status')!.textContent = JSON.stringify(event.data);
                    return;
                }
                worker.terminate();
                resolve(event.data);
            };
            worker.onerror = error => {
                worker.terminate();
                reject(Error(error.message));
            };
            worker.postMessage({ pcm, starts }, [pcm.buffer]);
        });
    }, baseline.result.starts);
    const files = [
        'drumBatchModel.ts',
        'drumRuntime.ts',
        'drumFeatures.ts',
        'drumOptions.ts',
        'drumVocabulary.ts',
        'onnxConstants.ts',
    ];
    const sourceHashes = await Promise.all(
        files.map(async file => ({ file, sha256: sha(await fs.readFile(`src/transcription/${file}`)) })),
    );
    const comparisons =
        answer.type === 'result'
            ? answer.result.windows.map((window: any, index: number) => {
                  const old = baseline.result.windows[index].diagnostic;
                  let prefix = 0;
                  while (
                      prefix < Math.min(old.tokens.length, window.diagnostic.tokens.length) &&
                      old.tokens[prefix] === window.diagnostic.tokens[prefix]
                  )
                      prefix++;
                  return {
                      startSeconds: old.inputStartSeconds,
                      featureEqual: old.featureHash === window.diagnostic.featureHash,
                      legacy: { tokens: old.tokens, termination: old.termination, decodeMs: old.decodeMs },
                      current: {
                          tokens: window.diagnostic.tokens,
                          termination: window.diagnostic.termination,
                          decodeMs: window.diagnostic.decodeMs,
                      },
                      sharedPrefixTokens: prefix,
                  };
              })
            : [];
    const directory = 'artifacts/evals/transcription-optimization';
    await fs.mkdir(directory, { recursive: true });
    const output = path.join(directory, `${info.project.name}-paired-windows-${Date.now()}.json`);
    await fs.writeFile(
        output,
        JSON.stringify(
            {
                kind: 'exact-start-paired-probe',
                baselineHash: sha(await fs.readFile(baselinePath!)),
                stemHash,
                sourceHashes,
                userAgent: await page.evaluate(() => navigator.userAgent),
                legacyTotalMs: baseline.result.totalMs,
                answer,
                comparisons,
            },
            null,
            2,
        ),
        'utf8',
    );
    console.log(`Exact-start comparison: ${output}`);
    expect(answer.type, JSON.stringify(answer)).toBe('result');
    expect(comparisons).toHaveLength(baseline.result.starts.length);
    expect(comparisons.every((comparison: { featureEqual: boolean }) => comparison.featureEqual)).toBe(true);
});
