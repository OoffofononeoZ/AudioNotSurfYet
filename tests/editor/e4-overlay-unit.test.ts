import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { analysisCanvasRenderer } from '../../src/analysis/canvasRenderer';
import { FEATURE_REGISTRY } from '../../src/analysis/featureRegistry';
import {
    FEATURE_IDS,
    type AnalysisCursorValueResult,
    type AnalysisSeries,
} from '../../src/analysis/types';
import {
    EDITOR_OVERLAY_DEFAULT_HEIGHT,
    EDITOR_OVERLAY_DEFAULT_TOP,
    EDITOR_OVERLAY_KEYBOARD_COARSE_STEP,
    EDITOR_OVERLAY_KEYBOARD_STEP,
    EDITOR_OVERLAY_MIN_HEIGHT,
    editorOverlayExactSummary,
    editorOverlayFeatureIds,
    moveEditorOverlayHandle,
    normalizeEditorOverlayBounds,
} from '../../src/editor/overlay';
import { E4_OVERLAY_GOLDEN_PATH } from '../analysis/generate-e4-overlay-golden';
import { buildE4OverlayGolden } from '../support/e4-overlay-fixture';

const exact = (
    featureId: typeof FEATURE_IDS[number],
    value: AnalysisCursorValueResult['value'],
): AnalysisCursorValueResult => ({
    kind: 'cursor-value-result',
    requestId: 'cursor',
    generation: 1,
    trackHash: 'e4',
    configHash: 'e4-config',
    featureId,
    frameStartSeconds: 1,
    value,
});

const fakeContext = () => new Proxy({}, {
    get: () => () => undefined,
    set: () => true,
}) as CanvasRenderingContext2D;

const scalarSeries = (payload: AnalysisSeries['payload'] = {
    kind: 'scalar-f32',
    values: new Float32Array([0.2, 0.4]),
}): AnalysisSeries => ({
    schemaVersion: 1,
    trackHash: 'e4',
    configHash: 'e4-config',
    featureId: 'rms',
    startTimeSeconds: 0,
    sampleStepSeconds: 0.5,
    sampleCount: 2,
    dimensions: [],
    payload,
});

describe('Editor E4 overlay contract', () => {
    test('matches the versioned 21-feature renderer golden', async () => {
        const committed = JSON.parse(await readFile(
            E4_OVERLAY_GOLDEN_PATH,
            'utf8',
        ));
        const current = buildE4OverlayGolden();
        const historicalIds = FEATURE_IDS.filter(id => id !== 'wallpaperEngineSpectrum');
        // The historical canonical remains 21 features; Wallpaper spectrum was added later.
        expect(committed).toEqual({ ...current, features: current.features.filter(item => item.featureId !== 'wallpaperEngineSpectrum') });
        expect(historicalIds).toHaveLength(21);
        expect(committed.features).toEqual(historicalIds.map((featureId) => ({
            featureId,
            outputShape: FEATURE_REGISTRY[featureId].outputShape,
            renderer: FEATURE_REGISTRY[featureId].renderer,
        })));
        expect(new Set(committed.features.map(
            (entry: { renderer: string }) => entry.renderer,
        ))).toEqual(new Set([
            'scalar-line',
            'frequency-heatmap',
            'chroma-heatmap',
            'waveform',
            'loudness',
            'complex-spectrum',
        ]));
    });

    test('normalizes defaults and clamps all three handle semantics', () => {
        expect(normalizeEditorOverlayBounds({
            topRatio: Number.NaN,
            heightRatio: Number.NaN,
        })).toEqual({
            topRatio: EDITOR_OVERLAY_DEFAULT_TOP,
            heightRatio: EDITOR_OVERLAY_DEFAULT_HEIGHT,
        });
        const top = moveEditorOverlayHandle(
            { topRatio: 0.1, heightRatio: 0.35 },
            'top',
            1,
        );
        expect(top.topRatio).toBeCloseTo(0.33);
        expect(top.heightRatio).toBe(0.12);
        expect(moveEditorOverlayHandle(
            { topRatio: 0.8, heightRatio: 0.2 },
            'move',
            0.5,
        )).toEqual({ topRatio: 0.8, heightRatio: 0.2 });
        expect(moveEditorOverlayHandle(
            { topRatio: 0.9, heightRatio: 0.1 },
            'bottom',
            -1,
        )).toEqual({ topRatio: 0.88, heightRatio: EDITOR_OVERLAY_MIN_HEIGHT });
        expect(EDITOR_OVERLAY_KEYBOARD_STEP).toBe(0.01);
        expect(EDITOR_OVERLAY_KEYBOARD_COARSE_STEP).toBe(0.05);
    });

    test('deduplicates Buffer and formats every exact-value family', () => {
        expect(editorOverlayFeatureIds(null)).toEqual(['buffer']);
        expect(editorOverlayFeatureIds('buffer')).toEqual(['buffer']);
        expect(editorOverlayFeatureIds('rms')).toEqual(['buffer', 'rms']);
        expect(editorOverlayExactSummary('rms', exact('rms', 0.25)))
            .toBe('0.25000');
        expect(editorOverlayExactSummary('chroma', exact(
            'chroma',
            [0, 0, 0.8, 0],
        ))).toContain('D');
        expect(editorOverlayExactSummary('buffer', exact(
            'buffer',
            [-0.5, 0.75],
        ))).toContain('-0.50000…0.75000');
        expect(editorOverlayExactSummary('loudness', exact('loudness', {
            total: 2,
            specific: [0, 1, 3, 2],
        }))).toContain('B2');
        expect(editorOverlayExactSummary('complexSpectrum', exact(
            'complexSpectrum',
            { real: [0, 0], imag: [0, 2] },
        ))).toContain('bin 1');
    });

    test('draws through the shared adapter and rejects payload mismatch', () => {
        const request = {
            feature: FEATURE_REGISTRY.rms,
            series: scalarSeries(),
            viewport: { startSeconds: 0, endSeconds: 1, zoom: 1 },
            widthCssPixels: 320,
            heightCssPixels: 120,
            devicePixelRatio: 2,
        };
        expect(() => analysisCanvasRenderer.drawStatic(request, fakeContext()))
            .not.toThrow();
        expect(() => analysisCanvasRenderer.drawStatic({
            ...request,
            series: scalarSeries({
                kind: 'waveform-envelope',
                min: new Int16Array([0]),
                max: new Int16Array([0]),
                scale: 1,
            }),
        }, fakeContext())).toThrow('标量数据形态');
    });
});
