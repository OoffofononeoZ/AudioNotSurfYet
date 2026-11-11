import { expect, it } from 'vitest';
import { analysisCanvasRenderer, type EditorRenderRequest } from '../../src/analysis/canvasRenderer';
import { FEATURE_REGISTRY } from '../../src/analysis/featureRegistry';
import type { AnalysisSeries, FeatureId } from '../../src/analysis/types';

function draw(values: number[], featureId: FeatureId = 'rms', width = values.length) {
    const segments: number[][] = [];
    let x = 0,
        y = 0;
    const target = new Proxy(
        { strokeStyle: '' },
        {
            set: (object, key, value) => Reflect.set(object, key, value),
            get: (object, key) => {
                if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
                if (key === 'moveTo')
                    return (a: number, b: number) => {
                        x = a;
                        y = b;
                    };
                if (key === 'lineTo')
                    return (a: number, b: number) => {
                        if (object.strokeStyle === '#65ffa9') segments.push([x, y, a, b]);
                    };
                return Reflect.get(object, key) ?? (() => {});
            },
        },
    ) as unknown as CanvasRenderingContext2D;
    const series: AnalysisSeries = {
        schemaVersion: 1,
        trackHash: 'track',
        configHash: 'config',
        featureId,
        startTimeSeconds: 0,
        sampleCount: values.length,
        sampleStepSeconds: 1,
        dimensions: [],
        payload: { kind: 'scalar-f32', values: Float32Array.from(values) },
    };
    const request: EditorRenderRequest = {
        feature: FEATURE_REGISTRY[featureId],
        series,
        viewport: { startSeconds: 0, endSeconds: values.length, zoom: 1 },
        widthCssPixels: width,
        heightCssPixels: 100,
        devicePixelRatio: 1,
        durationSeconds: values.length,
    };
    analysisCanvasRenderer.drawStatic(request, target);
    return { segments, request, target };
}

it('mirrors nonnegative scalars around the center and preserves narrow time peaks', () => {
    expect(draw([0.25, 1]).segments).toEqual([
        [0.5, 39, 0.5, 61],
        [1.5, 6, 1.5, 94],
    ]);
    expect(draw([0.1, 1, 0.1], 'rms', 1).segments).toEqual([[0.5, 6, 0.5, 94]]);
});
it('keeps signed values on their actual side of a centered zero line', () => {
    expect(draw([-2, 1], 'spectralSlope').segments).toEqual([
        [0.5, 50, 0.5, 94],
        [1.5, 28, 1.5, 50],
    ]);
});
it('keeps silence and a single sample finite, and honors fixed scalar ranges', () => {
    expect(draw([0]).segments).toEqual([[0.5, 50, 0.5, 50]]);
    const segment = draw([0.25], 'spectralFlatness').segments[0]!;
    expect(segment).toEqual([0.5, 39, 0.5, 61]);
});
it('draws the real asymmetric buffer envelope and keeps its cursor layer free of an inset', () => {
    const { request, target, segments } = draw([1]);
    segments.length = 0;
    const series: AnalysisSeries = {
        ...request.series!,
        startTimeSeconds: 0,
        featureId: 'buffer',
        payload: { kind: 'waveform-envelope', min: new Int16Array([-2]), max: new Int16Array([1]), scale: 0.25 },
    };
    const buffer = { ...request, feature: FEATURE_REGISTRY.buffer, series };
    analysisCanvasRenderer.drawStatic(buffer, target);
    expect(segments).toEqual([[0.5, 39, 0.5, 72]]);
    segments.length = 0;
    analysisCanvasRenderer.drawCursor(buffer, 0.5, null, target);
    expect(segments).toEqual([]);
});
