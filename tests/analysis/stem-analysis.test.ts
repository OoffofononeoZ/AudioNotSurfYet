import { describe, it, expect } from 'vitest';
import { createAnalysisConfig } from '../../src/analysis/config';
import { runAnalysisJob } from '../../src/analysis/workerCore';
import { runStemAnalysis, readStemCursor, readStemWindow } from '../../src/analysis/stemWorkerCore';
import { validateAnalysisInputs, analysisInputKey, STEM_FEATURE_IDS } from '../../src/analysis/sources';
import type { StemPcmSource } from '../../src/analysis/stemProtocol';

async function fixture(): Promise<StemPcmSource> {
    const left = Float32Array.from({ length: 7000 }, (_, i) => Math.sin(i * 0.07) * 0.4),
        right = Float32Array.from({ length: left.length }, (_, i) => Math.sin(i * 0.13) * 0.2);
    return {
        role: 'drums',
        identity: 'verified',
        trackHash: 'track',
        frames: left.length,
        config: await createAnalysisConfig(44100),
        left: new File([left], 'left'),
        right: new File([right], 'right'),
    };
}
describe('source-scoped stem analysis', () => {
    it('matches the existing full PCM extraction, including stereo wallpaper history', async () => {
        const source = await fixture(),
            left = new Float32Array(await source.left.arrayBuffer()),
            right = new Float32Array(await source.right.arrayBuffer()),
            mono = Float32Array.from(left, (v, i) => (v + right[i]!) / 2);
        const reference = await runAnalysisJob({
            kind: 'analyze',
            jobId: 'reference',
            generation: 1,
            trackHash: source.trackHash,
            config: source.config,
            featureIds: STEM_FEATURE_IDS,
            cursorFeatureIds: STEM_FEATURE_IDS,
            pcm: mono.buffer,
            stereoPcm: [left.buffer, right.buffer],
            durationSeconds: source.frames / 44100,
        });
        const actual = await runStemAnalysis(source, STEM_FEATURE_IDS, () => false);
        for (const series of actual)
            expect(series).toEqual(reference.result.series.find(s => s.featureId === series.featureId));
        const value = await readStemCursor(source, 'buffer', 0.08, 1, 'cursor', () => false);
        expect(value?.value).toHaveLength(1024);
    });
    it('uses real PCM for detailed waveform windows and observes cancellation', async () => {
        const source = await fixture();
        const window = await readStemWindow(
            source,
            { featureId: 'buffer', startSeconds: 0.03, endSeconds: 0.06, waveformBucketSamples: 1 },
            () => false,
        );
        expect(window?.sampleStepSeconds).toBe(1 / 44100);
        expect(window?.startTimeSeconds).toBeLessThanOrEqual(0.03);
        await expect(runStemAnalysis(source, ['energy'], () => true)).rejects.toThrow('取消');
    });
    it('separates same-name features and limits each source independently', () => {
        expect(analysisInputKey({ featureId: 'energy', stemRole: 'drums' })).not.toBe(
            analysisInputKey({ featureId: 'energy', stemRole: 'bass' }),
        );
        expect(() =>
            validateAnalysisInputs(
                ['drums', 'bass', 'other', 'vocals'].flatMap(stemRole =>
                    STEM_FEATURE_IDS.map(featureId => ({ stemRole: stemRole as 'drums', featureId })),
                ),
            ),
        ).not.toThrow();
        expect(() => validateAnalysisInputs([{ stemRole: 'bass', featureId: 'mfcc' }])).toThrow();
    });
});
