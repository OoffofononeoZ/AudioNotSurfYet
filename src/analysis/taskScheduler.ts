/** Background priority lets incoming Worker messages run ahead of continuations. */
export const yieldAnalysisTask = (): Promise<void> => {
    const scheduler = (
        globalThis as unknown as {
            scheduler: {
                yield(): Promise<void>;
                postTask(run: () => Promise<void>, options: { priority: 'background' }): Promise<void>;
            };
        }
    ).scheduler;
    return scheduler.postTask(() => scheduler.yield(), { priority: 'background' });
};

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
