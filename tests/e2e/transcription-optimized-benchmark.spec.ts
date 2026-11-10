import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const stem = process.env.TRANSCRIPTION_BENCH_STEM;
test('frozen FT drums: complete WebGPU overlap and bounded retry benchmark', async ({ page }, info) => {
    test.skip(!stem, 'Opt-in frozen local FT drums input.');
    test.setTimeout(900000);
    page.on('console', message => {
        if (message.text().startsWith('drum-benchmark:')) console.log(message.text());
    });
    await page.goto('/tests/transcription/index.html');
    await page.evaluate(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.id = 'frozen-stem';
        document.body.append(input);
    });
    await page.locator('#frozen-stem').setInputFiles(stem!);
    const answer = await page.evaluate(async () => {
        const file = document.querySelector<HTMLInputElement>('#frozen-stem')!.files![0]!;
        const context = new AudioContext({ sampleRate: 44100 });
        const buffer = await context.decodeAudioData(await file.arrayBuffer());
        const pcm = new Float32Array(buffer.length);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const source = buffer.getChannelData(channel);
            for (let i = 0; i < pcm.length; i++) pcm[i] = pcm[i]! + source[i]! / buffer.numberOfChannels;
        }
        await context.close();
        return new Promise<any>((resolve, reject) => {
            const worker = new Worker('/tests/transcription/optimized-benchmark.worker.ts', { type: 'module' });
            worker.onmessage = event => {
                document.querySelector('#status')!.textContent = JSON.stringify(
                    event.data.type === 'progress' ? event.data : { type: event.data.type },
                );
                if (event.data.type === 'progress') {
                    if (event.data.phase.includes('windows'))
                        console.log(`drum-benchmark: ${event.data.phase} ${event.data.done}/${event.data.total}`);
                    return;
                }
                worker.terminate();
                resolve(event.data);
            };
            worker.onerror = error => {
                worker.terminate();
                reject(Error(error.message));
            };
            worker.postMessage({ pcm }, [pcm.buffer]);
        });
    });
    const directory = 'artifacts/evals/transcription-optimization';
    await fs.mkdir(directory, { recursive: true });
    const files = [
        'drumBatchModel.ts',
        'drumRuntime.ts',
        'onnxConstants.ts',
        'drumTranscription.ts',
        'drumWindows.ts',
        'drumOptions.ts',
    ];
    const sourceHashes = await Promise.all(
        files.map(async file => ({
            file,
            hash: createHash('sha256')
                .update(await fs.readFile(`src/transcription/${file}`))
                .digest('hex'),
        })),
    );
    const output = path.join(directory, `${info.project.name}-optimized-${Date.now()}.json`);
    await fs.writeFile(
        output,
        JSON.stringify(
            {
                stemHash: createHash('sha256')
                    .update(await fs.readFile(stem!))
                    .digest('hex'),
                userAgent: await page.evaluate(() => navigator.userAgent),
                sourceHashes,
                answer,
            },
            null,
            2,
        ),
        'utf8',
    );
    console.log(`Optimized drum report: ${output}`);
    expect(answer.type, JSON.stringify(answer)).toBe('result');
    expect(answer.result.backend).toBe('webgpu');
    expect(answer.result.diagnostics.length).toBeGreaterThan(0);
    expect(answer.result.totalMs).toBeLessThanOrEqual(600000);
});
