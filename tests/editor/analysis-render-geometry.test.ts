import { afterEach, expect, test, vi } from 'vitest';
import { plotColumns } from '../../src/analysis/renderGeometry';
import { visibleSampleRange } from '../../src/analysis/rendererData';
import { analysisCanvasRenderer } from '../../src/analysis/canvasRenderer';
import { FEATURE_REGISTRY } from '../../src/analysis/featureRegistry';
import type { AnalysisSeries, FeatureId } from '../../src/analysis/types';

function series(featureId: FeatureId = 'rms'): AnalysisSeries {
    return {
        schemaVersion: 1,
        trackHash: 'track',
        configHash: 'config',
        featureId,
        startTimeSeconds: 0,
        sampleStepSeconds: 0.5,
        sampleCount: 4,
        dimensions: [],
        payload: { kind: 'scalar-f32', values: new Float32Array([1, 2, 3, 4]) },
    };
}
afterEach(() => vi.unstubAllGlobals());

test('time cells preserve the 15% song-start padding, fixed scale and song-end padding', () => {
    const viewport = { startSeconds: -1.5, endSeconds: 8.5, zoom: 1 };
    const columns = plotColumns(series(), viewport, 1000, 1, 1.75);
    expect(columns.map(c => [c.left, c.right])).toEqual([
        [150, 200],
        [200, 250],
        [250, 300],
        [300, 325],
    ]);
    const moved = plotColumns(series(), { ...viewport, startSeconds: -1, endSeconds: 9 }, 1000, 1, 1.75);
    expect(columns[0]!.left - moved[0]!.left).toBe(50);
    expect(moved[1]!.right - moved[1]!.left).toBe(50);
    expect(plotColumns(series(), { startSeconds: 3, endSeconds: 4, zoom: 1 }, 1000)).toEqual([]);
    expect(visibleSampleRange(series(), { startSeconds: -2, endSeconds: -1, zoom: 1 })).toEqual({
        startIndex: 0,
        endIndex: 0,
    });
});

test.each([
    'amplitudeSpectrum',
    'chroma',
    'mfcc',
    'loudness',
    'buffer',
    'complexSpectrum',
    'wallpaperEngineSpectrum',
] as const)('%s draws time data into its real time cells rather than stretching the visible samples', featureId => {
    const value = series(featureId);
    if (featureId === 'loudness')
        value.payload = {
            kind: 'loudness',
            bands: 24,
            total: new Float32Array(4),
            specific: new Uint16Array(96),
            scale: 1,
            offset: 0,
        };
    else if (featureId === 'buffer')
        value.payload = {
            kind: 'waveform-envelope',
            min: new Int16Array([-1, -1, -1, -1]),
            max: new Int16Array([1, 1, 1, 1]),
            scale: 1,
        };
    else if (featureId === 'complexSpectrum')
        value.payload = {
            kind: 'complex-derived',
            bins: 2,
            magnitude: new Uint16Array(8),
            phase: new Int16Array(8),
            magnitudeScale: 1,
        };
    else if (featureId === 'wallpaperEngineSpectrum')
        value.payload = { kind: 'stereo-spectrum-f32', width: 128, values: new Float32Array(512) };
    else
        value.payload = {
            kind: featureId === 'amplitudeSpectrum' ? 'frequency-u16' : 'category-u16',
            width: 2,
            values: new Uint16Array(8),
            scale: 1,
            offset: 0,
        };
    const calls: { name: string; args: number[] }[] = [];
    const context = new Proxy(
        {},
        {
            set: () => true,
            get:
                (_, name: string) =>
                (...args: number[]) => {
                    calls.push({ name, args });
                },
        },
    ) as CanvasRenderingContext2D;
    vi.stubGlobal(
        'ImageData',
        class {
            data: Uint8ClampedArray;
            constructor(width: number, height: number) {
                this.data = new Uint8ClampedArray(width * height * 4);
            }
        },
    );
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => context }) });
    analysisCanvasRenderer.drawStatic(
        {
            feature: FEATURE_REGISTRY[featureId],
            series: value,
            viewport: { startSeconds: -1.5, endSeconds: 8.5, zoom: 1 },
            widthCssPixels: 1000,
            heightCssPixels: 200,
            devicePixelRatio: 2,
            durationSeconds: 1.75,
        },
        context,
    );
    if (featureId === 'complexSpectrum') {
        const images = calls.filter(c => c.name === 'drawImage');
        expect(images[0]!.args.slice(5, 8)).toEqual([150, 0, 50]);
        expect(images[3]!.args.slice(5, 8)).toEqual([300, 0, 25]);
    } else if (featureId === 'buffer') {
        expect(calls.some(c => c.name === 'moveTo' && c.args[0] === 175)).toBe(true);
        expect(calls.some(c => c.name === 'moveTo' && c.args[0] === 312.5)).toBe(true);
    } else {
        const cells = calls.filter(c => c.name === 'fillRect' && c.args[2] !== 1000);
        expect(cells[0]!.args[0]).toBe(150);
        expect(cells.some(c => c.args[0] === 300 && c.args[2] === 25)).toBe(true);
    }
});
