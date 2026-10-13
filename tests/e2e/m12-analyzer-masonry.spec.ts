import { test, expect } from '@playwright/test';
import { FEATURE_IDS } from '../../src/analysis/types';
import { expectAnalyzerList } from '../support/analyzer-list';

test('shows one-column borderless rows and independently collapsible descriptions', async ({ page }) => {
    await page.goto('/analyzer');
    for (const width of [390, 1024, 1280, 1920]) {
        await expectAnalyzerList(page, width);
        const bounds = await page.locator('.analyzer-status').boundingBox();
        expect(bounds!.y).toBeGreaterThanOrEqual(64);
        await expect(page.getByTestId('app-settings')).toBeVisible();
    }
    await expect(page.locator('.timeline-toolbar, .reorder-handle')).toHaveCount(0);
    await expect(page.getByTestId('reset-feature-order')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 900 });
    const row = page.locator('[data-feature-id="amplitudeSpectrum"]');
    await row.scrollIntoViewIfNeeded();
    const description = row.locator('.description');
    const toggle = row.locator('.description-toggle');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(await description.evaluate(el => getComputedStyle(el).textOverflow)).toBe('ellipsis');
    const oneLine = (await description.boundingBox())!.height;
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect((await description.boundingBox())!.height).toBeGreaterThan(oneLine * 2);
    await expect(page.locator('.plot')).toHaveCount(0);
    await row.locator('.toggle-card').click();
    await expect(page.locator('.pinned-panel [data-feature-id="amplitudeSpectrum"] .description-toggle')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('.pinned-panel .toggle-card').click();
    await expect(page.locator('.original-list [data-feature-id="amplitudeSpectrum"] .description-toggle')).toHaveAttribute('aria-expanded', 'true');
    await page.setViewportSize({ width: 1920, height: 900 });
    await expect(page.locator('[data-feature-id="zcr"] .description-toggle')).toHaveCount(0);
    const style = await row.evaluate(el => ({
        border: getComputedStyle(el).borderTopWidth, shadow: getComputedStyle(el).boxShadow,
        line: getComputedStyle(el, '::after').backgroundImage,
    }));
    expect(style).toMatchObject({ border: '0px', shadow: 'none' });
    expect(style.line).toContain('linear-gradient');
});

test('isolates renderer failure and releases Analyzer observers across navigation', async ({ page }) => {
    const issues: string[] = [];
    page.on('pageerror', error => issues.push(error.message));
    await page.addInitScript(() => {
        const Native = window.ResizeObserver;
        let live = 0;
        window.ResizeObserver = class extends Native {
            private tracked = false;
            observe(el: Element, options?: ResizeObserverOptions) {
                if (!this.tracked && el.matches('.plot, .description-area, .analyzer-workspace, .feature-list')) {
                    this.tracked = true; live++;
                }
                super.observe(el, options);
            }
            disconnect() { if (this.tracked) { live--; this.tracked = false; } super.disconnect(); }
        };
        const getContext = HTMLCanvasElement.prototype.getContext;
        const state = { fail: true, live: () => live };
        (window as unknown as { __analyzerResources: typeof state }).__analyzerResources = state;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
            if (state.fail && this.closest('[data-feature-id="complexSpectrum"]')) return null;
            return getContext.apply(this, args);
        } as typeof getContext;
    });
    await page.goto('/analyzer');
    await page.locator('[data-feature-id="complexSpectrum"] .toggle-card').click();
    await expect(page.locator('.plot-error')).toBeVisible();
    await page.evaluate(() => { (window as unknown as { __analyzerResources: { fail: boolean } }).__analyzerResources.fail = false; });
    await page.locator('.plot-error button').click();
    await expect(page.locator('.plot-error')).toHaveCount(0);
    for (let cycle = 0; cycle < 10; cycle++) {
        await page.getByRole('link', { name: '首页', exact: true }).click();
        await expect.poll(() => page.evaluate(() => (window as unknown as { __analyzerResources: { live(): number } }).__analyzerResources.live())).toBe(0);
        await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
        await expect(page.locator('.analysis-card')).toHaveCount(FEATURE_IDS.length);
        await page.locator('.toggle-card').first().click();
    }
    await page.getByRole('link', { name: '首页', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __analyzerResources: { live(): number } }).__analyzerResources.live())).toBe(0);
    expect(issues).toEqual([]);
});
