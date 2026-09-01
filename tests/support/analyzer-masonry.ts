import { expect, type Page } from '@playwright/test';
import { FEATURE_IDS } from '../../src/analysis/types';

export interface AnalyzerMasonryGeometry {
    columns: number;
    contained: boolean;
    documentOverflow: number;
    gap: number;
    itemCount: number;
    noOverlap: boolean;
    shortestColumnOrder: boolean;
    slots: string[];
}

const readGeometry = (page: Page) => page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(
        '[data-testid="analyzer-masonry"]',
    );
    if (!root || !root.classList.contains('is-ready')) return null;
    const rootRect = root.getBoundingClientRect();
    const items = Array.from(root.querySelectorAll<HTMLElement>(
        ':scope > .masonry-item',
    ));
    const rects = items.map((item) => {
        const rect = item.getBoundingClientRect();
        return {
            slot: item.dataset.slot ?? '',
            left: rect.left - rootRect.left,
            top: rect.top - rootRect.top,
            right: rect.right - rootRect.left,
            bottom: rect.bottom - rootRect.top,
            width: rect.width,
            height: rect.height,
        };
    });
    const roundedLefts = new Set(rects.map((rect) => Math.round(rect.left)));
    const columns = roundedLefts.size;
    const gap = 18;
    const columnBottoms = Array.from({ length: columns }, () => 0);
    let shortestColumnOrder = columns === 1 || columns === 2;
    for (const rect of rects) {
        let column = 0;
        for (let index = 1; index < columnBottoms.length; index += 1) {
            if (columnBottoms[index]! < columnBottoms[column]!) column = index;
        }
        const expectedLeft = column * (rect.width + gap);
        const expectedTop = columnBottoms[column]!;
        if (
            Math.abs(rect.left - expectedLeft) > 1
            || Math.abs(rect.top - expectedTop) > 1
        ) {
            shortestColumnOrder = false;
        }
        columnBottoms[column] = expectedTop + rect.height + gap;
    }
    let noOverlap = true;
    for (let leftIndex = 0; leftIndex < rects.length; leftIndex += 1) {
        for (
            let rightIndex = leftIndex + 1;
            rightIndex < rects.length;
            rightIndex += 1
        ) {
            const left = rects[leftIndex]!;
            const right = rects[rightIndex]!;
            if (
                left.left < right.right - 0.5
                && left.right > right.left + 0.5
                && left.top < right.bottom - 0.5
                && left.bottom > right.top + 0.5
            ) {
                noOverlap = false;
            }
        }
    }
    return {
        columns,
        contained: rects.every((rect) =>
            rect.left >= -1
            && rect.right <= rootRect.width + 1
            && rect.top >= -1
            && rect.bottom <= rootRect.height + 1),
        documentOverflow: Math.max(
            0,
            document.documentElement.scrollWidth - window.innerWidth,
        ),
        gap,
        itemCount: rects.length,
        noOverlap,
        shortestColumnOrder,
        slots: rects.map((rect) => rect.slot),
    } satisfies AnalyzerMasonryGeometry;
});

export const expectAnalyzerMasonry = async (
    page: Page,
    width: number,
    height = 900,
    expectedSlots: readonly string[] = FEATURE_IDS,
): Promise<AnalyzerMasonryGeometry> => {
    await page.setViewportSize({ width, height });
    const expectedColumns = width >= 1_280 ? 2 : 1;
    await expect.poll(async () => {
        const geometry = await readGeometry(page);
        return geometry && {
            columns: geometry.columns,
            contained: geometry.contained,
            documentOverflow: geometry.documentOverflow,
            itemCount: geometry.itemCount,
            noOverlap: geometry.noOverlap,
            shortestColumnOrder: geometry.shortestColumnOrder,
            slots: geometry.slots,
        };
    }).toEqual({
        columns: expectedColumns,
        contained: true,
        documentOverflow: 0,
        itemCount: FEATURE_IDS.length,
        noOverlap: true,
        shortestColumnOrder: true,
        slots: [...expectedSlots],
    });
    const geometry = await readGeometry(page);
    if (!geometry) throw new Error('Analyzer masonry geometry is not ready.');
    return geometry;
};
