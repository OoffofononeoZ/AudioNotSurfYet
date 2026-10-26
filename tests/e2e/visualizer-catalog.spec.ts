import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { installDirectoryPickerStub, prepareResourceDirectory } from '../support/resource-directory';
import { resourceRows } from '../support/visualizer-assets.mjs';

const audio = path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav');
test.use({ viewport: { width: 1920, height: 1080 } });
async function open(page: Page, withLibrary = true) {
    await installFilePickerStub(page, { visualizerAssets: withLibrary });
    await page.goto('/');
    await chooseFiles(page, [audio]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await expect(page.getByRole('dialog', { name: '资源商城' })).toBeVisible();
}
async function geometry(page: Page) {
    return page.locator('.viz-catalog').evaluate(dialog => {
        const body = dialog.querySelector('.catalog-body') as HTMLElement;
        const header = dialog.querySelector('header')!.getBoundingClientRect();
        const footer = dialog.querySelector('footer')!.getBoundingClientRect();
        const rect = dialog.getBoundingClientRect();
        const grid = dialog.querySelector('.viz-catalog-grid');
        return {
            height: rect.height,
            width: rect.width,
            top: rect.top,
            bottom: rect.bottom,
            headerVisible: header.top >= rect.top && header.bottom <= rect.bottom,
            footerVisible: footer.top >= rect.top && footer.bottom <= rect.bottom,
            outerOverflow: dialog.scrollHeight - dialog.clientHeight,
            horizontalOverflow: body.scrollWidth - body.clientWidth,
            bodyOverflow: body.scrollHeight > body.clientHeight,
            gutter: body.offsetWidth - body.clientWidth,
            columns: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
        };
    });
}

test('metadata, single rows and empty results retain the catalog height and independent scrolling', async ({
    page,
}, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page);
    await expect(page.locator('[data-resource-id]')).toHaveCount(
        resourceRows().filter(row => row.info.kind !== 'preset').length,
    );
    const initial = await geometry(page);
    expect(initial).toMatchObject({ columns: 3, bodyOverflow: true, outerOverflow: 0 });
    expect(initial.height).toBeGreaterThanOrEqual(620);
    expect(initial.width).toBeLessThanOrEqual(1080);
    for (const row of resourceRows().filter(row => row.info.kind !== 'preset')) {
        const card = page.locator(`[data-resource-id="${row.info.resource.id}"]`);
        await expect(card.locator('.catalog-creator')).toHaveText('default');
        await expect(card.locator('time')).toHaveAttribute('datetime', row.info.createdAt);
    }
    await page.getByLabel('搜索资源').fill('纯色背景');
    await expect(page.locator('[data-resource-id]')).toHaveCount(1);
    expect(await geometry(page)).toMatchObject({ height: initial.height, columns: 3, bodyOverflow: false, gutter: 0 });
    const artwork = page.locator('[data-resource-id="solid"] .catalog-artwork');
    const box = await artwork.boundingBox();
    expect(box!.width / box!.height).toBeCloseTo(16 / 9, 1);
    await page.screenshot({ path: `artifacts/visualizer-composition/catalog/single-${info.project.name}.png` });
    await page.getByLabel('搜索资源').fill('does-not-exist');
    await expect(page.getByText('没有匹配的元素', { exact: true })).toBeVisible();
    expect(await geometry(page)).toMatchObject({ height: initial.height, outerOverflow: 0, horizontalOverflow: 0 });
    await page.getByRole('button', { name: '清除筛选', exact: true }).click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await expect(page.locator('[data-preset-id]')).toHaveCount(
        resourceRows().filter(row => row.info.kind === 'preset').length,
    );
    for (const row of resourceRows().filter(row => row.info.kind === 'preset'))
        await expect(page.locator(`[data-preset-id="${row.info.resource.id}"] time`)).toHaveAttribute(
            'datetime',
            row.info.createdAt,
        );
    await page.getByLabel('搜索资源').fill('双环频谱');
    await expect(page.locator('[data-preset-id="geometric-0.6"]')).toBeVisible();
    await page.getByLabel('预设用途').selectOption('wallpaper');
    await expect(page.getByLabel('预设用途')).toHaveValue('wallpaper');
    await page.getByRole('button', { name: '元素', exact: true }).click();
    await expect(page.getByLabel('搜索资源')).toHaveValue('');
    await expect(page.getByRole('button', { name: '全部', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await expect(page.getByLabel('预设用途')).toHaveValue('all');
    expect(await geometry(page)).toMatchObject({ height: initial.height, outerOverflow: 0, horizontalOverflow: 0 });
    await page.screenshot({ path: `artifacts/visualizer-composition/catalog/presets-${info.project.name}.png` });

    for (const [width, height, columns] of [
        [1280, 800, 3],
        [1024, 720, 3],
        [800, 720, 2],
        [390, 844, 1],
        [390, 540, 1],
    ]) {
        await page.setViewportSize({ width, height });
        const layout = await geometry(page);
        expect(layout).toMatchObject({
            headerVisible: true,
            footerVisible: true,
            outerOverflow: 0,
            horizontalOverflow: 0,
            columns,
        });
        expect(layout.top).toBeGreaterThanOrEqual(15);
        expect(layout.bottom).toBeLessThanOrEqual(height - 15);
        await page.screenshot({
            path: `artifacts/visualizer-composition/catalog/${width}x${height}-${info.project.name}.png`,
        });
    }
    expect(errors).toEqual([]);
});

test('folder onboarding, loading and cancellation stay usable across closing and reopening', async ({ page }, info) => {
    await installDirectoryPickerStub(page);
    await page.addInitScript(() => {
        Object.defineProperty(FileSystemHandle.prototype, 'queryPermission', {
            configurable: true,
            value: async () => {
                if (sessionStorage.getItem('hold-library') === 'true') {
                    await new Promise<void>(resolve => {
                        (window as any).releaseLibrary = resolve;
                    });
                }
                return 'granted';
            },
        });
    });
    await open(page, false);
    await prepareResourceDirectory(page, false);
    const initial = await geometry(page);
    await expect(page.getByRole('button', { name: '加载资源库', exact: true })).toBeVisible();
    expect(initial).toMatchObject({ bodyOverflow: false, gutter: 0 });
    await page.screenshot({ path: `artifacts/visualizer-composition/catalog/onboarding-${info.project.name}.png` });
    await page.evaluate(() => sessionStorage.setItem('hold-library', 'true'));
    await page.getByRole('button', { name: '加载资源库', exact: true }).click();
    await expect(page.locator('.viz-catalog').getByRole('status')).toHaveText('正在加载资源库…');
    await expect(page.getByRole('button', { name: '加载资源库', exact: true })).toBeDisabled();
    expect((await geometry(page)).height).toBe(initial.height);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('add-visualizer-element')).toBeFocused();
    await page.getByTestId('add-visualizer-element').click();
    await expect(page.locator('.viz-catalog').getByRole('status')).toHaveText('正在加载资源库…');
    await page.evaluate(() => {
        sessionStorage.removeItem('hold-library');
        (window as any).releaseLibrary();
    });
    await expect(page.locator('[data-resource-id]')).not.toHaveCount(0);
    await page.evaluate(() => sessionStorage.setItem('resource-picker-cancel', 'true'));
    const before = await page.locator('[data-resource-id] img').first().getAttribute('src');
    await page.getByRole('button', { name: '更换文件夹', exact: true }).click();
    expect(await page.locator('[data-resource-id] img').first().getAttribute('src')).toBe(before);
    await page.mouse.click(4, 4);
    await expect(page.getByRole('dialog', { name: '资源商城' })).not.toBeVisible();
});

test('card focus, late cover errors and add actions share the existing resource flow', async ({ page }) => {
    await open(page);
    const card = page.locator('[data-resource-id="solid"]');
    const image = card.locator('img');
    await expect(image).toHaveAttribute('src', /^blob:/);
    await image.evaluate(element => {
        (element as HTMLImageElement).src = 'data:image/png;base64,invalid';
    });
    await expect(image).toHaveAttribute('src', '/default_cover.png');
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await expect(image).toHaveAttribute('src', /^blob:/);
    await card.focus();
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: '资源商城' })).not.toBeVisible();
    await expect(page.locator('.viz-root-item')).toHaveCount(1);
    await expect(page.locator('.viz-element-select img')).toHaveAttribute('src', /^blob:/);
});
