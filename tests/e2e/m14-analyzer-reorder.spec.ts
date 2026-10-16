import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { FEATURE_IDS } from '../../src/analysis/types';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { expectAnalyzerList, readAnalyzerViewport } from '../support/analyzer-list';

const fixture = path.resolve(import.meta.dirname, '../fixtures/audio/format-master.wav');
const expand = (page: Page, id: string) => page.locator('.original-list [data-feature-id="' + id + '"] .toggle-card').click();
const pinnedIds = (page: Page) => page.locator('.pinned-panel .analysis-card').evaluateAll(els => els.map(el => (el as HTMLElement).dataset.featureId));

test('pins newest first, restores default positions, and preserves the original reading anchor', async ({ page }) => {
    await page.goto('/analyzer');
    const original = page.locator('.original-list');
    await original.evaluate(el => { el.scrollTop = 420; });
    const visible = await original.evaluate(el => {
        const top = el.getBoundingClientRect().top;
        const rows = [...el.querySelectorAll<HTMLElement>('.analysis-card')];
        const source = rows.find(row => row.getBoundingClientRect().top >= top)!;
        const anchor = rows.find(row => row !== source && row.getBoundingClientRect().bottom > top)!;
        return { source: source.dataset.featureId!, anchor: anchor.dataset.featureId!,
            offset: anchor.getBoundingClientRect().top - top };
    });
    await expand(page, visible.source);
    await expect.poll(async () => original.locator('[data-feature-id="' + visible.anchor + '"]').evaluate(el =>
        el.getBoundingClientRect().top - el.parentElement!.getBoundingClientRect().top)).toBeCloseTo(visible.offset, 0);
    await page.locator('.pinned-panel .toggle-card').click();
    for (const id of FEATURE_IDS.slice(0, 5)) await expand(page, id);
    expect(await pinnedIds(page)).toEqual([...FEATURE_IDS.slice(1, 5)].reverse());
    await expect(page.locator('.pinned-panel .toggle-card').first()).toBeFocused();
    const originals = await original.locator('.analysis-card').evaluateAll(els => els.map(el => (el as HTMLElement).dataset.featureId));
    expect(originals).toEqual(FEATURE_IDS.filter(id => !FEATURE_IDS.slice(1, 5).includes(id)));
    await page.locator('.pinned-panel [data-feature-id="' + FEATURE_IDS[1] + '"] .toggle-card').click();
    await expand(page, FEATURE_IDS[0]);
    expect(await pinnedIds(page)).toEqual([FEATURE_IDS[0], ...FEATURE_IDS.slice(2, 5).reverse()]);
    await expect(page.locator('.plot canvas')).toHaveCount(8);
    await expectAnalyzerList(page, 1280);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-persistence-state', 'ready');
    const beforeReload = await pinnedIds(page);
    await page.reload();
    await expect.poll(() => pinnedIds(page)).toEqual(beforeReload);
    await expect(page.locator('.description-toggle[aria-expanded="true"]')).toHaveCount(0);
});

test('drags between forty percent and full height, supports cancellation, and caps short content', async ({ page }) => {
    await page.goto('/analyzer');
    for (const id of FEATURE_IDS.slice(0, 4)) await expand(page, id);
    const panel = page.locator('.pinned-panel');
    const handle = page.getByTestId('analyzer-height-handle');
    const height = () => panel.evaluate(el => el.getBoundingClientRect().height);
    const available = () => page.getByTestId('analyzer-workspace').evaluate(el => el.clientHeight);
    await expect(handle).toHaveAttribute('aria-valuenow', '60');
    const pos = (await handle.boundingBox())!;
    await page.mouse.move(pos.x + pos.width / 2, pos.y + pos.height / 2);
    await page.mouse.down();
    await page.mouse.move(pos.x + pos.width / 2, pos.y - 500);
    await expect(handle).toHaveAttribute('aria-valuenow', '40');
    await page.mouse.move(pos.x + pos.width / 2, pos.y + 700);
    await expect(handle).toHaveAttribute('aria-valuenow', '100');
    await page.mouse.up();
    expect(await height()).toBeCloseTo(await available(), 0);
    await expect(page.locator('.original-list')).toHaveAttribute('inert', '');
    await handle.focus();
    await page.keyboard.press('Home');
    await expect(handle).toHaveAttribute('aria-valuenow', '40');
    await page.keyboard.press('ArrowDown');
    await expect(handle).toHaveAttribute('aria-valuenow', '45');
    const before = await height();
    const start = (await handle.boundingBox())!;
    await page.mouse.move(start.x + 100, start.y + 12);
    await page.mouse.down();
    await page.mouse.move(start.x + 100, start.y + 120);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await height()).toBeCloseTo(before, 0);
    await handle.evaluate(el => el.addEventListener('pointerdown', event => {
        (el as HTMLElement).dataset.pointerId = String((event as PointerEvent).pointerId);
    }, { once: true }));
    const cancelStart = (await handle.boundingBox())!;
    await page.mouse.move(cancelStart.x + 100, cancelStart.y + 12);
    await page.mouse.down();
    await page.mouse.move(cancelStart.x + 100, cancelStart.y + 80);
    const pointerId = Number(await handle.getAttribute('data-pointer-id'));
    await handle.dispatchEvent('pointercancel', { pointerId: pointerId + 1 });
    expect(await height()).toBeGreaterThan(before);
    await handle.dispatchEvent('pointercancel', { pointerId });
    await page.mouse.up();
    expect(await height()).toBeCloseTo(before, 0);
    await handle.focus();
    await page.keyboard.press('End');
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(height).toBeCloseTo(await available(), 0);
    await handle.press('Home');
    for (const id of FEATURE_IDS.slice(0, 4)) await page.locator('.pinned-panel [data-feature-id="' + id + '"] .toggle-card').click();
    await expect(panel).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 1800 });
    await expand(page, 'rms');
    await expect(handle).toBeDisabled();
    const natural = await page.locator('.pinned-panel .feature-list').evaluate(el => el.getBoundingClientRect().height);
    expect(await height()).toBeCloseTo(natural + 24, 0);
    expect(await height()).toBeLessThan((await available()) * 0.4);
});

