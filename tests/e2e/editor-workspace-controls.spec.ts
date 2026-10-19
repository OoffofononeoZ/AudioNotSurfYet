import { expect, test } from '@playwright/test';
import { prepareMarkerEditor } from '../support/editor-marking';
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
