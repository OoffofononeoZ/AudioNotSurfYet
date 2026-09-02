import { describe, expect, test } from 'vitest';
import type { VisualizerResolvedParameter } from '../../src/visualizer/bindingResolver';
import type {
    SceneTemplateDescriptor,
} from '../../src/visualizer/sceneRegistry';
import { SceneRegistry } from '../../src/visualizer/sceneRegistry';
import type {
    VisualizerRenderFrame,
    VisualizerRenderer,
    VisualizerResolvedParameterMap,
    VisualizerScene,
    VisualizerSceneRenderInput,
} from '../../src/visualizer/rendererTypes';
import {
    VisualizerRendererHost,
    visualizerRendererDiagnostics,
} from '../../src/visualizer/visualizerRendererHost';

const resolvedEntry: VisualizerResolvedParameter = {
    parameterId: 'intensity',
    state: 'ready',
    value: 0.5,
};

const frame = (): VisualizerRenderFrame => ({
    trackIdentity: 'v3-track-hash',
    templateId: 'orthogonal-lines',
    templateVersion: 1,
    seed: 7,
    timeSeconds: 1.25,
    bindingRevision: 3,
    playbackState: 'paused',
});

const fakeCanvas = (): HTMLCanvasElement => ({
    dataset: {},
    addEventListener() {},
    removeEventListener() {},
} as unknown as HTMLCanvasElement);

const fakeRenderer = (canvas: HTMLCanvasElement): VisualizerRenderer => ({
    domElement: canvas,
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
        cancel(handle: number) { callbacks.delete(handle); },
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
    const descriptor = (
        id: 'orthogonal-lines' | 'cube-swarm',
        kind: VisualizerScene['kind'],
    ): SceneTemplateDescriptor => ({
        id,
        version: 1,
        title: id,
        description: id,
        parameters: [],
        create: () => {
            const sceneId = `${id}-${++sequence}`;
            return {
                kind,
                render(frameInput) {
                    if (input.throwOnRender?.()) throw new Error('fixture render failure');
                    input.onRender?.(sceneId, frameInput);
                    return {
                        hash: `${sceneId}:${frameInput.timeSeconds}`,
                        needsSourcePrompt: false,
                    };
                },
                resize() {
                    if (input.throwOnResize?.()) throw new Error('fixture resize failure');
                },
                dispose() {
                    if (input.throwOnDispose?.()) throw new Error('fixture dispose failure');
                    input.onDispose?.(sceneId);
                },
            };
        },
    });
    return new SceneRegistry([
        descriptor('orthogonal-lines', 'rendered'),
        descriptor('cube-swarm', 'neutral'),
    ]);
};

describe('Visualizer V3 renderer host integration', () => {
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
            registry: registryHarness({
                onRender: (_sceneId, input) => { renderedMap = input.values; },
            }),
            readFrame: () => currentFrame,
            resolveValuesAt: () => targetMap,
            onFrame: (values) => { inspectorMap = values; },
            onStatus() {},
            createRenderer: (target) => {
                rendererCreateCount += 1;
                return fakeRenderer(target);
            },
            requestAnimationFrame: (callback) => raf.request(callback),
            cancelAnimationFrame: (handle) => raf.cancel(handle),
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
            registry: registryHarness({ onDispose: (sceneId) => disposed.push(sceneId) }),
            readFrame: () => currentFrame,
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus() {},
            createRenderer: (target) => {
                rendererCreateCount += 1;
                return fakeRenderer(target);
            },
            requestAnimationFrame: (callback) => raf.request(callback),
            cancelAnimationFrame: (handle) => raf.cancel(handle),
        });
        host.requestFrame();
        raf.flush();
        const hostId = host.id;
        currentFrame = { ...currentFrame, templateId: 'cube-swarm' };
        host.requestFrame();
        raf.flush();
        expect(disposed).toEqual(['orthogonal-lines-1']);
        expect(host.id).toBe(hostId);
        expect(host.canvas).toBe(canvas);
        expect(rendererCreateCount).toBe(1);
        host.dispose();
        expect(disposed).toEqual(['orthogonal-lines-1', 'cube-swarm-2']);
    });

    test('isolates scene errors and retry creates one replacement scene', () => {
        const raf = createRafHarness();
        let fail = true;
        const statuses: string[] = [];
        const disposed: string[] = [];
        const host = new VisualizerRendererHost({
            canvas: fakeCanvas(),
            registry: registryHarness({
                throwOnRender: () => {
                    const value = fail;
                    fail = false;
                    return value;
                },
                onDispose: (sceneId) => disposed.push(sceneId),
            }),
            readFrame: frame,
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus: (status) => statuses.push(status.state),
            createRenderer: fakeRenderer,
            requestAnimationFrame: (callback) => raf.request(callback),
            cancelAnimationFrame: (handle) => raf.cancel(handle),
        });
        host.requestFrame();
        raf.flush();
        expect(statuses.at(-1)).toBe('error');
        expect(raf.callbacks.size).toBe(0);
        host.retry();
        raf.flush();
        expect(disposed).toEqual(['orthogonal-lines-1']);
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
            registry: registryHarness({
                throwOnResize: () => failResize,
                onDispose: (sceneId) => disposed.push(sceneId),
            }),
            readFrame: frame,
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus: (status) => statuses.push(status.state),
            createRenderer: fakeRenderer,
            requestAnimationFrame: (callback) => raf.request(callback),
            cancelAnimationFrame: (handle) => raf.cancel(handle),
        });
        host.requestFrame();
        raf.flush();
        failResize = true;
        host.resize(800, 450, 2);
        expect(statuses.at(-1)).toBe('error');
        failResize = false;
        host.retry();
        raf.flush();
        expect(disposed).toEqual(['orthogonal-lines-1']);
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
            registry: registryHarness({
                throwOnDispose: () => {
                    const value = failDispose;
                    failDispose = false;
                    return value;
                },
                onDispose: (sceneId) => disposed.push(sceneId),
            }),
            readFrame: frame,
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus: (status) => statuses.push(status.state),
            createRenderer: (canvas) => {
                rendererCreateCount += 1;
                return fakeRenderer(canvas);
            },
            requestAnimationFrame: (callback) => raf.request(callback),
            cancelAnimationFrame: (handle) => raf.cancel(handle),
        });
        host.requestFrame();
        raf.flush();
        host.retry();
        expect(statuses.at(-1)).toBe('error');
        expect(raf.callbacks.size).toBe(0);
        host.retry();
        raf.flush();
        expect(disposed).toEqual(['orthogonal-lines-1']);
        expect(statuses.at(-1)).toBe('ready');
        expect(rendererCreateCount).toBe(1);
        host.dispose();
    });
});
