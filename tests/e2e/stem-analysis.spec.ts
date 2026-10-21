import { test, expect } from '@playwright/test';
import { prepareMarkerEditor } from '../support/editor-marking';
import { captureSeparation, seedStemResult, chooseOverlay } from '../support/stem-analysis';

test('verified stems appear in Analyzer and Cascader, keep independent queues and restore references', async ({
    page,
}) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await captureSeparation(page);
    await prepareMarkerEditor(page);
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await expect(page.getByTestId('editor-overlay-feature-menu').locator('[data-source]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await seedStemResult(page);
    await chooseOverlay(page, 'energy', 'drums');
    const panel = page.getByTestId('editor-analysis-overlay-panel');
    await expect(panel).toHaveAttribute('data-analysis-state', 'ready', { timeout: 30000 });
    await expect(panel).toContainText('drums');
    await expect(page.getByTestId('editor-overlay-exact-summary')).not.toContainText('等待精确值');
    const drumEnergy = await page.getByTestId('editor-overlay-exact-summary').textContent();
    await chooseOverlay(page, 'energy', 'vocals');
    await expect(panel).toHaveAttribute('data-analysis-state', 'ready');
    await expect.poll(() => page.getByTestId('editor-overlay-exact-summary').textContent()).not.toBe(drumEnergy);
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(panel).toContainText('vocals');
    await expect(panel).toHaveAttribute('data-analysis-state', 'ready', { timeout: 30000 });
    await page.goto('/analyzer');
    const sources = page.getByTestId('analyzer-sources');
    await expect(sources.locator('button')).toHaveCount(5, { timeout: 30000 });
    await sources.locator('[data-source="drums"]').click();
    await expect(page.locator('[data-testid^="analyzer-card-"]')).toHaveCount(4);
    await page.getByTestId('analyzer-card-energy').locator('.toggle-card').click();
    await expect(page.getByTestId('analyzer-card-energy')).toContainText('精确值', { timeout: 30000 });
    await sources.locator('[data-source="bass"]').click();
    await expect(page.getByTestId('analyzer-pinned')).toBeHidden();
    await page.getByTestId('analyzer-card-buffer').locator('.toggle-card').click();
    await sources.locator('[data-source="drums"]').click();
    await expect(page.getByTestId('analyzer-pinned').locator('[data-feature-id="energy"]')).toBeVisible();
    await expect(page.getByTestId('analyzer-pinned').locator('[data-feature-id="buffer"]')).toHaveCount(0);
    for (const width of [390, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        const r = await sources.boundingBox();
        expect(r!.x).toBeGreaterThanOrEqual(0);
        expect(r!.x + r!.width).toBeLessThanOrEqual(width);
    }
    await page.reload();
    await expect(sources.locator('[data-source="drums"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
    const requests = await page.evaluate(
        () => Reflect.get(window, '__stemRequests') as Array<{ role: string; ids: string[] }>,
    );
    expect(requests.filter(r => r.role !== 'drums' && r.ids.length)).toEqual([]);
    expect(errors).toEqual([]);
});
