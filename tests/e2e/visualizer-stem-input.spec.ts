import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { prepareMarkerEditor } from '../support/editor-marking';
import { captureSeparation, seedStemResult } from '../support/stem-analysis';
import { installFilePickerStub, savedPickerEntries } from '../support/file-picker';
import type { VisualizerSessionController } from '../../src/visualizer/visualizerSessionController';

async function inspect(page: Page, time: number, seek = false) {
    return page.getByTestId('visualizer-ready').evaluate(
        async (node, { time, seek }) => {
            const provides = (
                node as HTMLElement & {
                    __vueParentComponent: { provides: Record<symbol, VisualizerSessionController> };
                }
            ).__vueParentComponent.provides;
            const url = '/src/visualizer/visualizerSessionController.ts',
                { visualizerSessionControllerKey } = await import(url),
                controller = provides[visualizerSessionControllerKey]!;
            if (seek) await controller.seek(time);
            await controller.prepareValuesAt(time);
            const values = controller.resolveValuesAt(time);
            return {
                project: controller.readProject(),
                runtime: controller.getSnapshot().bindingRuntime,
                spectra: controller.readProject()!.elements.map(element => values.get(element.id + ':spectrum')),
            };
        },
        { time, seek },
    );
}
test('mixed stem spectrum and exact Buffer inputs survive seek, project restore and offline export', async ({
    page,
}, info) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(10000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await captureSeparation(page);
    await installFilePickerStub(page, { visualizerAssets: true });
    await prepareMarkerEditor(page, 'tests/fixtures/audio/visualizer-v5-avsync-v1.wav');
    await seedStemResult(page);
    const track = await page.evaluate(async () => {
        const url = '/src/stores/audioSessionStore.ts';
        return (await import(url)).useAudioSessionStore().currentTrackId;
    });
    await page.goto(`/visualizer/${track}`);
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    for (const [role, element] of [
        ['drums', 'spectral-dots'],
        ['vocals', 'spectral-dots'],
    ] as const) {
        await page.getByTestId('add-visualizer-element').click();
        await page.locator(`[data-element-type="${element}"]`).click();
        const source = page.getByLabel('频谱输入数据来源', { exact: true });
        await expect(source.locator('option[value="analysis"]')).toHaveText('analyzer（原曲）');
        await expect(source.locator('option')).toHaveCount(7);
        await source.selectOption(role);
        const feature = page.getByLabel('频谱输入分析特征', { exact: true });
        await expect(feature.locator('option')).toHaveCount(3);
        await feature.selectOption('wallpaperEngineSpectrum');
        await expect(page.locator('[data-analysis-status="ready"]')).toBeVisible({ timeout: 30000 });
    }
    const mixed = await inspect(page, 0.7);
    expect(mixed.spectra.every(input => input?.state === 'ready')).toBe(true);
    expect(mixed.spectra[0]?.value).not.toEqual(mixed.spectra[1]?.value);
    expect(mixed.runtime.activeInputs).toEqual([
        { featureId: 'wallpaperEngineSpectrum', stemRole: 'drums' },
        { featureId: 'wallpaperEngineSpectrum', stemRole: 'vocals' },
    ]);
    await page.getByLabel('频谱输入分析特征', { exact: true }).selectOption('buffer');
    await expect(page.locator('[data-analysis-status="ready"]')).toBeVisible();
    const first = (await inspect(page, 0.7)).spectra[1];
    expect(first?.value).toHaveLength(1024);
    await inspect(page, 1.8);
    expect((await inspect(page, 0.7)).spectra[1]).toEqual(first);
    // Exercise the same bounded reader through the algorithm's asynchronous history callback.
    await page.getByTestId('add-visualizer-element').click();
    await page.locator('[data-element-type="spectral-strings"]').click();
    await page.getByLabel('频谱输入数据来源', { exact: true }).selectOption('bass');
    await page.getByLabel('频谱输入分析特征', { exact: true }).selectOption('buffer');
    await expect(page.locator('[data-analysis-status="ready"]')).toBeVisible();
    const before = await inspect(page, 0.7);
    await expect(page.locator('.viz-save-state')).toHaveAttribute('data-state', 'saved');
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(page.locator('[data-analysis-status="ready"]')).toBeVisible({ timeout: 30000 });
    expect((await inspect(page, 0.7)).project?.elements.map(e => e.bindings)).toEqual(
        before.project?.elements.map(e => e.bindings),
    );
    await inspect(page, 0.7, true);
    await expect(page.getByTestId('visualizer-preview-canvas')).toHaveAttribute('data-frame-time', '0.700000', {
        timeout: 30000,
    });
    await mkdir('artifacts/stem-analysis', { recursive: true });
    await page.screenshot({ path: `artifacts/stem-analysis/${info.project.name}-visualizer.png` });
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status="ready"]')).toBeVisible({ timeout: 90000 });
    await page.getByTestId('save-visualizer-export').click();
    await expect
        .poll(async () => (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).length)
        .toBe(1);
    const saved = (await savedPickerEntries(page)).find(e => e.name.endsWith('.webm'))!;
    await writeFile(`artifacts/stem-analysis/${info.project.name}.webm`, Buffer.from(saved.base64, 'base64'));
    await page.evaluate(async () => {
        await Reflect.get(window, '__stemTestService').clear('results');
    });
    await expect(page.locator('[data-analysis-status="error"]')).toBeVisible();
    await expect(page.getByTestId('start-visualizer-export')).toBeDisabled();
    expect((await inspect(page, 0.7)).project?.elements.length).toBe(3);
    expect(errors).toEqual([]);
});
