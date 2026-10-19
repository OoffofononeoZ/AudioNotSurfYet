import type { CompositionDraftRepositoryPort } from './compositionDraftRepository';
import type { VisualizerProjectV5 } from './compositionTypes';

export class CompositionDraftWriter {
    private pending: VisualizerProjectV5 | null = null;
    private active: Promise<boolean> | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;

    private repository: CompositionDraftRepositoryPort;
    private notify: (
        state: 'saving' | 'saved' | 'not-persisted',
        project: VisualizerProjectV5,
        message?: string,
    ) => void;

    constructor(repository: CompositionDraftRepositoryPort, notify: CompositionDraftWriter['notify']) {
        this.repository = repository;
        this.notify = notify;
    }

    hasPending() {
        return !!(this.pending || this.active);
    }

    queue(project: VisualizerProjectV5) {
        this.pending = structuredClone(project);
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.flush();
        }, 250);
    }

    flush(): Promise<boolean> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        // Every caller waits for the same drain, including edits queued during a write.
        if (!this.active)
            this.active = Promise.resolve()
                .then(() => this.drain())
                .finally(() => {
                    this.active = null;
                });
        return this.active;
    }

    private async drain(): Promise<boolean> {
        while (this.pending) {
            const project = this.pending;
            this.pending = null;
            this.notify('saving', project);
            try {
                await this.repository.replace({ schemaVersion: 5, savedAt: new Date().toISOString(), project });
            } catch (error) {
                if (!this.pending) this.pending = project;
                this.notify('not-persisted', project, (error as Error).message);
                return false;
            }
            this.notify(this.pending ? 'saving' : 'saved', project);
        }
        return true;
    }
}
