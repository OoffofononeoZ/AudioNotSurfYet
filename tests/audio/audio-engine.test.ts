import {
    describe,
    expect,
    test,
    vi,
} from 'vitest';
import { AudioEngine } from '../../src/audio/audioEngine';

interface Deferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
    });
    return { promise, resolve, reject };
}

class FakeAudioBuffer {
    readonly duration: number;

    constructor(duration = 10) {
        this.duration = duration;
    }
}

class FakeAudioNode {
    connect = vi.fn();
    disconnect = vi.fn();
}

class FakeGainNode extends FakeAudioNode {
    gain = { value: 1 };
}

class FakeAnalyserNode extends FakeAudioNode {
    fftSize = 2048;
    frequencyBinCount = 1024;

    getFloatTimeDomainData(values: Float32Array) {
        values.fill(0.25);
    }
}

class FakeBufferSourceNode extends FakeAudioNode {
    buffer: AudioBuffer | null = null;
    onended: (() => void) | null = null;
    start = vi.fn();
    stop = vi.fn(() => {
        this.onended?.();
    });

    finishNaturally() {
        this.onended?.();
    }
}

class FakeAudioContext {
    currentTime = 0;
    state: AudioContextState = 'suspended';
    destination = new FakeAudioNode() as unknown as AudioDestinationNode;
    gain = new FakeGainNode();
    analyser = new FakeAnalyserNode();
    sources: FakeBufferSourceNode[] = [];
    decodeQueue: Array<Deferred<AudioBuffer>> = [];
    resume = vi.fn(async () => {
        this.state = 'running';
    });
    close = vi.fn(async () => {
        this.state = 'closed';
    });

    createGain() {
        return this.gain as unknown as GainNode;
    }

    createAnalyser() {
        return this.analyser as unknown as AnalyserNode;
    }

    createBufferSource() {
        const source = new FakeBufferSourceNode();
        this.sources.push(source);
        return source as unknown as AudioBufferSourceNode;
    }

    decodeAudioData() {
        const controlled = this.decodeQueue.shift();
        if (controlled) return controlled.promise;
        return Promise.resolve(
            new FakeAudioBuffer() as unknown as AudioBuffer,
        );
    }
}

const bytes = () => new Uint8Array([1, 2, 3]).buffer;

