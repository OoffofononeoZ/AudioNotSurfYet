import {
    describe,
    expect,
    test,
} from 'vitest';
import {
    assertValidFeatureOrder,
    defaultFeatureOrder,
    findFeatureDropTarget,
    insertFeatureOrder,
    isDefaultFeatureOrder,
    isValidFeatureOrder,
    moveFeatureOrder,
    restoredFeatureOrder,
} from '../../src/analysis/featureOrder';
import { FEATURE_IDS, type FeatureId } from '../../src/analysis/types';
import { calculateMasonryLayout } from '../../src/utils/masonryLayout';

const movedOrder = () => moveFeatureOrder(
    defaultFeatureOrder(),
    FEATURE_IDS[4],
    'first',
);

describe('M14 feature order model', () => {
    test('accepts only a complete unique 21-feature permutation', () => {
        const order = defaultFeatureOrder();
        expect(isValidFeatureOrder(order)).toBe(true);
        expect(() => assertValidFeatureOrder(order)).not.toThrow();
        expect(isValidFeatureOrder(order.slice(0, -1))).toBe(false);
        expect(isValidFeatureOrder([...order.slice(0, -1), order[0]]))
            .toBe(false);
        expect(isValidFeatureOrder([
            ...order.slice(0, -1),
            'unknown',
        ])).toBe(false);
    });

    test('restores legacy absence but rejects malformed persisted order', () => {
        expect(restoredFeatureOrder(undefined)).toEqual(FEATURE_IDS);
        expect(() => restoredFeatureOrder([
            ...FEATURE_IDS.slice(0, -1),
            FEATURE_IDS[0],
        ])).toThrow(/all 21 unique features/);
    });

    test('inserts before and after without duplicating the source', () => {
        const order = defaultFeatureOrder();
        const source = order[0];
        const target = order[4];
        const before = insertFeatureOrder(order, source, target, 'before');
        const after = insertFeatureOrder(order, source, target, 'after');
        expect(before.indexOf(source)).toBe(before.indexOf(target) - 1);
        expect(after.indexOf(source)).toBe(after.indexOf(target) + 1);
        expect(new Set(before).size).toBe(FEATURE_IDS.length);
        expect(insertFeatureOrder(order, source, source, 'after'))
            .toEqual(order);
    });

    test('moves up, down, first and last with boundary no-ops', () => {
        const order = defaultFeatureOrder();
        const middle = order[5];
        expect(moveFeatureOrder(order, middle, 'up').indexOf(middle)).toBe(4);
        expect(moveFeatureOrder(order, middle, 'down').indexOf(middle)).toBe(6);
        expect(moveFeatureOrder(order, middle, 'first')[0]).toBe(middle);
        expect(moveFeatureOrder(order, middle, 'last').at(-1)).toBe(middle);
        expect(moveFeatureOrder(order, order[0], 'up')).toEqual(order);
        expect(moveFeatureOrder(order, order.at(-1)!, 'down')).toEqual(order);
        expect(isDefaultFeatureOrder(order)).toBe(true);
        expect(isDefaultFeatureOrder(movedOrder())).toBe(false);
    });

    test('uses custom order as deterministic single and two-column masonry input', () => {
        const order = movedOrder();
        for (const columnCount of [1, 2] as const) {
            const result = calculateMasonryLayout({
                containerWidth: columnCount === 1 ? 640 : 1_298,
                columnCount,
                gap: 18,
                items: order.map((id, index) => ({
                    id,
                    height: 100 + index * 3,
                })),
            });
            expect(result.placements.map((placement) => placement.id))
                .toEqual(order);
            expect(result.placements[0]?.left).toBe(0);
            expect(result.height).toBeGreaterThan(0);
        }
    });
});

describe('M14 pointer insertion target', () => {
    const root = {
        left: 0,
        top: 0,
        right: 418,
        bottom: 600,
    };
    const items = [
        { id: 'rms' as FeatureId, left: 0, top: 0, right: 200, bottom: 100 },
        { id: 'chroma' as FeatureId, left: 218, top: 0, right: 418, bottom: 180 },
        { id: 'energy' as FeatureId, left: 0, top: 118, right: 200, bottom: 260 },
    ];

    test('uses the target upper or lower half for insertion edge', () => {
        expect(findFeatureDropTarget(300, 20, root, items, 'rms')).toEqual({
            featureId: 'chroma',
            edge: 'before',
        });
        expect(findFeatureDropTarget(300, 170, root, items, 'rms')).toEqual({
            featureId: 'chroma',
            edge: 'after',
        });
    });

    test('chooses the nearest card in a gap and keeps input order on ties', () => {
        expect(findFeatureDropTarget(209, 40, root, items, 'energy')).toEqual({
            featureId: 'rms',
            edge: 'before',
        });
    });

    test('cancels outside the workspace', () => {
        expect(findFeatureDropTarget(-1, 40, root, items, 'rms')).toBeNull();
        expect(findFeatureDropTarget(20, 601, root, items, 'rms')).toBeNull();
    });
});
