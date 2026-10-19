import { expect, test } from '@playwright/test';
import {
    prepareMarkerEditor,
    addMarkerLane,
    clickMarkerTime,
    markerSurface,
    seekMarkerEditor,
} from '../support/editor-marking';
import { openEditorWorkspace } from '../support/editor-workspaces';

test('marking has no outer padding, processing retains padding and BPM columns share the available width', async ({
    page,
}) => {
    await prepareMarkerEditor(page);
    for (const width of [390, 1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await openEditorWorkspace(page, 'marking');
        await expect(page.locator('.editor-shell')).toHaveCSS('padding', '0px');
        await page.getByTestId('toggle-editor-timing').click();
        const metrics = await page.getByTestId('editor-timing-panel').evaluate(element => {
            const columns = ['.timing-list', '.timing-assistant', '.tap-controls'].map(selector =>
                element.querySelector(selector)!.getBoundingClientRect(),
            );
            const row = element.querySelector('.timing-row')!.getBoundingClientRect();
            const seek = element.querySelector('.timing-seek')!.getBoundingClientRect();
            return {
                widths: columns.map(rect => rect.width),
                tops: columns.map(rect => rect.top),
                gap: row.right - seek.right,
                available: document.getElementById('editor-marking-panel')!.clientWidth,
            };
        });
        expect(Math.max(...metrics.widths) - Math.min(...metrics.widths)).toBeLessThanOrEqual(1);
        if (metrics.available >= 760)
            expect(Math.max(...metrics.tops) - Math.min(...metrics.tops)).toBeLessThanOrEqual(1);
        else expect(metrics.tops[2]).toBeGreaterThan(metrics.tops[1]!);
        expect(metrics.gap).toBeGreaterThanOrEqual(8);
        await page.screenshot({ path: `artifacts/editor-marking/workspace-controls-${width}.png` });
        await page.getByTestId('toggle-editor-timing').click();
        for (const workspace of ['separation', 'transcription'] as const) {
            await openEditorWorkspace(page, workspace);
            await expect(page.locator('.editor-shell')).toHaveCSS('padding', width <= 600 ? '12px' : '16px');
        }
    }
});

test('paused marker operations work inside the retained left mask', async ({ page }) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await addMarkerLane(page, 'range');
    await seekMarkerEditor(page, 2);
    const point = markerSurface(page, 'point'),
        range = markerSurface(page, 'range');
    const mask = await point.evaluate(element => getComputedStyle(element, '::before').backgroundColor);
    expect(mask).not.toBe('rgba(0, 0, 0, 0)');
    await clickMarkerTime(point, 1.5);
    const marker = page.locator('[data-testid^="point-marker-"]').first();
    await marker.focus();
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(marker).toHaveAttribute('data-time-seconds', '1.375');
    await clickMarkerTime(range, 0.75);
    await clickMarkerTime(range, 1.25);
    const block = page.locator('[data-testid^="range-marker-"]').first();
    const start = page.locator('[data-testid^="range-start-handle-"]').first();
    await start.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(block).toHaveAttribute('data-start-seconds', '0.625');
    await clickMarkerTime(point, 1.375, 'right');
    await expect(marker).toHaveCount(0);
    await block.focus();
    await page.keyboard.press('Delete');
    await expect(block).toHaveCount(0);
    await seekMarkerEditor(page, 0);
    await clickMarkerTime(point, -0.1);
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(0);
    expect(await point.evaluate(element => getComputedStyle(element, '::before').backgroundColor)).toBe(mask);
});

test('BPM calculator estimates after two taps, stays independent of playback and applies explicitly', async ({
    page,
}) => {
    await prepareMarkerEditor(page);
    await page.getByTestId('toggle-editor-timing').click();
    await expect(page.getByRole('heading', { name: 'bpm测算', exact: true })).toBeVisible();
    await page.evaluate(() => {
        const original = performance.now.bind(performance);
        let time = 10000;
        performance.now = () => time;
        try {
            document.querySelector<HTMLButtonElement>('[data-testid="timing-tap"]')!.click();
            time += 600;
            document.querySelector<HTMLButtonElement>('[data-testid="timing-tap"]')!.click();
        } finally {
            performance.now = original;
        }
    });
    await expect(page.getByTestId('timing-tap-preview')).toHaveText('100 BPM');
    await expect(page.getByRole('spinbutton', { name: '辅助 BPM', exact: true })).toHaveValue('120');
    await page.getByTestId('toggle-playback').click();
    await expect(page.getByTestId('timing-tap-preview')).toHaveText('100 BPM');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('timing-apply-tap').click();
    await expect(page.getByRole('spinbutton', { name: '辅助 BPM', exact: true })).toHaveValue('100');
    await page.getByTestId('toggle-editor-timing').click();
    await page.getByTestId('toggle-editor-timing').click();
    await expect(page.getByTestId('timing-tap-preview')).toHaveText('点按开始测算');
});

test('BPM controls omit meter without changing the left beat subdivision', async ({ page }) => {
    await prepareMarkerEditor(page);
    await page.getByTestId('toggle-editor-timing').click();
    await expect(page.getByLabel(/拍号/)).toHaveCount(0);
    await expect(page.locator('.meter-inputs,.meter-fields,.beat-phase')).toHaveCount(0);
    await expect(page.getByTestId('editor-beat-divisor')).toHaveAttribute('data-divisor', '4');
    await page.getByRole('spinbutton', { name: '辅助 BPM', exact: true }).fill('127.5');
    await page.getByRole('spinbutton', { name: '辅助 BPM', exact: true }).press('Enter');
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('127.5');
    await expect(page.getByTestId('editor-tempo-lane')).not.toContainText('4/4');
    await expect(page.locator('.timing-select')).not.toContainText('4/4');
});
