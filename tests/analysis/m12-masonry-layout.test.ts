import { describe, expect, test } from 'vitest';
import { calculateMasonryLayout } from '../../src/utils/masonryLayout';

const rectanglesOverlap = (
    left: { left: number; top: number; width: number; height: number },
    right: { left: number; top: number; width: number; height: number },
) => left.left < right.left + right.width
    && left.left + left.width > right.left
    && left.top < right.top + right.height
    && left.top + left.height > right.top;

describe('M12 masonry layout', () => {
    test('keeps slot order in one column and reports the container height', () => {
        const layout = calculateMasonryLayout({
            containerWidth: 390,
            columnCount: 1,
            gap: 18,
            items: [
                { id: 0, height: 100 },
                { id: 1, height: 160 },
                { id: 2, height: 80 },
            ],
        });

        expect(layout.columnWidth).toBe(390);
        expect(layout.height).toBe(376);
        expect(layout.placements).toEqual([
            { id: 0, column: 0, left: 0, top: 0, width: 390, height: 100 },
            { id: 1, column: 0, left: 0, top: 118, width: 390, height: 160 },
            { id: 2, column: 0, left: 0, top: 296, width: 390, height: 80 },
        ]);
    });

    test('uses the shortest column and resolves equal heights to the left', () => {
        const layout = calculateMasonryLayout({
            containerWidth: 1_218,
            columnCount: 2,
            gap: 18,
            items: [
                { id: 0, height: 100 },
                { id: 1, height: 100 },
                { id: 2, height: 180 },
                { id: 3, height: 80 },
            ],
        });

        expect(layout.columnWidth).toBe(600);
        expect(layout.placements.map(({ id, column, left, top }) => ({
            id,
            column,
            left,
            top,
        }))).toEqual([
            { id: 0, column: 0, left: 0, top: 0 },
            { id: 1, column: 1, left: 618, top: 0 },
            { id: 2, column: 0, left: 0, top: 118 },
            { id: 3, column: 1, left: 618, top: 118 },
        ]);
        expect(layout.height).toBe(298);
    });

    test('reassigns later slots after a measured height changes', () => {
        const input = {
            containerWidth: 1_218,
            columnCount: 2 as const,
            gap: 18,
        };
        const initial = calculateMasonryLayout({
            ...input,
            items: [
                { id: 0, height: 100 },
                { id: 1, height: 160 },
                { id: 2, height: 100 },
                { id: 3, height: 100 },
            ],
        });
        const expanded = calculateMasonryLayout({
            ...input,
            items: [
                { id: 0, height: 260 },
                { id: 1, height: 160 },
                { id: 2, height: 100 },
                { id: 3, height: 100 },
            ],
        });

        expect(initial.placements[2]?.column).toBe(0);
        expect(expanded.placements[2]?.column).toBe(1);
        expect(expanded.placements[3]?.column).toBe(0);
        for (let leftIndex = 0; leftIndex < expanded.placements.length; leftIndex += 1) {
            for (
                let rightIndex = leftIndex + 1;
                rightIndex < expanded.placements.length;
                rightIndex += 1
            ) {
                expect(rectanglesOverlap(
                    expanded.placements[leftIndex]!,
                    expanded.placements[rightIndex]!,
                )).toBe(false);
            }
        }
        expect(Math.max(...expanded.placements.map((placement) =>
            placement.top + placement.height))).toBe(expanded.height);
    });

    test('handles an empty workspace and clamps negative geometry', () => {
        expect(calculateMasonryLayout({
            containerWidth: -20,
            columnCount: 2,
            gap: -8,
            items: [],
        })).toEqual({
            columnWidth: 0,
            height: 0,
            placements: [],
        });
    });
});
