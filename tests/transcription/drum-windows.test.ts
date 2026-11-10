import { describe, expect, it, vi } from 'vitest';
import { ownsDrumTime, primaryDrumWindows, retryDrumWindows } from '../../src/transcription/drumWindows';
import { transcribeDrumReader } from '../../src/transcription/drumTranscription';
import type { DrumBatchModel } from '../../src/transcription/drumBatchModel';

describe('context windows and bounded retries', () => {
    it('owns the entire song exactly once, including first and last partial windows', () => {
        const windows = primaryDrumWindows(3);
        expect(windows.map(w => [w.inputStartSample, w.coverageStartSample, w.coverageEndSample])).toEqual([
            [-7680, 0, 46080],
            [38400, 46080, 72000],
        ]);
        expect(windows.filter(w => ownsDrumTime(w, 1.92))).toHaveLength(1);
        expect(ownsDrumTime(windows[0]!, 0)).toBe(true);
        expect(ownsDrumTime(windows[1]!, 3)).toBe(false);
        const retry = retryDrumWindows(windows[0]!);
        expect(retry.map(w => [w.coverageStartSample, w.coverageEndSample])).toEqual([
            [0, 23040],
            [23040, 46080],
        ]);
        expect(() => retryDrumWindows(retry[0]!)).toThrow('one retry');
    });
    it('keeps successful retry coverage and isolates failed child coverage without publishing partial hits', async () => {
        let call = 0;
        const dispose = vi.fn(async () => {});
        const hit = (time: number) => ({
            startSeconds: time,
            endSeconds: time + 0.1,
            drum: 'kick',
            customPitch: 36,
            strength: 0.8,
        });
        const model = {
            backend: 'webgpu',
            adapter: null,
            setupMs: 5,
            dispose,
            inferBatch: vi.fn(async () =>
                ++call === 1
                    ? [
                          { hits: [hit(0.2)], diagnostic: { termination: 'limit' } },
                          { hits: [hit(2)], diagnostic: { termination: 'eos' } },
                      ]
                    : [
                          { hits: [hit(0.48)], diagnostic: { termination: 'eos' } },
                          { hits: [hit(1.5)], diagnostic: { termination: 'limit' } },
                      ],
            ),
        };
        const reader = {
            sampleRate: 24000,
            frames: 72000,
            channels: 1,
            read: vi.fn(async (_channel: number, _start: number, length: number) => new Float32Array(length)),
        };
        const create = vi.fn(async () => model) as unknown as typeof DrumBatchModel.create;
        const result = await transcribeDrumReader(
            reader,
            3,
            'webgpu',
            new AbortController().signal,
            () => {},
            undefined,
            create,
        );
        expect(result.hits.map(h => h.startSeconds)).toEqual([0.48, 2]);
        expect(result.incomplete).toEqual([{ startSeconds: 0.96, endSeconds: 1.92, reason: 'limit' }]);
        expect(result.diagnostics.map(d => d.attempt)).toEqual([0, 0, 1, 1]);
        expect(model.inferBatch).toHaveBeenCalledTimes(2);
        expect(dispose).toHaveBeenCalledOnce();
    });
});
