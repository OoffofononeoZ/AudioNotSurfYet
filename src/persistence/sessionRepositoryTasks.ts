import type { SessionRepositoryPort } from './sessionRepository';

/** Keeps the repository contract unchanged while allowing the app owner to await all current transactions. */
export class SessionRepositoryTasks implements SessionRepositoryPort {
    private readonly repository: SessionRepositoryPort;
    private pending = new Set<Promise<unknown>>();
    constructor(repository: SessionRepositoryPort) {
        this.repository = repository;
    }
    private track<T>(work: Promise<T>): Promise<T> {
        this.pending.add(work);
        void work.then(
            () => this.pending.delete(work),
            () => this.pending.delete(work),
        );
        return work;
    }
    get busy() {
        return this.pending.size > 0;
    }
    async flush() {
        while (this.pending.size) await Promise.allSettled([...this.pending]);
    }
    restore(...args: Parameters<SessionRepositoryPort['restore']>) {
        return this.track(this.repository.restore(...args));
    }
    saveQueue(...args: Parameters<SessionRepositoryPort['saveQueue']>) {
        return this.track(this.repository.saveQueue(...args));
    }
    replaceCurrent(...args: Parameters<SessionRepositoryPort['replaceCurrent']>) {
        return this.track(this.repository.replaceCurrent(...args));
    }
    replaceCurrentAnalysisCache(...args: Parameters<SessionRepositoryPort['replaceCurrentAnalysisCache']>) {
        return this.track(this.repository.replaceCurrentAnalysisCache(...args));
    }
    removeTrack(...args: Parameters<SessionRepositoryPort['removeTrack']>) {
        return this.track(this.repository.removeTrack(...args));
    }
    clear(...args: Parameters<SessionRepositoryPort['clear']>) {
        return this.track(this.repository.clear(...args));
    }
}
