import { expect, type Page } from '@playwright/test';
import { FEATURE_IDS } from '../../src/analysis/types';

export const readAnalyzerViewport = (page: Page) => page.locator('.plot').first().evaluate(el => ({
    start: Number((el as HTMLElement).dataset.start),
    end: Number((el as HTMLElement).dataset.end),
    zoom: Number((el as HTMLElement).dataset.zoom),
}));

export const zoomAnalyzer = async (page: Page, direction: 'in' | 'out' = 'in', steps = 6) => {
    const plot = page.locator('.plot').first();
    const initialZoom = Number(await plot.getAttribute('data-zoom'));
    await plot.hover({ position: { x: 100, y: 60 } });
    for (let i = 0; i < steps; i++) await page.mouse.wheel(0, direction === 'in' ? -120 : 120);
    await expect.poll(() => plot.getAttribute('data-zoom').then(Number)).toBeCloseTo(
        Math.max(1, Math.min(64, initialZoom * Math.pow(1.12, direction === 'in' ? steps : -steps))), 10);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-persistence-state', 'ready');
};

export const expectAnalyzerList = async (page: Page, width: number, height = 900) => {
    await page.setViewportSize({ width, height });
    const read = () => page.evaluate(() => {
        const regions = [...document.querySelectorAll<HTMLElement>('.pinned-scroll, .original-list')];
        if (regions.length !== 2) return null;
        const cards = regions.flatMap(region => [...region.querySelectorAll<HTMLElement>('.analysis-card')]);
        let contained = true;
        let noOverlap = true;
        for (const region of regions) {
            const bounds = region.getBoundingClientRect();
            const rects = [...region.querySelectorAll<HTMLElement>('.analysis-card')].map(el => el.getBoundingClientRect());
            contained &&= rects.every(rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1);
            noOverlap &&= rects.every((rect, index) => index === 0 || rect.top >= rects[index - 1]!.bottom - 1);
        }
        return {
            columns: new Set(cards.map(el => Math.round(el.getBoundingClientRect().left))).size,
            contained, noOverlap, itemCount: cards.length, gap: 0,
            documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
            slots: cards.map(el => el.dataset.featureId!),
            original: [...regions[1]!.querySelectorAll<HTMLElement>('.analysis-card')].map(el => el.dataset.featureId!),
        };
    });
    await expect.poll(async () => {
        const geometry = await read();
        return geometry && { columns: geometry.columns, contained: geometry.contained, noOverlap: geometry.noOverlap,
            itemCount: geometry.itemCount, documentOverflow: geometry.documentOverflow,
            unique: new Set(geometry.slots).size,
            ordered: geometry.original.every((id, index, list) => index === 0
                || FEATURE_IDS.indexOf(id as typeof FEATURE_IDS[number]) > FEATURE_IDS.indexOf(list[index - 1] as typeof FEATURE_IDS[number])) };
    }).toEqual({ columns: 1, contained: true, noOverlap: true, itemCount: FEATURE_IDS.length,
        documentOverflow: 0, unique: FEATURE_IDS.length, ordered: true });
    const geometry = await read();
    if (!geometry) throw new Error('Analyzer list is not mounted.');
    return geometry;
};
