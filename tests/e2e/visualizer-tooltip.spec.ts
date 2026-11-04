import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chooseFiles, installFilePickerStub, savedPickerEntries, queuePickerData } from '../support/file-picker';
import { chooseVisualizerProjectExport } from '../support/project-actions';
import { runTooltipScenario } from '../support/tooltip-scenario.mjs';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';

test('attribute help survives import and fits scrolling panels, narrow viewports and screen edges', async ({
    page,
}, info) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/format-master.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="geometric-0.6"]').click();
    for (const id of ['point-line-horizontal', 'fade', 'circular-background', 'black-hole-lyrics']) {
        await page.getByTestId('add-visualizer-element').click();
        await page.getByRole('button', { name: '元素', exact: true }).click();
        await page.locator(`[data-element-type="${id}"]`).click();
    }
    const directory = 'artifacts/visualizer-composition/tooltip';
    await mkdir(directory, { recursive: true });
    let last: VisualizerProjectV6;
    const result = await runTooltipScenario(page, {
        async resizeViewport(width, height) {
            await page.setViewportSize({ width, height });
        },
        async readProject() {
            const count = (await savedPickerEntries(page)).length;
            await chooseVisualizerProjectExport(page);
            await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
            last = JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
            return last;
        },
        async lastProject() {
            return last;
        },
        async importProject(p) {
            await queuePickerData(page, [
                { name: 'tooltip.json', mimeType: 'application/json', text: JSON.stringify(p) },
            ]);
            await page.getByTestId('import-visualizer-project').click();
            await expect(page.getByTestId('import-visualizer-project')).toHaveAttribute('aria-busy', 'false');
            await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
        },
        async screenshot(name) {
            await page.screenshot({ path: `${directory}/${info.project.name}-${name}.png` });
        },
    });
    expect(result.persisted).toBe(true);
    expect(errors).toEqual([]);
    await writeFile(`${directory}/${info.project.name}-result.json`, JSON.stringify(result, null, 2), 'utf8');
});
