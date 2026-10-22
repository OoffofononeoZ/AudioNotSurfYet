import { describe, expect, test } from 'vitest';
import type { VisualizerResolvedParameter } from '../../src/visualizer/rendererTypes';
import type {
    VisualizerRenderFrame,
    VisualizerRenderer,
    VisualizerResolvedParameterMap,
    VisualizerScene,
    VisualizerSceneRenderInput,
} from '../../src/visualizer/rendererTypes';
import { VisualizerRendererHost, visualizerRendererDiagnostics } from '../../src/visualizer/visualizerRendererHost';

const resolvedEntry: VisualizerResolvedParameter = {
    parameterId: 'intensity',
    state: 'ready',
    value: 0.5,
};

const defaultSeeds = new Map([['element', 7]]);
const frame = (): VisualizerRenderFrame => ({
    trackIdentity: 'v3-track-hash',
    elementSeeds: defaultSeeds,
    timeSeconds: 1.25,
    bindingRevision: 3,
    playbackState: 'paused',
});

const fakeCanvas = (): HTMLCanvasElement =>
    ({
        dataset: {},
        addEventListener() {},
        removeEventListener() {},
    }) as unknown as HTMLCanvasElement;

const fakeRenderer = (canvas: HTMLCanvasElement): VisualizerRenderer => ({
    domElement: canvas,
    autoClear: true,
    clear() {},
    setRenderTarget() {},
    setPixelRatio() {},
    setSize() {},
    setClearColor() {},
    render() {},
    dispose() {},
    forceContextLoss() {},
});

const createRafHarness = () => {
    let nextHandle = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    return {
        callbacks,
        request(callback: FrameRequestCallback) {
            const handle = nextHandle++;
            callbacks.set(handle, callback);
            return handle;
        },
        cancel(handle: number) {
            callbacks.delete(handle);
        },
        flush() {
            const entry = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined;
            if (!entry) throw new Error('No visual animation frame is queued.');
            callbacks.delete(entry[0]);
            entry[1](16);
        },
    };
};

const registryHarness = (input: {
    onRender?: (sceneId: string, frameInput: VisualizerSceneRenderInput) => void;
    onDispose?: (sceneId: string) => void;
    throwOnRender?: () => boolean;
    throwOnResize?: () => boolean;
    throwOnDispose?: () => boolean;
}) => {
    let sequence = 0;
    return (): VisualizerScene => {
        const sceneId = 'scene-' + ++sequence;
        return {
            kind: 'rendered',
            render(frameInput) {
                if (input.throwOnRender?.()) throw Error('fixture render failure');
                input.onRender?.(sceneId, frameInput);
                return { hash: sceneId + ':' + frameInput.timeSeconds, needsSourcePrompt: false };
            },
            resize() {
                if (input.throwOnResize?.()) throw Error('fixture resize failure');
            },
            dispose() {
                if (input.throwOnDispose?.()) throw Error('fixture dispose failure');
                input.onDispose?.(sceneId);
            },
        };
    };
};

