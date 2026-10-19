import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chooseFiles, installFilePickerStub, savedPickerEntries, queuePickerData } from '../support/file-picker';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import type { VisualizerProjectV5 } from '../../src/visualizer/compositionTypes';
const audio = path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav');
async function open(page: Page) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [audio]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
}
async function add(page: Page, type: string) {
    await page.getByTestId('add-visualizer-element').click();
    await page.locator('[data-element-type="' + type + '"]').click();
    await expect(page.getByRole('dialog', { name: '添加元素' })).not.toBeVisible();
}
async function exported(page: Page): Promise<VisualizerProjectV5> {
    const previous = (await savedPickerEntries(page)).length;
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(previous + 1);
    const entries = await savedPickerEntries(page);
    return JSON.parse(Buffer.from(entries[entries.length - 1]!.base64, 'base64').toString('utf8'));
}
test('adds seven independent elements and configures targets and exact manual FX', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
        if (m.type() === 'error') errors.push(m.text());
    });
    await open(page);
    await expect(page.locator('.viz-element-row')).toHaveCount(0);
    for (const type of ['solid', 'spectral-strings', 'spectral-dots', 'reactive-rings', 'scale', 'blur', 'fade'])
        await add(page, type);
    await expect(page.locator('.viz-element-row')).toHaveCount(7);
    const p = await exported(page);
    expect(p.schemaVersion).toBe(5);
    expect(p.elements).toHaveLength(7);
    const editor = createInitialEditorProject({ track: p.track }),
        laneId = crypto.randomUUID(),
        eventId = crypto.randomUUID(),
        innerClassId = crypto.randomUUID();
    editor.lanes.push({
        id: laneId,
        name: 'FX',
        eventKind: 'range',
        innerClasses: [{ id: innerClassId, label: '淡出' }],
        events: [{ id: eventId, innerClassId, startSeconds: 0.5, endSeconds: 2.5 }],
    });
    await page.getByRole('tab', { name: 'Editor 数据' }).click();
    await queuePickerData(page, [{ name: 'editor.json', mimeType: 'application/json', text: JSON.stringify(editor) }]);
    await page.getByRole('button', { name: '导入 Editor JSON', exact: true }).click();
    await page.getByLabel('转场范围标记').selectOption(laneId + ':' + eventId);
    await page.getByLabel('影响对象范围').selectOption('elements');
    await page.getByLabel('纯色背景', { exact: true }).check();
    await page.getByLabel('频谱点阵', { exact: true }).check();
    const next = await exported(page),
        fade = next.elements.find(e => e.resource.id === 'fade')!;
    expect(fade.timing).toEqual({ kind: 'editor-range', laneId, eventId });
    expect(fade.targets).toMatchObject({ kind: 'elements', ids: expect.any(Array) });
    if (fade.targets?.kind === 'elements') expect(fade.targets.ids).toHaveLength(2);
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    expect(errors).toEqual([]);
    await page.screenshot({ path: 'test-results/visualizer-composition-desktop.png' });
});
test('fullscreen uses the same canvas and exposes only video transport', async ({ page }) => {
    await open(page);
    await add(page, 'spectral-dots');
    const canvas = page.getByTestId('visualizer-preview-canvas'),
        host = await canvas.getAttribute('data-renderer-host-id');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('visualizer-fullscreen-toggle').click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    await expect(page.getByTestId('visualizer-seek')).toBeVisible();
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(host);
    await page.getByTestId('visualizer-seek').fill('1');
    await page.getByTestId('visualizer-seek').dispatchEvent('input');
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
    await expect(page.locator('#music-bar-container')).toBeVisible();
});
test('exports a composition offline and preserves the ready WebM until save', async ({ page }, testInfo) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    await add(page, 'spectral-dots');
    await add(page, 'blur');
    await page.getByLabel('模糊半径', { exact: true }).fill('4');
    await page.getByLabel('模糊半径', { exact: true }).dispatchEvent('change');
    await expect
        .poll(() =>
            page.evaluate(() => document.querySelector('.viz-preview-frame')?.getAttribute('data-scene-status')),
        )
        .toBe('ready');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-export-locked', 'true');
    await expect(page.getByTestId('cancel-visualizer-export')).toBeVisible();
    await expect(page.getByTestId('visualizer-fullscreen-toggle')).toBeDisabled();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.waitForTimeout(350);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('save-visualizer-export').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const entries = await savedPickerEntries(page);
    expect(entries[entries.length - 1]!.name).toMatch(/composition-720p30fps.webm$/);
    const bytes = Buffer.from(entries[entries.length - 1]!.base64, 'base64');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    await mkdir('artifacts/visualizer-composition', { recursive: true });
    await writeFile('artifacts/visualizer-composition/' + testInfo.project.name + '.webm', bytes);
    expect(errors).toEqual([]);
});
