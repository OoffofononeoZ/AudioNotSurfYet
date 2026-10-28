/** Yield to browser tasks without the minimum delay of nested timers. */
export const yieldAnalysisTask = (): Promise<void> =>
    (globalThis as unknown as { scheduler: { yield(): Promise<void> } }).scheduler.yield();

/** Copying remains chunked, but only yields when its CPU time budget is spent. */
export function createBudgetYield(
    yieldControl = yieldAnalysisTask,
    now = () => performance.now(),
    budgetMs = 8,
): () => Promise<void> {
    let started = now();
    return async () => {
        if (now() - started < budgetMs) return;
        await yieldControl();
        started = now();
    };
}
