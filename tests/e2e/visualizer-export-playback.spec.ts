import { chooseVisualizerProjectExport } from '../support/project-actions';
import '../setup-visualizer-resources';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { getVisualizerExportPreset } from '../../src/visualizer/exportPresets';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';
import type { VisualizerSessionController } from '../../src/visualizer/visualizerSessionController';
import type { VisualizerExportSessionOptions } from '../../src/visualizer/visualizerExportSession';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import { createOutputSyncWav, OUTPUT_SYNC_EVENTS, OUTPUT_SYNC_FLASH_SECONDS } from '../support/visualizer-output-sync';

const root = 'artifacts/visualizer-composition/output';

async function observeExport(page: Page) {
    // Use the existing injected session and export runner; no production diagnostics API is added.
    await page.getByTestId('visualizer-ready').evaluate(async node => {
        const provides = (
            node as HTMLElement & {
                __vueParentComponent: { provides: Record<symbol, VisualizerSessionController> };
            }
        ).__vueParentComponent.provides;
        const modulePath = '/src/visualizer/visualizerSessionController.ts';
        const { visualizerSessionControllerKey } = await import(modulePath);
        const controller = provides[visualizerSessionControllerKey]!;
        const runtime = (controller as unknown as { exporter: { options: VisualizerExportSessionOptions } }).exporter
            .options;
        const exportPath = '/src/visualizer/offlineExport.ts';
        const { runOfflineExport } = await import(exportPath);
        runtime.runExport = options => {
            const hashes: string[] = [];
            (window as unknown as { playbackExportHashes: string[] }).playbackExportHashes = hashes;
            return runOfflineExport({
                ...options,
                renderFrame: async (time: number) => {
                    await options.renderFrame(time);
                    hashes.push(options.canvas.dataset.frameStateHash!);
                },
                // Keep a real encoded job active long enough to exercise controls and a natural loop.
                yieldControl: () => new Promise<void>(resolve => setTimeout(resolve, 30)),
            });
        };
    });
}

