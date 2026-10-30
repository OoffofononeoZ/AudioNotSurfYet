import { NativeFileError, nativeError } from './nativeErrors';

/** One lifetime for the owner's dialogs and file IPC, separate from renderer shutdown messages. */
export class NativeIpcTasks {
    private pending = new Set<Promise<unknown>>();
    private epoch = 0;
    private open = true;
    get accepting() {
        return this.open;
    }
    get revision() {
        return this.epoch;
    }
    get busy() {
        return this.pending.size > 0;
    }
    invalidate() {
        ++this.epoch;
    }
    suspend() {
        this.open = false;
        this.invalidate();
    }
    resume() {
        this.open = true;
    }
    current(revision: number) {
        return this.open && this.epoch === revision;
    }
    run<T>(operation: () => Promise<T>, cleanup = false): Promise<T> {
        if (!this.open && !cleanup) return Promise.reject(new NativeFileError('permission-denied'));
        const work = operation();
        this.pending.add(work);
        void work.then(
            () => this.pending.delete(work),
            () => this.pending.delete(work),
        );
        return work;
    }
    async drain() {
        while (this.pending.size) {
            const results = await Promise.allSettled([...this.pending]);
            if (
                results.some(
                    result => result.status === 'rejected' && nativeError(result.reason).code === 'cleanup-failed',
                )
            )
                throw new NativeFileError('cleanup-failed');
        }
    }
}
