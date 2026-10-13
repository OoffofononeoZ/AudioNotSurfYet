import { describe, expect, test } from 'vitest';
import { pinnedPanelBounds, resolvePinnedHeight } from '../../src/analysis/pinnedPanelHeight';

describe('Analyzer pinned height bounds', () => {
    test('starts at sixty percent and permits dragging from forty percent to full height', () => {
        expect(pinnedPanelBounds(800, 1500)).toEqual({ min: 320, max: 800 });
        expect(resolvePinnedHeight(0.6, 800, 1500)).toBe(480);
        expect(resolvePinnedHeight(0.1, 800, 1500)).toBe(320);
        expect(resolvePinnedHeight(1.2, 800, 1500)).toBe(800);
    });
    test('caps the height at natural content including the handle', () => {
        expect(pinnedPanelBounds(800, 400)).toEqual({ min: 320, max: 424 });
        expect(resolvePinnedHeight(1, 800, 400)).toBe(424);
    });
    test('lets short content override the forty percent minimum', () => {
        expect(pinnedPanelBounds(1200, 300)).toEqual({ min: 324, max: 324 });
        expect(resolvePinnedHeight(0.6, 1200, 300)).toBe(324);
    });
    test('reuses the chosen ratio when content or the viewport changes', () => {
        expect(resolvePinnedHeight(0.85, 800, 1600)).toBe(680);
        expect(resolvePinnedHeight(0.85, 800, 400)).toBe(424);
        expect(resolvePinnedHeight(0.85, 1000, 1600)).toBe(850);
        expect(pinnedPanelBounds(0, 400)).toEqual({ min: 0, max: 0 });
        expect(pinnedPanelBounds(-10, -1)).toEqual({ min: 0, max: 0 });
    });
});
