import { expect, test } from 'vitest';
import { AnalysisPriorityTasks } from '../../src/analysis/priorityTasks';
import { createAnalysisConfig } from '../../src/analysis/config';
import { estimateTempo, estimateTempoAsync } from '../../src/analysis/tempoEstimator';

test('services visible work at a checkpoint, then advances interrupted background work', async () => {
    const tasks = new AnalysisPriorityTasks(),
        order: string[] = [];
    let complete!: () => void;
    const done = new Promise<void>(resolve => {
        complete = resolve;
    });
    tasks.enqueue(async () => {
        order.push('background');
        await tasks.checkpoint();
        order.push('background-advanced');
        await tasks.checkpoint();
        order.push('finished');
        complete();
    }, 0);
    tasks.enqueue(async () => {
        order.push('window-one');
    }, 2);
    tasks.enqueue(async () => {
        order.push('window-two');
    }, 2);
    await done;
    expect(order).toEqual(['background', 'window-one', 'background-advanced', 'window-two', 'finished']);
});

test('cooperative BPM matches synchronous BPM and stops after cancellation', async () => {
    const config = await createAnalysisConfig(48000);
    const pcm = Float32Array.from({ length: 96000 }, (_, i) => Math.sin(i * 0.03) * Math.exp(-(i % 24000) / 800));
    let yields = 0;
    expect(
        await estimateTempoAsync(pcm, config, {
            yieldControl: async () => {
                yields++;
            },
        }),
    ).toEqual(estimateTempo(pcm, config));
    expect(yields).toBeGreaterThan(0);
    let cancelled = false;
    expect(
        await estimateTempoAsync(pcm, config, {
            isCancelled: () => cancelled,
            yieldControl: async () => {
                cancelled = true;
            },
        }),
    ).toMatchObject({ state: 'low-confidence', confidence: 0 });
});
