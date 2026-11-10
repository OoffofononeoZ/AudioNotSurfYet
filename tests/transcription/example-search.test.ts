import { describe, expect, it } from 'vitest';
import { ACOUSTIC_CONFIG, ACOUSTIC_CONFIG_HASH, acousticFrameSeconds } from '../../src/transcription/acousticIndex';
import type { AcousticIndex } from '../../src/transcription/acousticIndex';
import { boundedDtw, searchSoundExamples } from '../../src/transcription/examples/matcher';
import type { ExampleProfile } from '../../src/transcription/examples/types';

function fixture(seconds = 8): AcousticIndex {
    const rate = ACOUSTIC_CONFIG.sampleRate,
        frames = Math.ceil((seconds * rate) / ACOUSTIC_CONFIG.hopSize);
    return {
        configHash: ACOUSTIC_CONFIG_HASH,
        sourceFrames: seconds * rate,
        sourceSampleRate: rate,
        durationSeconds: seconds,
        frameCount: frames,
        rms: new Float32Array(frames),
        onset: new Float32Array(frames),
        mfcc: new Float32Array(frames * 13),
        chroma: new Float32Array(frames * 12),
        bandRms: new Float32Array(frames * 3),
        bandOnset: new Float32Array(frames * 3),
    };
}
function sound(index: AcousticIndex, first: number, length: number, type: number, gain = 1, reversed = false) {
    for (let i = 0; i < length; i++) {
        const frame = first + i;
        index.rms[frame] = 0.2 * gain;
        index.onset[frame] = i ? 0 : 0.9;
        for (let c = 0; c < 13; c++)
            index.mfcc[frame * 13 + c] =
                c === 0
                    ? 100 * gain
                    : 4 * Math.sin(c * (type + 1)) +
                      3 * Math.cos(((reversed ? length - i : i) / length) * Math.PI * 2 + c);
    }
}
function profile(index: AcousticIndex): ExampleProfile {
    return {
        version: 1,
        id: '12345678-1234-1234-1234-123456789abc',
        songHash: 'a'.repeat(64),
        sourceKey: 'b'.repeat(64),
        label: '声音 A',
        durationSeconds: index.durationSeconds,
        examples: [],
        threshold: 0.86,
        negativeMargin: 0.04,
        matches: [],
        queryHash: null,
    };
}
const signal = () => new AbortController().signal;
describe('same-song sound examples', () => {
    it('finds repeated attacks at different gains, preserves fast repeats and excludes silence', async () => {
        const index = fixture(),
            p = profile(index);
        for (const frame of [30, 80, 83, 150]) sound(index, frame, 3, 1, frame === 150 ? 0.2 : 1);
        sound(index, 220, 3, 4);
        const time = acousticFrameSeconds(30);
        p.examples = [{ id: 'positive', kind: 'point', polarity: 'positive', startSeconds: time, endSeconds: time }];
        p.threshold = 0.75;
        const result = await searchSoundExamples(index, p, signal());
        expect(result.matches.filter(m => [30, 80, 83, 150].includes(m.anchorFrame))).toHaveLength(4);
        expect(result.matches.every(m => m.selected === false)).toBe(true);
        expect(result.matches.some(m => m.anchorFrame < 25 || m.anchorFrame > 225)).toBe(false);
    });
    it('uses temporal order for phrases and supports multiple positives and explicit negatives', async () => {
        const index = fixture(12),
            p = profile(index);
        sound(index, 30, 32, 1);
        sound(index, 180, 38, 1);
        sound(index, 330, 32, 1, 1, true);
        p.examples = [
            {
                id: 'phrase',
                kind: 'range',
                polarity: 'positive',
                startSeconds: acousticFrameSeconds(30),
                endSeconds: acousticFrameSeconds(61),
            },
        ];
        p.threshold = 0.88;
        const before = await searchSoundExamples(index, p, signal());
        expect(before.matches.some(m => Math.abs(m.anchorFrame - 180) <= 2)).toBe(true);
        p.examples.push({
            id: 'negative',
            kind: 'range',
            polarity: 'negative',
            startSeconds: acousticFrameSeconds(330),
            endSeconds: acousticFrameSeconds(361),
        });
        const after = await searchSoundExamples(index, p, signal());
        expect(after.matches.some(m => Math.abs(m.anchorFrame - 180) <= 2)).toBe(true);
        expect(after.matches.some(m => Math.abs(m.anchorFrame - 330) <= 10)).toBe(false);
        expect(after.refinedCandidates).toBeGreaterThan(0);
    });
    it('rejects source changes, silent examples, missing positives, and cancellation', async () => {
        const index = fixture(),
            p = profile(index);
        await expect(searchSoundExamples(index, p, signal())).rejects.toThrow('正例');
        p.examples = [{ id: 'silent', kind: 'point', polarity: 'positive', startSeconds: 1, endSeconds: 1 }];
        await expect(searchSoundExamples(index, p, signal())).rejects.toThrow('静音');
        p.durationSeconds++;
        await expect(searchSoundExamples(index, p, signal())).rejects.toThrow('匹配');
        const abort = new AbortController();
        abort.abort();
        expect(() => boundedDtw(new Float32Array(24), new Float32Array(24), abort.signal)).toThrow();
    });
});
