import { expect, test } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { installDirectoryPickerStub, prepareResourceDirectory } from '../support/resource-directory';
import { resourceRows } from '../support/visualizer-assets.mjs';
const elementCount = resourceRows().filter(row => row.info.kind !== 'preset').length;
test.use({ viewport: { width: 1920, height: 1080 } });
test('first selection is explicit, cancellation keeps it empty, all external previews and all configured elements load', async ({
    page,
}) => {
    await installDirectoryPickerStub(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await prepareResourceDirectory(page, false);
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await expect(page.getByText('请选择 WheresYourElements/assets 文件夹')).toBeVisible();
    await expect(page.locator('[data-resource-id]')).toHaveCount(0);
    await page.evaluate(() => sessionStorage.setItem('resource-picker-cancel', 'true'));
    await page.getByRole('button', { name: '选择文件夹', exact: true }).click();
    await expect(page.getByText('请选择 WheresYourElements/assets 文件夹')).toBeVisible();
    await page.evaluate(() => sessionStorage.removeItem('resource-picker-cancel'));
    await page.getByRole('button', { name: '选择文件夹', exact: true }).click();
    await expect(page.locator('[data-resource-id]')).toHaveCount(elementCount);
    expect(
        await page
            .locator('[data-resource-id] img')
            .evaluateAll(nodes =>
                nodes.every(n => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0),
            ),
    ).toBe(true);
    const ids = await page
        .locator('[data-resource-id]')
        .evaluateAll(nodes => nodes.map(n => n.getAttribute('data-resource-id')!));
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await expect(page.locator('[data-preset-id]')).toHaveCount(2);
    expect(
        await page
            .locator('[data-preset-id] img')
            .evaluateAll(nodes =>
                nodes.every(n => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0),
            ),
    ).toBe(true);
    await page.getByRole('button', { name: '全部', exact: true }).click();
    for (const [index, id] of ids.entries()) {
        if (index) await page.getByTestId('add-visualizer-element').click();
        await page.locator(`[data-resource-id="${id}"]`).click();
    }
    await expect(page.locator('.viz-root-item')).toHaveCount(elementCount);
    await expect(page.locator('.viz-element-select img')).toHaveCount(elementCount);
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await expect(page.locator('[data-resource-id]')).toHaveCount(elementCount);
    await page.screenshot({ path: 'artifacts/visualizer-composition/resources/external-directory.png' });
});
test('permission recovery and a damaged refresh preserve the usable catalog', async ({ page }) => {
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.addInitScript(() => {
        Object.defineProperty(FileSystemHandle.prototype, 'queryPermission', {
            configurable: true,
            value: async () => sessionStorage.getItem('resource-permission') ?? 'granted',
        });
        Object.defineProperty(FileSystemHandle.prototype, 'requestPermission', {
            configurable: true,
            value: async () => {
                const result = sessionStorage.getItem('resource-request') ?? 'denied';
                if (result === 'granted') sessionStorage.removeItem('resource-permission');
                return result;
            },
        });
    });
    await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.evaluate(() => sessionStorage.setItem('resource-permission', 'prompt'));
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '恢复访问', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('未获得');
    await page.evaluate(() => sessionStorage.setItem('resource-request', 'granted'));
    await page.getByRole('button', { name: '恢复访问', exact: true }).click();
    await expect(page.locator('[data-resource-id]')).toHaveCount(elementCount);
    const before = await page.locator('[data-resource-id] img').first().getAttribute('src');
    await page.evaluate(async () => {
        let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('visualizer-library-fixture');
        for (const name of ['assets', 'presets', 'geometric-0.6']) dir = await dir.getDirectoryHandle(name);
        const handle = await dir.getFileHandle('resource-info.json'),
            info = JSON.parse(await (await handle.getFile()).text());
        info.dependencies = [];
        const writer = await handle.createWritable();
        await writer.write(JSON.stringify(info));
        await writer.close();
    });
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('依赖');
    await expect(page.locator('[data-resource-id]')).toHaveCount(elementCount);
    expect(await page.locator('[data-resource-id] img').first().getAttribute('src')).toBe(before);
    await prepareResourceDirectory(page, false);
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect.poll(() => page.locator('[data-resource-id] img').first().getAttribute('src')).not.toBe(before);
    for (const variant of ['path', 'identity', 'preset-elements', 'missing-file']) {
        await prepareResourceDirectory(page, false);
        const previous = await page.locator('[data-resource-id] img').first().getAttribute('src');
        await page.evaluate(async variant => {
            let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('visualizer-library-fixture');
            for (const name of ['assets', 'presets', 'geometric-0.6']) dir = await dir.getDirectoryHandle(name);
            const update = async (name: string, change: (v: any) => void) => {
                const handle = await dir.getFileHandle(name),
                    value = JSON.parse(await (await handle.getFile()).text());
                change(value);
                const writer = await handle.createWritable();
                await writer.write(JSON.stringify(value));
                await writer.close();
            };
            if (variant === 'path')
                await update('resource-info.json', v => (v.sourceEntry = 'source/../../outside.json'));
            if (variant === 'identity') await update('resource-info.json', v => (v.resource.hash = '0'.repeat(64)));
            if (variant === 'missing-file') await dir.removeEntry('preview.svg');
            if (variant === 'preset-elements') {
                let solid = await (
                    await navigator.storage.getDirectory()
                ).getDirectoryHandle('visualizer-library-fixture');
                for (const name of ['assets', 'elements', 'solid']) solid = await solid.getDirectoryHandle(name);
                const pack = JSON.parse(
                    await (await (await solid.getFileHandle('resource-package.json')).getFile()).text(),
                );
                await update('resource-package.json', v => {
                    v.algorithms = pack.algorithms;
                    v.elements = pack.elements;
                });
            }
        }, variant);
        await page.getByRole('button', { name: '重新加载', exact: true }).click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.locator('[data-resource-id]')).toHaveCount(elementCount);
        expect(await page.locator('[data-resource-id] img').first().getAttribute('src')).toBe(previous);
    }
});
