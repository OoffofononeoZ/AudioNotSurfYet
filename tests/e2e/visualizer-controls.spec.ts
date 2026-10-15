import { expect, test } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

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
