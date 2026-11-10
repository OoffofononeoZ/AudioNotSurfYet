import { expect } from '@playwright/test';
import { test } from '../processing/persistentFixture';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const source = process.env.TRANSCRIPTION_BENCH_AUDIO;
const suppliedStem = process.env.TRANSCRIPTION_BENCH_STEM;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('frozen real-song drums: legacy WASM diagnostic baseline', async ({ page }, info) => {
    test.skip(!source && !suppliedStem, 'Opt-in local audio benchmark.');
    test.setTimeout(7_200_000);
    const directory = path.resolve('artifacts/evals/transcription-optimization');
    await fs.mkdir(directory, { recursive: true });
    let stem = suppliedStem;
    let sourceHash: string | null = null;
    let decoded: unknown = null;
    if (!stem) {
        sourceHash = sha(await fs.readFile(source!));
        stem = path.join(directory, `${sourceHash}-ft-drums.wav`);
        try {
            await fs.access(stem);
        } catch {
            await page.goto('/tests/processing/index.html');
            await page.locator('#audio').setInputFiles(source!);
            decoded = await page.evaluate(() =>
                (window as unknown as { __P1: { local(): Promise<unknown> } }).__P1.local(),
            );
            const downloadPromise = page.waitForEvent('download');
            await page.locator('a[data-role="drums"]').click();
            await (await downloadPromise).saveAs(stem);
            await fs.writeFile(
                `${stem}.json`,
                JSON.stringify({ sourceHash, decoded, createdAt: new Date().toISOString() }, null, 2),
                'utf8',
            );
        }
    }
    const provenance = JSON.parse(await fs.readFile(`${stem}.json`, 'utf8'));
    if (sourceHash && sourceHash !== provenance.sourceHash) throw Error('Frozen source identity mismatch.');
    sourceHash = provenance.sourceHash;
    const sourceFiles = [
        'src/transcription/drumModel.ts',
        'src/transcription/drumFeatures.ts',
        'src/transcription/drumTokens.ts',
        'src/transcription/modelSession.ts',
        'src/processing/runtime.ts',
        'src/transcription/model-artifacts.json',
    ];
    const sourceHashes = await Promise.all(
        sourceFiles.map(async file => ({ file, sha256: sha(await fs.readFile(file)) })),
    );
    const starts = [
        46.08, 70.4, 145.92, 186.88, 87.04, 120.32, 128, 163.84, 192, 199.68, 212.48, 215.04, 245.76, 248.32,
    ];
    const checkpointDirectory = path.join(directory, `${info.project.name}-wasm-checkpoints-${Date.now()}`);
    await fs.mkdir(checkpointDirectory, { recursive: true });
    const checkpoints: Promise<void>[] = [];
    await page.exposeFunction('__saveDrumWindow', (message: { index: number; start: number; window: unknown }) => {
        console.log(`Legacy drum window completed: ${message.start}s`);
        const write = fs.writeFile(
            path.join(checkpointDirectory, `${message.index}.json`),
            JSON.stringify(message),
            'utf8',
        );
        checkpoints.push(write);
        return write;
    });
    await fs.writeFile(
        path.join(checkpointDirectory, 'identity.json'),
        JSON.stringify({
            stemHash: sha(await fs.readFile(stem)),
            sourceHash,
            sourceHashes,
            starts,
            userAgent: await page.evaluate(() => navigator.userAgent),
        }),
        'utf8',
    );
    await page.goto('/tests/transcription/benchmark.html');
    await page.locator('#stem').setInputFiles(stem);
    const result = await page.evaluate(
        starts =>
            (
                window as unknown as {
                    __DrumBenchmark: { run(starts: number[]): Promise<Record<string, unknown>> };
                }
            ).__DrumBenchmark.run(starts),
        starts,
    );
    await Promise.all(checkpoints);
    const endingHashes = await Promise.all(
        sourceFiles.map(async file => ({ file, sha256: sha(await fs.readFile(file)) })),
    );
    expect(endingHashes).toEqual(sourceHashes);
    const output = path.join(directory, `${info.project.name}-wasm-baseline-${Date.now()}.json`);
    await fs.writeFile(
        output,
        JSON.stringify(
            {
                sourceHash,
                stemHash: sha(await fs.readFile(stem)),
                userAgent: await page.evaluate(() => navigator.userAgent),
                sourceHashes,
                result,
            },
            null,
            2,
        ),
        'utf8',
    );
    expect((result.windows as unknown[]).length).toBe(starts.length);
    expect(result.backend).toBe('wasm');
    console.log(`Drum baseline: ${output}`);
});