describe('AudioEngine', () => {
    test('creates one lazy graph and uses the AudioContext clock', async () => {
        const context = new FakeAudioContext();
        const factory = vi.fn(
            () => context as unknown as AudioContext,
        );
        const engine = new AudioEngine({ audioContextFactory: factory });

        expect(factory).not.toHaveBeenCalled();
        engine.setVolume(0.4);
        expect(factory).not.toHaveBeenCalled();

        await expect(engine.load({
            trackId: 'track-a',
            encodedAudio: bytes(),
        })).resolves.toBe('loaded');
        expect(factory).toHaveBeenCalledTimes(1);
        expect(context.gain.gain.value).toBe(0.4);

        await engine.play();
        await engine.play();
        expect(context.sources).toHaveLength(1);
        expect(context.resume).toHaveBeenCalledTimes(1);

        context.currentTime = 3.25;
        expect(engine.getSnapshot().currentTimeSeconds).toBe(3.25);
        engine.pause();
        expect(engine.getSnapshot()).toMatchObject({
            state: 'paused',
            currentTimeSeconds: 3.25,
        });
        context.currentTime = 8;
        expect(engine.getSnapshot().currentTimeSeconds).toBe(3.25);
    });

    test('clamps seeks, rebuilds a playing source, and restarts after ended', async () => {
        const context = new FakeAudioContext();
        const engine = new AudioEngine({
            audioContextFactory: () =>
                context as unknown as AudioContext,
        });
        const states: string[] = [];
        engine.subscribe((snapshot) => states.push(snapshot.state));

        await engine.load({ trackId: 'track-a', encodedAudio: bytes() });
        await engine.seek(-4);
        expect(engine.getSnapshot().currentTimeSeconds).toBe(0);

        await engine.play();
        context.currentTime = 2;
        await engine.seek(7);
        expect(context.sources).toHaveLength(2);
        expect(engine.getSnapshot()).toMatchObject({
            state: 'playing',
            currentTimeSeconds: 7,
        });

        context.sources.at(-1)?.finishNaturally();
        context.sources.at(-1)?.finishNaturally();
        expect(states.filter((state) => state === 'ended')).toHaveLength(1);
        expect(engine.getSnapshot()).toMatchObject({
            state: 'ended',
            currentTimeSeconds: 10,
        });

        await engine.play();
        expect(context.sources.at(-1)?.start).toHaveBeenCalledWith(
            context.currentTime,
            0,
        );
        engine.pause();
        await engine.seek(999);
        expect(engine.getSnapshot()).toMatchObject({
            state: 'paused',
            currentTimeSeconds: 10,
        });

        await engine.play();
        await engine.seek(999);
        expect(engine.getSnapshot()).toMatchObject({
            state: 'playing',
            currentTimeSeconds: 0,
        });
    });

    test('ignores stale decodes and keeps the latest track identity', async () => {
        const context = new FakeAudioContext();
        const firstDecode = deferred<AudioBuffer>();
        const secondDecode = deferred<AudioBuffer>();
        context.decodeQueue.push(firstDecode, secondDecode);
        const engine = new AudioEngine({
            audioContextFactory: () =>
                context as unknown as AudioContext,
        });

        const first = engine.load({
            trackId: 'track-a',
            encodedAudio: bytes(),
        });
        const second = engine.load({
            trackId: 'track-b',
            encodedAudio: bytes(),
        });
        secondDecode.resolve(
            new FakeAudioBuffer(8) as unknown as AudioBuffer,
        );
        await expect(second).resolves.toBe('loaded');
        firstDecode.resolve(
            new FakeAudioBuffer(4) as unknown as AudioBuffer,
        );
        await expect(first).resolves.toBe('stale');
        expect(engine.getSnapshot()).toMatchObject({
            trackId: 'track-b',
            state: 'paused',
            durationSeconds: 8,
        });
    });

    test('publishes typed decode and context errors without getting stuck loading', async () => {
        const decodeContext = new FakeAudioContext();
        const failedDecode = deferred<AudioBuffer>();
        decodeContext.decodeQueue.push(failedDecode);
        const decodeEngine = new AudioEngine({
            audioContextFactory: () =>
                decodeContext as unknown as AudioContext,
        });

        const loading = decodeEngine.load({
            trackId: 'broken',
            encodedAudio: bytes(),
        });
        failedDecode.reject(new DOMException(
            'Unsupported stream',
            'NotSupportedError',
        ));
        await expect(loading).rejects.toThrow('Unsupported stream');
        expect(decodeEngine.getSnapshot()).toMatchObject({
            trackId: 'broken',
            state: 'error',
            error: { code: 'unsupported' },
        });

        const contextError = new Error('AudioContext unavailable');
        const contextEngine = new AudioEngine({
            audioContextFactory: () => {
                throw contextError;
            },
        });
        await expect(contextEngine.load({
            trackId: 'track-a',
            encodedAudio: bytes(),
        })).rejects.toThrow(contextError);
        expect(contextEngine.getSnapshot()).toMatchObject({
            state: 'error',
            error: { code: 'context' },
        });

        const sourceContext = new FakeAudioContext();
        sourceContext.createBufferSource = () => {
            throw new Error('Source allocation failed');
        };
        const sourceEngine = new AudioEngine({
            audioContextFactory: () =>
                sourceContext as unknown as AudioContext,
        });
        await sourceEngine.load({
            trackId: 'track-a',
            encodedAudio: bytes(),
        });
        await expect(sourceEngine.play()).rejects.toThrow(
            'Source allocation failed',
        );
        expect(sourceEngine.getSnapshot()).toMatchObject({
            state: 'error',
            error: { code: 'source' },
        });

        const startContext = new FakeAudioContext();
        const failedSource = new FakeBufferSourceNode();
        failedSource.start.mockImplementation(() => {
            throw new Error('Source start failed');
        });
        startContext.createBufferSource = () =>
            failedSource as unknown as AudioBufferSourceNode;
        const startEngine = new AudioEngine({
            audioContextFactory: () =>
                startContext as unknown as AudioContext,
        });
        await startEngine.load({
            trackId: 'track-a',
            encodedAudio: bytes(),
        });
        await expect(startEngine.play()).rejects.toThrow(
            'Source start failed',
        );
        expect(failedSource.disconnect).toHaveBeenCalled();
        expect(startEngine.getSnapshot()).toMatchObject({
            state: 'error',
            error: { code: 'source' },
        });
    });

    test('unloads and disposes resources without eagerly creating a replacement context', async () => {
        const context = new FakeAudioContext();
        const factory = vi.fn(
            () => context as unknown as AudioContext,
        );
        const engine = new AudioEngine({ audioContextFactory: factory });

        await engine.load({ trackId: 'track-a', encodedAudio: bytes() });
        await engine.play();
        engine.unload();
        expect(engine.getSnapshot().state).toBe('empty');
        expect(context.sources[0]?.disconnect).toHaveBeenCalled();

        await engine.dispose();
        expect(context.analyser.disconnect).toHaveBeenCalledTimes(1);
        expect(context.gain.disconnect).toHaveBeenCalledTimes(1);
        expect(context.close).toHaveBeenCalledTimes(1);
        expect(factory).toHaveBeenCalledTimes(1);
    });
});
