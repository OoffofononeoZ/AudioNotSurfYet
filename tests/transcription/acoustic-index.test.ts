import { expect, it, vi } from 'vitest';
import {
    acousticEvidence,
    acousticFrameSeconds,
    buildAcousticIndex,
    validAcousticIndex,
    ACOUSTIC_CONFIG,
} from '../../src/transcription/acousticIndex';

function reader(pcm: Float32Array, sampleRate = 22050) {
    return {
        sampleRate,
        frames: pcm.length,
        channels: 1,
        read: vi.fn(async (_channel: number, start: number, count: number) => pcm.slice(start, start + count)),
    };
}

it('indexes silence without nonfinite MFCCs or invented onset evidence', async () => {
    const index = await buildAcousticIndex(reader(new Float32Array(22050)), new AbortController().signal, () => {});
    expect(validAcousticIndex(index)).toBe(true);
    expect(validAcousticIndex({ ...index, sourceFrames: index.sourceFrames + 1 })).toBe(false);
    expect(index.mfcc.every(value => value === 0)).toBe(true);
    expect(acousticEvidence(index, 0.2, 0.4)).toMatchObject({ rms: 0, onset: 0, localContrast: 0 });
    expect(validAcousticIndex({ ...index, onset: new Float32Array(index.frameCount).fill(NaN) })).toBe(false);
});

it('preserves absolute onset positions across a bounded block boundary and resampling', async () => {
    const sampleRate = 44100,
        pcm = new Float32Array(sampleRate * 4);
    for (const start of [0.5, 3]) {
        for (let i = Math.round(start * sampleRate); i < Math.round((start + 0.12) * sampleRate); i++)
            pcm[i] = 0.5 * Math.sin(2 * Math.PI * 440 * (i / sampleRate - start));
    }
    const source = reader(pcm, sampleRate);
    const index = await buildAcousticIndex(source, new AbortController().signal, () => {});
    expect(validAcousticIndex(index)).toBe(true);
    for (const start of [0.5, 3]) {
        const evidence = acousticEvidence(index, start, start + 0.12);
        expect(evidence.rms).toBeGreaterThan(0.1);
        expect(evidence.onset).toBeGreaterThan(0.2);
        expect(Math.abs(evidence.onsetSeconds - start)).toBeLessThan(0.07);
        expect(evidence.mfcc).toHaveLength(13);
        expect(evidence.mfcc.every(Number.isFinite)).toBe(true);
    }
    expect(acousticFrameSeconds(128)).toBeCloseTo((128 * 512 + 512) / 22050, 12);
    expect(source.read.mock.calls.length).toBeGreaterThan(1);
    expect(Math.max(...source.read.mock.calls.map(call => call[2]))).toBeLessThan(sampleRate * 4);
    expect(index.frameCount).toBe(Math.ceil((4 * ACOUSTIC_CONFIG.sampleRate) / ACOUSTIC_CONFIG.hopSize));
});

it('abandons an index cancelled during PCM read without publishing completion', async () => {
    const abort = new AbortController(),
        progress = vi.fn();
    const source = reader(new Float32Array(22050));
    source.read.mockImplementation(async (_channel, _start, count) => {
        abort.abort();
        return new Float32Array(count);
    });
    await expect(buildAcousticIndex(source, abort.signal, progress)).rejects.toMatchObject({ code: 'job-cancelled' });
    expect(progress).not.toHaveBeenCalled();
});
