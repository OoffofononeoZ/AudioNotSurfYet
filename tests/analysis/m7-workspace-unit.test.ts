import {
    describe,
    expect,
    test,
} from 'vitest';
import {
    canvasXToTime,
    normalizeTimelineViewport,
    panTimelineViewport,
    resetTimelineViewport,
    timeToCanvasX,
    zoomTimelineViewport,
} from '../../src/analysis/timelineViewport';
import {
    cursorSampleIndex,
    peakBin,
    vectorAt,
    visibleSampleRange,
} from '../../src/analysis/rendererData';
import type { AnalysisSeries } from '../../src/analysis/types';
import { assertValidAnalysisWorkspace } from '../../src/types/session';

describe('M7 shared timeline', () => {
    test('maps canvas x and time in both directions', () => {
        const viewport = {
            startSeconds: 10,
            endSeconds: 30,
            zoom: 4,
        };
        expect(timeToCanvasX(20, viewport, 800)).toBe(400);
        expect(canvasXToTime(400, viewport, 800)).toBe(20);
        expect(canvasXToTime(-100, viewport, 800)).toBe(10);
        expect(canvasXToTime(900, viewport, 800)).toBe(30);
    });

    test('zooms around the anchor and pans by one quarter window', () => {
        const full = resetTimelineViewport(64);
        const zoomed = zoomTimelineViewport(full, 64, 4, 16);
        expect(zoomed).toEqual({
            startSeconds: 12,
            endSeconds: 28,
            zoom: 4,
        });
        expect(panTimelineViewport(zoomed, 64, 1)).toEqual({
            startSeconds: 16,
            endSeconds: 32,
            zoom: 4,
        });
        expect(panTimelineViewport(zoomed, 64, -1)).toEqual({
            startSeconds: 8,
            endSeconds: 24,
            zoom: 4,
        });
    });

    test('repairs stale viewport bounds after a track change', () => {
        expect(normalizeTimelineViewport({
            startSeconds: 80,
            endSeconds: 120,
            zoom: 4,
        }, 30)).toEqual({
            startSeconds: 22.5,
            endSeconds: 30,
            zoom: 4,
        });
    });
});

describe('M7 renderer data transformations', () => {
    const series: AnalysisSeries = {
        schemaVersion: 1,
        trackHash: 'track',
        configHash: 'config',
        featureId: 'chroma',
        startTimeSeconds: 0,
        sampleStepSeconds: 0.5,
        sampleCount: 4,
        dimensions: [3],
        payload: {
            kind: 'category-u16',
            values: Uint16Array.from([
                0, 1, 2,
                3, 4, 5,
                6, 7, 8,
                9, 10, 11,
            ]),
            width: 3,
            scale: 0.5,
            offset: 1,
        },
    };

    test('selects visible samples and decodes the cursor vector', () => {
        expect(visibleSampleRange(series, {
            startSeconds: 0.5,
            endSeconds: 1,
            zoom: 2,
        })).toEqual({ startIndex: 1, endIndex: 3 });
        expect(cursorSampleIndex(series, 1.7)).toBe(3);
        expect(vectorAt(series.payload as Extract<
            AnalysisSeries['payload'],
            { kind: 'category-u16' }
        >, 2)).toEqual([4, 4.5, 5]);
        expect(peakBin([0.2, 0.9, 0.4])).toEqual({
            index: 1,
            value: 0.9,
        });
    });
});

describe('M7 workspace invariants', () => {
    test('accepts empty and unique workspaces', () => {
        expect(() => assertValidAnalysisWorkspace({
            activeCards: [],
            viewport: null,
        })).not.toThrow();
        expect(() => assertValidAnalysisWorkspace({
            activeCards: [
                { slot: 0, featureId: 'rms' },
                { slot: 2, featureId: 'chroma' },
            ],
            viewport: {
                startSeconds: 0,
                endSeconds: 5,
                zoom: 2,
            },
        })).not.toThrow();
    });

    test('rejects duplicate slots/features and invalid viewport values', () => {
        expect(() => assertValidAnalysisWorkspace({
            activeCards: [
                { slot: 0, featureId: 'rms' },
                { slot: 0, featureId: 'chroma' },
            ],
            viewport: null,
        })).toThrow(/unique slots/);
        expect(() => assertValidAnalysisWorkspace({
            activeCards: [
                { slot: 0, featureId: 'rms' },
                { slot: 1, featureId: 'rms' },
            ],
            viewport: null,
        })).toThrow(/unique slots/);
        expect(() => assertValidAnalysisWorkspace({
            activeCards: [],
            viewport: {
                startSeconds: 5,
                endSeconds: 5,
                zoom: 0,
            },
        })).toThrow(/viewport/);
    });
});
