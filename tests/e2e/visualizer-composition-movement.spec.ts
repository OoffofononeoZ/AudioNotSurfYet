import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import { chooseVisualizerProjectExport } from '../support/project-actions';
import { runCompositionMovement, writeMovementCapture } from '../support/composition-movement-scenario.mjs';

test('cross-preset buttons and drag/drop preserve structure, keyboard focus, persistence and actual compositing', async ({
    page,
}, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="geometric-0.6"]').click();
    const directory = 'artifacts/visualizer-composition/movement';
    await mkdir(directory, { recursive: true });
    const result = await runCompositionMovement(page, {
        async resizeViewport(width, height) {
            await page.setViewportSize({ width, height });
        },
        async readProject() {
            const count = (await savedPickerEntries(page)).length;
            await chooseVisualizerProjectExport(page);
            await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
            return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
        },
        async importProject(p: unknown) {
            await queuePickerData(page, [
                { name: 'layers.json', mimeType: 'application/json', text: JSON.stringify(p) },
            ]);
            await page.getByTestId('import-visualizer-project').click();
            await expect(page.getByTestId('import-visualizer-project')).toHaveAttribute('aria-busy', 'false');
            await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
        },
        async screenshot(name: string) {
            await page.screenshot({ path: `${directory}/${info.project.name}-${name}.png` });
        },
        async saveVideo() {
            await page.getByTestId('save-visualizer-export').click();
            await expect(page.locator('[data-export-status=idle]')).toBeVisible();
            const entry = (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).at(-1)!;
            const file = path.resolve(
                'artifacts/visualizer-composition/output',
                `composition-movement-${info.project.name}.webm`,
            );
            await mkdir(path.dirname(file), { recursive: true });
            await writeFile(file, Buffer.from(entry.base64, 'base64'));
            return file;
        },
    });
    await writeFile(`${directory}/${info.project.name}-result.json`, JSON.stringify(result, null, 2), 'utf8');
    await writeMovementCapture(
        path.resolve('artifacts/visualizer-composition/output', `composition-movement-${info.project.name}.webm`),
        result,
        info.project.name,
        page.context().browser()!.version(),
    );
    expect(errors).toEqual([]);
});
