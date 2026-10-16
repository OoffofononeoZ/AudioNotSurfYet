import { expect, test } from 'vitest';
import { BluesteinDFT } from '../../src/analysis/bluestein';
import { WallpaperBlockTransform, WallpaperSmoothing, analyzeWallpaperSpectrum, wallpaperBandMap, wallpaperBandRanges, wallpaperPcmLength } from '../../src/analysis/wallpaperSpectrum';
import { createAnalysisConfig } from '../../src/analysis/config';
import { decodeAnalysisSeries, encodeAnalysisSeries } from '../../src/analysis/compactCodec';
import { copyDecodedAudioToMono, speakersToStereo } from '../../src/analysis/pcm';
import { extractCursorValue, runAnalysisJob } from '../../src/analysis/workerCore';
import { projectAnalysisSeries } from '../../src/visualizer/analysisProjection';
import { geometricSpectrum } from '../../src/visualizer/geometricBatch';

const tone = (hz: number, n: number, rate = 48000, gain = 0.2) => Float32Array.from({ length: n }, (_, i) => gain * Math.sin(2 * Math.PI * hz * i / rate));
const yieldControl = async () => undefined;

for (const n of [3, 7, 16, 31, 1920, 2089]) test(`Bluestein ${n} agrees with direct real DFT`, () => {
    const pcm = Float64Array.from({ length: n }, (_, i) => Math.sin(i * 0.7) + 0.3 * Math.cos(i * 1.27));
    const bins = Math.min(n, 80), re = new Float64Array(bins), im = new Float64Array(bins);
    new BluesteinDFT(n).transform(pcm, re, im);
    for (let k = 0; k < bins; k++) {
        let expectedRe = 0, expectedIm = 0;
        for (let i = 0; i < n; i++) { expectedRe += pcm[i]! * Math.cos(-2 * Math.PI * k * i / n); expectedIm += pcm[i]! * Math.sin(-2 * Math.PI * k * i / n); }
        expect(re[k]).toBeCloseTo(expectedRe, 8); expect(im[k]).toBeCloseTo(expectedIm, 8);
    }
    const again = new Float64Array(bins); new BluesteinDFT(n).transform(pcm, again, im); expect(again).toEqual(re);
});

test('mapping covers all bands without empty buckets, with ordered reference ranges', () => {
    const map = wallpaperBandMap(); expect(new Set(map.slice(1)).size).toBe(64);
    for (let i = 2; i < map.length; i++) expect(map[i]! - map[i - 1]!).toBeOneOf([0, 1]);
    for (const rate of [22050, 44100, 48000, 96000]) {
        const ranges = wallpaperBandRanges(rate);
        expect(ranges.every(([lo, hi]) => lo < hi && hi < rate / 2)).toBe(true);
        for (let i = 1; i < 64; i++) expect(ranges[i]![0]).toBeCloseTo(ranges[i - 1]![1], 8);
    }
});

test('silence stays zero, stereo tones separate and phase inversion does not cancel', () => {
    const block = new WallpaperBlockTransform(48000), left = tone(220, block.pcmLength), right = tone(5000, block.pcmLength);
    expect([...block.extract(new Float32Array(left.length), new Float32Array(left.length), 0)]).toEqual(Array(128).fill(0));
    const values = block.extract(left, right, 0), l = values.slice(0, 64), r = values.slice(64);
    expect(l.indexOf(Math.max(...l))).toBeLessThan(r.indexOf(Math.max(...r)));
    const inverse = block.extract(left, left.map(v => -v), 0);
    expect(inverse.slice(0, 64)).toEqual(inverse.slice(64)); expect(Math.max(...inverse)).toBeGreaterThan(0);
    const padded = new Float32Array(block.length).fill(10); padded.set(left);
    expect(block.extract(padded, padded, 0)).toEqual(block.extract(left, left, 0));
    const last = left.slice(); last[last.length - 1] = last[last.length - 1]! + 1;
    expect(block.extract(last, last, 0)).not.toEqual(block.extract(left, left, 0));
});

test('sweep, seeded noise and abrupt gain stay finite; smoothing preserves values above one', () => {
    const block = new WallpaperBlockTransform(48000), peaks: number[] = [];
    for (const hz of [50, 220, 1000, 5000, 12000]) {
        const pcm = tone(hz, block.pcmLength), values = block.extract(pcm, pcm, 0).slice(0, 64);
        peaks.push(values.indexOf(Math.max(...values)));
    }
    expect(peaks).toEqual([...peaks].sort((a, b) => a - b)); expect(new Set(peaks).size).toBe(5);
    let seed = 42; const noise = Float32Array.from({ length: block.pcmLength }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 - 0.5; });
    expect([...block.extract(noise, noise, 0)].every(v => v > 0 && Number.isFinite(v))).toBe(true);
    const smooth = new WallpaperSmoothing(); let output = new Float32Array(128) as Float32Array;
    for (let i = 0; i < 90; i++) output = smooth.advance(new Float32Array(128).fill(0.01));
    for (let i = 0; i < 4; i++) output = smooth.advance(new Float32Array(128).fill(8));
    expect(Math.max(...output)).toBeGreaterThan(1); expect([...output].every(Number.isFinite)).toBe(true);
    expect([...smooth.advance(new Float32Array(128))]).toEqual(Array(128).fill(0));
});

