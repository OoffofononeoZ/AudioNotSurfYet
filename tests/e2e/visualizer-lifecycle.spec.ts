import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import { installV6ResourceProbe, readV6ResourceProbe } from '../support/v6-resource-probe';

const audio = path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav');
const second = path.resolve(import.meta.dirname, '../fixtures/audio/format-master.wav');
const player = (page: Page) => page.locator('#music-bar-container');
async function setup(page: Page) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [audio, second]);
    await expect(player(page)).toHaveAttribute('data-playback-state', 'playing');
}
async function enter(page: Page) {
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
}
async function solid(page: Page) {
    await page.getByTestId('add-visualizer-element').click();
    await page.locator('[data-element-type=solid]').click();
}
async function draft(page: Page): Promise<any> {
    return page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const open = indexedDB.open('audionotsurfyet-visualizer', 1);
            open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
        });
        try {
            return await new Promise((resolve, reject) => {
                const request = db.transaction('draft').objectStore('draft').get('latest');
                request.onsuccess = () => resolve(request.result?.envelope); request.onerror = () => reject(request.error);
            });
        } finally { db.close(); }
    });
}

test('playlist switch asks before replacing a draft; cancellation preserves song and project', async ({ page }) => {
    await setup(page);
    for (let i = 0; i < 3; i++) await page.getByTestId('playback-mode').click();
    await expect(page.getByTestId('playback-mode')).toHaveAttribute('aria-label', /随机/);
    const firstId = await player(page).getAttribute('data-current-track-id');
    await enter(page); await solid(page);
    await expect(page.getByTestId('playback-mode')).toBeDisabled();
    await expect(page.getByTestId('playback-mode')).toHaveAttribute('aria-label', /单曲循环/);
    const firstUrl = page.url();
    await expect.poll(async () => (await draft(page))?.project.elements.length).toBe(1);
    const original = await draft(page);
    await page.getByTestId('toggle-queue').click();
    await page.getByTestId('queue-item').nth(1).click();
    await expect(page.getByRole('dialog', { name: '切换歌曲工程' })).toBeVisible();
    await page.getByRole('button', { name: '留在此页', exact: true }).click();
    expect(page.url()).toBe(firstUrl);
    await expect(player(page)).toHaveAttribute('data-current-track-id', firstId!);
    expect(await draft(page)).toEqual(original);
    await expect(page.locator('.viz-element-row')).toHaveCount(1);
    await page.getByTestId('queue-item').nth(1).click();
    await page.getByTestId('confirm-track-project-switch').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(player(page)).not.toHaveAttribute('data-current-track-id', firstId!);
    await expect(player(page)).toHaveAttribute('data-playback-state', 'playing');
    await expect(page.locator('.viz-element-row')).toHaveCount(0);
    const secondId = await player(page).getAttribute('data-current-track-id');
    await page.getByTestId('previous-track').click(); await page.getByTestId('next-track').click();
    await expect(player(page)).toHaveAttribute('data-current-track-id', secondId!);
    await page.getByTestId('clear-queue').click();
    await expect(page.getByTestId('visualizer-empty')).toBeVisible();
    await expect(page.getByTestId('queue-count')).toHaveText('0');
    expect((await draft(page)).project.track.contentHash).not.toBe(original.project.track.contentHash);
    await page.getByRole('link', { name: '首页', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('playback-mode')).toBeEnabled();
    await expect(page.getByTestId('playback-mode')).toHaveAttribute('aria-label', /随机/);
});

test('old draft export and cancellation preserve raw data until explicit replacement', async ({ page }) => {
    await setup(page);
    const raw = { schemaVersion: 1, savedAt: '2026-01-01T00:00:00Z', project: { scene: 'previous-project' } };
    await page.evaluate(async envelope => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const open = indexedDB.open('audionotsurfyet-visualizer', 1);
            open.onupgradeneeded = () => open.result.createObjectStore('draft', { keyPath: 'key' });
            open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
        });
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('draft', 'readwrite'); tx.objectStore('draft').put({ key: 'latest', envelope });
            tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
        }); db.close();
    }, raw);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-unsupported-draft')).toBeVisible();
    await page.screenshot({ path: 'artifacts/visualizer-composition/draft-notice.png' });
    expect(await draft(page)).toEqual(raw);
    await page.getByRole('button', { name: '导出原草稿' }).click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const saved = (await savedPickerEntries(page))[0]!;
    expect(JSON.parse(Buffer.from(saved.base64, 'base64').toString())).toEqual(raw);
    await page.getByRole('button', { name: '取消进入' }).click();
    await expect(page).toHaveURL('/');
    expect(await draft(page)).toEqual(raw);
    await page.getByTestId('header-visualizer-link').click();
    await page.getByRole('button', { name: '覆盖草稿', exact: true }).click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect.poll(async () => (await draft(page))?.schemaVersion).toBe(3);
    expect((await draft(page)).project.elements).toEqual([]);
});

