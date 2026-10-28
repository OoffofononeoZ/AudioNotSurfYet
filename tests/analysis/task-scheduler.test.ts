import { expect, test, vi } from 'vitest';
import { createBudgetYield } from '../../src/analysis/taskScheduler';

test('only yields after its time budget and starts a fresh budget after resuming', async () => {
    let time = 0;
    const yieldControl = vi.fn(async () => {
        time += 100;
    });
    const checkpoint = createBudgetYield(yieldControl, () => time);
    for (time = 1; time < 8; time++) await checkpoint();
    expect(yieldControl).not.toHaveBeenCalled();
    await checkpoint();
    expect(yieldControl).toHaveBeenCalledTimes(1);
    time += 7;
    await checkpoint();
    expect(yieldControl).toHaveBeenCalledTimes(1);
    time++;
    await checkpoint();
    expect(yieldControl).toHaveBeenCalledTimes(2);
});
