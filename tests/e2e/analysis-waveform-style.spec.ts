import { expect, test } from '@playwright/test';
import { FEATURE_IDS } from '../../src/analysis/types';
import { FEATURE_REGISTRY } from '../../src/analysis/featureRegistry';
import { prepareMarkerEditor, addMarkerLane } from '../support/editor-marking';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { chooseOverlay } from '../support/stem-analysis';
import { verifyWaveformPixels } from '../support/waveform-pixels.mjs';
import path from 'node:path';

test('draws every scalar and buffer as green waveform columns in Analyzer', async ({ page }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await installFilePickerStub(page);
    await page.goto('/analyzer');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/format-master.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    const ids = FEATURE_IDS.filter(id => FEATURE_REGISTRY[id].outputShape === 'scalar' || id === 'buffer');
    expect(ids).toHaveLength(15);
    for (const id of ids) {
        await page.locator(`.original-list [data-feature-id="${id}"] .toggle-card`).click();
        const selector = `.pinned-panel [data-feature-id="${id}"] .plot`;
        await expect(page.locator(`${selector} .plot-message`)).toHaveCount(0, { timeout: 30000 });
        await expect(async () => {
            await verifyWaveformPixels(
                page,
                `${selector} canvas`,
                !FEATURE_REGISTRY[id].range.signed && id !== 'buffer',
            );
        }).toPass({ timeout: 5000 });
        expect(await page.locator(selector).evaluate(el => getComputedStyle(el).borderRadius)).toBe('0px');
        if (id === 'rms' || id === 'buffer')
            await page.locator(selector).screenshot({ path: `test-results/waveform-${id}-${info.project.name}.png` });
    }
    expect(errors).toEqual([]);
});

test('uses the same waveform in the aligned Editor overlay at responsive sizes', async ({ page }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    for (const id of ['rms', 'spectralSlope', 'buffer']) {
        await chooseOverlay(page, id);
        const panel = page.getByTestId('editor-analysis-overlay-panel');
        await expect(panel).toHaveAttribute('data-analysis-state', 'ready');
        for (const width of [390, 1280, 1920]) {
            await page.setViewportSize({ width, height: 1000 });
            await expect(async () => {
                await verifyWaveformPixels(
                    page,
                    'canvas.overlay-canvas.static',
                    id === 'rms',
                    '[data-testid="editor-analysis-overlay-panel"]',
                );
            }).toPass({ timeout: 5000 });
            await expect(panel).toHaveAttribute('data-renderer-error', 'false');
            if (id === 'rms' && width === 1280)
                await page.screenshot({ path: `test-results/waveform-overlay-${info.project.name}.png` });
        }
    }
    expect(errors).toEqual([]);
});
