import { expect, test } from '@playwright/test';
import { prepareMarkerEditor, addMarkerLane } from '../support/editor-marking';

test('frequency image content preserves song padding and moves at the marker time scale', async ({ page }) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await page.locator('[data-feature-id="amplitudeSpectrum"]').click();
    const panel = page.getByTestId('editor-analysis-overlay-panel');
    await expect(panel).toHaveAttribute('data-analysis-state', 'ready');
    async function firstColumn() {
        return page.evaluate(() => {
            const ruler = document.querySelector('.marker-ruler-time')!.getBoundingClientRect();
            const panel = document
                .querySelector('[data-testid="editor-analysis-overlay-panel"]')!
                .getBoundingClientRect();
            const canvas = document.querySelector('canvas.overlay-canvas.static') as HTMLCanvasElement;
            const context = canvas.getContext('2d')!;
            const dpr = window.devicePixelRatio;
            const y = Math.round((panel.top + panel.height * 0.3) * dpr);
            for (let x = 0; x < ruler.width; x++) {
                const pixel = context.getImageData(Math.round((ruler.left + x) * dpr), y, 1, 1).data;
                // The heatmap's dark-green zero cell is distinct from its background and grid.
                if (pixel[1]! > 30 && pixel[1]! > pixel[0]! * 2) return x / ruler.width;
            }
            return -1;
        });
    }
    await expect.poll(firstColumn).toBeCloseTo(0.15, 2);
    await page.getByTestId('editor-timeline').press('ArrowRight');
    await expect(page.getByTestId('marker-ruler-time')).toHaveAttribute('data-cursor-seconds', '1');
    await expect.poll(firstColumn).toBeCloseTo(0.05, 2);
    await page.getByTestId('editor-timeline').press('End');
    await expect(panel).toHaveAttribute('data-renderer-error', 'false');
});
