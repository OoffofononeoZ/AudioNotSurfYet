import { expect } from '@playwright/test';
import { test } from '../processing/persistentFixture';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { FT_MODELS } from '../../src/processing/modelManifest';
import type { TranscriptionRecord } from '../../src/transcription/resultRepository';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { openEditorWorkspace } from '../support/editor-workspaces';
import { startSystemSampler } from '../processing/systemSampler';
import { exerciseRealRangeExamples } from '../support/real-range-example-flow.mjs';

const audio = process.env.TRANSCRIPTION_PRODUCT_AUDIO;
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
test('cached real-song product drum analysis includes verification, DSP, review and result publication', async ({
    page,
}, info) => {
    test.skip(
        !audio,
        'Explicit local original audio required; full FT preparation is separate from timed transcription.',
    );
    test.setTimeout(3600000);
    const directory = path.resolve(
        'artifacts/evals/transcription-optimization/product',
        `${info.project.name}-${Date.now()}`,
    );
    await fs.mkdir(directory, { recursive: true });
    const artifacts = JSON.parse(await fs.readFile('src/transcription/model-artifacts.json', 'utf8')) as {
        models: Array<{ id: string; file: string; bytes: number; sha256: string }>;
    };
    const models = [
        ...FT_MODELS.map(m => ({ ...m, prefix: 'p1-models' })),
        ...artifacts.models.filter(m => m.id.startsWith('adt-')).map(m => ({ ...m, prefix: 'transcription-models' })),
    ];
    for (const model of models) {
        const bytes = await fs.readFile(path.resolve('artifacts/fixtures', model.prefix, model.file));
        expect(bytes.byteLength).toBe(model.bytes);
        expect(sha(bytes)).toBe(model.sha256);
    }
    const files = [
        'src/processing/modelManifest.ts',
        'src/processing/runtime.ts',
        'src/transcription/drumRuntime.ts',
        'src/transcription/drumTranscription.ts',
        'src/transcription/pipeline.ts',
        'src/transcription/analysisOptions.ts',
        'src/transcription/candidateReview.ts',
        'src/transcription/editorTranscriptionService.ts',
        'src/transcription/resultRepository.ts',
    ];
    const sourceHashes = await Promise.all(files.map(async file => ({ file, sha256: sha(await fs.readFile(file)) })));
    const sourceHash = sha(await fs.readFile(audio!)),
        errors: string[] = [],
        requests: string[] = [];
    let timed = false;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
        if (
            timed &&
            /^https?:/.test(request.url()) &&
            !request.url().startsWith(`http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 4173}`)
        )
            requests.push(request.url());
    });
    await installFilePickerStub(page);
    await page.goto('/');
    // Prepare exact fixed model bytes outside the measured interval; product loaders still verify cached bytes.
    await page.evaluate(
        async assets => {
            const url = '/src/processing/storage.ts',
                { databasePut } = await import(url);
            for (const model of assets) {
                const response = await fetch(`/${model.prefix}/${model.file}`);
                if (!response.ok) throw Error(`Missing fixture ${model.file}`);
                await databasePut('models', model.sha256, await response.blob(), new AbortController().signal);
            }
        },
        models.map(m => ({ prefix: m.prefix, file: m.file, sha256: m.sha256 })),
    );
    await chooseFiles(page, [audio!]);
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('toggle-playback').click();
    await openEditorWorkspace(page, 'separation');
    const ftStarted = Date.now();
    await page.getByTestId('editor-separate-start').click();
    let previous = '';
    await expect
        .poll(
            async () => {
                const state = await page.getByTestId('editor-separation').getAttribute('data-state');
                const text = (await page.getByTestId('editor-separation-progress').allTextContents()).join(' ');
                const phase = `${state}:${text?.trim().slice(0, 180)}`;
                if (phase !== previous) {
                    previous = phase;
                    console.log(`${info.project.name} FT ${phase}`);
                    await fs.writeFile(
                        path.join(directory, 'ft-checkpoint.json'),
                        JSON.stringify({ sourceHash, elapsedMs: Date.now() - ftStarted, phase }),
                        'utf8',
                    );
                }
                return state;
            },
            { timeout: 3000000, intervals: [1000] },
        )
        .toMatch(/^(ready|error|cancelled)$/);
    expect(
        await page.getByTestId('editor-separation').getAttribute('data-state'),
        (await page.getByTestId('editor-separation-message').allTextContents()).join(' '),
    ).toBe('ready');
    const ftPreparationMs = Date.now() - ftStarted;
    await openEditorWorkspace(page, 'transcription');
    await expect(page.getByTestId('transcription-start')).toBeEnabled({ timeout: 60000 });
    for (const instrument of ['低音', '人声', '钢琴', '吉他', '其他音色'])
        await page.getByRole('checkbox', { name: new RegExp(`^${instrument} Basic Pitch`) }).uncheck();
    const stopSampler = await startSystemSampler();
    let memory;
    let elapsedMs = 0;
    try {
        timed = true;
        const started = await page.evaluate(() => performance.now());
        await page.getByTestId('transcription-start').click();
        previous = '';
        await expect
            .poll(
                async () => {
                    const state = await page.getByTestId('editor-transcription').getAttribute('data-state');
                    const text = (await page.getByTestId('transcription-progress').allTextContents()).join(' ');
                    const phase = `${state}:${text?.trim().slice(0, 180)}`;
                    if (phase !== previous) {
                        previous = phase;
                        console.log(`${info.project.name} drums ${phase}`);
                        await fs.writeFile(
                            path.join(directory, 'drum-checkpoint.json'),
                            JSON.stringify({ sourceHash, phase }),
                            'utf8',
                        );
                    }
                    return state;
                },
                { timeout: 1200000, intervals: [1000] },
            )
            .toMatch(/^(ready|partial|error|cancelled)$/);
        elapsedMs = (await page.evaluate(() => performance.now())) - started;
        timed = false;
    } finally {
        timed = false;
        memory = await stopSampler();
    }
    const status = await page.getByTestId('editor-transcription').getAttribute('data-state');
    const record: TranscriptionRecord | null = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open('editor-transcriptions', 1);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
        try {
            return await new Promise((resolve, reject) => {
                const r = db.transaction('results').objectStore('results').getAll();
                r.onsuccess = () => resolve(r.result.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null);
                r.onerror = () => reject(r.error);
            });
        } finally {
            db.close();
        }
    });
    // Export after timing/memory collection, in bounded chunks; native Web save uses
    // File System Access rather than a browser download event.
    let stemHash: string | null = null;
    if (record) {
        const stem = path.join(directory, 'ft-drums.wav'),
            handle = await fs.open(stem, 'wx'),
            hash = createHash('sha256');
        try {
            for (let offset = 0; ; offset += 1024 * 1024) {
                const part = await page.evaluate(
                    async ({ id, offset }) => {
                        const root = await navigator.storage.getDirectory(),
                            base = await root.getDirectoryHandle('processing-p1'),
                            directory = await base.getDirectoryHandle(id),
                            file = await (await directory.getFileHandle('drums.wav')).getFile();
                        if (offset >= file.size) return null;
                        const bytes = new Uint8Array(await file.slice(offset, offset + 1024 * 1024).arrayBuffer());
                        let binary = '';
                        for (let at = 0; at < bytes.length; at += 16384)
                            binary += String.fromCharCode(...bytes.subarray(at, at + 16384));
                        return btoa(binary);
                    },
                    { id: record.bundle.result.identity.ftResultId, offset },
                );
                if (part === null) break;
                const bytes = Buffer.from(part, 'base64');
                hash.update(bytes);
                await handle.write(bytes);
            }
            stemHash = hash.digest('hex');
        } finally {
            await handle.close();
        }
    }
    await fs.writeFile(path.join(directory, 'cached-record.json'), JSON.stringify(record), 'utf8');
    const rangeExamples = process.env.EXAMPLE_BENCH_REFERENCE
        ? await exerciseRealRangeExamples(page, process.env.EXAMPLE_BENCH_REFERENCE, directory, sourceHash)
        : null;
    await fs.writeFile(
        path.join(directory, 'report.json'),
        JSON.stringify(
            {
                sourceHash,
                stemHash,
                sourceHashes,
                status,
                elapsedMs,
                targetMs: 600000,
                targetMet: elapsedMs <= 600000,
                ftPreparationMs,
                rangeExamples,
                timedScope:
                    'Before product start click through verified cached record, derived review and rendered terminal status; FT, network, exports and later example queries excluded.',
                requestsDuringTimedInterval: requests,
                errors,
                memory,
                userAgent: await page.evaluate(() => navigator.userAgent),
            },
            null,
            2,
        ),
        'utf8',
    );
    expect(status, (await page.getByTestId('transcription-message').allTextContents()).join(' ')).toMatch(
        /^(ready|partial)$/,
    );
    expect(record?.bundle.result.identity.contentHash).toBe(sourceHash);
    expect(record?.bundle.result.completedRoles).toEqual(['drums']);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    expect(await Promise.all(files.map(async file => ({ file, sha256: sha(await fs.readFile(file)) })))).toEqual(
        sourceHashes,
    );
    console.log(
        `${info.project.name} product ${elapsedMs.toFixed(0)} ms; target ${elapsedMs <= 600000 ? 'met' : 'missed'}`,
    );
});
