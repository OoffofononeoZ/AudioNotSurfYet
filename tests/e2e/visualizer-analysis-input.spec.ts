import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { sourceModule } from '../support/visualizer-assets.mjs';
const { spectrumBands } = await import(/* @vite-ignore */ sourceModule('spectral-strings', 'shared/strings.js'));
import { chooseFiles, installFilePickerStub, savedPickerEntries } from '../support/file-picker';
import type { VisualizerSessionController } from '../../src/visualizer/visualizerSessionController';

async function inputAt(page: Page, time: number) {
    const value = await page.getByTestId('visualizer-ready').evaluate(async (node, time) => {
        // Inspect the injected controller in the development app without adding a production debug API.
        let provides = (
            node as HTMLElement & { __vueParentComponent: { provides: Record<symbol, VisualizerSessionController> } }
        ).__vueParentComponent.provides;
        let controller: VisualizerSessionController | undefined;
        while (provides && !controller) {
            const key = Object.getOwnPropertySymbols(provides).find(
                key => key.description === 'visualizer-session-controller',
            );
            if (key) controller = provides[key];
            provides = Object.getPrototypeOf(provides);
        }
        if (!controller) throw new Error('Injected Visualizer controller not found.');
        const element = controller.readProject()!.elements.find(e => e.resource.id === 'spectral-dots')!;
        const value = controller.resolveValuesAt(time).get(element.id + ':spectrum');
        return value;
    }, time);
    return { ...value, levels: Array.isArray(value?.value) ? [...spectrumBands(value.value)] : [] };
}
async function open(page: Page) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    if ((await page.locator('#music-bar-container').getAttribute('data-playback-state')) === 'playing')
        await page.getByTestId('toggle-playback').click();
    await page.getByTestId('add-visualizer-element').click();
    await page.locator('[data-element-type=spectral-dots]').click();
}

test('Analyzer vector inputs render complete data and Buffer remains deterministic through seek, fullscreen and recording', async ({
    page,
}, info) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
        if (m.type() === 'error') errors.push(m.text());
    });
    await open(page);
    const feature = page.getByLabel('频谱输入分析特征', { exact: true });
    for (const [id, width] of [
        ['buffer', 1024],
        ['mfcc', 13],
        ['chroma', 12],
        ['powerSpectrum', 512],
        ['loudness', 24],
        ['complexSpectrum', 1024],
        ['amplitudeSpectrum', 512],
    ] as const) {
        await feature.selectOption(id);
        await expect.poll(async () => (await inputAt(page, 0.7)).state).toBe('ready');
        const input = await inputAt(page, 0.7);
        expect(input.value).toHaveLength(width);
        expect((input.value as number[]).every(value => Number.isFinite(value) && value >= 0)).toBe(true);
        // The AV-sync fixture is a narrow tone; a power spectrum can legitimately occupy one band.
        expect(new Set(input.levels).size, id).toBeGreaterThan(id === 'buffer' ? 32 : 1);
    }
    await feature.selectOption('buffer');
    await expect.poll(async () => (await inputAt(page, 0.7)).state).toBe('ready');
    const first = await inputAt(page, 0.7);
    await inputAt(page, 2);
    expect(await inputAt(page, 0.7)).toEqual(first);
    const canvas = page.getByTestId('visualizer-preview-canvas'),
        host = await canvas.getAttribute('data-renderer-host-id');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('visualizer-fullscreen-toggle').click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    const seek = page.getByTestId('visualizer-seek');
    await seek.fill('0.7');
    await seek.dispatchEvent('input');
    await page.waitForTimeout(150);
    const picture = await canvas.screenshot({ path: 'test-results/buffer-input-' + info.project.name + '.png' });
    await seek.fill('1.8');
    await seek.dispatchEvent('input');
    await page.waitForTimeout(150);
    expect((await canvas.screenshot()).equals(picture)).toBe(false);
    await seek.fill('0.7');
    await seek.dispatchEvent('input');
    await page.waitForTimeout(150);
    expect((await canvas.screenshot()).equals(picture)).toBe(true);
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(host);
    await page.keyboard.press('Escape');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('save-visualizer-export').click();
    await expect
        .poll(async () => (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).length)
        .toBe(1);
    const saved = (await savedPickerEntries(page)).find(e => e.name.endsWith('.webm'))!;
    expect(Buffer.from(saved.base64, 'base64').length).toBeGreaterThan(10000);
    expect(errors).toEqual([]);
});
