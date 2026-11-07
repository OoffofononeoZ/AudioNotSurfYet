import { afterEach, expect, test, vi } from 'vitest';
import { createPlaybackPitchCorrection } from '../../src/audio/playbackPitch';

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
    expect(node.disconnect).toHaveBeenCalledOnce();
    expect(node.port.close).toHaveBeenCalledOnce();
    const second = await h.create(2);
    expect(h.addModule).toHaveBeenCalledOnce();
    expect(Worklet.instances[1]!.port.postMessage).toHaveBeenCalledWith([1, 'start', { active: true, semitones: -12 }]);
    second.dispose();
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
    expect(fresh.onError).toHaveBeenCalledOnce();
    expect(Worklet.instances[0]!.port.close).toHaveBeenCalledOnce();
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
