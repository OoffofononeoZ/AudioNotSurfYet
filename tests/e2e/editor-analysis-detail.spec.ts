import { expect, test } from '@playwright/test';
import { prepareMarkerEditor, addMarkerLane } from '../support/editor-marking';

async function instrumentWindows(page: import('@playwright/test').Page) {
    await page.addInitScript(() => {
        const requests: Array<{ kind: string; featureId: string; waveformBucketSamples: number }> = [];
        Reflect.set(window, '__detailRequests', requests);
        const original = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function (message, options?: StructuredSerializeOptions | Transferable[]) {
            if (message?.kind === 'window-series') {
                requests.push(message);
                if (Reflect.get(window, '__holdDetail')) {
                    const delayed = Reflect.get(window, '__delayedDetails') ?? [];
                    delayed.push(() => Reflect.apply(original, this, [message, options]));
                    Reflect.set(window, '__delayedDetails', delayed);
                    return;
                }
            }
            return Reflect.apply(original, this, [message, options]);
        };
    });
}

test('both waveforms refine automatically and continuous zoom only requests its final detail level', async ({
    page,
}) => {
    await instrumentWindows(page);
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    const wave = page.locator('.editor-timeline-panel');
    await expect.poll(async () => Number(await wave.getAttribute('data-sample-step')) || Infinity).toBeLessThan(0.04);
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await page.getByTestId('editor-overlay-feature-menu').locator('[data-source="original"]').click();
    await page.locator('[data-feature-id="buffer"]').click();
    const panel = page.getByTestId('editor-analysis-overlay-panel');
    await expect.poll(async () => Number(await panel.getAttribute('data-sample-step')) || Infinity).toBeLessThan(0.04);
    const before = Number(await panel.getAttribute('data-sample-step'));
    await page.evaluate(async () => {
        Reflect.get(window, '__detailRequests').length = 0;
        const ruler = document.querySelector('.marker-ruler-time')!;
        for (let i = 0; i < 10; i++) {
            ruler.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }));
            await new Promise(resolve => setTimeout(resolve, 35));
        }
    });
    expect(await page.evaluate(() => Reflect.get(window, '__detailRequests').length)).toBe(0);
    await expect
        .poll(async () => Number(await panel.getAttribute('data-sample-step')) || Infinity)
        .toBeLessThan(before);
    expect(await page.evaluate(() => Reflect.get(window, '__detailRequests').length)).toBe(1);
    const topBefore = Number(await wave.getAttribute('data-sample-step'));
    await page.evaluate(async () => {
        Reflect.get(window, '__detailRequests').length = 0;
        const stage = document.querySelector('[data-testid="editor-timeline"]')!;
        for (let i = 0; i < 10; i++) {
            stage.dispatchEvent(
                new WheelEvent('wheel', {
                    bubbles: true,
                    cancelable: true,
                    deltaY: -100,
                    clientX: stage.getBoundingClientRect().left + 100,
                }),
            );
            await new Promise(resolve => setTimeout(resolve, 35));
        }
    });
    expect(await page.evaluate(() => Reflect.get(window, '__detailRequests').length)).toBe(0);
    await expect
        .poll(async () => Number(await wave.getAttribute('data-sample-step')) || Infinity)
        .toBeLessThan(topBefore);
    expect(await page.evaluate(() => Reflect.get(window, '__detailRequests').length)).toBe(1);
    await expect(panel).toHaveAttribute('data-renderer-error', 'false');
});

