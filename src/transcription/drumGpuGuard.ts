import { ProcessingError } from '../processing/modelManifest';

/** Observe ORT's own device; never request a different device or provider. */
export class DrumGpuGuard {
    private error: ProcessingError | null = null;
    private closed = false;
    private attached = false;
    private waiting = false;
    private timer: ReturnType<typeof setInterval> | null = null;
    private abortTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingAborts: unknown[] = [];
    private rejectLoss!: (error: Error) => void;
    private readonly loss = new Promise<never>((_, reject) => {
        this.rejectLoss = reject;
    });
    private readonly readDevice: () => GPUDevice | Promise<GPUDevice> | undefined;
    private readonly onUnhandled = (event: PromiseRejectionEvent) => {
        // Native WebGPU can report a map abort just before device.lost resolves.
        // Preserve that exact error briefly; without confirmed loss it is reported.
        if (
            event.reason?.name === 'AbortError' &&
            /GPUBuffer.*(?:lost|unmapped before mapping was resolved)|Device.*lost/i.test(String(event.reason?.message))
        ) {
            if (!this.error && (!this.attached || this.closed)) return;
            event.preventDefault();
            if (this.error) return;
            this.pendingAborts.push(event.reason);
            this.abortTimer ??= setTimeout(() => this.finishAborts(!this.error), 50);
        }
    };
    constructor(readDevice: () => GPUDevice | Promise<GPUDevice> | undefined) {
        this.readDevice = readDevice;
        void this.loss.catch(() => {});
        globalThis.addEventListener?.('unhandledrejection', this.onUnhandled as EventListener);
        this.observe();
        if (!this.attached) this.timer = setInterval(() => this.observe(), 25);
    }
    get hasLost(): boolean {
        return this.error !== null;
    }
    observe(): void {
        if (this.closed || this.attached || this.waiting) return;
        let value: GPUDevice | Promise<GPUDevice> | undefined;
        try {
            value = this.readDevice();
        } catch {
            return;
        }
        if (!value) return;
        this.waiting = true;
        void Promise.resolve(value).then(
            device => {
                this.waiting = false;
                if (this.closed || this.attached || !device?.lost) return;
                this.attached = true;
                if (this.timer) clearInterval(this.timer);
                this.timer = null;
                void device.lost.then(info => {
                    if (this.closed) return;
                    this.error = new ProcessingError(
                        'webgpu-device-lost',
                        `鼓推理的 GPU 设备已丢失（${info.reason}）。本次未完成的鼓结果未发布，可重新分析或主动选择慢速 WASM。`,
                    );
                    this.finishAborts(false);
                    this.rejectLoss(this.error);
                });
            },
            () => {
                this.waiting = false;
            },
        );
    }
    async run<T>(operation: () => Promise<T>): Promise<T> {
        this.observe();
        if (this.error) throw this.error;
        try {
            return await Promise.race([operation(), this.loss]);
        } catch (error) {
            throw this.error ?? error;
        }
    }
    async release(operations: Array<() => Promise<void>>): Promise<void> {
        const releasing = Promise.allSettled(operations.map(operation => Promise.resolve().then(operation)));
        try {
            // A dead device has already invalidated its buffers. ORT release/run
            // promises may never settle; the controller owns Worker termination.
            if (!this.error) await Promise.race([releasing, this.loss]);
        } catch (error) {
            if (!this.error) throw error;
        } finally {
            this.close();
        }
    }
    close(): void {
        this.closed = true;
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.finishAborts(!this.error);
        // Retain the scoped late-map abort handler after loss until this Worker
        // is terminated. Normal disposal removes it immediately.
        if (!this.error) globalThis.removeEventListener?.('unhandledrejection', this.onUnhandled as EventListener);
    }
    private finishAborts(report: boolean): void {
        if (this.abortTimer) clearTimeout(this.abortTimer);
        this.abortTimer = null;
        const pending = this.pendingAborts.splice(0);
        if (report) for (const error of pending) globalThis.reportError(error);
    }
}
