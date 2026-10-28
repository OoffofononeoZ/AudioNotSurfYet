import { chooseVisualizerProjectExport, openRealtimeStyleExport } from '../support/project-actions';
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, savedPickerEntries } from '../support/file-picker';

async function traceSeeds(page: Page) {
    await page.evaluate(async modulePath => {
        const { IsolatedAlgorithmRuntime } = await import(modulePath);
        const original = IsolatedAlgorithmRuntime.prototype.prepareFrames;
        const trace: { id: string; seed: number }[] = [];
        (window as any).__seedFrames = trace;
        IsolatedAlgorithmRuntime.prototype.prepareFrames = function (
            frames: { id: string; frame: { seed: number } }[],
            ...args: unknown[]
        ) {
            trace.push(...frames.map(e => ({ id: e.id, seed: e.frame.seed })));
            return original.call(this, frames, ...args);
        };
    }, '/src/visualizer/isolatedAlgorithmRuntime.ts');
}

const seeds = (page: Page, id?: string): Promise<number[]> =>
    page.evaluate(
        id =>
            ((window as any).__seedFrames as { id: string; seed: number }[])
                .filter(e => !id || e.id === id)
                .map(e => e.seed),
        id,
    );

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
        await page.locator('[data-resource-id="starfield"]').click();
        await expect(page.getByRole('spinbutton', { name: '元素 Seed', exact: true })).toHaveValue('');
        await openRealtimeStyleExport(page);
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

test('only random elements expose independent Seed properties and preserve them through export and reload', async ({
    page,
}) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await traceSeeds(page);
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    const seed = page.getByRole('spinbutton', { name: '元素 Seed', exact: true });
    const add = async (type: string) => {
        await page.getByTestId('add-visualizer-element').click();
        await page.locator('[data-resource-id="' + type + '"]').click();
        return (await page.locator('.viz-element-row.selected').getAttribute('data-element-id'))!;
    };
    const select = (id: string) => page.locator('[data-element-id="' + id + '"] .viz-element-select').click();
    const solid = await add('solid');
    await expect(seed).toHaveCount(0);
    await expect(page.getByRole('spinbutton', { name: '确定性 Seed', exact: true })).toHaveCount(0);
    const a = await add('starfield');
    await expect(seed).toHaveValue('');
    await seed.fill('37');
    await seed.press('Enter');
    await expect.poll(async () => (await seeds(page, a)).at(-1)).toBe(37);
    const b = await add('starfield');
    await expect(seed).toHaveValue('');
    await seed.fill('71');
    await seed.press('Enter');
    await expect.poll(async () => (await seeds(page, b)).at(-1)).toBe(71);
    await select(a);
    await expect(seed).toHaveValue('37');
    await page.getByRole('button', { name: '清空元素 Seed', exact: true }).click();
    await expect(seed).toHaveValue('');
    await expect(seed).toHaveAttribute('placeholder', '自动随机');
    await expect.poll(async () => (await seeds(page, a)).at(-1)).not.toBe(37);
    const current = (await seeds(page, a)).at(-1)!;
    expect(Number.isInteger(current)).toBe(true);
    expect((await seeds(page, b)).at(-1)).toBe(71);
    await page.screenshot({ path: 'artifacts/visualizer-composition/element-seed-auto.png' });
    await page.evaluate(() => {
        (window as any).__seedFrames.length = 0;
    });
    await page.getByTestId('playback-progress').focus();
    await page.getByTestId('playback-progress').press('ArrowRight');
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect.poll(async () => (await seeds(page, a)).length).toBeGreaterThan(0);
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const project = JSON.parse(Buffer.from((await savedPickerEntries(page))[0]!.base64, 'base64').toString('utf8'));
    expect(project).not.toHaveProperty('seed');
    expect(project.elements.find((e: any) => e.id === a).seed).toBeNull();
    expect(project.elements.find((e: any) => e.id === b).seed).toBe(71);
    expect(project.elements.find((e: any) => e.id === solid)).not.toHaveProperty('seed');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(seed).toBeDisabled();
    await expect(page.getByRole('button', { name: '清空元素 Seed', exact: true })).toBeDisabled();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 45000 });
    expect((await seeds(page, a)).every(value => value === current)).toBe(true);
    expect((await seeds(page, b)).every(value => value === 71)).toBe(true);
    expect((await seeds(page, solid)).every(value => value === 0)).toBe(true);
    await page.getByTestId('discard-visualizer-export').click();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await traceSeeds(page);
    await select(a);
    await expect(seed).toHaveValue('');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect.poll(async () => (await seeds(page, a)).length).toBeGreaterThan(0);
    expect((await seeds(page, a)).at(-1)).not.toBe(current);
    expect((await seeds(page, b)).at(-1)).toBe(71);
    await select(b);
    await expect(seed).toHaveValue('71');
    await seed.fill('');
    await seed.press('Enter');
    await expect(seed).toHaveValue('');
    await select(solid);
    await expect(seed).toHaveCount(0);
});

test('preset children expose Seed only for their own random effects', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="geometric-0.6"]').click();
    const seed = page.getByRole('spinbutton', { name: '元素 Seed', exact: true });
    await expect(seed).toHaveCount(0);
    const collapsed = page.locator('.viz-element-items button[aria-expanded=false]');
    while (await collapsed.count()) await collapsed.first().click();
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const project = JSON.parse(Buffer.from((await savedPickerEntries(page))[0]!.base64, 'base64').toString('utf8'));
    const select = async (resourceId: string) => {
        const element = project.elements.find((e: any) => e.resource.id === resourceId);
        await page.locator('[data-element-id="' + element.id + '"] .viz-element-select').click();
    };
    await select('radial-spectrum');
    await expect(seed).toHaveValue('');
    await seed.fill('19');
    await seed.press('Enter');
    await select('orbit-solids');
    await expect(seed).toHaveValue('');
    await seed.fill('27');
    await seed.press('Enter');
    await select('radial-spectrum');
    await expect(seed).toHaveValue('19');
    await select('arc-lattice');
    await expect(seed).toHaveCount(0);
    await select('solid');
    await expect(seed).toHaveCount(0);
});
