import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

async function openEditor(page: Page, fixture = 'tests/fixtures/audio/format-master.wav') {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [path.resolve(fixture)]);
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

test('collapsed timing workspace selects intervals, edits BPM and applies tap only on request', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await openEditor(page);
    await expect(page.getByTestId('editor-timing-panel')).toHaveCount(0);
    await page.getByTestId('toggle-editor-timing').click();
    const assistant = page.getByRole('complementary', { name: 'BPM 辅助标记' });
    await expect(assistant).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: '辅助区间起点（毫秒）', exact: true })).toBeDisabled();
    await page.getByRole('spinbutton', { name: '辅助 BPM', exact: true }).fill('150');
    await page.getByRole('spinbutton', { name: '辅助 BPM', exact: true }).press('Enter');
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('150');
    await page.evaluate(() => {
        const nativeNow = performance.now.bind(performance); let time = 10000;
        performance.now = () => time;
        try { for (let index = 0; index < 8; index++) { time += 500; document.querySelector<HTMLButtonElement>('[data-testid="timing-tap"]')!.click(); } }
        finally { performance.now = nativeNow; }
    });
    await expect(page.getByTestId('timing-tap-preview')).toHaveText('120 BPM');
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('150');
    await page.getByTestId('timing-apply-tap').click();
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('120');
    await page.getByTestId('editor-timeline').click({ position: { x: 250, y: 40 } });
    await page.getByTestId('timing-add-boundary').click();
    await expect(page.getByTestId('timing-select-1')).toHaveAttribute('aria-pressed', 'true');
    const start = page.getByRole('spinbutton', { name: '辅助区间起点（毫秒）', exact: true });
    await expect(start).toBeEnabled();
    await start.fill('400'); await start.press('Enter');
    await expect(page.locator('button[data-testid^="tempo-boundary-"]')).toHaveAttribute('data-time-seconds', '0.4');
    await page.getByTestId('timing-select-0').click();
    await expect(page.getByTestId('timing-tap-preview')).toHaveText('点按 8 次后预览');
    await page.getByTestId('toggle-editor-timing').click();
    await expect(page.getByTestId('editor-timing-panel')).toHaveCount(0);
    await page.reload(); await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.getByTestId('editor-timing-panel')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('local viewport defaults to four bars, stops at one bar and restores saved local windows', async ({ page }) => {
    await openEditor(page,'artifacts/fixtures/editor-e2-tempo-100-v1.wav');
    const state = page.getByTestId('editor-viewport-state');
    await expect(state).toContainText('0:08.000');
    await page.getByTestId('editor-zoom-in').click();
    await page.getByTestId('editor-zoom-in').click();
    await expect(page.getByTestId('editor-zoom-in')).toBeDisabled();
    const local = await state.textContent();
    await page.reload(); await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(state).toHaveText(local!);
    await page.getByTestId('editor-reset-viewport').click();
    await expect(state).toContainText('0:08.000');
    await page.getByLabel('标记显示范围', { exact:true }).selectOption('all');
    await expect(state).toContainText('0:12.000');
    await page.getByTestId('editor-reset-viewport').click();
    await expect(state).toContainText('0:08.000');
});

test('single point movement snaps, rejects duplicates, cancels previews and persists a pointer drag', async ({ page }) => {
    const errors:string[] = []; page.on('pageerror',error => errors.push(error.message));
    await openEditor(page); await page.getByTestId('add-point-lane').click();
    const surface = page.locator('[data-testid^="marker-surface-"]').first();
    await surface.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    const first = page.locator('[data-testid^="point-marker-"]').first();
    await first.focus(); await page.keyboard.press('Alt+ArrowRight');
    await expect(first).toHaveAttribute('data-time-seconds','0.25');
    await surface.focus(); await page.keyboard.press('Home'); for (let i=0;i<3;i++) await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    await first.focus(); await page.keyboard.press('Alt+ArrowRight');
    await expect(first).toHaveAttribute('data-time-seconds','0.25');
    await expect(page.getByTestId('point-workspace-status')).toContainText('目标已有');
    const bounds = await first.boundingBox(), row = await surface.boundingBox();
    const x = bounds!.x + bounds!.width/2, y = bounds!.y + bounds!.height/2;
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x + row!.width/8,y,{steps:4});
    await expect(surface.locator('.marker-move-hint')).toBeVisible();
    await page.keyboard.press('Escape'); await page.mouse.up();
    await expect(first).toHaveAttribute('data-time-seconds','0.25');
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x + row!.width/8,y,{steps:4}); await page.mouse.up();
    await expect(page.locator('[data-testid^="point-marker-"][data-time-seconds="0.75"]')).toHaveCount(1);
    await page.reload(); await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.locator('[data-testid^="point-marker-"][data-time-seconds="0.75"]')).toHaveCount(1);
    expect(errors).toEqual([]);
});

test('range body movement preserves length while its endpoint controls remain independent', async ({ page }) => {
    await openEditor(page); await page.getByTestId('add-range-lane').click();
    const surface = page.locator('[data-testid^="range-surface-"]').first();
    await surface.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    const marker = page.locator('[data-testid^="range-marker-"]').first();
    await marker.focus(); await page.keyboard.press('Alt+ArrowRight');
    await expect(marker).toHaveAttribute('data-start-seconds','0.25'); await expect(marker).toHaveAttribute('data-end-seconds','0.5');
    const bounds = await marker.boundingBox(), row = await surface.boundingBox();
    const x = bounds!.x + bounds!.width/2, y = bounds!.y + 3;
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x + row!.width/16,y,{steps:4}); await page.mouse.up();
    await expect(marker).toHaveAttribute('data-start-seconds','0.5'); await expect(marker).toHaveAttribute('data-end-seconds','0.75');
    await page.locator('[data-testid^="range-end-handle-"]').first().focus(); await page.keyboard.press('ArrowRight');
    await expect(marker).toHaveAttribute('data-start-seconds','0.5'); await expect(marker).toHaveAttribute('data-end-seconds','0.875');
});
