import { expect, test } from '@playwright/test';
import { addMarkerLane, clickMarkerTime, markerSurface, prepareMarkerEditor } from '../support/editor-marking';
import { FEATURE_IDS } from '../../src/analysis/types';

test('compact hierarchy keeps beats visible while marker rows scroll independently', async ({ page }) => {
    await prepareMarkerEditor(page);
    for (let i = 0; i < 14; i++) await addMarkerLane(page, i % 2 ? 'range' : 'point');
    const top = (await page.getByTestId('editor-timeline').boundingBox())!.y;
    await page.locator('.marker-scroll').evaluate(element => (element.scrollTop = element.scrollHeight));
    await expect.poll(() => page.locator('.marker-scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect((await page.getByTestId('editor-timeline').boundingBox())!.y).toBe(top);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByTestId('editor-toolbar')).toHaveCSS('height', '64px');
    await page.locator('.marker-scroll').evaluate(element => (element.scrollTop = 0));
    await expect(page.locator('.marker-lane-heading').first()).toHaveCSS('height', '36px');
    await expect(markerSurface(page, 'point')).toHaveCSS('height', '48px');
});

test('fullscreen overlay retains all features and handles, allows pointer-through and saves only visibility preferences', async ({
    page,
}) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await page.getByTestId('editor-overlay-toggle').click();
    const menu = page.getByTestId('editor-overlay-feature-menu');
    await menu.locator('[data-source="original"]').click();
    await expect(menu.locator('[data-feature-id]')).toHaveCount(FEATURE_IDS.length);
    await menu.locator('[data-feature-id="rms"]').click();
    const panel = page.getByTestId('editor-analysis-overlay-panel');
    await expect(panel).toHaveAttribute('data-analysis-state', 'ready');
    for (const handle of ['top', 'move', 'bottom'])
        await expect(page.getByTestId(`editor-overlay-handle-${handle}`)).toBeVisible();
    const host = page.getByTestId('editor-analysis-overlay-host');
    await expect(host).toHaveCSS('position', 'fixed');
    await expect(host).toHaveCSS('pointer-events', 'none');
    await clickMarkerTime(markerSurface(page, 'point'), 2);
    await expect(page.locator('.marker-point')).toHaveCount(1);
    await page.getByTestId('editor-overlay-toggle').click();
    await expect(panel).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(panel).toHaveCount(0);
    await expect(page.locator('.marker-point')).toHaveCount(1);
});
