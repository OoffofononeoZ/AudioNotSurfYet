import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
    removeTempoBoundary,
    resolveTempoSegmentPresentation,
} from '../../src/editor/tempoMap';
import { editorTimeToX } from '../../src/editor/timeline';
import type { TempoSegmentV1 } from '../../src/editor/types';

interface Golden {
    tempoMap: TempoSegmentV1[];
    durationSeconds: number;
    compactGeometry: {
        stripHeight: number;
        guideHeight: number;
        guideWidth: number;
        labelFontSize: number;
        controlHeight: number;
        boundarySafetyInset: number;
    };
    presentationCases: Array<{
        available: number;
        full: number;
        summary: number;
        expected: 'full' | 'summary' | 'hidden';
    }>;
}

const golden = JSON.parse(readFileSync(path.resolve(
    import.meta.dirname,
    '../analysis/golden/editor-e9-tempo-lane.v1.json',
), 'utf8')) as Golden;

describe('Editor E9 tempo lane domain', () => {
    test('removes an internal segment and lets the preceding segment extend', () => {
        const result = removeTempoBoundary(golden.tempoMap, 'tempo-40');
        expect(result.map((segment) => segment.id)).toEqual(['tempo-0', 'tempo-57']);
        expect(result[0]).toEqual(golden.tempoMap[0]);
        expect(result[1]).toEqual(golden.tempoMap[2]);
        expect(result[0]).not.toBe(golden.tempoMap[0]);
    });

    test('protects the first boundary and treats an unknown id as an idempotent no-op', () => {
        for (const id of ['tempo-0', 'missing']) {
            const result = removeTempoBoundary(golden.tempoMap, id);
            expect(result).toEqual(golden.tempoMap);
            expect(result).not.toBe(golden.tempoMap);
        }
    });

    test('supports consecutive internal deletion without changing remaining settings', () => {
        const first = removeTempoBoundary(golden.tempoMap, 'tempo-40');
        const second = removeTempoBoundary(first, 'tempo-57');
        expect(second).toEqual([golden.tempoMap[0]]);
    });

    test.each(golden.presentationCases)(
        'selects compact $expected at $available CSS px without a viewport breakpoint',
        ({ available, full, summary, expected }) => {
            expect(resolveTempoSegmentPresentation(available, full, summary))
                .toBe(expected);
        },
    );

    test('locks the compact strip geometry independently from viewport breakpoints', () => {
        expect(golden.compactGeometry).toEqual({
            stripHeight: 28,
            guideHeight: 12,
            guideWidth: 1,
            labelFontSize: 11,
            controlHeight: 18,
            boundarySafetyInset: 26,
        });
    });

    test('uses the same time mapping for waveform and tempo caret anchors', () => {
        const viewport = { startSeconds: 20, endSeconds: 80, zoom: 146.866 / 60 };
        for (const seconds of [40, 57, 80]) {
            const waveformX = editorTimeToX(seconds, viewport, 960);
            const tempoX = editorTimeToX(seconds, viewport, 960);
            expect(tempoX).toBe(waveformX);
        }
    });
});
