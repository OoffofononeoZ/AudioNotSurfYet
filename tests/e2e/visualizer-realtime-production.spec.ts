import { test, expect } from '@playwright/test';
import path from 'node:path';
import { installFilePickerStub, chooseFiles } from '../support/file-picker';

test('production bundle loads its AudioWorklet and renders a realtime home style', async ({ page }) => {
    test.skip(process.env.PLAYWRIGHT_PREVIEW !== '1', 'Run against the production preview.');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="geometric-0.6"]').click();
    await page.getByTestId('realtime-style-actions').click();
    await page.getByTestId('apply-home-style').click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-realtime-state]')).toHaveAttribute('data-realtime-state', 'ready');
    if ((await page.getByTestId('toggle-playback').getAttribute('aria-label')) === '播放')
        await page.getByTestId('toggle-playback').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('[data-realtime-state]')).toHaveAttribute('data-realtime-state', 'ready');
    await expect(page.locator('.realtime-visualizer [role=alert]')).toHaveCount(0);
    expect(errors).toEqual([]);
});
