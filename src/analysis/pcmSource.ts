import { copyDecodedAudioToMono, PcmCopyError, type DecodedAudioCopyPort } from './pcm';
import type { AnalysisConfig, AnalysisWorkerRequest } from './types';

/** Main-thread ownership of the single source preparation/acknowledgement. */
export class AnalysisPcmSource {
    private entry: {
        key: string;
        promise: Promise<void>;
        resolve(): void;
        reject(error: unknown): void;
        ready: boolean;
        timer?: ReturnType<typeof setTimeout>;
    } | null = null;
    get ready(): boolean {
        return this.entry?.ready ?? false;
    }
    async prepare(
        key: string,
        config: AnalysisConfig,
        trackHash: string,
        engine: DecodedAudioCopyPort,
        post: (message: AnalysisWorkerRequest, transfer?: Transferable[]) => void,
        yieldControl?: () => Promise<void>,
    ): Promise<void> {
        if (this.entry?.key === key) return this.entry.promise;
        this.clear();
        let resolve!: () => void, reject!: (error: unknown) => void;
        const promise = new Promise<void>((yes, no) => {
            resolve = yes;
            reject = no;
        });
        const entry = { key, promise, resolve, reject, ready: false } as NonNullable<typeof this.entry>;
        this.entry = entry;
        void copyDecodedAudioToMono(engine, { yieldControl, isCancelled: () => this.entry !== entry })
            .then(copied => {
                if (this.entry !== entry) return;
                entry.timer = setTimeout(() => {
                    if (this.entry === entry) this.clear(new Error('Audio source preparation timed out.'));
                }, 15000);
                post(
                    {
                        kind: 'prepare-source',
                        sourceKey: key,
                        trackHash,
                        config,
                        pcm: copied.pcm.buffer as ArrayBuffer,
                        durationSeconds: copied.descriptor.durationSeconds,
                    },
                    [copied.pcm.buffer],
                );
            })
            .catch(error => {
                if (this.entry === entry) this.clear(error);
            });
        return promise;
    }
    acknowledge(key: string): void {
        const entry = this.entry;
        if (entry?.key !== key) return;
        clearTimeout(entry.timer);
        entry.ready = true;
        entry.resolve();
    }
    fail(key: string, message: string): void {
        if (this.entry?.key === key) this.clear(new Error(message));
    }
    clear(error: unknown = new PcmCopyError('stale', 'Audio source changed.')): void {
        const entry = this.entry;
        this.entry = null;
        if (!entry) return;
        clearTimeout(entry.timer);
        if (!entry.ready) entry.reject(error);
    }
}