test('high-DPR responsive plots keep alignment and late detail cannot survive leaving Editor', async ({
    browser,
    baseURL,
}) => {
    const context = await browser.newContext({ baseURL, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await instrumentWindows(page);
        await prepareMarkerEditor(page);
        await addMarkerLane(page, 'point');
        await page.getByTestId('editor-overlay-menu-toggle').click();
        await page.getByTestId('editor-overlay-feature-menu').locator('[data-source="original"]').click();
        await page.locator('[data-feature-id="amplitudeSpectrum"]').click();
        const panel = page.getByTestId('editor-analysis-overlay-panel');
        for (const width of [1440, 1024, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await expect
                .poll(async () => Number(await panel.getAttribute('data-sample-step')))
                .toBeCloseTo(512 / 48000, 7);
            await expect(panel).toHaveAttribute('data-renderer-error', 'false');
            const geometry = await page.evaluate(() => {
                const ruler = document.querySelector('.marker-ruler-time')!.getBoundingClientRect();
                const panel = document
                    .querySelector('[data-testid="editor-analysis-overlay-panel"]')!
                    .getBoundingClientRect();
                const canvas = document.querySelector('canvas.overlay-canvas.static') as HTMLCanvasElement;
                return {
                    delta: Math.max(Math.abs(ruler.left - panel.left), Math.abs(ruler.width - panel.width)),
                    backing: canvas.width,
                    expected: innerWidth * devicePixelRatio,
                };
            });
            expect(geometry.delta).toBeLessThanOrEqual(1);
            expect(geometry.backing).toBe(geometry.expected);
            await page.screenshot({ path: `artifacts/editor-marking/analysis-detail-${width}.png` });
        }
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.evaluate(() => Reflect.set(window, '__holdDetail', true));
        await page.getByTestId('editor-overlay-menu-toggle').click();
        await page.locator('[data-feature-id="rms"]').click();
        await expect
            .poll(() => page.evaluate(() => Reflect.get(window, '__delayedDetails')?.length ?? 0))
            .toBeGreaterThan(0);
        await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
        if (await page.getByTestId('editor-leave-dialog').isVisible())
            await page.getByTestId('editor-leave-confirm').click();
        await expect(page).toHaveURL(/analyzer$/);
        await expect(page.locator('canvas.overlay-canvas')).toHaveCount(0);
        await page.evaluate(() => {
            Reflect.set(window, '__holdDetail', false);
            for (const release of Reflect.get(window, '__delayedDetails')) release();
        });
        await page.getByTestId('header-editor-link').click();
        await expect(page.getByTestId('editor-ready')).toBeVisible();
        await expect(panel).toHaveAttribute('data-feature-id', 'rms');
        await expect.poll(async () => Number(await panel.getAttribute('data-sample-step'))).toBeCloseTo(512 / 48000, 7);
        expect(errors).toEqual([]);
        await page.reload();
        await expect(page.getByTestId('editor-ready')).toBeVisible();
        await expect.poll(async () => Number(await panel.getAttribute('data-sample-step'))).toBeCloseTo(512 / 48000, 7);
    } finally {
        await context.close();
    }
});

test('native feature precision stays bounded and playing windows prefetch instead of recomputing each frame', async ({
    page,
}) => {
    await instrumentWindows(page);
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await page.evaluate(() => {
        const ruler = document.querySelector('.marker-ruler-time')!;
        for (let i = 0; i < 30; i++)
            ruler.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }));
    });
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await page.getByTestId('editor-overlay-feature-menu').locator('[data-source="original"]').click();
    await page.locator('[data-feature-id="amplitudeSpectrum"]').click();
    const panel = page.getByTestId('editor-analysis-overlay-panel');
    await expect.poll(async () => Number(await panel.getAttribute('data-sample-step'))).toBeCloseTo(512 / 48000, 7);
    await page.evaluate(() => {
        Reflect.get(window, '__detailRequests').length = 0;
    });
    await page.getByTestId('toggle-playback').click();
    await expect
        .poll(async () => Number(await page.getByTestId('marker-ruler-time').getAttribute('data-cursor-seconds')))
        .toBeGreaterThan(2.5);
    await page.getByTestId('toggle-playback').click();
    const count = await page.evaluate(
        () =>
            Reflect.get(window, '__detailRequests').filter(
                (r: { featureId: string }) => r.featureId === 'amplitudeSpectrum',
            ).length,
    );
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
    await expect(panel).toHaveAttribute('data-detail-pending', 'false');
    await expect.poll(async () => Number(await panel.getAttribute('data-sample-step'))).toBeCloseTo(512 / 48000, 7);
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await page.locator('[data-feature-id="wallpaperEngineSpectrum"]').click();
    await expect.poll(async () => Number(await panel.getAttribute('data-sample-step'))).toBeCloseTo(1 / 30, 7);
    expect(
        await page.evaluate(
            () =>
                Reflect.get(window, '__detailRequests').filter(
                    (r: { featureId: string }) => r.featureId === 'wallpaperEngineSpectrum',
                ).length,
        ),
    ).toBe(0);
});

test('frequency image content preserves song padding and moves at the marker time scale', async ({ page }) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await page.getByTestId('editor-overlay-feature-menu').locator('[data-source="original"]').click();
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
