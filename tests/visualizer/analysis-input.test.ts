import { attachElements } from './resource-fixtures';
import { describe, expect, test, vi } from 'vitest';
import { FEATURE_IDS, type AnalysisSeries } from '../../src/analysis/types';
import { createAnalysisConfig } from '../../src/analysis/config';
import { runAnalysisJob } from '../../src/analysis/workerCore';
import { createAnalysisFrame } from '../../src/analysis/frames';
import { exactM10Value } from '../../src/analysis/meydaAdapter';
import { analysisComponentsForFeature, analysisComponentIsVector } from '../../src/visualizer/bindingDefaults';
import { projectAnalysisSeries } from '../../src/visualizer/analysisProjection';
import { CompositionResolver } from '../../src/visualizer/compositionResolver';
import { createComposition, validateComposition } from '../../src/visualizer/compositionCodec';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { analysisVectorLength } from '../../src/visualizer/bindingDefaults';
import { spectrumBands } from '../../resources/visualizer/shared/strings.js';

const track = { contentHash: 'a'.repeat(64), fileName: 'input.wav', durationSeconds: 2, sampleRate: 48000 };
const series = (
    featureId: AnalysisSeries['featureId'],
    payload: AnalysisSeries['payload'],
    sampleCount = 1,
): AnalysisSeries => ({
    schemaVersion: 1,
    trackHash: track.contentHash,
    configHash: 'config',
    featureId,
    startTimeSeconds: 0,
    sampleStepSeconds: 0.1,
    sampleCount,
    dimensions: [],
    payload,
});
const buffer = () =>
    series('buffer', {
        kind: 'waveform-envelope',
        min: new Int16Array([-32767]),
        max: new Int16Array([32767]),
        scale: 1 / 32767,
    });
function resolve(s: AnalysisSeries, waveform?: (time: number) => readonly number[] | null) {
    const p = createComposition(track),
        e = elementRegistry.create('spectral-dots', 2, 0);
    e.bindings[0] = {
        parameterId: 'spectrum',
        source: {
            kind: 'analysis',
            featureId: s.featureId,
            ...(s.featureId === 'loudness'
                ? { component: 'specific' as const }
                : s.featureId === 'complexSpectrum'
                  ? { component: 'magnitude' as const }
                  : {}),
            projection: { kind: 'full' },
        },
    };
    p.elements = [e];
    attachElements(p);
    return new CompositionResolver()
        .resolve(p, 0, () => s, waveform)
        .get(e.id)!
        .get('spectrum')!;
}

