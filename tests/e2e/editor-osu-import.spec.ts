import { openOsuImport } from '../support/project-actions';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { installFilePickerStub, queuePickerData, queuePickerFiles } from '../support/file-picker';
import { prepareMarkerEditor, addMarkerLane, clickMarkerTime, markerSurface } from '../support/editor-marking';
import { osuFixture } from '../support/osu-fixture';
import type { EditorProjectV2 } from '../../src/editor/types';
import { createInitialEditorProject } from '../../src/editor/projectCodec';

const directory = path.resolve('artifacts/editor-marking/osu-import');
let archivePath: string, brokenPath: string;
test.beforeAll(async () => {
    await mkdir(directory, { recursive: true });
    const audio = Buffer.from(await readFile('artifacts/fixtures/editor-e2-tempo-100-v1.wav'));
    audio[audio.length - 2] = audio[audio.length - 2]! ^ 1;
    const maps = {
        'test.osu': strToU8(osuFixture()),
        'hard.osu': strToU8(osuFixture().replace('Version: Test', 'Version: Hard')),
    };
    archivePath = path.join(directory, 'reference.osz');
    brokenPath = path.join(directory, 'broken.osz');
    await writeFile(archivePath, zipSync({ ...maps, 'audio.wav': audio }));
    await writeFile(brokenPath, zipSync({ ...maps, 'audio.wav': strToU8('invalid audio') }));
});

async function draft(page: Page): Promise<EditorProjectV2> {
    return page.evaluate(
        () =>
            new Promise<EditorProjectV2>((resolve, reject) => {
                const request = indexedDB.open('audionotsurfyet-editor');
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    const read = db.transaction('draft').objectStore('draft').get('latest');
                    read.onsuccess = () => {
                        db.close();
                        resolve(read.result?.envelope.project);
                    };
                    read.onerror = () => {
                        db.close();
                        reject(read.error);
                    };
                };
            }),
    );
}
async function openSource(page: Page, source: string | { text: string }) {
    await openOsuImport(page);
    if (typeof source === 'string') await queuePickerFiles(page, [source]);
    else await queuePickerData(page, [{ name: 'map.osu', mimeType: 'application/octet-stream', text: source.text }]);
    await page.getByTestId('osu-select-source').click();
    await expect(page.getByTestId('osu-difficulty')).toBeVisible();
}
async function preview(page: Page) {
    await page.getByTestId('osu-build-preview').click();
    await expect(page.getByTestId('osu-preview')).toBeVisible();
    await expect(page.getByTestId('osu-apply')).toBeEnabled();
}
async function saved(page: Page) {
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
}

test('standalone osu appends selected tracks, keeps existing tempo and persists exact event seconds', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await clickMarkerTime(markerSurface(page, 'point'), 1);
    await saved(page);
    const before = await draft(page);
    await openSource(page, { text: osuFixture() });
    await expect(page.getByTestId('osu-tempo')).not.toBeChecked();
    await page.getByTestId('osu-confirm-current').check();
    for (const id of ['osu-bookmarks', 'osu-breaks', 'osu-kiai']) await page.getByTestId(id).check();
    await preview(page);
    await expect(page.getByTestId('osu-preview')).toContainText('新增 6 条轨道');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(directory, 'preview-narrow.png') });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId('osu-apply').click();
    await expect(page.getByTestId('osu-import-dialog')).toHaveCount(0);
    await saved(page);
    const result = await draft(page);
    expect(result.schemaVersion).toBe(2);
    expect(result.lanes).toHaveLength(7);
    expect(result.lanes[0]).toEqual(before.lanes[0]);
    expect(result.tempoMap).toEqual(before.tempoMap);
    expect(result.lanes[2]!.events).toMatchObject([{ startSeconds: 1.1, endSeconds: 1.6 }]);
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    expect(await draft(page)).toEqual(result);
    expect(errors).toEqual([]);
});

