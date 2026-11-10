import { expect } from '@playwright/test';
import { test } from '../processing/persistentFixture';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { openEditorWorkspace } from '../support/editor-workspaces';
import { storedExampleProfiles } from '../support/sound-example-flow.mjs';
import type { EditorProjectV2, RangeLaneV1 } from '../../src/editor/types';
import type { ExampleMatch } from '../../src/transcription/examples/types';
import { EXAMPLE_SEARCH_CONFIG } from '../../src/transcription/examples/config';

const audio = process.env.EXAMPLE_BENCH_AUDIO,
    reference = process.env.EXAMPLE_BENCH_REFERENCE;
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
test('real-song reciprocal manual-range examples, with untouched holdout and unreviewed other sounds', async ({
    page,
}, info) => {
    test.skip(!audio || !reference, 'Explicit local song and manual project required.');
    test.setTimeout(600000);
    const manual = JSON.parse(await fs.readFile(reference!, 'utf8')) as EditorProjectV2;
    const sourceHash = sha(await fs.readFile(audio!));
    expect(manual.track.contentHash).toBe(sourceHash);
    const lane = manual.lanes[2] as RangeLaneV1;
    expect(lane.eventKind).toBe('range');
    const mid = lane.events.filter(e => e.innerClassId === lane.events[0]!.innerClassId);
    expect(mid).toHaveLength(2);
    const end = lane.events.find(e => e.innerClassId !== mid[0]!.innerClassId)!;
    const directory = path.resolve(
        'artifacts/evals/editor-transcription/real-examples',
        `${info.project.name}-${Date.now()}`,
    );
    await fs.mkdir(directory, { recursive: true });
    const files = [
        'src/transcription/examples/matcher.ts',
        'src/transcription/examples/config.ts',
        'src/transcription/acousticIndex.ts',
    ];
    const sourceHashes = await Promise.all(files.map(async file => ({ file, sha256: sha(await fs.readFile(file)) })));
    const errors: string[] = [],
        modelRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
        if (/huggingface|raw.githubusercontent.com\/spotify/.test(request.url())) modelRequests.push(request.url());
    });
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [audio!]);
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('toggle-playback').click();
    await openEditorWorkspace(page, 'transcription');
    const panel = page.getByTestId('editor-sound-examples');
    await expect(panel).toHaveAttribute('data-state', 'idle', { timeout: 30000 });
    const queries = [];
    for (let i = 0; i < 3; i++) {
        const example = i < 2 ? mid[i]! : end,
            target = i < 2 ? mid[1 - i]! : null;
        if (i) await panel.getByRole('button', { name: '新声音组', exact: true }).click();
        await panel.getByLabel('示例声音组名称').fill(i < 2 ? `mid-${i}` : 'end-single');
        await panel.getByLabel('示例声音组名称').press('Tab');
        await panel.getByLabel('声音示例类型').selectOption('range');
        await panel.getByLabel('声音示例起点').fill(String(example.startSeconds));
        await panel.getByLabel('声音示例终点').fill(String(example.endSeconds));
        await panel.getByTestId('sound-example-add').click();
        const started = Date.now();
        await panel.getByTestId('sound-example-search').click();
        await expect.poll(() => panel.getAttribute('data-state'), { timeout: 180000 }).toMatch(/^(ready|error)$/);
        expect(await panel.getAttribute('data-state'), (await panel.textContent()) ?? '').toBe('ready');
        await expect(panel).toContainText('示例已保存到本机');
        const profile = (await storedExampleProfiles(page)).find(p => p.label === (i < 2 ? `mid-${i}` : 'end-single'))!;
        expect(profile.examples).toHaveLength(1);
        expect(profile.threshold).toBe(0.82);
        expect(profile.matches.every(m => !m.selected)).toBe(true);
        const comparison = (match: ExampleMatch, truth: typeof example) => {
            const overlap = Math.max(
                0,
                Math.min(match.endSeconds, truth.endSeconds) - Math.max(match.startSeconds, truth.startSeconds),
            );
            return {
                match,
                startErrorSeconds: match.startSeconds - truth.startSeconds,
                intersectionOverUnion:
                    overlap /
                    (Math.max(match.endSeconds, truth.endSeconds) - Math.min(match.startSeconds, truth.startSeconds)),
            };
        };
        const associations = target
            ? profile.matches
                  .map(m => comparison(m, target))
                  .filter(m => m.intersectionOverUnion > 0)
                  .sort((a, b) => b.intersectionOverUnion - a.intersectionOverUnion)
            : [];
        const report = {
            example,
            holdout: target,
            elapsedWallMs: Date.now() - started,
            candidateCount: profile.matches.length,
            bestHoldoutOverlap: associations[0] ?? null,
            self:
                profile.matches
                    .map(m => comparison(m, example))
                    .sort((a, b) => b.intersectionOverUnion - a.intersectionOverUnion)[0] ?? null,
            note: target
                ? 'Fixed parameters; every other match remains unreviewed, not a false positive.'
                : 'Single example only; no holdout/generalization claim.',
            profile,
        };
        queries.push(report);
        await fs.writeFile(path.join(directory, `query-${i}.json`), JSON.stringify(report, null, 2), 'utf8');
        console.log(
            `${info.project.name} query ${i}: ${profile.matches.length} candidates, holdout IoU ${associations[0]?.intersectionOverUnion ?? 'none'}`,
        );
    }
    expect(modelRequests).toEqual([]);
    expect(errors).toEqual([]);
    expect(await Promise.all(files.map(async file => ({ file, sha256: sha(await fs.readFile(file)) })))).toEqual(
        sourceHashes,
    );
    await fs.writeFile(
        path.join(directory, 'report.json'),
        JSON.stringify(
            {
                sourceHash,
                referenceHash: sha(await fs.readFile(reference!)),
                sourceHashes,
                config: EXAMPLE_SEARCH_CONFIG,
                threshold: 0.82,
                queries,
                userAgent: await page.evaluate(() => navigator.userAgent),
            },
            null,
            2,
        ),
        'utf8',
    );
    if (process.env.EXAMPLE_EXPORT_INDEX === '1') {
        const record = await page.evaluate(async () => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                const r = indexedDB.open('editor-sound-examples', 1);
                r.onsuccess = () => resolve(r.result);
                r.onerror = () => reject(r.error);
            });
            try {
                const row = await new Promise<{ sourceKey: string; checksum: string; index: Record<string, unknown> }>(
                    (resolve, reject) => {
                        const r = db.transaction('indices').objectStore('indices').getAll();
                        r.onsuccess = () => resolve(r.result[0]);
                        r.onerror = () => reject(r.error);
                    },
                );
                const arrays: Record<string, string> = {},
                    metadata: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(row.index)) {
                    if (!(value instanceof Float32Array)) {
                        metadata[key] = value;
                        continue;
                    }
                    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
                    let text = '';
                    for (let start = 0; start < bytes.length; start += 16384)
                        text += String.fromCharCode(...bytes.subarray(start, start + 16384));
                    arrays[key] = btoa(text);
                }
                return { sourceKey: row.sourceKey, checksum: row.checksum, metadata, arrays };
            } finally {
                db.close();
            }
        });
        const arrays = [];
        for (const [name, encoded] of Object.entries(record.arrays)) {
            const bytes = Buffer.from(encoded, 'base64'),
                file = `${name}.f32`;
            await fs.writeFile(path.join(directory, file), bytes);
            arrays.push({ name, file, bytes: bytes.length, sha256: sha(bytes) });
        }
        await fs.writeFile(
            path.join(directory, 'index.json'),
            JSON.stringify(
                {
                    sourceHash,
                    sourceKey: record.sourceKey,
                    publishedChecksum: record.checksum,
                    metadata: record.metadata,
                    arrays,
                },
                null,
                2,
            ),
            'utf8',
        );
    }
});
