import { chooseVisualizerProjectExport } from '../support/project-actions';
import '../setup-visualizer-resources';
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
const audio = path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav');
test.use({ viewport: { width: 1920, height: 1080 } });
async function open(page: Page) {
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [audio]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
}
async function exported(page: Page): Promise<VisualizerProjectV6> {
    const count = (await savedPickerEntries(page)).length;
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}
async function imported(page: Page, project: VisualizerProjectV6) {
    await queuePickerData(page, [
        { name: 'project.json', mimeType: 'application/json', text: JSON.stringify(project) },
    ]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
async function add(page: Page, id: string, preset = false) {
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: preset ? '预设' : '元素', exact: true }).click();
    await page.locator(`[data-${preset ? 'preset' : 'resource'}-id="${id}"]`).click();
    await expect(page.getByRole('dialog', { name: '资源商城', exact: true })).not.toBeVisible();
}
async function newFolders(page: Page) {
    return page.evaluate(
        async existing => {
            let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('visualizer-library-fixture');
            for (const name of ['assets', 'presets']) dir = await dir.getDirectoryHandle(name);
            const ids: string[] = [];
            for await (const [name] of (dir as any).entries())
                if (name.startsWith('user-preset-') && !existing.includes(name)) ids.push(name);
            return ids;
        },
        elementRegistry.presets.map(p => p.id),
    );
}
test('exports visible and hidden grouped and standalone configurations, refreshes the catalog and restores media and seeds', async ({
    page,
}, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    await add(page, 'geometric-0.6', true);
    await add(page, 'starfield');
    await add(page, 'circular-background');
    let p = await exported(page);
    p.elements[1]!.enabled = false;
    p.elements.find(e => e.resource.id === 'starfield')!.seed = 321;
    const data = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 36;
        const context = canvas.getContext('2d')!;
        context.fillStyle = '#305c7c';
        context.fillRect(0, 0, 64, 36);
        return canvas.toDataURL('image/png').split(',')[1]!;
    });
    const id = createHash('sha256').update(Buffer.from(data, 'base64')).digest('hex');
    p.mediaAssets = [{ id, name: '用户背景.png', mimeType: 'image/png', data }];
    const background = p.elements.find(e => e.resource.id === 'circular-background')!;
    const input = p.resources.elements.find(e => e.id === 'circular-background')!.mediaInputs![0]!.id;
    background.mediaBindings![input] = {
        kind: 'media',
        assetIds: [id],
        fit: 'contain',
        intervalSeconds: 8,
        crossfadeSeconds: 0.5,
    };
    await imported(page, p);
    const before = await exported(page);
    await page.getByTestId('export-visualizer-preset').click();
    const dialog = page.getByRole('dialog', { name: '导出预设', exact: true });
    await expect(page.getByTestId('save-visualizer-preset')).toBeEnabled();
    await expect(dialog.getByAltText('预设封面预览')).toBeVisible();
    await dialog.getByLabel('预设名称', { exact: true }).fill('跨歌曲预设');
    await dialog.getByLabel('预设说明', { exact: true }).fill('保留实际配置');
    await dialog.getByLabel('作者', { exact: true }).fill('自定义作者');
    await page.screenshot({ path: `artifacts/visualizer-composition/preset-export-${info.project.name}.png` });
    await dialog
        .locator('input[type=file]')
        .setInputFiles({ name: '封面.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') });
    await expect
        .poll(() => dialog.getByAltText('预设封面预览').evaluate(image => (image as HTMLImageElement).naturalWidth))
        .toBe(64);
    await expect(page.getByTestId('save-visualizer-preset')).toBeEnabled();
    await page.getByTestId('save-visualizer-preset').click();
    await expect(dialog.getByRole('status')).toContainText('请刷新资源商城后添加');
    expect(await newFolders(page)).toHaveLength(1);
    await dialog.getByRole('button', { name: '关闭导出预设' }).click();
    expect(await exported(page)).toEqual(before);
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    const card = page.locator('[data-preset-id^="user-preset-"]').filter({ hasText: '跨歌曲预设' });
    await expect(card).toContainText('跨歌曲预设');
    await expect(card).toContainText('保留实际配置');
    await expect(card).toContainText('自定义作者');
    await expect
        .poll(() => card.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    await card.click();
    p = await exported(page);
    const added = p.items.at(-1)!;
    expect(added.kind).toBe('preset');
    if (added.kind !== 'preset') throw Error('Expected preset');
    const leaves = p.elements.filter(e => added.children.includes(e.id));
    expect(leaves).toHaveLength(before.elements.length);
    expect(leaves.map(e => e.enabled)).toEqual(before.elements.map(e => e.enabled));
    expect(leaves.find(e => e.resource.id === 'starfield')!.seed).toBe(321);
    expect(leaves.find(e => e.resource.id === 'circular-background')!.mediaBindings).toEqual(background.mediaBindings);
    expect(p.mediaAssets).toHaveLength(1);
    expect(errors).toEqual([]);
});
test('realtime ineligibility and denied write permission leave the resource library intact', async ({ page }) => {
    await open(page);
    await add(page, 'spectral-strings');
    await page.getByTestId('export-visualizer-preset').click();
    const dialog = page.getByRole('dialog', { name: '导出预设', exact: true });
    await expect(dialog.getByRole('alert')).toContainText('需要历史输入');
    await expect(page.getByTestId('save-visualizer-preset')).toBeDisabled();
    await dialog.getByRole('button', { name: '关闭导出预设' }).click();
    const p = await exported(page);
    p.elements[0]!.enabled = false;
    await imported(page, p);
    await add(page, 'solid');
    await page.getByTestId('export-visualizer-preset').click();
    await expect(dialog.getByRole('alert')).toContainText('需要历史输入');
    await expect(page.getByTestId('save-visualizer-preset')).toBeDisabled();
    await dialog.getByRole('button', { name: '关闭导出预设' }).click();
    await page
        .locator(`.viz-element-row[data-element-id="${p.elements[0]!.id}"]`)
        .getByRole('button', { name: '删除元素', exact: true })
        .click();
    await page.evaluate(() =>
        Object.defineProperty(FileSystemHandle.prototype, 'requestPermission', {
            configurable: true,
            value: async () => 'denied',
        }),
    );
    await page.getByTestId('export-visualizer-preset').click();
    await expect(page.getByTestId('save-visualizer-preset')).toBeEnabled();
    await page.getByTestId('save-visualizer-preset').click();
    await expect(dialog.getByRole('alert')).toContainText('写入权限');
    expect(await newFolders(page)).toEqual([]);
    await dialog.getByRole('button', { name: '关闭导出预设' }).click();
    await page.getByTestId('export-visualizer-preset').click();
    await dialog.getByRole('button', { name: '关闭导出预设' }).click();
    await expect(dialog).not.toBeVisible();
    expect(await newFolders(page)).toEqual([]);
});

