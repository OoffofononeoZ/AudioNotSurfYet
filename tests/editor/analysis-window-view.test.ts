import { afterEach, expect, test, vi } from 'vitest';
import {
    EditorAnalysisWindowView,
    waveformBucketSamples,
    type AnalysisWindowViewInput,
} from '../../src/editor/analysisWindowView';
import type { AnalysisWindowInput, AnalysisWindowSeries } from '../../src/analysis/windowTypes';

function context(): AnalysisWindowViewInput {
    return {
        series: {
            schemaVersion: 1,
            trackHash: 'track',
            configHash: 'config',
            featureId: 'buffer',
            startTimeSeconds: 0,
            sampleStepSeconds: 0.04,
            sampleCount: 2500,
            dimensions: [1024],
            payload: { kind: 'waveform-envelope', min: new Int16Array(2500), max: new Int16Array(2500), scale: 1 },
        },
        generation: 1,
        startSeconds: 10,
        endSeconds: 20,
        durationSeconds: 100,
        sampleRate: 48000,
        pixels: 1000,
        enabled: true,
    };
}
function result(input: AnalysisWindowInput): AnalysisWindowSeries {
    return {
        ...context().series!,
        startTimeSeconds: input.startSeconds,
        endTimeSeconds: input.endSeconds,
        sampleStepSeconds: input.waveformBucketSamples / 48000,
    };
}
afterEach(() => vi.useRealTimers());

test('continuous zoom waits for 150ms of quiet and only requests the last resolution', async () => {
    vi.useFakeTimers();
    const request = vi.fn(async (input: AnalysisWindowInput) => result(input));
    const changed = vi.fn(),
        view = new EditorAnalysisWindowView(request, changed),
        input = context();
    view.update(input);
    for (let i = 1; i <= 5; i++) {
        await vi.advanceTimersByTimeAsync(100);
        view.update({ ...input, endSeconds: 20 - i });
    }
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(149);
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]![0].waveformBucketSamples).toBe(waveformBucketSamples({ ...input, endSeconds: 15 }));
    view.dispose();
});

test('playback reuses coverage, prefetches at the edge, and a source change rejects a late result', async () => {
    vi.useFakeTimers();
    const pending: Array<{
        input: AnalysisWindowInput;
        signal: AbortSignal;
        resolve: (value: AnalysisWindowSeries | null) => void;
    }> = [];
    const changed = vi.fn();
    const view = new EditorAnalysisWindowView(
        (input, signal) => new Promise(resolve => pending.push({ input, signal, resolve })),
        changed,
    );
    const input = context();
    view.update(input);
    await vi.advanceTimersByTimeAsync(150);
    pending[0]!.resolve(result(pending[0]!.input));
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 60; i++) view.update({ ...input, startSeconds: 11, endSeconds: 21 });
    expect(pending).toHaveLength(1);
    view.update({ ...input, startSeconds: 18, endSeconds: 28 });
    await vi.advanceTimersByTimeAsync(0);
    expect(pending).toHaveLength(2);
    view.update({ ...input, generation: 2, enabled: false });
    expect(pending[1]!.signal.aborted).toBe(true);
    changed.mockClear();
    pending[1]!.resolve(result(pending[1]!.input));
    await vi.advanceTimersByTimeAsync(0);
    expect(changed).not.toHaveBeenCalled();
    view.dispose();
});

test('two views remain independent and disposal clears timers and in-flight signals', async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const request = vi.fn((_input: AnalysisWindowInput, signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<AnalysisWindowSeries | null>(() => {});
    });
    const first = new EditorAnalysisWindowView(request, () => {}),
        second = new EditorAnalysisWindowView(request, () => {});
    first.update(context());
    second.update(context());
    first.dispose();
    await vi.advanceTimersByTimeAsync(150);
    expect(request).toHaveBeenCalledOnce();
    second.dispose();
    expect(signals[0]!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
});
