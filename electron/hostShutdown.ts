import type { ClosePhase, CloseReply, CloseSummary } from '../src/platform/lifecycleContracts';

export interface HostShutdownPorts {
    exchange(phase: ClosePhase, timeoutMs?: number): Promise<CloseReply>;
    nativeBusy(): boolean;
    confirm(summary: CloseSummary | null): Promise<boolean>;
    suspendFiles(): void;
    cleanupFiles(): Promise<void>;
    resumeFiles(): void;
    flushStorage(): Promise<void>;
    finish(): void;
    report(message: string): Promise<void>;
}
/** Only commits window destruction after renderer and native owners have acknowledged cleanup. */
export class HostShutdown {
    private work: Promise<void> | null = null;
    private approved = false;
    private readonly ports: HostShutdownPorts;
    constructor(ports: HostShutdownPorts) {
        this.ports = ports;
    }
    get completed() {
        return this.approved;
    }
    requestClose(): Promise<void> {
        if (this.approved) return Promise.resolve();
        if (!this.work)
            this.work = this.close()
                .catch(async () => {
                    await this.restore();
                    await this.report('退出未能完成，当前窗口保持打开，请重试。');
                })
                .finally(() => {
                    this.work = null;
                });
        return this.work;
    }
    private async checked(phase: ClosePhase, timeoutMs?: number) {
        const reply = await this.ports.exchange(phase, timeoutMs);
        if (!reply.ok) throw Error(reply.message);
    }
    private async restore() {
        try {
            this.ports.resumeFiles();
            await this.checked('resume', 5000);
        } catch {
            /* A crashed frame cannot resume. */
        }
    }
    private async report(message: string) {
        try {
            await this.ports.report(message);
        } catch {
            /* The native window may already have been destroyed. */
        }
    }
    private async close() {
        let summary: CloseSummary | null = null;
        try {
            const reply = await this.ports.exchange('inspect', 5000);
            if (reply.ok && reply.summary) summary = reply.summary;
        } catch {
            /* The native dialog requires explicit consent to close an unresponsive page. */
        }
        if (
            (!summary || summary.unsaved || summary.tasks || summary.output || this.ports.nativeBusy()) &&
            !(await this.ports.confirm(summary))
        )
            return;
        if (summary) {
            try {
                await this.checked('prepare');
            } catch (error) {
                await this.restore();
                await this.report(error instanceof Error ? error.message : '草稿未能保存，窗口保持打开。');
                return;
            }
        }
        this.ports.suspendFiles();
        try {
            await this.ports.cleanupFiles();
            await this.ports.flushStorage();
        } catch {
            await this.restore();
            await this.report('文件或本地存储尚未完成收尾，窗口保持打开，请重试。');
            return;
        }
        if (summary) {
            try {
                await this.checked('dispose');
            } catch (error) {
                await this.restore();
                await this.report(error instanceof Error ? error.message : '资源释放未完成，请重试关闭。');
                return;
            }
        }
        this.approved = true;
        this.ports.finish();
    }
}
