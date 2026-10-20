import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { installFilePickerStub, chooseFiles } from '../support/file-picker';

async function openPreset(page: Page, id = 'geometric-0.6') {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator(`[data-preset-id="${id}"]`).click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    await page.getByTestId('realtime-style-actions').click();
}
test('current composition applies to home, survives refresh and maintains one renderer through mode switches', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await openPreset(page);
    await page.getByTestId('apply-home-style').click();
    await expect(page).toHaveURL('/');
    const canvas = page.getByTestId('realtime-visualizer-canvas');
    await expect(canvas).toHaveAttribute('data-webgl-context-state', 'ready');
    await expect(page.locator('[data-realtime-state]')).toHaveAttribute('data-realtime-state', 'ready');
    await page.reload();
    await expect(canvas).toHaveAttribute('data-webgl-context-state', 'ready');
    await expect(page.getByTestId('toggle-playback')).toHaveAttribute('aria-label', '播放');
    await page.getByTestId('toggle-playback').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await expect.poll(async () => Number(await canvas.getAttribute('data-realtime-input-frames'))).toBeGreaterThan(2);
    await expect.poll(async () => Number(await canvas.getAttribute('data-realtime-input-peak'))).toBeGreaterThan(0);
    await expect.poll(() => canvas.getAttribute('data-frame-time')).not.toBe('0.000000');
    await page.screenshot({ path: 'artifacts/visualizer-composition/realtime-home.png' });
    for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: '详情', exact: true }).click();
        await expect(canvas).toHaveCount(0);
        await page.getByRole('button', { name: '可视化', exact: true }).click();
        await expect(canvas).toHaveAttribute('data-webgl-context-state', 'ready');
    }
    expect(await page.evaluate(() => (window as any).__VISUALIZER_DIAGNOSTICS__.activeRenderers)).toBe(1);
    expect(errors).toEqual([]);
});
test('local display page has full viewport canvas, native fullscreen and recoverable missing style', async ({
    page,
}) => {
    await openPreset(page);
    await page.getByTestId('create-display-page').click();
    const address = page.getByRole('textbox', { name: '本地展示地址' });
    await expect(address).toHaveValue(/\/display\/[0-9a-f-]+$/);
    await page.getByRole('link', { name: '打开展示页' }).click();
    await expect(page.getByTestId('visualizer-display')).toBeVisible();
    const canvas = page.getByTestId('realtime-visualizer-canvas');
    await expect(canvas).toHaveAttribute('data-webgl-context-state', 'ready');
    const size = await canvas.boundingBox();
    expect(size?.width).toBe(1920);
    expect(size?.height).toBe(1080);
    await page.getByRole('button', { name: '全屏', exact: true }).click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(canvas).toHaveAttribute('data-webgl-context-state', 'ready');
    await page.goto('/display/missing');
    await expect(page.getByRole('alert')).toContainText('不存在');
});
test('partial song sections are classified as song-only and block realtime actions', async ({ page }) => {
    await openPreset(page, 'prismatic-voyage');
    await expect(
        page
            .getByRole('dialog')
            .getByText(/局部分镜/)
            .first(),
    ).toBeVisible();
    await expect(page.getByTestId('apply-home-style')).toBeDisabled();
    await expect(page.getByTestId('create-display-page')).toBeDisabled();
});