describe('Visualizer V3 renderer host integration', () => {
    test('manual export pauses visual RAF, renders explicit timestamps and restores the latest preview size', async () => {
        const raf = createRafHarness(),
            canvas = fakeCanvas(),
            rendered: number[] = [];
        const sizes: number[][] = [],
            ratios: number[] = [];
        const host = new VisualizerRendererHost({
            canvas,
            readFrame: () => ({ ...frame(), playbackState: 'playing' }),
            createScene: registryHarness({
                onRender: (_, input) => {
                    rendered.push(input.timeSeconds);
                },
            }),
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus() {},
            createRenderer: c => ({
                ...fakeRenderer(c),
                setSize: (w, h) => {
                    sizes.push([w, h]);
                },
                setPixelRatio: dpr => {
                    ratios.push(dpr);
                },
            }),
            requestAnimationFrame: cb => raf.request(cb),
            cancelAnimationFrame: id => raf.cancel(id),
        });
        host.resize(640, 360, 2);
        raf.flush();
        const surface = host.acquireExportSurface(1920, 1080);
        expect(raf.callbacks.size).toBe(0);
        expect(ratios.at(-1)).toBe(1);
        host.requestFrame();
        host.resize(800, 450, 2);
        expect(raf.callbacks.size).toBe(0);
        await surface.renderAtTime(0);
        await surface.renderAtTime(1 / 60);
        await surface.renderAtTime(8);
        expect(rendered.slice(-3)).toEqual([0, 1 / 60, 8]);
        expect(raf.callbacks.size).toBe(0);
        surface.release();
        expect(sizes.at(-1)).toEqual([800, 450]);
        expect(ratios.at(-1)).toBe(2);
        expect(raf.callbacks.size).toBe(1);
        await expect(surface.renderAtTime(9)).rejects.toThrow();
        host.dispose();
    });
    test('shares one target map, one renderer, and one cancelable visual RAF', () => {
        const initialHosts = visualizerRendererDiagnostics.activeHosts;
        const initialRenderers = visualizerRendererDiagnostics.activeRenderers;
        const raf = createRafHarness();
        const canvas = fakeCanvas();
        const targetMap: VisualizerResolvedParameterMap = new Map([['intensity', resolvedEntry]]);
        let currentFrame = frame();
        let renderedMap: VisualizerResolvedParameterMap | null = null;
        let inspectorMap: VisualizerResolvedParameterMap | null = null;
        let rendererCreateCount = 0;
        const host = new VisualizerRendererHost({
            canvas,
            createScene: registryHarness({
                onRender: (_sceneId, input) => {
                    renderedMap = input.values;
                },
            }),
            readFrame: () => currentFrame,
            resolveValuesAt: () => targetMap,
            onFrame: values => {
                inspectorMap = values;
            },
            onStatus() {},
            createRenderer: target => {
                rendererCreateCount += 1;
                return fakeRenderer(target);
            },
            requestAnimationFrame: callback => raf.request(callback),
            cancelAnimationFrame: handle => raf.cancel(handle),
        });

        host.resize(640, 360, 3);
        expect(canvas.dataset.renderDpr).toBe('2');
        expect(raf.callbacks.size).toBe(1);
        raf.flush();
        expect(renderedMap).toBe(targetMap);
        expect(inspectorMap).toBe(targetMap);
        expect(rendererCreateCount).toBe(1);
        expect(raf.callbacks.size).toBe(0);

        currentFrame = { ...currentFrame, playbackState: 'playing' };
        host.requestFrame();
        host.requestFrame();
        expect(raf.callbacks.size).toBe(1);
        raf.flush();
        expect(raf.callbacks.size).toBe(1);
        host.dispose();
        expect(raf.callbacks.size).toBe(0);
        expect(visualizerRendererDiagnostics.activeHosts).toBe(initialHosts);
        expect(visualizerRendererDiagnostics.activeRenderers).toBe(initialRenderers);
    });

    test('switches scenes by disposal while retaining the host, renderer, and canvas', () => {
        const raf = createRafHarness();
        const canvas = fakeCanvas();
        let currentFrame = frame();
        const disposed: string[] = [];
        let rendererCreateCount = 0;
        const host = new VisualizerRendererHost({
            canvas,
            createScene: registryHarness({ onDispose: sceneId => disposed.push(sceneId) }),
            readFrame: () => currentFrame,
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus() {},
            createRenderer: target => {
                rendererCreateCount += 1;
                return fakeRenderer(target);
            },
            requestAnimationFrame: callback => raf.request(callback),
            cancelAnimationFrame: handle => raf.cancel(handle),
        });
        host.requestFrame();
        raf.flush();
        const hostId = host.id;
        currentFrame = { ...currentFrame, elementSeeds: new Map([['element', 8]]) };
        host.requestFrame();
        raf.flush();
        expect(disposed).toEqual(['scene-1']);
        expect(host.id).toBe(hostId);
        expect(host.canvas).toBe(canvas);
        expect(rendererCreateCount).toBe(1);
        host.dispose();
        expect(disposed).toEqual(['scene-1', 'scene-2']);
    });

    test('isolates scene errors and retry creates one replacement scene', () => {
        const raf = createRafHarness();
        let fail = true;
        const statuses: string[] = [];
        const disposed: string[] = [];
        const host = new VisualizerRendererHost({
            canvas: fakeCanvas(),
            createScene: registryHarness({
                throwOnRender: () => {
                    const value = fail;
                    fail = false;
                    return value;
                },
                onDispose: sceneId => disposed.push(sceneId),
            }),
            readFrame: frame,
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus: status => statuses.push(status.state),
            createRenderer: fakeRenderer,
            requestAnimationFrame: callback => raf.request(callback),
            cancelAnimationFrame: handle => raf.cancel(handle),
        });
        host.requestFrame();
        raf.flush();
        expect(statuses.at(-1)).toBe('error');
        expect(raf.callbacks.size).toBe(0);
        host.retry();
        raf.flush();
        expect(disposed).toEqual(['scene-1']);
        expect(statuses.at(-1)).toBe('ready');
        host.dispose();
    });

    test('isolates resize errors and retries in the existing host', () => {
        const raf = createRafHarness();
        let failResize = false;
        const statuses: string[] = [];
        const disposed: string[] = [];
        const host = new VisualizerRendererHost({
            canvas: fakeCanvas(),
            createScene: registryHarness({
                throwOnResize: () => failResize,
                onDispose: sceneId => disposed.push(sceneId),
            }),
            readFrame: frame,
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus: status => statuses.push(status.state),
            createRenderer: fakeRenderer,
            requestAnimationFrame: callback => raf.request(callback),
            cancelAnimationFrame: handle => raf.cancel(handle),
        });
        host.requestFrame();
        raf.flush();
        failResize = true;
        host.resize(800, 450, 2);
        expect(statuses.at(-1)).toBe('error');
        failResize = false;
        host.retry();
        raf.flush();
        expect(disposed).toEqual(['scene-1']);
        expect(statuses.at(-1)).toBe('ready');
        host.dispose();
    });

    test('does not replace a scene until its failed disposal succeeds', () => {
        const raf = createRafHarness();
        let failDispose = true;
        const statuses: string[] = [];
        const disposed: string[] = [];
        let rendererCreateCount = 0;
        const host = new VisualizerRendererHost({
            canvas: fakeCanvas(),
            createScene: registryHarness({
                throwOnDispose: () => {
                    const value = failDispose;
                    failDispose = false;
                    return value;
                },
                onDispose: sceneId => disposed.push(sceneId),
            }),
            readFrame: frame,
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus: status => statuses.push(status.state),
            createRenderer: canvas => {
                rendererCreateCount += 1;
                return fakeRenderer(canvas);
            },
            requestAnimationFrame: callback => raf.request(callback),
            cancelAnimationFrame: handle => raf.cancel(handle),
        });
        host.requestFrame();
        raf.flush();
        host.retry();
        expect(statuses.at(-1)).toBe('error');
        expect(raf.callbacks.size).toBe(0);
        host.retry();
        raf.flush();
        expect(disposed).toEqual(['scene-1']);
        expect(statuses.at(-1)).toBe('ready');
        expect(rendererCreateCount).toBe(1);
        host.dispose();
    });
});