test('mono/quad/5.1 speakers mixing preserves independent channels and ignores LFE', async () => {
    const channels = [1, 2, 3, 100, 5, 6].map(v => new Float32Array([v, -v]));
    expect(speakersToStereo([channels[0]!])).toEqual([channels[0], channels[0]]);
    expect(speakersToStereo(channels)[0][0]).toBeCloseTo(1 + Math.SQRT1_2 * 8, 5);
    expect(speakersToStereo(channels)[1][0]).toBeCloseTo(2 + Math.SQRT1_2 * 9, 5);
    expect(speakersToStereo(channels.slice(0, 4))[0][0]).toBe(2);
    const descriptor = { trackId: 't', revision: 1, sampleRate: 48000, channelCount: 6, length: 2, durationSeconds: 2 / 48000 };
    const copy = await copyDecodedAudioToMono({ getDecodedAudioDescriptor: () => descriptor, copyDecodedChannelRange: ({ channel, start, length }) => channels[channel]!.slice(start, start + length) }, { stereo: true, chunkSize: 1, yieldControl });
    expect(copy.stereoPcm).toEqual(speakersToStereo(channels)); expect(copy.pcm[0]).toBeCloseTo(117 / 6);
});

test('30Hz sequence, mixed Meyda extraction, codec, cursor and visualizer share exact Float32 values', async () => {
    const config = await createAnalysisConfig(48000), left = tone(440, 24000), right = tone(2000, 24000);
    const request = { kind: 'analyze' as const, jobId: 'we', generation: 1, trackHash: 'song', config, featureIds: ['wallpaperEngineSpectrum', 'rms'] as const, cursorFeatureIds: ['wallpaperEngineSpectrum', 'rms'] as const, pcm: left.buffer, stereoPcm: [left.buffer, right.buffer] as const, durationSeconds: 0.5 };
    const result = await runAnalysisJob(request, { yieldControl }), direct = await analyzeWallpaperSpectrum(left, right, config, 'song', { yieldControl });
    const series = result.result.series[0]!, restored = decodeAnalysisSeries(encodeAnalysisSeries(series));
    expect(series).toEqual(direct); expect(restored).toEqual(series);
    expect(series.payload.kind).toBe('stereo-spectrum-f32');
    for (const time of [0, 0.033, 0.14, 0.49, 0.14, ...Array.from({length:15},(_,i)=>i/30)]) {
        const cursor = extractCursorValue(result.retained, { kind: 'cursor-value', requestId: 'cursor', generation: 1, trackHash: 'song', config, featureId: 'wallpaperEngineSpectrum', timeSeconds: time })!;
        expect(projectAnalysisSeries(restored, 'default', { kind: 'full' }, time)).toEqual(cursor.value);
        expect(projectAnalysisSeries(restored, 'default', { kind: 'bin', index: 72 }, time)).toBe((cursor.value as number[])[72]);
    }
    expect((extractCursorValue(result.retained, { kind:'cursor-value',requestId:'c',generation:2,trackHash:'song',config,featureId:'wallpaperEngineSpectrum',timeSeconds:0 }) )).toBeNull();
    const meyda = await runAnalysisJob({ ...request, featureIds: ['rms'], cursorFeatureIds: ['rms'], stereoPcm: undefined }, { yieldControl });
    expect(result.result.series[1]).toEqual(meyda.result.series[0]);
    expect([...geometricSpectrum(Array(128).fill(2), 0.6, undefined, 'we-strength')]).toEqual(Array(128).fill(Math.fround(1.2)));
    expect(wallpaperPcmLength(48000)).toBe(1399);
});

test('cancellation is observed at bounded batches and malformed stereo is rejected', async () => {
    const config = await createAnalysisConfig(48000), pcm = tone(440, 48000);
    let cancelled = false;
    await expect(analyzeWallpaperSpectrum(pcm, pcm, config, 'song', { isCancelled: () => cancelled, yieldControl: async () => { cancelled = true; } })).rejects.toThrow('cancelled');
    await expect(runAnalysisJob({ kind:'analyze',jobId:'bad',generation:1,trackHash:'song',config,featureIds:['wallpaperEngineSpectrum'],cursorFeatureIds:['wallpaperEngineSpectrum'],pcm:pcm.buffer,durationSeconds:1 })).rejects.toThrow('stereo PCM');
});
