import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, savedPickerEntries } from '../support/file-picker';

async function openEditor(page: Page) {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, ['format-master.wav', 'format-master.mp3'].map(name => path.resolve('tests/fixtures/audio', name)));
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
}

test('MusicBar protects selection, export, deletion and clearing before mutation', async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await openEditor(page);
    const bar = page.locator('#music-bar-container');
    const first = await bar.getAttribute('data-current-track-id');
    await page.getByTestId('playback-progress').focus();
    await page.keyboard.press('ArrowRight');
    const position = await bar.getAttribute('data-current-time');
    await page.getByTestId('toggle-queue').click();
    const items = page.getByTestId('queue-item');
    const second = await items.nth(1).getAttribute('data-track-id');
    await items.nth(1).click();
    await expect(page.getByTestId('editor-track-change-dialog')).toBeVisible();
    await page.getByTestId('editor-track-change-export').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    await expect(page.getByTestId('editor-track-change-dialog')).toBeVisible();
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(bar).toHaveAttribute('data-current-track-id', first!);
    await expect(bar).toHaveAttribute('data-playback-state', 'paused');
    await expect(bar).toHaveAttribute('data-current-time', position!);
    await expect(page).toHaveURL(new RegExp('/editor/' + first + '$'));
    await items.nth(1).click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page).toHaveURL(new RegExp('/editor/' + second + '$'));
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.getByTestId('editor-draft-conflict')).toHaveCount(0);
    await expect(bar).toHaveAttribute('data-current-track-id', second!);
    await expect(bar).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(bar).toHaveAttribute('data-playback-state', 'paused');
    await page.getByTestId('toggle-queue').click();
    await items.nth(1).hover();
    await items.nth(1).getByTestId('delete-track').click();
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(items).toHaveCount(2);
    await items.nth(1).hover();
    await items.nth(1).getByTestId('delete-track').click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(items).toHaveCount(1);
    await expect(bar).toHaveAttribute('data-current-track-id', first!);
    await page.getByTestId('clear-queue').click();
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(items).toHaveCount(1);
    await page.getByTestId('clear-queue').click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page.getByTestId('editor-empty')).toBeVisible();
    await expect(bar).toHaveAttribute('data-playback-state', 'empty');
    expect(errors).toEqual([]);
});

test('a failed draft save blocks switching while export and cancellation remain available', async ({ page }) => {
    await openEditor(page);
    const bar = page.locator('#music-bar-container');
    const first = await bar.getAttribute('data-current-track-id');
    await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
            if (this.transaction.db.name === 'audionotsurfyet-editor' && this.name === 'draft') {
                throw new DOMException('test quota', 'QuotaExceededError');
            }
            return put.apply(this, args);
        };
    });
    await page.getByTestId('add-point-lane').click();
    await expect(page.getByTestId('editor-page').getByRole('alert')).toContainText('无法保存草稿');
    await page.getByTestId('toggle-queue').click();
    await page.getByTestId('queue-item').nth(1).click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page.getByTestId('editor-track-change-dialog').getByRole('alert')).toContainText('尚未保存');
    await expect(bar).toHaveAttribute('data-current-track-id', first!);
    await page.getByTestId('editor-track-change-export').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(bar).toHaveAttribute('data-playback-state', 'paused');
    await expect(page.getByTestId('editor-point-workspace').locator('article')).toHaveCount(1);
});
