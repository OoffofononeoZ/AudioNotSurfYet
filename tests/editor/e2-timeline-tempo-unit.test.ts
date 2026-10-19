import { describe, expect, test } from 'vitest';
import { createAnalysisConfig } from '../../src/analysis/config';
import { chooseTempoCandidate, estimateTempo } from '../../src/analysis/tempoEstimator';
import {
    centerEditorViewport,
    editorTimeToX,
    editorXToTime,
    panEditorViewportByPixels,
    zoomEditorViewportAtX,
} from '../../src/editor/timeline';
import {
    applyBpmInput,
    applyMeterInput,
    beatSecondsFor,
    generateTempoGrid,
    insertTempoBoundary,
    moveTempoBoundary,
    snapEditorTime,
} from '../../src/editor/tempoMap';
import type { TempoSegmentV1 } from '../../src/editor/types';
import { SAMPLE_RATE } from '../support/audio-fixtures';
import { E2_TEMPO_CASES } from '../support/e2-tempo-fixture';

const baseTempo = (): TempoSegmentV1[] => [
    {
        id: 'tempo-1',
        startSeconds: 0,
        mode: 'metered',
        bpm: 120,
        bpmSource: 'user',
        meter: { numerator: 4, denominator: 4 },
    },
];

describe('Editor E2 timeline and tempo', () => {
    test('keeps time/x, anchored zoom, pixel pan and center deterministic', () => {
        const viewport = { startSeconds: 10, endSeconds: 30, zoom: 5 };
        expect(editorTimeToX(20, viewport, 1_000)).toBe(500);
        expect(editorXToTime(500, viewport, 1_000)).toBe(20);
        const zoomed = zoomEditorViewportAtX(viewport, 100, 10, 250, 1_000);
        expect(editorXToTime(250, zoomed, 1_000)).toBeCloseTo(15, 8);
        expect(panEditorViewportByPixels(viewport, 100, -100, 1_000)).toMatchObject({
            startSeconds: 12,
            endSeconds: 32,
        });
        expect(centerEditorViewport(viewport, 100, 90)).toMatchObject({ startSeconds: 80, endSeconds: 100 });
    });

    test('uses 60/BPM beat spacing independently of meter denominator', () => {
        const tempo: TempoSegmentV1[] = [
            {
                id: 'seven-eight',
                startSeconds: 0,
                mode: 'metered',
                bpm: 127.5,
                bpmSource: 'user',
                meter: { numerator: 7, denominator: 8 },
            },
        ];
        const lines = generateTempoGrid(tempo, 8, { startSeconds: 0, endSeconds: 8, zoom: 1 }).filter(
            line => line.kind !== 'subdivision',
        );
        expect(lines[1]!.timeSeconds - lines[0]!.timeSeconds).toBeCloseTo(beatSecondsFor(127.5), 6);
        expect(lines[0]!.kind).toBe('beat');
        expect(lines[7]!.kind).toBe('beat');
        const changedMeter: TempoSegmentV1[] = [
            { ...tempo[0]!, mode: 'metered', bpm: 127.5, bpmSource: 'user', meter: { numerator: 3, denominator: 4 } },
        ];
        expect(generateTempoGrid(changedMeter, 8, { startSeconds: 0, endSeconds: 8, zoom: 1 })).toEqual(
            generateTempoGrid(tempo, 8, { startSeconds: 0, endSeconds: 8, zoom: 1 }),
        );
    });

    test('inserts inherited boundaries, snaps only with a grid and clamps moves', () => {
        const viewport = { startSeconds: 0, endSeconds: 10, zoom: 1 };
        const snapped = snapEditorTime(1.03, baseTempo(), viewport, 1_600, 10);
        expect(snapped).toBe(1);
        const noBpm: TempoSegmentV1[] = [
            {
                id: 'unset',
                startSeconds: 0,
                mode: 'metered',
                bpm: null,
                bpmSource: 'unset',
                meter: { numerator: 4, denominator: 4 },
            },
        ];
        expect(snapEditorTime(1.0300004, noBpm, viewport, 1_600, 10)).toBe(1.03);
        const inserted = insertTempoBoundary(baseTempo(), 4, () => 'tempo-2');
        expect(inserted[1]).toMatchObject({
            id: 'tempo-2',
            startSeconds: 4,
            mode: 'metered',
            bpm: 120,
        });
        expect(moveTempoBoundary(inserted, 'tempo-2', -4, 10)[1]!.startSeconds).toBe(0.000001);
    });

    test('validates decimal BPM, single-beat and meter boundaries', () => {
        const segment = baseTempo()[0]!;
        expect(applyBpmInput(segment, '127.5')).toMatchObject({
            ok: true,
            segment: { mode: 'metered', bpm: 127.5, bpmSource: 'user' },
        });
        expect(applyBpmInput(segment, '19.999')).toMatchObject({
            ok: true,
            segment: { mode: 'single-beat' },
        });
        expect(applyBpmInput(segment, '-1')).toMatchObject({ ok: false });
        expect(applyBpmInput(segment, '301')).toMatchObject({ ok: false });
        expect(applyMeterInput(segment, 7, 8)).toMatchObject({
            ok: true,
            segment: { meter: { numerator: 7, denominator: 8 } },
        });
        expect(applyMeterInput(segment, 0, 3)).toMatchObject({ ok: false });
    });

    test('returns reliable goldens and low confidence for invalid rhythm evidence', async () => {
        const config = await createAnalysisConfig(SAMPLE_RATE);
        for (const entry of E2_TEMPO_CASES) {
            const result = estimateTempo(entry.pcm, config);
            expect(result.state, entry.id).toBe(entry.expected);
            if ('bpm' in entry && result.state === 'reliable') {
                const tolerance = Math.max(0.5, entry.bpm * 0.01);
                expect(Math.abs(result.bpm! - entry.bpm), entry.id).toBeLessThanOrEqual(tolerance);
            }
        }
        expect(chooseTempoCandidate(new Float64Array(4), SAMPLE_RATE, 512)).toMatchObject({
            state: 'low-confidence',
            confidence: 0,
        });
    }, 30_000);
});