describe('Visualizer Analyzer input', () => {
    test('Wallpaper vectors carry stereo units and preserve values above one through projection', () => {
        const values = Float32Array.from({ length: 128 }, (_, i) => (i === 72 ? 2.125 : i / 128));
        const s = series('wallpaperEngineSpectrum', { kind: 'stereo-spectrum-f32', width: 128, values });
        const resolved = resolve(s);
        expect(resolved).toMatchObject({ state: 'ready', unit: 'we-strength', channelLayout: 'stereo-64' });
        expect(resolved.value).toEqual([...values]);
        expect(projectAnalysisSeries(s, 'default', { kind: 'bin', index: 72 }, 0)).toBe(2.125);
        expect(spectrumBands(resolved.value as number[], undefined, resolved.unit)[36]).toBe(1);
    });
    test('requires the complete Buffer frame instead of treating extrema as samples', () => {
        expect(() => projectAnalysisSeries(buffer(), 'default', { kind: 'full' }, 0)).toThrow(/波形/);
        const samples = Array.from({ length: 1024 }, (_, i) => (i - 512) / 1024);
        expect(projectAnalysisSeries(buffer(), 'default', { kind: 'full' }, 0, samples)).toEqual(samples);
        expect(projectAnalysisSeries(buffer(), 'default', { kind: 'bin', index: 900 }, 0, samples)).toBe(samples[900]);
        expect(
            projectAnalysisSeries(buffer(), 'default', { kind: 'band', start: 500, end: 503 }, 0, samples),
        ).toBeCloseTo((samples[500]! + samples[501]! + samples[502]!) / 3);
        expect(analysisVectorLength('buffer', 'default')).toBe(1024);
    });
    test('exposes distinct waveform levels after actual renderer band reduction', () => {
        const samples = Array.from({ length: 1024 }, (_, i) => -i / 1024);
        const value = resolve(buffer(), () => samples);
        expect(value.state).toBe('ready');
        const levels = spectrumBands(value.value as number[]);
        expect(new Set(levels).size).toBeGreaterThan(32);
        expect(levels[63]).toBeGreaterThan(0.9);
        expect(resolve(buffer()).state).toBe('error');
    });
    test('accepts full-frame Buffer bin/band bounds and rejects out-of-range indices', () => {
        const p = createComposition(track),
            e = elementRegistry.create('blur', 2, 0);
        p.elements = [e];
        attachElements(p);
        e.bindings[0] = {
            parameterId: 'amount',
            source: { kind: 'analysis', featureId: 'buffer', projection: { kind: 'bin', index: 1023 } },
        };
        expect(() => validateComposition(p)).not.toThrow();
        e.bindings[0].source = { kind: 'analysis', featureId: 'buffer', projection: { kind: 'bin', index: 1024 } };
        expect(() => validateComposition(p)).toThrow();
    });
    test('preserves signed MFCC projections but renders both coefficient polarities', () => {
        const s = series('mfcc', {
            kind: 'category-u16',
            width: 13,
            values: Uint16Array.from([0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96]),
            scale: 1,
            offset: -48,
        });
        const raw = projectAnalysisSeries(s, 'default', { kind: 'full' }, 0) as number[];
        expect(raw[0]).toBe(-48);
        expect(raw[12]).toBe(48);
        const display = resolve(s).value as number[];
        expect(display[0]).toBe(display[12]);
        expect(display[0]).toBeGreaterThan(0);
        expect(projectAnalysisSeries(s, 'default', { kind: 'bin', index: 0 }, 0)).toBe(-48);
    });
    test('maps normalized Chroma and waveform values to the shared render reference', () => {
        const s = series('chroma', {
            kind: 'category-u16',
            width: 12,
            values: Uint16Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
            scale: 1 / 11,
            offset: 0,
        });
        const display = resolve(s).value as number[];
        expect(spectrumBands(display)[63]).toBeCloseTo(1);
        expect(projectAnalysisSeries(s, 'default', { kind: 'bin', index: 11 }, 0)).toBeCloseTo(1);
    });
    test('power and amplitude spectra produce equal display strength for equal physical amplitude', () => {
        const amp = series('amplitudeSpectrum', {
            kind: 'frequency-u16',
            width: 512,
            values: new Uint16Array(512).fill(8),
            scale: 1,
            offset: 0,
        });
        const power = series('powerSpectrum', {
            kind: 'frequency-u16',
            width: 512,
            values: new Uint16Array(512).fill(64),
            scale: 1,
            offset: 0,
        });
        expect(resolve(power).value).toEqual(resolve(amp).value);
        expect(projectAnalysisSeries(power, 'default', { kind: 'mean' }, 0)).toBe(64);
    });
    test('interpolates complex phase across its wrap instead of crossing zero', () => {
        const phase = series(
            'complexSpectrum',
            {
                kind: 'complex-derived',
                bins: 1,
                magnitude: new Uint16Array([4, 4]),
                phase: new Int16Array([32000, -32000]),
                magnitudeScale: 1,
            },
            2,
        );
        expect(Math.abs(projectAnalysisSeries(phase, 'phase', { kind: 'bin', index: 0 }, 0.05) as number)).toBeCloseTo(
            Math.PI,
        );
        expect(projectAnalysisSeries(phase, 'magnitude', { kind: 'bin', index: 0 }, 0.05)).toBe(4);
    });
    test('does not reuse an earlier track series for a newly entered project', () => {
        const wrong = { ...buffer(), trackHash: 'b'.repeat(64) },
            read = vi.fn(() => Array(1024).fill(0.5));
        expect(resolve(wrong, read).state).not.toBe('ready');
        expect(read).not.toHaveBeenCalled();
    });
});

test('all registered Worker features retain their scalar/vector dimensions and finite projections', async () => {
    const config = await createAnalysisConfig(track.sampleRate);
    const pcm = Float32Array.from({ length: 4096 }, (_, i) => Math.sin(i * 0.09) * (0.3 + 0.2 * Math.cos(i * 0.001)));
    const waveform = exactM10Value('buffer', createAnalysisFrame(pcm, 0, config), config) as number[];
    for (let start = 0; start < FEATURE_IDS.length; start += 4) {
        const featureIds = FEATURE_IDS.slice(start, start + 4);
        const { result } = await runAnalysisJob({
            kind: 'analyze',
            jobId: 'projection',
            generation: 1,
            trackHash: track.contentHash,
            config,
            featureIds,
            cursorFeatureIds: featureIds,
            pcm: pcm.slice().buffer,
            stereoPcm: [pcm.slice().buffer, pcm.slice().buffer],
            durationSeconds: pcm.length / config.sampleRate,
        });
        for (const s of result.series)
            for (const component of analysisComponentsForFeature(s.featureId)) {
                const vector = analysisComponentIsVector(s.featureId, component);
                const value = projectAnalysisSeries(
                    s,
                    component,
                    { kind: vector ? 'full' : 'scalar' },
                    0.005,
                    waveform,
                );
                if (vector) {
                    expect(value, s.featureId + ':' + component).toHaveLength(
                        analysisVectorLength(s.featureId, component),
                    );
                    expect((value as number[]).every(Number.isFinite)).toBe(true);
                    for (const kind of ['mean', 'max', 'peak'] as const)
                        expect(Number.isFinite(projectAnalysisSeries(s, component, { kind }, 0.005, waveform))).toBe(
                            true,
                        );
                } else expect(Number.isFinite(value)).toBe(true);
            }
    }
});