test('invalid import preserves the saved composition', async ({ page }) => {
    await setup(page); await enter(page); await solid(page);
    await expect.poll(async () => (await draft(page))?.project.elements.length).toBe(1);
    const before = await draft(page);
    await queuePickerData(page, [{ name: 'invalid.json', mimeType: 'application/json', text: '{"schemaVersion":1}' }]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(await draft(page)).toEqual(before);
    await expect(page.locator('.viz-element-row')).toHaveCount(1);
});

test('cancel, context recovery and repeated entry release the renderer and export resources', async ({ page }) => {
    test.setTimeout(60000);
    await installV6ResourceProbe(page); await setup(page); await enter(page); await solid(page);
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(player(page)).toHaveAttribute('data-export-locked', 'true');
    await page.getByTestId('cancel-visualizer-export').click();
    await expect(player(page)).toHaveAttribute('data-export-locked', 'false');
    await expect.poll(async () => (await readV6ResourceProbe(page)).exportResources).toBe(0);
    await expect.poll(async () => (await readV6ResourceProbe(page)).liveMediaTracks).toBe(0);
    await page.getByTestId('visualizer-preview-canvas').evaluate(canvas => {
        const gl = (canvas as HTMLCanvasElement).getContext('webgl2')!;
        const extension = gl.getExtension('WEBGL_lose_context')!;
        extension.loseContext(); setTimeout(() => extension.restoreContext(), 400);
    });
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'recovering');
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    for (let i = 0; i < 3; i++) {
        await page.getByRole('link', { name: '首页', exact: true }).click();
        await expect.poll(async () => (await readV6ResourceProbe(page)).visualizerHosts).toBe(0);
        const left = await readV6ResourceProbe(page);
        expect(left.visualizerRenderers).toBe(0); expect(left.visualizerRafs).toBe(0);
        expect(left.visualizerCanvases).toBe(0); expect(left.exportResources).toBe(0);
        await enter(page);
        const active = await readV6ResourceProbe(page);
        expect(active.visualizerHosts).toBe(1); expect(active.visualizerRenderers).toBe(1);
        expect(active.visualizerCanvases).toBe(1);
    }
});

test('ready WebM blocks leaving and survives a cancelled save', async ({ page }) => {
    test.setTimeout(60000); await setup(page); await enter(page); await solid(page);
    await page.getByTestId('visualizer-preview-frame').hover(); await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
    await page.getByRole('link', { name: '首页', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'WebM 尚未处理' })).toBeVisible();
    await page.evaluate(() => { (window as unknown as {showSaveFilePicker:()=>Promise<never>}).showSaveFilePicker = async () => { throw new DOMException('Cancelled', 'AbortError'); }; });
    await page.getByRole('button', { name: '保存并离开' }).click();
    await expect(page.getByRole('dialog', { name: 'WebM 尚未处理' })).toBeVisible();
    await page.getByRole('button', { name: '留在此页' }).click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible();
    await page.getByRole('link', { name: '首页', exact: true }).click();
    await page.getByRole('button', { name: '丢弃并离开' }).click();
    await expect(page).toHaveURL('/');
});
