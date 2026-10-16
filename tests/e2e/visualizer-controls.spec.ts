import { expect, test } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

test('element actions stay visible without selecting or resizing rows', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page); await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/format-master.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    for (let i = 0; i < 3; i++) {
        await page.getByTestId('add-visualizer-element').click();
        await page.locator('[data-element-type=solid]').click();
    }
    const rows = page.locator('.viz-element-row');
    const selected = await rows.filter({ has: page.locator('[aria-pressed=true]') }).getAttribute('data-element-id');
    const other = rows.nth(1), otherId = await other.getAttribute('data-element-id');
    const row = page.locator(`.viz-element-row[data-element-id="${otherId}"]`);
    const height = (await row.boundingBox())!.height;
    await expect(row.getByRole('button', { name: '隐藏元素' })).toBeVisible();
    await row.getByRole('button', { name: '隐藏元素' }).click();
    await expect(row).toHaveClass(/muted/);
    await row.getByRole('button', { name: '显示元素' }).click();
    await row.getByRole('button', { name: '上移元素' }).click();
    await expect(rows.first()).toHaveAttribute('data-element-id', otherId!);
    await expect(rows.first().getByRole('button', { name: '上移元素' })).toBeDisabled();
    await expect(rows.last().getByRole('button', { name: '下移元素' })).toBeDisabled();
    await expect(page.locator('.viz-element-row.selected')).toHaveAttribute('data-element-id', selected!);
    await row.locator('.viz-element-select').click();
    await expect(page.locator('.viz-element-row.selected')).toHaveAttribute('data-element-id', otherId!);
    expect((await row.boundingBox())!.height).toBe(height);
    const name = page.getByRole('textbox', { name: '元素名称', exact: true });
    await name.fill('一个很长的元素名称用于验证操作按钮始终完整显示'); await name.press('Tab');
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.getByRole('button', { name: '元素列表', exact: true }).click();
    for (const label of ['上移元素', '下移元素', '隐藏元素', '删除元素']) {
        await expect(row.getByRole('button', { name: label })).toBeVisible();
    }
    await row.getByRole('button', { name: '删除元素' }).click();
    await expect(rows).toHaveCount(2);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-recording').click();
    await expect(page.getByTestId('cancel-visualizer-recording')).toBeVisible();
    for (const button of await rows.locator('.viz-row-actions button').all()) await expect(button).toBeDisabled();
    await page.getByTestId('cancel-visualizer-recording').click();
});

test('shared selects and number steppers keep keyboard, bounds and recording locks', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await installFilePickerStub(page); await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/format-master.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    const fps = page.getByRole('combobox', { name: '输出帧率', exact: true });
    await fps.focus(); await fps.press('Space');
    await expect.poll(() => fps.evaluate(element => element.matches(':open'))).toBe(true);
    await page.screenshot({ path: 'artifacts/visualizer-composition/output-controls.png' });
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await expect(fps).toHaveValue('60');
    await expect(fps).toBeFocused();
    await fps.press('Space'); await page.keyboard.press('Escape');
    await expect.poll(() => fps.evaluate(element => element.matches(':open'))).toBe(false);
    await expect(fps).toHaveValue('60');
    const seed = page.getByRole('spinbutton', { name: '确定性 Seed', exact: true });
    await seed.fill('4294967295'); await seed.press('Enter');
    await expect(page.getByRole('button', { name: '确定性 Seed增加', exact: true })).toBeDisabled();
    await seed.fill('0'); await seed.press('Enter');
    await expect(page.getByRole('button', { name: '确定性 Seed减少', exact: true })).toBeDisabled();
    await seed.press('ArrowUp'); await expect(seed).toHaveValue('1');
    await page.getByRole('button', { name: '确定性 Seed增加', exact: true }).click();
    await expect(seed).toHaveValue('2');
    await seed.fill(''); await seed.press('Enter'); await expect(seed).toHaveValue('2');
    await page.getByTestId('add-visualizer-element').click();
    await page.locator('[data-element-type=solid]').click();
    const opacity = page.getByRole('spinbutton', { name: '透明度', exact: true });
    await opacity.fill('.5'); await opacity.press('Enter');
    await opacity.press('ArrowUp'); await expect(opacity).toHaveValue('0.501');
    await page.screenshot({ path: 'artifacts/visualizer-composition/inspector-controls.png' });
    await fps.selectOption('30');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-recording').click();
    await expect(page.getByTestId('cancel-visualizer-recording')).toBeVisible();
    await expect(opacity).toBeDisabled();
    await expect(page.getByRole('spinbutton', { name: '元素层级', exact: true })).toBeDisabled();
    await page.getByTestId('cancel-visualizer-recording').click();
    await expect(opacity).toBeEnabled();
    expect(errors).toEqual([]);
});

test('fullscreen shares MusicBar track styling, supports dragging and keeps the same canvas', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page); await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/format-master.wav')]);
    await page.getByTestId('toggle-playback').click();
    const musicStyle = await page.getByTestId('playback-progress').evaluate(element => ({
        background: getComputedStyle(element).backgroundColor,
        fill: getComputedStyle(element, '::before').backgroundImage,
        height: getComputedStyle(element).height,
    }));
    await page.getByTestId('header-visualizer-link').click();
    const canvas = page.getByTestId('visualizer-preview-canvas');
    const host = await canvas.getAttribute('data-renderer-host-id');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('visualizer-fullscreen-toggle').click();
    const seek = page.getByTestId('visualizer-seek');
    await expect(seek).toBeVisible();
    const videoStyle = await seek.evaluate(element => {
        const track = element.parentElement!;
        return { background: getComputedStyle(track).backgroundColor,
            fill: getComputedStyle(track, '::before').backgroundImage, height: getComputedStyle(track).height };
    });
    expect(videoStyle).toEqual(musicStyle);
    await seek.fill('1.5'); await seek.dispatchEvent('input');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-time', '1.5');
    const box = (await seek.boundingBox())!;
    await page.mouse.move(box.x + box.width * .4, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .75, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Number(await page.locator('#music-bar-container').getAttribute('data-current-time'))).toBeCloseTo(3, 1);
    await seek.focus(); await page.keyboard.press('Home');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-time', '0');
    await page.screenshot({ path: 'artifacts/visualizer-composition/fullscreen-controls.png' });
    await page.keyboard.press('Escape');
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(host);
});
