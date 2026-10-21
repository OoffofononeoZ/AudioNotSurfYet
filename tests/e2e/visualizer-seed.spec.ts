import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, savedPickerEntries } from '../support/file-picker';

async function traceSeeds(page: Page) {
    await page.evaluate(async modulePath => {
        const { IsolatedAlgorithmRuntime } = await import(modulePath);
        const original = IsolatedAlgorithmRuntime.prototype.prepareFrames;
        const trace: number[] = [];
        (window as any).__seedFrames = trace;
        IsolatedAlgorithmRuntime.prototype.prepareFrames = function (
            frames: { frame: { seed: number } }[],
            ...args: unknown[]
        ) {
            trace.push(...frames.map(e => e.frame.seed));
            return original.call(this, frames, ...args);
        };
    }, '/src/visualizer/isolatedAlgorithmRuntime.ts');
}

const seeds = (page: Page): Promise<number[]> => page.evaluate(() => (window as any).__seedFrames);

for (const target of ['home', 'page'] as const) {
    test(`automatic ${target} styles choose a new numeric seed on reload and retain it on render retry`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await installFilePickerStub(page, { visualizerAssets: true });
        await page.goto('/');
        await traceSeeds(page);
        await chooseFiles(page, [path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav')]);
        await page.getByTestId('header-visualizer-link').click();
        await expect(page.getByTestId('visualizer-ready')).toBeVisible();
        await page.getByTestId('add-visualizer-element').click();
        await page.locator('[data-resource-id="solid"]').click();
        await page.getByRole('button', { name: '清空 Seed', exact: true }).click();
        await page.getByTestId('realtime-style-actions').click();
        await page.getByTestId(target === 'home' ? 'apply-home-style' : 'create-display-page').click();
        if (target === 'page') await page.getByRole('link', { name: '打开展示页', exact: true }).click();
        const canvas = page.getByTestId('realtime-visualizer-canvas');
        await expect(canvas).toHaveAttribute('data-webgl-context-state', 'ready');
        await page.evaluate(() => {
            (window as any).__seedFrames.length = 0;
        });
        await expect.poll(async () => (await seeds(page)).length).toBeGreaterThan(2);
        const before = (await seeds(page)).at(-1)!;
        expect(Number.isInteger(before)).toBe(true);
        expect((await seeds(page)).every(value => value === before)).toBe(true);
        await page.reload();
        await traceSeeds(page);
        await expect(canvas).toHaveAttribute('data-webgl-context-state', 'ready');
        await expect.poll(async () => (await seeds(page)).length).toBeGreaterThan(2);
        const current = (await seeds(page)).at(-1)!;
        expect(Number.isInteger(current)).toBe(true);
        expect(current).not.toBe(before);
        await canvas.dispatchEvent('visualizer-scene-error-test');
        await expect(page.getByRole('alert')).toContainText('错误恢复测试');
        await page.getByRole('button', { name: '重试', exact: true }).click();
        await expect(page.locator('[data-realtime-state]')).toHaveAttribute('data-realtime-state', 'ready');
        expect((await seeds(page)).every(value => value === current)).toBe(true);
    });
}

test('empty Seed persists while preview, seek, resize and offline export share a numeric session seed', async ({
    page,
}) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await traceSeeds(page);
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await page.locator('[data-resource-id="solid"]').click();
    const seed = page.getByRole('spinbutton', { name: '确定性 Seed', exact: true });
    await seed.fill('37');
    await seed.press('Enter');
    await expect.poll(async () => (await seeds(page)).at(-1)).toBe(37);
    await page.getByRole('button', { name: '清空 Seed', exact: true }).click();
    await expect(seed).toHaveValue('');
    await expect(seed).toHaveAttribute('placeholder', '自动随机');
    await page.screenshot({ path: 'artifacts/visualizer-composition/seed-auto.png' });
    await expect.poll(async () => (await seeds(page)).at(-1)).not.toBe(37);
    const current = (await seeds(page)).at(-1)!;
    expect(Number.isInteger(current) && current >= 0 && current <= 0xffffffff).toBe(true);
    await page.evaluate(() => {
        (window as any).__seedFrames.length = 0;
    });
    await page.getByTestId('playback-progress').focus();
    await page.getByTestId('playback-progress').press('ArrowRight');
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect.poll(async () => (await seeds(page)).length).toBeGreaterThan(0);
    expect((await seeds(page)).every(value => value === current)).toBe(true);
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    expect(
        JSON.parse(Buffer.from((await savedPickerEntries(page))[0]!.base64, 'base64').toString('utf8')).seed,
    ).toBeNull();
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(seed).toBeDisabled();
    await expect(page.getByRole('button', { name: '清空 Seed', exact: true })).toBeDisabled();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
    expect((await seeds(page)).every(value => value === current)).toBe(true);
    await page.getByTestId('discard-visualizer-export').click();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(seed).toHaveValue('');
    await traceSeeds(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect.poll(async () => (await seeds(page)).length).toBeGreaterThan(0);
    expect((await seeds(page)).at(-1)).not.toBe(current);
    await seed.fill('0');
    await seed.press('Enter');
    await expect.poll(async () => (await seeds(page)).at(-1)).toBe(0);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(seed).toHaveValue('0');
});
