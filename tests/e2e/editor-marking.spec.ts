import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

async function openEditor(page: Page) {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/format-master.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('tempo-bpm-0').fill('120');
    await page.getByTestId('tempo-bpm-0').press('Enter');
}

test('menus escape clipped waveform and 44px point/range rows, preserve keyboard and close on scroll', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await openEditor(page);
    await page.getByTestId('add-point-lane').click();
    await page.getByTestId('add-range-lane').click();
    for (const [surfaceId, menuId] of [['editor-timeline', 'editor-timeline-menu'], ['marker-surface-', 'editor-point-menu'], ['range-surface-', 'editor-range-menu']]) {
        const surface = surfaceId!.endsWith('-') ? page.locator(`[data-testid^="${surfaceId}"]`).first() : page.getByTestId(surfaceId!);
        const bounds = await surface.boundingBox(); expect(bounds).toBeTruthy();
        await surface.click({ button: 'right', position: { x: bounds!.width - 20, y: 15 } });
        const menu = page.getByTestId(menuId!); await expect(menu).toBeVisible();
        const rect = await menu.boundingBox();
        expect(rect!.height).toBeGreaterThan(90); expect(rect!.y).toBeGreaterThanOrEqual(8);
        expect(rect!.y + rect!.height).toBeLessThanOrEqual(page.viewportSize()!.height - 8);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width - 8);
        await expect(menu.getByRole('menuitem').first()).toBeFocused();
        await page.keyboard.press('End'); await expect(menu.getByRole('menuitem').last()).toBeFocused();
        await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(surface).toBeFocused();
    }
    await page.getByTestId('editor-timeline').click({ button: 'right' });
    await page.locator('#editor-marking-panel').dispatchEvent('scroll');
    await expect(page.getByTestId('editor-timeline-menu')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('track deletion confirms nonempty lanes, cancels safely and persists deleting the last lane', async ({ page }) => {
    await openEditor(page);
    await page.getByTestId('add-point-lane').click();
    const surface = page.locator('[data-testid^="marker-surface-"]').first();
    await surface.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(1);
    await page.locator('[data-testid^="delete-lane-"]').click();
    const dialog = page.getByTestId('editor-delete-lane-dialog');
    await expect(dialog).toBeVisible(); await expect(dialog).toContainText('1 个标记');
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(1);
    await page.locator('[data-testid^="delete-lane-"]').click();
    await page.getByTestId('confirm-delete-lane').click();
    await expect(page.locator('[data-testid^="point-lane-name-"]')).toHaveCount(0);
    await expect(page.getByTestId('add-point-lane')).toBeFocused();
    await page.getByTestId('add-range-lane').click();
    await page.locator('[data-testid^="delete-lane-"]').click();
    await expect(page.locator('[data-testid^="range-lane-name-"]')).toHaveCount(0);
    await page.reload(); await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.locator('[data-testid^="delete-lane-"]')).toHaveCount(0);
});

test('osu divisors stay fixed through zoom, drive point keyboard steps and restore custom presets', async ({ page }) => {
    await openEditor(page);
    const control = page.getByTestId('editor-beat-divisor');
    await expect(control).toHaveAttribute('data-divisor', '4');
    await page.getByTestId('add-point-lane').click();
    const surface = page.locator('[data-testid^="marker-surface-"]').first();
    await surface.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    await expect(surface).toHaveAttribute('data-candidate-seconds', '0.125');
    await page.getByTestId('editor-zoom-in').click();
    await expect(control).toHaveAttribute('data-divisor', '4');
    await page.getByLabel('细分预设', { exact: true }).selectOption('triplets');
    await expect(control).toHaveAttribute('data-divisor', '6');
    await surface.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    await expect(surface).toHaveAttribute('data-candidate-seconds', '0.083333');
    await page.getByLabel('细分预设', { exact: true }).selectOption('custom');
    await page.getByRole('spinbutton', { name: '自定义细分', exact: true }).fill('12');
    await page.getByRole('spinbutton', { name: '自定义细分', exact: true }).press('Enter');
    await page.getByRole('button', { name: '减小节拍细分', exact: true }).click();
    await expect(control).toHaveAttribute('data-divisor', '6');
    await page.reload(); await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(control).toHaveAttribute('data-divisor', '6');
    await expect(page.getByRole('spinbutton', { name: '自定义细分', exact: true })).toHaveValue('12');
});