test('asynchronous frame preparation coalesces requests and cannot draw a stale seek', async () => {
    const raf = createRafHarness(),
        canvas = fakeCanvas(),
        rendered: number[] = [];
    let current = frame(),
        release = () => {},
        started = 0;
    const scene: VisualizerScene = {
        kind: 'rendered',
        resize() {},
        dispose() {},
        prepare: () => {
            started++;
            return new Promise<void>(resolve => {
                release = resolve;
            });
        },
        render: input => {
            rendered.push(input.timeSeconds);
            return { hash: 'frame', needsSourcePrompt: false };
        },
    };
    const host = new VisualizerRendererHost({
        canvas,
        createScene: () => scene,
        readFrame: () => current,
        resolveValuesAt: () => new Map(),
        onFrame() {},
        onStatus() {},
        createRenderer: fakeRenderer,
        requestAnimationFrame: cb => raf.request(cb),
        cancelAnimationFrame: id => raf.cancel(id),
    });
    host.resize(640, 360, 1);
    raf.flush();
    host.requestFrame();
    raf.flush();
    expect(started).toBe(1);
    current = { ...current, timeSeconds: 0.25 };
    host.invalidateFrame();
    release();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(rendered).toEqual([]);
    raf.flush();
    expect(started).toBe(2);
    release();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(rendered).toEqual([0.25]);
    host.dispose();
});

test('manual export waits for the algorithm before resolving its render lease', async () => {
    const raf = createRafHarness(),
        canvas = fakeCanvas();
    let release = () => {},
        rendered = false;
    const host = new VisualizerRendererHost({
        canvas,
        readFrame: frame,
        resolveValuesAt: () => new Map(),
        createScene: () => ({
            kind: 'rendered',
            resize() {},
            dispose() {},
            prepare: () =>
                new Promise<void>(resolve => {
                    release = resolve;
                }),
            render: () => {
                rendered = true;
                return { hash: 'frame', needsSourcePrompt: false };
            },
        }),
        onFrame() {},
        onStatus() {},
        createRenderer: fakeRenderer,
        requestAnimationFrame: cb => raf.request(cb),
        cancelAnimationFrame: id => raf.cancel(id),
    });
    const surface = host.acquireExportSurface(640, 360);
    const rendering = surface.renderAtTime(2);
    expect(rendered).toBe(false);
    release();
    await rendering;
    expect(rendered).toBe(true);
    surface.release();
    host.dispose();
});

test('an expired marker read cannot block the renderer after a binding revision changes', async () => {
    const raf = createRafHarness(),
        statuses: string[] = [];
    let current = frame(),
        rejectOld!: (reason: Error) => void,
        first = true;
    const host = new VisualizerRendererHost({
        canvas: fakeCanvas(),
        readFrame: () => current,
        resolveValuesAt: () => new Map(),
        createScene: () => ({
            kind: 'rendered',
            resize() {},
            dispose() {},
            prepare: () => {
                if (!first) return Promise.resolve();
                first = false;
                return new Promise<void>((_yes, no) => (rejectOld = no));
            },
            render: () => ({ hash: 'latest', needsSourcePrompt: false }),
        }),
        onFrame() {},
        onStatus: s => statuses.push(s.state),
        createRenderer: fakeRenderer,
        requestAnimationFrame: cb => raf.request(cb),
        cancelAnimationFrame: id => raf.cancel(id),
    });
    host.resize(640, 360, 1);
    raf.flush();
    current = { ...current, bindingRevision: current.bindingRevision + 1 };
    host.requestFrame();
    raf.flush();
    rejectOld(Error('标记查询所属工程已失效。'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(statuses).not.toContain('error');
    raf.flush();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(statuses.at(-1)).toBe('ready');
    host.dispose();
});
