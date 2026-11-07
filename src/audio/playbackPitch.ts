import processorSource from 'signalsmith-stretch?raw';

export interface PlaybackPitchCorrection {
    readonly input: AudioNode;
    readonly latencySeconds: number;
    dispose(): void;
}

export type PlaybackPitchFactory = (
    context: AudioContext,
    destination: AudioNode,
    rate: number,
    signal: AbortSignal,
    onError: (error: Error) => void,
) => Promise<PlaybackPitchCorrection>;

const modules = new WeakMap<AudioContext, Promise<void>>();

/** Add an explicit lifetime boundary to the pinned upstream JS wrapper; the WASM DSP stays unchanged. */
export function withPitchProcessorDisposal(source: string): string {
    const insert = (marker: string, addition: string) => {
        if (source.indexOf(marker) < 0 || source.indexOf(marker) !== source.lastIndexOf(marker))
            throw Error('保调处理器版本不匹配。');
        source = source.replace(marker, marker + addition);
    };
    insert('let remoteMethods = {', '\n dispose: () => { this.audiosurfDisposed = true; },');
    insert('process(inputList, outputList, parameters) {', '\n if (this.audiosurfDisposed) return false;');
    return source;
}

/** Register one managed copy per AudioContext, including its embedded WASM. */
export const createPlaybackPitchCorrection: PlaybackPitchFactory = async (
    context,
    destination,
    rate,
    signal,
    onError,
) => {
    let registered = modules.get(context);
    if (!registered) {
        const url = URL.createObjectURL(
            new Blob([withPitchProcessorDisposal(processorSource)], { type: 'text/javascript' }),
        );
        registered = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
        modules.set(context, registered);
        void registered.catch(() => modules.delete(context));
    }
    await registered;
    signal.throwIfAborted();
    const node = new AudioWorkletNode(context, 'signalsmith-stretch', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
    });
    let disposed = false;
    let initialized = false;
    let id = 0;
    const pending = new Map<number | string, { resolve(value: unknown): void; reject(error: Error): void }>();
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
        node.onprocessorerror = null;
        // Keep the port entangled until the processor acknowledges termination.
        // Closing immediately can discard the queued stop message on the render thread.
        const disposalId = id++;
        const close = () => {
            clearTimeout(closeTimeout);
            node.port.onmessage = null;
            node.port.close();
        };
        const closeTimeout = setTimeout(close, 10_000);
        node.port.onmessage = event => {
            if (event.data[0] === disposalId) close();
        };
        node.port.postMessage([disposalId, 'dispose']);
        node.disconnect();
        for (const request of pending.values()) request.reject(new DOMException('音高处理已取消。', 'AbortError'));
        pending.clear();
    };
    const fail = (error: Error) => {
        if (disposed) return;
        const notify = initialized;
        for (const request of pending.values()) request.reject(error);
        pending.clear();
        dispose();
        if (notify) onError(error);
    };
    const abort = () => dispose();
    const timeout = setTimeout(() => fail(Error('音高处理初始化超时，请重试。')), 10_000);
    signal.addEventListener('abort', abort, { once: true });
    node.onprocessorerror = () => fail(Error('音高处理失败，请重试。'));
    node.port.onmessage = event => {
        const [key, value] = event.data as [number | string, unknown];
        const request = pending.get(key);
        pending.delete(key);
        request?.resolve(value);
    };
    const ready = new Promise<unknown>((resolve, reject) => pending.set('ready', { resolve, reject }));
    const call = (method: string, ...args: unknown[]) =>
        new Promise<unknown>((resolve, reject) => {
            const key = id++;
            pending.set(key, { resolve, reject });
            node.port.postMessage([key, method, ...args]);
        });
    try {
        await ready;
        const latencySeconds = Number(await call('latency'));
        if (!Number.isFinite(latencySeconds) || latencySeconds < 0) throw Error('音高处理延迟无效。');
        await call('start', { active: true, semitones: -12 * Math.log2(rate) });
        signal.throwIfAborted();
        node.connect(destination);
        initialized = true;
        clearTimeout(timeout);
        return { input: node, latencySeconds, dispose };
    } catch (error) {
        dispose();
        throw error;
    }
};
