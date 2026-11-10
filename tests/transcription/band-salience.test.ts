import { expect, it } from 'vitest';
import { buildAcousticIndex, validAcousticIndex } from '../../src/transcription/acousticIndex';
import { candidateAcoustics, drumAcousticBand } from '../../src/transcription/candidateAcoustics';
import { deriveCandidateReview } from '../../src/transcription/candidateReview';
import { defaultReviewSettings } from '../../src/transcription/reviewSettings';
import { drumCandidate, reviewResult } from './review-fixture';

it('compares a quiet high-frequency drum with its own band even beside a loud kick', async () => {
    const rate = 22050,
        pcm = new Float32Array(rate * 4),
        hats = [0.1, 0.5, 0.6, 0.7, 1.5, 1.6, 1.7, 2.5, 2.6, 2.7, 3.5, 3.6, 3.7];
    const tone = (start: number, length: number, frequency: number, amplitude: number) => {
        for (let i = Math.round(start * rate); i < Math.round((start + length) * rate); i++) {
            const t = i / rate - start,
                envelope = Math.min(1, t / 0.004, (start + length - i / rate) / 0.004);
            pcm[i] = pcm[i]! + amplitude * Math.sin(2 * Math.PI * frequency * t) * envelope;
        }
    };
    for (const start of [0.1, 1.1, 2.1, 3.1]) tone(start, 0.22, 80, 0.8);
    for (const start of hats) tone(start, 0.03, 7000, 0.04);
    const reader = {
        sampleRate: rate,
        frames: pcm.length,
        channels: 1,
        read: async (_channel: number, start: number, count: number) => pcm.slice(start, start + count),
    };
    const index = await buildAcousticIndex(reader, new AbortController().signal, () => {});
    expect(validAcousticIndex(index)).toBe(true);
    const quietWhole = candidateAcoustics(index, 0.6, 0.72),
        quietBand = candidateAcoustics(index, 0.6, 0.72, 'high');
    expect(quietWhole.salience).toBeLessThan(0.24);
    expect(quietBand.salience).toBeGreaterThan(0.24);
    expect(quietBand.rms).toBeCloseTo(quietWhole.rms, 9);
    const candidates = hats.map((start, i) => ({
        ...drumCandidate(`hat-${i}`, start, 42),
        drum: 'hat' as const,
        acoustics: candidateAcoustics(index, start, start + 0.12, drumAcousticBand('hat')),
    }));
    candidates.push({
        ...drumCandidate('silent', 0.9, 42),
        drum: 'hat' as const,
        acoustics: candidateAcoustics(index, 0.9, 1.02, 'high'),
    });
    const review = deriveCandidateReview(reviewResult(candidates), defaultReviewSettings(), {});
    expect(review.selectedIds).toEqual(hats.map((_, i) => `hat-${i}`));
    expect(review.excluded.silent).toBeTruthy();
    expect(drumAcousticBand('snare')).toBe('mid');
    expect(drumAcousticBand('kick')).toBe('low');
    expect(drumAcousticBand('unknown')).toBe('full');
});