test('Circular export retains all seven elements, hidden settings and re-enable behavior', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    await add(page, 'circular-visualizer-893418273', true);
    await page.getByRole('button', { name: '展开Circular Visualizer', exact: true }).click();
    const original = await exported(page);
    const particles = original.elements.find(e => e.resource.id === 'circular-particles')!;
    const depth = original.elements.find(e => e.resource.id === 'circular-depth')!;
    await page
        .locator(`.viz-element-row[data-element-id="${particles.id}"]`)
        .getByRole('button', { name: '隐藏元素', exact: true })
        .click();
    await page
        .locator(`.viz-element-row[data-element-id="${depth.id}"]`)
        .getByRole('button', { name: '显示元素', exact: true })
        .click();
    const before = await exported(page);
    expect(before.elements).toHaveLength(7);
    await page.getByTestId('export-visualizer-preset').click();
    const dialog = page.getByRole('dialog', { name: '导出预设', exact: true });
    await expect(page.getByTestId('save-visualizer-preset')).toBeEnabled();
    await dialog.getByLabel('预设名称', { exact: true }).fill('保留隐藏粒子');
    await page.getByTestId('save-visualizer-preset').click();
    await expect(dialog.getByRole('status')).toContainText('请刷新资源商城后添加');
    await dialog.getByRole('button', { name: '关闭导出预设' }).click();
    expect(await exported(page)).toEqual(before);
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id^="user-preset-"]').filter({ hasText: '保留隐藏粒子' }).click();
    let p = await exported(page);
    const group = p.items.at(-1)!;
    if (group.kind !== 'preset') throw Error('Expected preset');
    const leaves = p.elements.filter(e => group.children.includes(e.id));
    expect(leaves).toHaveLength(7);
    for (const [index, leaf] of leaves.entries()) {
        const source = before.elements[index]!;
        expect(leaf).toMatchObject({
            resource: source.resource,
            name: source.name,
            enabled: source.enabled,
            bindings: source.bindings,
            ...(source.seed === undefined ? {} : { seed: source.seed }),
            ...(source.mediaBindings ? { mediaBindings: source.mediaBindings } : {}),
        });
    }
    const hidden = leaves.find(e => e.resource.id === 'circular-particles')!;
    expect(hidden.enabled).toBe(false);
    expect(leaves.find(e => e.resource.id === 'circular-foreground')!.enabled).toBe(false);
    await page.getByRole('button', { name: '展开保留隐藏粒子', exact: true }).click();
    const row = page.locator(`.viz-element-row[data-element-id="${hidden.id}"]`);
    await row.getByRole('button', { name: '显示元素', exact: true }).click();
    p = await exported(page);
    expect(p.elements.find(e => e.id === hidden.id)!.enabled).toBe(true);
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    await page.screenshot({ path: `artifacts/visualizer-composition/preset-hidden-restored-${info.project.name}.png` });
    expect(errors).toEqual([]);
});

test('all-hidden content can be exported without changing the preview or original project', async ({ page }) => {
    await open(page);
    await add(page, 'solid');
    const p = await exported(page);
    p.elements[0]!.enabled = false;
    await imported(page, p);
    const before = await exported(page);
    await page.getByTestId('export-visualizer-preset').click();
    const dialog = page.getByRole('dialog', { name: '导出预设', exact: true });
    await expect(page.getByTestId('save-visualizer-preset')).toBeEnabled();
    await page.getByTestId('save-visualizer-preset').click();
    await expect(dialog.getByRole('status')).toContainText('请刷新资源商城后添加');
    await dialog.getByRole('button', { name: '关闭导出预设' }).click();
    expect(await exported(page)).toEqual(before);
});
