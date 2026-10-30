import { ipcMain, type BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import type { ClosePhase, CloseReply, CloseRequest } from '../src/platform/lifecycleContracts';
import { grantId } from './files/nativeGrants';
import { requireOwner } from './files/ownedIpc';
import { nativeResult, NativeFileError } from './files/nativeErrors';

interface Pending {
    phase: ClosePhase;
    token: string;
    resolve(reply: CloseReply): void;
    reject(error: Error): void;
    timer?: ReturnType<typeof setTimeout>;
}
export class ShutdownChannel {
    private readonly getWindow: () => BrowserWindow | null;
    private readonly origin: string;
    private readyToken: string | null = null;
    private pending = new Map<string, Pending>();
    constructor(getWindow: () => BrowserWindow | null, origin: string) {
        this.getWindow = getWindow;
        this.origin = origin;
        ipcMain.handle('audiosurf:lifecycle:ready', event =>
            nativeResult(async () => {
                const owner = requireOwner(event, this.getWindow(), this.origin);
                if (this.readyToken) this.invalidate();
                this.readyToken = owner.webContents.mainFrame.frameToken;
            }),
        );
        ipcMain.handle('audiosurf:lifecycle:reply', (event, id: unknown, input: unknown) =>
            nativeResult(async () => {
                const owner = requireOwner(event, this.getWindow(), this.origin);
                const key = grantId(id),
                    pending = this.pending.get(key);
                if (!pending || pending.token !== owner.webContents.mainFrame.frameToken)
                    throw new NativeFileError('invalid-request');
                const reply = input as CloseReply;
                if (!reply || typeof reply.ok !== 'boolean') throw new NativeFileError('invalid-request');
                if (!reply.ok && (typeof reply.message !== 'string' || reply.message.length > 500))
                    throw new NativeFileError('invalid-request');
                if (
                    reply.ok &&
                    pending.phase === 'inspect' &&
                    (!reply.summary ||
                        !['unsaved', 'tasks', 'output'].every(
                            key => typeof reply.summary![key as keyof typeof reply.summary] === 'boolean',
                        ))
                )
                    throw new NativeFileError('invalid-request');
                this.pending.delete(key);
                clearTimeout(pending.timer);
                pending.resolve(
                    reply.ok
                        ? { ok: true, ...(pending.phase === 'inspect' ? { summary: reply.summary } : {}) }
                        : { ok: false, message: reply.message },
                );
            }),
        );
    }
    get ready() {
        const owner = this.getWindow();
        return (
            !!owner &&
            !owner.isDestroyed() &&
            !!this.readyToken &&
            owner.webContents.mainFrame.frameToken === this.readyToken &&
            owner.webContents.mainFrame.origin === this.origin
        );
    }
    request(phase: ClosePhase, timeoutMs?: number): Promise<CloseReply> {
        if (!this.ready) return Promise.reject(Error('窗口退出处理器尚未就绪。'));
        const owner = this.getWindow()!,
            id = randomUUID();
        return new Promise((resolve, reject) => {
            const pending: Pending = { phase, token: this.readyToken!, resolve, reject };
            this.pending.set(id, pending);
            if (timeoutMs !== undefined)
                pending.timer = setTimeout(() => {
                    this.pending.delete(id);
                    reject(Error('窗口没有响应退出检查。'));
                }, timeoutMs);
            try {
                owner.webContents.send('audiosurf:lifecycle:request', { id, phase } satisfies CloseRequest);
            } catch (error) {
                this.pending.delete(id);
                clearTimeout(pending.timer);
                reject(error);
            }
        });
    }
    invalidate() {
        this.readyToken = null;
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(Error('窗口已离开，退出检查失效。'));
        }
        this.pending.clear();
    }
    dispose() {
        this.invalidate();
        ipcMain.removeHandler('audiosurf:lifecycle:ready');
        ipcMain.removeHandler('audiosurf:lifecycle:reply');
    }
}
