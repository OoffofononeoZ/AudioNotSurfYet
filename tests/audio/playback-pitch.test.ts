import { afterEach, expect, test, vi } from 'vitest';
import { createPlaybackPitchCorrection, withPitchProcessorDisposal } from '../../src/audio/playbackPitch';

class Worklet {
    static instances: Worklet[] = [];
    static ready = true;
    onprocessorerror: (() => void) | null = null;
    connect = vi.fn();
    disconnect = vi.fn();
    port = {
        onmessage: null as ((event: { data: unknown[] }) => void) | null,
        close: vi.fn(),
        postMessage: vi.fn((message: unknown[]) => {
            const [id, method] = message;
            queueMicrotask(() => this.port.onmessage?.({ data: [id, method === 'latency' ? 0.12 : {}] }));
        }),
    };
    constructor() {
        Worklet.instances.push(this);
        if (Worklet.ready) queueMicrotask(() => this.port.onmessage?.({ data: ['ready', {}] }));
    }
}

function harness() {
    Worklet.instances = [];
    Worklet.ready = true;
    vi.stubGlobal('AudioWorkletNode', Worklet);
    const addModule = vi.fn(async () => {});
    const context = { audioWorklet: { addModule } } as unknown as AudioContext;
    const destination = {} as AudioNode;
    const abort = new AbortController();
    const onError = vi.fn();
    const create = (rate = 0.5) => createPlaybackPitchCorrection(context, destination, rate, abort.signal, onError);
    return { context, destination, abort, addModule, onError, create };
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

test('shares module registration, configures inverse pitch, and closes owned nodes and ports', async () => {
    const h = harness();
    const first = await h.create(0.5);
    const node = Worklet.instances[0]!;
    expect(first.latencySeconds).toBe(0.12);
    expect(node.port.postMessage).toHaveBeenCalledWith([1, 'start', { active: true, semitones: 12 }]);
    expect(node.connect).toHaveBeenCalledWith(h.destination);
    first.dispose();
    first.dispose();
    await Promise.resolve();
    expect(node.disconnect).toHaveBeenCalledOnce();
    expect(node.port.close).toHaveBeenCalledOnce();
    expect(node.port.postMessage).toHaveBeenLastCalledWith([2, 'dispose']);
    const second = await h.create(2);
    expect(h.addModule).toHaveBeenCalledOnce();
    expect(Worklet.instances[1]!.port.postMessage).toHaveBeenCalledWith([1, 'start', { active: true, semitones: -12 }]);
    second.dispose();
});

test('managed processors return false after disposal and reject unexpected upstream wrappers', () => {
    const source = `class Processor {
        constructor() { let remoteMethods = {}; this.methods = remoteMethods; }
        process(inputList, outputList, parameters) { return true; }
    }
    return Processor;`;
    const Processor = new Function(withPitchProcessorDisposal(source))() as new () => {
        methods: { dispose(): void };
        process(): boolean;
    };
    const processor = new Processor();
    expect(processor.process()).toBe(true);
    processor.methods.dispose();
    expect(processor.process()).toBe(false);
    expect(() => withPitchProcessorDisposal('')).toThrow('版本不匹配');
    expect(() => withPitchProcessorDisposal(source + source)).toThrow('版本不匹配');
});

test('cancels initialization without publishing a runtime error and rejects processor failures', async () => {
    const h = harness();
    Worklet.ready = false;
    const pending = h.create();
    const cancelled = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(Worklet.instances).toHaveLength(1));
    h.abort.abort();
    await cancelled;
    expect(h.onError).not.toHaveBeenCalled();
    expect(Worklet.instances[0]!.port.close).toHaveBeenCalledOnce();
    const fresh = harness();
    const initializing = fresh.create();
    await initializing;
    Worklet.instances[0]!.onprocessorerror?.();
    await Promise.resolve();
    expect(fresh.onError).toHaveBeenCalledOnce();
    expect(Worklet.instances[0]!.port.close).toHaveBeenCalledOnce();
});

test('keeps the control port open until disposal is acknowledged', async () => {
    const h = harness();
    const correction = await h.create();
    const node = Worklet.instances[0]!;
    node.port.postMessage.mockImplementationOnce(() => {});
    correction.dispose();
    expect(node.port.close).not.toHaveBeenCalled();
    node.port.onmessage?.({ data: [2, undefined] });
    expect(node.port.close).toHaveBeenCalledOnce();
});

test('times out an unresponsive processor and allows failed module registration to be retried', async () => {
    vi.useFakeTimers();
    const h = harness();
    h.addModule.mockRejectedValueOnce(Error('missing processor'));
    await expect(h.create()).rejects.toThrow('missing processor');
    Worklet.ready = false;
    const pending = h.create();
    const timedOut = expect(pending).rejects.toThrow('初始化超时');
    await vi.advanceTimersByTimeAsync(10001);
    await timedOut;
    expect(h.addModule).toHaveBeenCalledTimes(2);
    expect(Worklet.instances[0]!.port.close).toHaveBeenCalledOnce();
});
