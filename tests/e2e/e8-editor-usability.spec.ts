import { prepareMarkerEditor, addMarkerLane, clickMarkerTime, markerSurface } from '../support/editor-marking';
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
    queuePickerFiles,
} from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_DIRECTORY = path.join(ROOT, 'tests/fixtures/audio');
const WAV_FILE = path.join(AUDIO_DIRECTORY, 'format-master.wav');
const MP3_FILE = path.join(AUDIO_DIRECTORY, 'format-master.mp3');

const captureIssues = (page: Page): string[] => {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => {
        issues.push(`pageerror: ${error.stack ?? error.message}`);
    });
    return issues;
};

const removeStoredHandle = async (page: Page, trackId: string) => {
    await page.evaluate(async (id) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('audionotsurfyet-session', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction('handles', 'readwrite');
        transaction.objectStore('handles').delete(id);
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        database.close();
    }, trackId);
};

test('uses compact waveform heights and centers solid point keys independently of the waveform',async({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'point'); await clickMarkerTime(markerSurface(page,'point'),2);
    for(const width of [390,1024,1280,1920]) {
        await page.setViewportSize({width,height:900});
        await expect.poll(()=>page.evaluate(()=>{
            const marker=document.querySelector<HTMLElement>('.marker-point')!,row=marker.parentElement!,bounds=row.getBoundingClientRect(),key=marker.getBoundingClientRect();
            const start=Number(row.dataset.viewStart),end=Number(row.dataset.viewEnd);
            return Math.max(Math.abs(key.x+key.width/2-bounds.x-(2-start)/(end-start)*bounds.width),Math.abs(key.y+key.height/2-bounds.y-bounds.height/2));
        })).toBeLessThanOrEqual(1);
        await expect(page.getByTestId('editor-timeline')).toHaveCSS('height',width<900?'72px':'88px');
    }
    await page.getByTestId('editor-timeline').press('+'); await page.getByTestId('editor-timeline').press(']'); await expect(page.locator('.marker-point')).toHaveAttribute('data-time-seconds','2');
});
test('automatically recovers the exact route after the same file is reselected', async ({ page }) => {
    test.setTimeout(150_000);
    const issues = captureIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [WAV_FILE, MP3_FILE]);
    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 30_000,
    });
    await expect(musicBar).toHaveAttribute('data-persistence-state', 'ready', {
        timeout: 30_000,
    });
    await page.getByTestId('toggle-playback').click();
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');
    await page.getByTestId('toggle-queue').click();
    const items = page.getByTestId('queue-item');
    await expect(items).toHaveCount(2);
    const targetTrackId = await items.nth(1).getAttribute('data-track-id');
    expect(targetTrackId).toBeTruthy();
    await removeStoredHandle(page, targetTrackId!);

    await page.reload();
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused', {
        timeout: 30_000,
    });
    await page.goto(`/editor/${targetTrackId}`);
    await expect(page.getByTestId('editor-unavailable')).toBeVisible({
        timeout: 30_000,
    });
    await page.getByTestId('toggle-queue').click();
    const targetItem = page.locator(`[data-track-id="${targetTrackId}"]`);
    await expect(targetItem.getByTestId('track-restore-state'))
        .toHaveAttribute('data-restore-state', 'file-missing');

    await queuePickerFiles(page, [WAV_FILE]);
    await targetItem.getByTestId('reselect-track').click();
    await expect(targetItem.getByTestId('track-restore-state'))
        .toHaveAttribute('data-restore-state', 'content-changed');
    await expect(page.getByTestId('editor-unavailable')).toBeVisible();

    await queuePickerFiles(page, [MP3_FILE]);
    await targetItem.getByTestId('reselect-track').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({
        timeout: 30_000,
    });
    await expect(page).toHaveURL(new RegExp(`/editor/${targetTrackId}$`));
    await expect(page.getByTestId('toggle-playback')).toHaveAttribute('aria-label', '播放');
    await expect(page.locator('#music-bar-container')).toBeVisible();
    expect(issues).toEqual([]);
});

test('offers but never silently switches to a different paused song', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [WAV_FILE]);
    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 30_000,
    });
    const currentTrackId = await musicBar.getAttribute('data-current-track-id');
    expect(currentTrackId).toBeTruthy();
    await page.getByTestId('toggle-playback').click();
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');

    await page.goto('/editor/missing-track');
    await expect(page.getByTestId('editor-unavailable')).toBeVisible();
    await expect(page).toHaveURL(/\/editor\/missing-track$/);
    const editCurrent = page.getByTestId('editor-edit-current-track');
    await expect(editCurrent).toBeVisible();
    await expect(editCurrent).toHaveAccessibleName(/编辑当前歌曲：/);
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');

    await editCurrent.click();
    await expect(page).toHaveURL(new RegExp(`/editor/${currentTrackId}$`));
    await expect(page.getByTestId('editor-ready')).toBeVisible({
        timeout: 30_000,
    });
    await expect(page.getByTestId('toggle-playback')).toHaveAttribute('aria-label', '播放');
    await expect(page.locator('#music-bar-container')).toBeVisible();
    expect(issues).toEqual([]);
});