test('archive audio is prepared without switching and obeys cancel then confirmed draft replacement', async ({
    page,
}) => {
    await prepareMarkerEditor(page);
    await saved(page);
    const before = await draft(page);
    await openSource(page, archivePath);
    await page.getByTestId('osu-difficulty').selectOption({ label: 'Hard · 标准' });
    await page.getByLabel('使用当前歌曲', { exact: true }).check();
    await page.getByTestId('osu-build-preview').click();
    await expect(page.getByTestId('osu-import-error')).toContainText('当前歌曲与包内原音频不同');
    expect(await draft(page)).toEqual(before);
    await page.getByLabel('使用包内原音频', { exact: true }).check();
    await preview(page);
    expect(await draft(page)).toEqual(before);
    await page.getByTestId('osu-apply').click();
    await expect(page.getByTestId('editor-track-change-dialog')).toBeVisible();
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(page.getByTestId('osu-apply')).toBeEnabled();
    expect(await draft(page)).toEqual(before);
    await page.getByTestId('osu-apply').click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page.getByTestId('osu-import-dialog')).toHaveCount(0);
    await saved(page);
    const next = await draft(page);
    expect(next.track.fileName).toBe('audio.wav');
    expect(next.track.contentHash).not.toBe(before.track.contentHash);
    expect(next.lanes).toHaveLength(3);
    expect(next.tempoMap[0]).toMatchObject({ beatOriginSeconds: -1, bpmSource: 'imported' });
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    expect(await draft(page)).toEqual(next);
});

test('empty Editor imports an archive directly and returns to a saved paused project', async ({ page }) => {
    await installFilePickerStub(page);
    await page.goto('/editor');
    await expect(page.getByTestId('editor-empty')).toBeVisible();
    await openSource(page, archivePath);
    await preview(page);
    await expect(page.getByTestId('editor-empty')).toBeVisible();
    await page.getByTestId('osu-apply').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await saved(page);
    expect((await draft(page)).lanes).toHaveLength(3);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    await page.screenshot({ path: path.join(directory, 'imported-desktop.png') });
    await openOsuImport(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(directory, 'dialog-narrow.png') });
    await page.getByTestId('osu-cancel').click();
});

test('a detached V1 draft is exportable and requires explicit replacement before an empty-page import', async ({
    page,
}) => {
    await installFilePickerStub(page);
    await page.goto('/editor');
    const previous = createInitialEditorProject({
        track: { contentHash: 'a'.repeat(64), fileName: 'old.wav', durationSeconds: 12 },
    });
    const legacy = {
        ...previous,
        schemaVersion: 1,
        tempoMap: previous.tempoMap.map(s => {
            if (s.mode !== 'metered') return s;
            const { beatOriginSeconds: _, ...rest } = s;
            return rest;
        }),
    };
    await page.evaluate(async project => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const open = indexedDB.open('audionotsurfyet-editor', 1);
            open.onupgradeneeded = () => {
                const db = open.result;
                if (!db.objectStoreNames.contains('draft')) db.createObjectStore('draft', { keyPath: 'key' });
                if (!db.objectStoreNames.contains('preferences'))
                    db.createObjectStore('preferences', { keyPath: 'key' });
            };
            open.onsuccess = () => resolve(open.result);
            open.onerror = () => reject(open.error);
        });
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction('draft', 'readwrite');
            transaction
                .objectStore('draft')
                .put({ key: 'latest', envelope: { schemaVersion: 1, savedAt: project.updatedAt, project } });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        db.close();
    }, legacy);
    await openSource(page, archivePath);
    await preview(page);
    await page.getByTestId('osu-apply').click();
    await expect(page.getByTestId('editor-track-change-dialog')).toBeVisible();
    await page.getByTestId('editor-track-change-export').click();
    await expect(page.getByTestId('editor-track-change-dialog')).toContainText('工程已导出');
    await page.getByTestId('editor-track-change-cancel').click();
    expect((await draft(page)).schemaVersion).toBe(1);
    await page.getByTestId('osu-apply').click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await saved(page);
    expect((await draft(page)).track.fileName).toBe('audio.wav');
});

