/// <reference types="vite/client" />
import workerSource from './algorithmWorker.js?raw';
import { sandboxBridge } from './algorithmSandboxBridge';
import { validateAlgorithmDefinition } from './algorithmCodec';
import { validateDrawPacket } from './drawPacket';
import type { AlgorithmDefinition, AlgorithmFrame, DrawPacket, HistoryRequest, HistorySample } from './algorithmTypes';

export interface RuntimeElement {
    id: string;
    algorithm: AlgorithmDefinition;
}
export interface RuntimeFrame {
    id: string;
    frame: AlgorithmFrame;
}
export type HistoryReader = (elementId: string, request: HistoryRequest) => Promise<HistorySample[]>;
interface Pending {
    resolve(value: unknown): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
    remaining: number;
    started: number;
    frames?: RuntimeFrame[];
    history?: HistoryReader;
    reading?: boolean;
}
export const algorithmRuntimeDiagnostics = { activeSandboxes: 0, activeTasks: 0 };

/** One disposable opaque-origin bridge/worker, owned by one composition scene. */
export class IsolatedAlgorithmRuntime {
    private iframe: HTMLIFrameElement | null = null;
    private port: MessagePort | null = null;
    private pending = new Map<number, Pending>();
    private elements = new Map<string, AlgorithmDefinition>();
    private sequence = 0;
    private disposed = false;
    private connected: Promise<void>;
    private disconnect: () => void = () => {};
    private readyReject: (error: Error) => void = () => {};
    private readonly timeoutMs: number;
    constructor(timeoutMs = 10_000) {
        this.timeoutMs = timeoutMs;
        this.connected = new Promise((resolve, reject) => {
            this.readyReject = reject;
            const iframe = document.createElement('iframe');
            this.iframe = iframe;
            iframe.hidden = true;
            iframe.setAttribute('sandbox', 'allow-scripts');
            iframe.setAttribute('aria-hidden', 'true');
            const nonce = crypto.randomUUID().replace(/-/g, '');
            const listener = (event: MessageEvent) => {
                if (event.source !== iframe.contentWindow || event.data?.kind !== 'algorithm-sandbox-ready') return;
                window.removeEventListener('message', listener);
                const channel = new MessageChannel();
                this.port = channel.port1;
                this.port.onmessage = message => {
                    if (!message.data || typeof message.data !== 'object') {
                        this.fail(Error('隔离算法消息格式无效。'));
                        return;
                    }
                    if (message.data?.connected) {
                        clearTimeout(timer);
                        resolve();
                        return;
                    }
                    void this.receive(message.data);
                };
                this.port.onmessageerror = () => this.fail(Error('隔离算法消息无法读取。'));
                this.port.start();
                iframe.contentWindow!.postMessage({ kind: 'connect', worker: workerSource }, '*', [channel.port2]);
            };
            const timer = setTimeout(() => this.fail(Error('算法隔离环境初始化超时。')), timeoutMs);
            this.disconnect = () => {
                clearTimeout(timer);
                window.removeEventListener('message', listener);
            };
            window.addEventListener('message', listener);
            iframe.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' blob:; worker-src blob:; connect-src 'none'; base-uri 'none'; form-action 'none';"><script nonce="${nonce}">(${sandboxBridge.toString()})()</script>`;
            document.body.append(iframe);
            algorithmRuntimeDiagnostics.activeSandboxes++;
        });
        // A scene can be disposed before its first frame awaits initialization.
        void this.connected.catch(() => {});
    }
    async initialize(elements: RuntimeElement[]) {
        await this.connected;
        const algorithms = new Map<string, AlgorithmDefinition>();
        for (const element of elements) {
            const algorithm = validateAlgorithmDefinition(element.algorithm);
            if (this.elements.has(element.id)) throw Error('算法实例 UUID 重复。');
            this.elements.set(element.id, algorithm);
            algorithms.set(algorithm.hash, algorithm);
        }
        await this.request({
            kind: 'initialize',
            algorithms: [...algorithms.values()],
            elements: elements.map(e => ({ id: e.id, hash: e.algorithm.hash })),
        });
    }
    async prepareFrames(
        frames: RuntimeFrame[],
        history: HistoryReader,
        signal?: AbortSignal,
    ): Promise<Map<string, DrawPacket>> {
        await this.connected;
        signal?.throwIfAborted();
        const abort = () => this.fail(Error('算法计算已取消。'));
        signal?.addEventListener('abort', abort, { once: true });
        try {
            const raw = await this.request({ kind: 'frame', frames }, frames, history);
            if (!Array.isArray(raw) || raw.length !== frames.length) throw Error('算法返回的帧数量无效。');
            const packets = new Map<string, DrawPacket>();
            for (const [index, entry] of raw.entries()) {
                if (entry.id !== frames[index]!.id || packets.has(entry.id)) throw Error('算法返回了错误的元素身份。');
                packets.set(entry.id, validateDrawPacket(entry.packet, this.elements.get(entry.id)!));
            }
            return packets;
        } finally {
            signal?.removeEventListener('abort', abort);
        }
    }
    private request(message: object, frames?: RuntimeFrame[], history?: HistoryReader) {
        if (this.disposed || !this.port) return Promise.reject(Error('算法运行时已释放。'));
        const id = ++this.sequence;
        return new Promise<unknown>((resolve, reject) => {
            const task: Pending = {
                resolve,
                reject,
                frames,
                history,
                remaining: this.timeoutMs,
                started: performance.now(),
                timer: setTimeout(() => this.fail(Error('算法计算超时。')), this.timeoutMs),
            };
            this.pending.set(id, task);
            algorithmRuntimeDiagnostics.activeTasks++;
            this.port!.postMessage({ ...message, id });
        });
    }
    private async receive(message: {
        id?: number;
        kind?: string;
        fatal?: string;
        error?: string;
        result?: unknown;
        readId?: number;
        elementId?: string;
        request?: HistoryRequest;
    }) {
        if (this.disposed) return;
        if (message.fatal) {
            this.fail(Error(message.fatal));
            return;
        }
        const task = this.pending.get(message.id!);
        if (!task) return;
        if (message.kind === 'history') {
            try {
                const request = message.request!,
                    frame = task.frames?.find(f => f.id === message.elementId);
                const algorithm = this.elements.get(message.elementId!);
                if (
                    task.reading ||
                    !frame ||
                    !algorithm ||
                    !task.history ||
                    !algorithm.contract.historyParameters.includes(request.parameterId) ||
                    !Number.isInteger(request.startTick) ||
                    !Number.isInteger(request.endTick) ||
                    request.startTick < 0 ||
                    request.endTick < request.startTick ||
                    request.endTick - request.startTick > 60 ||
                    request.endTick > Math.floor(frame.frame.time * 60 + 1e-8)
                )
                    throw Error('算法历史输入请求越界。');
                clearTimeout(task.timer);
                task.reading = true;
                task.remaining -= performance.now() - task.started;
                const samples = await task.history(message.elementId!, request);
                if (this.disposed || !this.pending.has(message.id!)) return;
                if (task.remaining <= 0) {
                    this.fail(Error('算法计算超时。'));
                    return;
                }
                task.started = performance.now();
                task.reading = false;
                task.timer = setTimeout(() => this.fail(Error('算法计算超时。')), task.remaining);
                this.port?.postMessage({ kind: 'history-result', readId: message.readId, samples });
            } catch (error) {
                this.fail(error instanceof Error ? error : Error(String(error)));
            }
            return;
        }
        clearTimeout(task.timer);
        this.pending.delete(message.id!);
        algorithmRuntimeDiagnostics.activeTasks--;
        if (message.error) task.reject(Error(message.error));
        else task.resolve(message.result);
    }
    private fail(error: Error) {
        this.readyReject(error);
        this.dispose(error);
    }
    dispose(reason = Error('算法运行时已释放。')) {
        if (this.disposed) return;
        this.disposed = true;
        this.disconnect();
        this.readyReject(reason);
        for (const task of this.pending.values()) {
            clearTimeout(task.timer);
            task.reject(reason);
            algorithmRuntimeDiagnostics.activeTasks--;
        }
        this.pending.clear();
        this.port?.postMessage({ kind: 'dispose' });
        this.port?.close();
        this.port = null;
        this.iframe?.remove();
        this.iframe = null;
        this.elements.clear();
        algorithmRuntimeDiagnostics.activeSandboxes--;
    }
}