test('zooms all plots at the pointer while preserving normal scrolling outside plots', async ({ page }) => {
    test.setTimeout(60000);
    await installFilePickerStub(page);
    await page.goto('/analyzer');
    await chooseFiles(page, [fixture]);
    await expand(page, 'rms');
    await expand(page, 'energy');
    await expect(page.locator('.plot-message')).toHaveCount(0, { timeout: 45000 });
    const plot = page.locator('.plot').first();
    const before = await readAnalyzerViewport(page);
    const rect = (await plot.boundingBox())!;
    const x = rect.width * 0.3;
    await plot.evaluate(el => el.addEventListener('wheel', event => {
        (el as HTMLElement).dataset.testWheelX = String((event as WheelEvent).clientX);
    }, {once:true}));
    await page.mouse.move(rect.x + x, rect.y + 60);
    await page.mouse.wheel(0, -120);
    await expect(plot).toHaveAttribute('data-zoom', '1.12');
    const after = await readAnalyzerViewport(page);
    const ratio = (Number(await plot.getAttribute('data-test-wheel-x')) - rect.x) / rect.width;
    const anchor = before.start + (before.end - before.start) * ratio;
    expect(after.start + (after.end - after.start) * ratio).toBeCloseTo(anchor, 5);
    expect(await page.locator('.plot').evaluateAll(els => els.map(el => ({
        zoom: (el as HTMLElement).dataset.zoom, start: (el as HTMLElement).dataset.start, end: (el as HTMLElement).dataset.end,
    })))).toEqual(Array(2).fill({ zoom: String(after.zoom), start: String(after.start), end: String(after.end) }));
    const original = page.locator('.original-list');
    await original.evaluate(el => { el.scrollTop = 0; });
    await original.hover({position:{x:100,y:10}});
    await page.mouse.wheel(0, 250);
    await expect.poll(() => original.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await readAnalyzerViewport(page)).toEqual(after);
    await plot.evaluate(el => {
        const rect = el.getBoundingClientRect();
        for (let i = 0; i < 70; i++) el.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: rect.x + rect.width / 2, bubbles: true, cancelable: true }));
    });
    await expect(plot).toHaveAttribute('data-zoom', '64');
    await plot.evaluate(el => {
        const rect = el.getBoundingClientRect();
        for (let i = 0; i < 70; i++) el.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, clientX: rect.x + rect.width / 2, bubbles: true, cancelable: true }));
    });
    await expect(plot).toHaveAttribute('data-zoom', '1');
    await page.mouse.move(rect.x + x, rect.y + 60);
    await page.mouse.wheel(0, -120);
    await expect(plot).toHaveAttribute('data-zoom', '1.12');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-persistence-state', 'ready');
    const persisted = await readAnalyzerViewport(page);
    await page.reload();
    await expect.poll(() => readAnalyzerViewport(page)).toEqual(persisted);
    const currentPlot = page.locator('.plot').first();
    await currentPlot.click({ position: { x: 100, y: 50 } });
    await expect.poll(() => page.locator('#music-bar-container').getAttribute('data-current-time').then(Number)).toBeGreaterThan(0);
    await currentPlot.focus();
    await page.keyboard.press('Home');
    await expect.poll(() => page.locator('#music-bar-container').getAttribute('data-current-time').then(Number)).toBeLessThan(0.1);
});
