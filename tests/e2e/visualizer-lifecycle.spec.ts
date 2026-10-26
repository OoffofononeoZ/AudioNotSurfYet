import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, queuePickerData } from '../support/file-picker';
import { installV6ResourceProbe, readV6ResourceProbe } from '../support/v6-resource-probe';

const audio = path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav');
const second = path.resolve(import.meta.dirname, '../fixtures/audio/format-master.wav');
const player = (page: Page) => page.locator('#music-bar-container');
async function setup(page: Page) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
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
            open.onsuccess = () => resolve(open.result);
            open.onerror = () => reject(open.error);
        });
        try {
            return await new Promise((resolve, reject) => {
                const request = db.transaction('draft').objectStore('draft').get('latest');
                request.onsuccess = () => resolve(request.result?.envelope);
                request.onerror = () => reject(request.error);
            });
        } finally {
            db.close();
        }
    });
}

test('playlist switch asks before replacing a draft; cancellation preserves song and project', async ({ page }) => {
    await setup(page);
    for (let i = 0; i < 3; i++) await page.getByTestId('playback-mode').click();
    await expect(page.getByTestId('playback-mode')).toHaveAttribute('aria-label', /随机/);
    const firstId = await player(page).getAttribute('data-current-track-id');
    await enter(page);
    await solid(page);
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
    await page.getByTestId('previous-track').click();
    await page.getByTestId('next-track').click();
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

test('old drafts are ignored without prompting and replaced by a V6 draft', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open('audionotsurfyet-visualizer', 1);
            r.onupgradeneeded = () => r.result.createObjectStore('draft', { keyPath: 'key' });
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
        await new Promise<void>(resolve => {
            const tx = db.transaction('draft', 'readwrite');
            tx.objectStore('draft').put({ key: 'latest', envelope: { schemaVersion: 3, project: { elements: [] } } });
            tx.oncomplete = () => resolve();
        });
        db.close();
    });
    await enter(page);
    await expect(page.getByTestId('visualizer-unsupported-draft')).toHaveCount(0);
    await expect.poll(async () => (await draft(page))?.schemaVersion).toBe(6);
    expect((await draft(page)).project.items).toEqual([]);
});

test('invalid import preserves the saved composition', async ({ page }) => {
    await setup(page);
    await enter(page);
    await solid(page);
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
    await installV6ResourceProbe(page);
    await setup(page);
    await enter(page);
    await solid(page);
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
        extension.loseContext();
        setTimeout(() => extension.restoreContext(), 400);
    });
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'recovering');
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    for (let i = 0; i < 3; i++) {
        await page.getByRole('link', { name: '首页', exact: true }).click();
        await expect.poll(async () => (await readV6ResourceProbe(page)).visualizerHosts).toBe(0);
        const left = await readV6ResourceProbe(page);
        expect(left.visualizerRenderers).toBe(0);
        expect(left.visualizerRafs).toBe(0);
        expect(left.visualizerCanvases).toBe(0);
        expect(left.exportResources).toBe(0);
        await enter(page);
        const active = await readV6ResourceProbe(page);
        expect(active.visualizerHosts).toBe(1);
        expect(active.visualizerRenderers).toBe(1);
        expect(active.visualizerCanvases).toBe(1);
    }
});

test('ready WebM blocks leaving and survives a cancelled save', async ({ page }) => {
    test.setTimeout(60000);
    await setup(page);
    await enter(page);
    await solid(page);
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
    await page.getByRole('link', { name: '首页', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'WebM 尚未处理' })).toBeVisible();
    await page.evaluate(() => {
        (window as unknown as { showSaveFilePicker: () => Promise<never> }).showSaveFilePicker = async () => {
            throw new DOMException('Cancelled', 'AbortError');
        };
    });
    await page.getByRole('button', { name: '保存并离开' }).click();
    await expect(page.getByRole('dialog', { name: 'WebM 尚未处理' })).toBeVisible();
    await page.getByRole('button', { name: '留在此页' }).click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible();
    await page.getByRole('link', { name: '首页', exact: true }).click();
    await page.getByRole('button', { name: '丢弃并离开' }).click();
    await expect(page).toHaveURL('/');
});