test('same-track controls and looping preserve deterministic export; finishing and cancelling keep the latest playback', async ({
    page,
}, info) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await mkdir(root, { recursive: true });
    const audioFile = path.resolve(root, `playback-source-${info.project.name}.wav`);
    await writeFile(audioFile, createOutputSyncWav());
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [audioFile]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    let project: VisualizerProjectV6 = JSON.parse(
        Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'),
    );
    project.output = { aspectRatio: '16:9', resolution: '720p', frameRate: 30, audioVideoOffsetMs: 0 };
    const native = elementRegistry.create('wireform', project.track.durationSeconds, 0);
    if (native.seed !== undefined) native.seed = 123;
    const background = elementRegistry.create('solid', project.track.durationSeconds, 1);
    background.bindings.find(b => b.parameterId === 'color')!.source = { kind: 'constant', value: '#000000' };
    const flashes = OUTPUT_SYNC_EVENTS.map((time, i) => {
        const flash = elementRegistry.create('solid', project.track.durationSeconds, i + 2);
        flash.bindings.find(b => b.parameterId === 'color')!.source = { kind: 'constant', value: '#ffffff' };
        flash.timing = { kind: 'manual', startSeconds: time, endSeconds: time + OUTPUT_SYNC_FLASH_SECONDS };
        return flash;
    });
    project = appendStandaloneElements(project, [native, background, ...flashes]);
    await queuePickerData(page, [
        { name: 'playback.json', mimeType: 'application/json', text: JSON.stringify(project) },
    ]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    await observeExport(page);
    const bar = page.locator('#music-bar-container');
    const progress = page.getByRole('slider', { name: '播放进度', exact: true });
    const canvas = page.getByTestId('visualizer-preview-canvas');
    const hashes: string[][] = [];
    const start = async () => {
        await page.getByTestId('visualizer-preview-frame').hover();
        await page.getByTestId('start-visualizer-export').click();
        await expect(canvas).toHaveAttribute('data-export-active', 'true');
    };
    for (const scenario of ['paused', 'controls'] as const) {
        if (scenario === 'controls') await page.getByTestId('toggle-playback').click();
        await start();
        await expect(bar).toHaveAttribute('data-playback-state', scenario === 'paused' ? 'paused' : 'playing');
        await expect(progress).toHaveAttribute('aria-disabled', 'false');
        await expect(page.getByTestId('import-audio')).toBeDisabled();
        await expect(page.getByTestId('add-visualizer-element')).toBeDisabled();
        if (scenario === 'controls') {
            await expect.poll(async () => Number(await bar.getAttribute('data-current-time'))).toBeGreaterThan(0.1);
            await page.getByTestId('next-track').click();
            await page.getByTestId('previous-track').click();
            const rect = (await progress.boundingBox())!;
            await progress.click({ position: { x: rect.width * 0.92, y: rect.height / 2 } });
            await expect.poll(async () => Number(await bar.getAttribute('data-current-time'))).toBeGreaterThan(10);
            await expect.poll(async () => Number(await bar.getAttribute('data-current-time'))).toBeLessThan(2);
            await expect(canvas).toHaveAttribute('data-export-active', 'true');
            await page.getByTestId('toggle-playback').click();
            await page.getByTestId('playback-speed').click();
            await page.getByRole('slider', { name: '播放速度', exact: true }).fill('0.5');
            await page.getByRole('slider', { name: '播放速度', exact: true }).dispatchEvent('input');
            await page.keyboard.press('Escape');
            await progress.press('Home');
            await progress.press('ArrowRight');
            await expect(bar).toHaveAttribute('data-current-time', '5');
            await expect(bar).toHaveAttribute('data-playback-rate', '0.5');
            await page.getByRole('tab', { name: '状态', exact: true }).click();
            await page
                .locator('.viz-bottom')
                .screenshot({ path: `artifacts/visualizer-composition/export-live-${info.project.name}.png` });
        }
        const position = await bar.getAttribute('data-current-time');
        await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 90000 });
        await expect(bar).toHaveAttribute('data-playback-state', 'paused');
        await expect(bar).toHaveAttribute('data-current-time', position!);
        hashes.push(
            await page.evaluate(() => (window as unknown as { playbackExportHashes: string[] }).playbackExportHashes),
        );
        await page.getByTestId('save-visualizer-export').click();
        await expect(page.locator('[data-export-status=idle]')).toBeVisible();
        const saved = (await savedPickerEntries(page)).filter(entry => entry.name.endsWith('.webm')).at(-1)!;
        const file = `${root}/playback-decoupled-${info.project.name}-${scenario}.webm`;
        await writeFile(file, Buffer.from(saved.base64, 'base64'));
        await writeFile(
            file + '.capture.json',
            JSON.stringify(
                {
                    mode: 'offline',
                    browser: info.project.name,
                    browserVersion: page.context().browser()!.version(),
                    kind: 'sync',
                    scenario,
                    sourceDurationSeconds: project.track.durationSeconds,
                    preset: getVisualizerExportPreset('720p', 30),
                    syncEventsSeconds: OUTPUT_SYNC_EVENTS,
                    syncFlashSeconds: OUTPUT_SYNC_FLASH_SECONDS,
                },
                null,
                2,
            ),
        );
    }
    expect(hashes[0]).toHaveLength(360);
    expect(hashes[1]).toEqual(hashes[0]);
    await start();
    await progress.press('Home');
    await progress.press('ArrowRight');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('cancel-visualizer-export').click();
    await expect(canvas).not.toHaveAttribute('data-export-active', 'true');
    await expect(bar).toHaveAttribute('data-playback-state', 'paused');
    await expect(bar).toHaveAttribute('data-current-time', '5');
    await expect(bar).toHaveAttribute('data-playback-rate', '0.5');
    await expect(canvas).toHaveAttribute('data-frame-time', '5.000000');
    expect(errors).toEqual([]);
});
