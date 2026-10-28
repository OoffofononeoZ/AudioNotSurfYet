import { yieldAnalysisTask } from './taskScheduler';

/** One Worker, cooperative priority at frame boundaries; no parallel PCM owners. */
export class AnalysisPriorityTasks {
    private pending: Array<{ priority: number; run(): Promise<void> }> = [];
    private pumping = false;
    private priority = -1;
    enqueue(run: () => Promise<void>, priority = 1): void {
        this.pending.push({ run, priority });
        void this.pump();
    }
    private take(minimum: number) {
        let index = -1;
        for (let i = 0; i < this.pending.length; i++)
            if (
                this.pending[i]!.priority > minimum &&
                (index < 0 || this.pending[i]!.priority > this.pending[index]!.priority)
            )
                index = i;
        return index < 0 ? null : this.pending.splice(index, 1)[0]!;
    }
    private async execute(task: NonNullable<ReturnType<AnalysisPriorityTasks['take']>>) {
        const previous = this.priority;
        this.priority = task.priority;
        try {
            await task.run();
        } finally {
            this.priority = previous;
        }
    }
    private async pump(): Promise<void> {
        if (this.pumping) return;
        this.pumping = true;
        try {
            let task;
            while ((task = this.take(-1))) await this.execute(task);
        } finally {
            this.pumping = false;
        }
    }
    checkpoint = async (): Promise<void> => {
        await yieldAnalysisTask();
        // Service one higher-priority job, then let the interrupted job advance.
        const task = this.take(this.priority);
        if (task) await this.execute(task);
    };
}
