import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { resourceHash } from '../../src/visualizer/resourceIdentity';
import type { VisualizerProjectV4 } from '../../src/visualizer/compositionTypes';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';

const audio = path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav');
async function open(page: Page) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [audio]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    if ((await page.locator('#music-bar-container').getAttribute('data-playback-state')) === 'playing')
        await page.getByTestId('toggle-playback').click();
}
async function addPreset(page: Page, id: string) {
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator(`[data-preset-id="${id}"]`).click();
}
async function add(page: Page, type: string) {
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '全部', exact: true }).click();
    await page.locator(`[data-element-type="${type}"]`).click();
}
async function exported(page: Page): Promise<VisualizerProjectV4> {
    const count = (await savedPickerEntries(page)).length;
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}
async function input(page: Page, label: string, value: string) {
    const field = page.getByRole('spinbutton', { name: label, exact: true });
    await field.fill(value);
    await field.dispatchEvent('change');
}
function pack() {
    const p = JSON.parse(
        readFileSync(
            path.resolve(import.meta.dirname, '../../public/visualizer-resources/v1/elements/wireform.json'),
            'utf8',
        ),
    );
    p.id = 'local-wire';
    p.elements[0].id = 'local-wire';
    p.elements[0].title = '本地线框';
    p.elements[0].hash = resourceHash(p.elements[0]);
    return p;
}

test('two presets and three leaves form five roots; shared values, child differences and reapply survive restore', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    await addPreset(page, 'geometric-0.6');
    await expect(page.locator('.viz-root-item')).toHaveCount(1);
    await expect(page.locator('.viz-preset-children')).toHaveCount(0);
    await input(page, '响应系数', '1.1');
    await page.getByRole('button', { name: '展开几何律动', exact: true }).click();
    await page.getByRole('button', { name: '外环 · 双重复频谱', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: '响应系数', exact: true })).toHaveValue('1.1');
    await input(page, '响应系数', '0.8');
    await page.getByRole('button', { name: '几何律动', exact: true }).click();
    await expect(page.locator('.viz-common-differences')).toContainText('已有 1 个元素修改此值');
    await page.getByRole('button', { name: '重新应用', exact: true }).click();
    await expect(page.getByText('已有 1 个元素修改此值')).toHaveCount(0);
    await addPreset(page, 'prismatic-voyage');
    for (const type of ['solid', 'blur', 'spectral-dots']) await add(page, type);
    await expect(page.locator('.viz-root-item')).toHaveCount(5);
    const p = await exported(page);
    expect(p.schemaVersion).toBe(4);
    expect(p.items).toHaveLength(5);
    expect(p.resources.presets).toHaveLength(2);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(page.locator('.viz-root-item')).toHaveCount(5);
    await expect(page.locator('.viz-preset-children')).toHaveCount(0);
    await page.getByRole('button', { name: '几何律动', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: '响应系数', exact: true })).toHaveValue('1.1');
    await page.locator('.viz-root-item').last().getByRole('button', { name: '上移预设', exact: true }).click();
    const reordered = await exported(page);
    expect(reordered.items[1]!.id).toBe(p.items[0]!.id);
    await page.screenshot({ path: 'artifacts/visualizer-composition/resources/groups.png' });
    expect(errors).toEqual([]);
});

test('local packages persist, reject conflicts and can be removed while their embedded project remains usable offline', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    await page.getByTestId('add-visualizer-element').click();
    const resource = pack();
    await queuePickerData(page, [{ name: 'local.json', mimeType: 'application/json', text: JSON.stringify(resource) }]);
    await page.getByRole('button', { name: '导入资源包', exact: true }).click();
    await page.locator('[data-resource-id=local-wire]').click();
    let p = await exported(page);
    expect(p.elements[0]!.type).toBe('wireform');
    expect(p.elements[0]!.resource.id).toBe('local-wire');
    expect(p.resources.elements).toHaveLength(1);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await expect(page.locator('[data-resource-id=local-wire]')).toBeVisible();
    const conflict = pack();
    conflict.elements[0].title = '冲突线框';
    conflict.elements[0].hash = resourceHash(conflict.elements[0]);
    await queuePickerData(page, [
        { name: 'conflict.json', mimeType: 'application/json', text: JSON.stringify(conflict) },
    ]);
    await page.getByRole('button', { name: '导入资源包', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('不同内容');
    await page.getByText('已导入资源包', { exact: true }).click();
    await page.getByRole('button', { name: '移除资源包 local-wire', exact: true }).click();
    await expect(page.locator('[data-resource-id=local-wire]')).toHaveCount(0);
    await page.getByRole('button', { name: '关闭元素库', exact: true }).click();
    await page.route('**/visualizer-resources/**', route => route.abort());
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    p = await exported(page);
    expect(p.resources.elements[0]!.title).toBe('本地线框');
    expect(errors).toEqual([]);
});

test('catalog request failures retry and preset controls remain usable in narrow drawers', async ({ page }) => {
    await page.route('**/visualizer-resources/v1/catalog.json', route => route.fulfill({ status: 503, body: '' }));
    await open(page);
    await page.getByTestId('add-visualizer-element').click();
    await expect(page.getByRole('alert')).toContainText('资源索引加载失败');
    await page.unroute('**/visualizer-resources/v1/catalog.json');
    await page.getByRole('button', { name: '重试加载', exact: true }).click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="geometric-0.6"]').click();
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.getByRole('button', { name: '元素列表', exact: true }).click();
    await page.getByRole('button', { name: '几何律动', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: '响应系数', exact: true })).toBeVisible();
    await input(page, '响应系数', '0.9');
    await page.screenshot({ path: 'artifacts/visualizer-composition/resources/narrow.png' });
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
});

test('group edits lock during a short deterministic offline export on the same renderer', async ({ page }) => {
    test.setTimeout(60000);
    await open(page);
    await addPreset(page, 'geometric-0.6');
    await page.getByRole('tab', { name: '状态', exact: true }).click();
    await expect(page.locator('.viz-status-lines')).toContainText('已就绪');
    const canvas = page.getByTestId('visualizer-preview-canvas'),
        host = await canvas.getAttribute('data-renderer-host-id');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.getByTestId('add-visualizer-element')).toBeDisabled();
    await expect(page.getByRole('spinbutton', { name: '响应系数', exact: true })).toBeDisabled();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(host);
    await page.getByTestId('save-visualizer-export').click();
    await expect
        .poll(async () =>
            (await savedPickerEntries(page)).some(
                e => e.name.endsWith('.webm') && Buffer.from(e.base64, 'base64').length > 1000,
            ),
        )
        .toBe(true);
});