test('manual timing accepts low and high BPM, negative anchors and keeps existing marker seconds', async ({ page }) => {
    await prepareMarkerEditor(page);
    await page.getByTestId('toggle-editor-timing').click();
    const bpm = page.getByRole('spinbutton', { name: '辅助 BPM', exact: true });
    for (const value of [15, 1020, 1200, 123]) {
        await bpm.fill(String(value));
        await bpm.press('Enter');
        await saved(page);
        expect((await draft(page)).tempoMap[0]).toMatchObject({ mode: 'metered', bpm: value });
    }
    const origin = page.getByRole('spinbutton', { name: '节拍起点（秒）', exact: true });
    await origin.fill('-1.866');
    await origin.press('Enter');
    await saved(page);
    await page.getByTestId('toggle-editor-timing').click();
    await addMarkerLane(page, 'point');
    await clickMarkerTime(markerSurface(page, 'point'), 0.09);
    await saved(page);
    expect((await draft(page)).lanes[0]!.events).toMatchObject([{ atSeconds: 0.08522 }]);
    await page.getByTestId('toggle-editor-timing').click();
    await bpm.fill('144');
    await bpm.press('Enter');
    await saved(page);
    expect((await draft(page)).lanes[0]!.events).toMatchObject([{ atSeconds: 0.08522 }]);
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    expect((await draft(page)).tempoMap[0]).toMatchObject({ beatOriginSeconds: -1.866, bpm: 144 });
});

test('decode failure and cancelling an in-flight preparation preserve the original song and draft', async ({
    page,
}) => {
    await page.addInitScript(() => {
        const decode = AudioContext.prototype.decodeAudioData;
        let count = 0;
        AudioContext.prototype.decodeAudioData = function (data: ArrayBuffer): Promise<AudioBuffer> {
            const result = decode.call(this, data);
            if (++count < 3) return result;
            return result.then(
                buffer =>
                    new Promise<AudioBuffer>(resolve => {
                        Reflect.set(window, '__releaseOsuDecode', () => resolve(buffer));
                    }),
            );
        };
    });
    await prepareMarkerEditor(page);
    await saved(page);
    const before = await draft(page);
    await openSource(page, brokenPath);
    await page.getByTestId('osu-build-preview').click();
    await expect(page.getByTestId('osu-import-error')).toBeVisible();
    expect(await draft(page)).toEqual(before);
    await queuePickerFiles(page, [archivePath]);
    await page.getByTestId('osu-select-source').click();
    await page.getByTestId('osu-build-preview').click();
    await page.waitForFunction(() => typeof Reflect.get(window, '__releaseOsuDecode') === 'function');
    await page.getByTestId('osu-cancel').click();
    await page.evaluate(() => Reflect.get(window, '__releaseOsuDecode')());
    await expect(page.getByTestId('osu-import-dialog')).toHaveCount(0);
    expect(await draft(page)).toEqual(before);
    await openOsuImport(page);
    await expect(page.getByTestId('osu-preview')).toHaveCount(0);
    await page.getByTestId('osu-cancel').click();
});

test('real Rush E preserves all 165 timing points and concurrent mania notes', async ({ page }) => {
    test.skip(!process.env.OSU_REFERENCE_ROOT, 'requires local reference files');
    const folder = path.join(process.env.OSU_REFERENCE_ROOT!, '2');
    const filename = (await readdir(folder)).find(name => name.endsWith('.osz'))!;
    await installFilePickerStub(page);
    await page.goto('/editor');
    await openSource(page, path.join(folder, filename));
    await page.getByTestId('osu-difficulty').selectOption({ label: 'EEEEE · mania' });
    await preview(page);
    await expect(page.getByTestId('osu-preview')).toContainText('166 个定时分段');
    await page.getByTestId('osu-apply').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await saved(page);
    const project = await draft(page);
    expect(project.tempoMap).toHaveLength(166);
    expect(project.lanes.reduce((n, lane) => n + lane.events.length, 0)).toBe(1646);
    expect(project.lanes.map(lane => lane.innerClasses.length)).toEqual([4, 4]);
    await expect(page.getByTestId('editor-tempo-estimate-state')).toContainText('BPM 已从谱面导入');
    await expect(page.getByTestId('editor-buffer-state')).toContainText('波形已就绪', { timeout: 30_000 });
    await page.screenshot({ path: path.join(directory, 'rush-e-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(directory, 'rush-e-narrow.png') });
});
