import { describe, expect, test } from 'vitest';
import { RealtimeFeatureExtractor } from '../../src/analysis/realtimeCore';
import { createAnalysisConfig } from '../../src/analysis/config';
import { extractM10Frame } from '../../src/analysis/meydaAdapter';
import { analyzeWallpaperSpectrum } from '../../src/analysis/wallpaperSpectrum';
import { FEATURE_IDS } from '../../src/analysis/types';

const rate = 48000;
const signal = (frequency: number, length = rate) =>
    Float32Array.from({ length }, (_, i) => 0.4 * Math.sin((2 * Math.PI * frequency * i) / rate));
async function stream(
    chunk: number,
    ids = ['rms', 'amplitudeSpectrum', 'spectralFlux', 'wallpaperEngineSpectrum'] as (typeof FEATURE_IDS)[number][],
) {
    const extractor = await RealtimeFeatureExtractor.create(rate, ids),
        left = signal(440),
        right = signal(880);
    const frames = [];
    for (let at = 0; at < left.length; at += chunk)
        frames.push(...extractor.push(left.subarray(at, at + chunk), right.subarray(at, at + chunk)));
    return frames;
}
describe('causal realtime feature extraction', () => {
    test('results do not depend on incoming block boundaries and preserve direct Meyda values', async () => {
        const a = await stream(1024),
            b = await stream(127);
        expect(a).toEqual(b);
        expect(a).toHaveLength(30);
        const l = signal(440),
            r = signal(880),
            input = Float32Array.from({ length: 1024 }, (_, i) => (l[i + 512]! + r[i + 512]!) / 2);
        const direct = extractM10Frame(['rms', 'amplitudeSpectrum'], input, await createAnalysisConfig(rate));
        expect(a[0]!.values.rms).toBe(direct.values.rms);
        expect(a[0]!.values.amplitudeSpectrum).toEqual(Array.from(direct.values.amplitudeSpectrum as Float32Array));
        expect(a[0]!.values.spectralFlux).toBeGreaterThanOrEqual(0);
    });
    test('WE stream reuses the existing transform and smoothing at each causal tick', async () => {
        const frames = await stream(512, ['wallpaperEngineSpectrum']);
        const series = await analyzeWallpaperSpectrum(
            signal(440),
            signal(880),
            await createAnalysisConfig(rate),
            'test',
            { yieldControl: async () => {} },
        );
        if (series.payload.kind !== 'stereo-spectrum-f32') throw Error('wrong payload');
        for (let i = 0; i < 29; i++)
            expect(frames[i]!.values.wallpaperEngineSpectrum).toEqual(
                Array.from(series.payload.values.slice((i + 1) * 128, (i + 2) * 128)),
            );
    });
    test('all registered features stream in bounded batches including structured values', async () => {
        for (let i = 0; i < FEATURE_IDS.length; i += 4) {
            const frames = await stream(1024, [...FEATURE_IDS.slice(i, i + 4)]);
            for (const id of FEATURE_IDS.slice(i, i + 4)) expect(frames.at(-1)!.values[id]).toBeDefined();
        }
    });
    test('rejects invalid configuration and PCM without retaining a partial result', async () => {
        await expect(RealtimeFeatureExtractor.create(rate, [...FEATURE_IDS])).rejects.toThrow(/四种/);
        const e = await RealtimeFeatureExtractor.create(rate, ['rms']);
        expect(() => e.push(new Float32Array(5000), new Float32Array(5000))).toThrow();
        expect(() => e.push(new Float32Array([NaN]), new Float32Array(1))).toThrow();
    });
});
