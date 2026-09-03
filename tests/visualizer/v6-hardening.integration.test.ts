import { describe, expect, test } from 'vitest';
import type {
    VisualizerRenderFrame,
    VisualizerRenderer,
    VisualizerScene,
} from '../../src/visualizer/rendererTypes';
import { SceneRegistry, type SceneTemplateDescriptor } from '../../src/visualizer/sceneRegistry';
import {
    VisualizerRendererHost,
    visualizerRendererDiagnostics,
} from '../../src/visualizer/visualizerRendererHost';

const fakeCanvas = () => {
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    const canvas = {
        dataset: {},
        width: 1280,
        height: 720,
        addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
            const values = listeners.get(type) ?? new Set();
            values.add(listener);
            listeners.set(type, values);
        },
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
            listeners.get(type)?.delete(listener);
        },
    } as unknown as HTMLCanvasElement;
    return {
        canvas,
        listenerCount: () => [...listeners.values()].reduce((sum, values) => sum + values.size, 0),
    };
};

const fakeRenderer = (canvas: HTMLCanvasElement): VisualizerRenderer => ({
    domElement: canvas,
    setPixelRatio() {},
    setSize() {},
    setClearColor() {},
    render() {},
    dispose() {},
    forceContextLoss() {},
});

describe('Visualizer V6 renderer diagnostics and idempotent lifecycle', () => {
    test('reports absolute song/frame time and leaves singleton resources at baseline', () => {
        const baseline = {
            hosts: visualizerRendererDiagnostics.activeHosts,
            renderers: visualizerRendererDiagnostics.activeRenderers,
        };
        const descriptor: SceneTemplateDescriptor = {
            id: 'cube-swarm',
            version: 1,
            title: 'V6 fixture',
            description: 'V6 fixture',
            parameters: [],
            create: () => ({
                kind: 'rendered',
                render: ({ timeSeconds }) => ({
                    hash: `v6:${timeSeconds.toFixed(6)}`,
                    needsSourcePrompt: false,
                }),
                resize() {},
                dispose() {},
            } satisfies VisualizerScene),
        };
        const registry = new SceneRegistry([descriptor]);
        const { canvas, listenerCount } = fakeCanvas();
        let frame: VisualizerRenderFrame = {
            trackIdentity: 'v6-track',
            templateId: 'cube-swarm',
            templateVersion: 1,
            seed: 607,
            timeSeconds: 412.345678,
            bindingRevision: 9,
            playbackState: 'paused',
        };
        let callback: FrameRequestCallback | null = null;
        const host = new VisualizerRendererHost({
            canvas,
            registry,
            readFrame: () => frame,
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus() {},
            createRenderer: fakeRenderer,
            requestAnimationFrame: (value) => {
                callback = value;
                return 1;
            },
            cancelAnimationFrame: () => { callback = null; },
        });
        host.resize(1280, 720, 1);
        expect(callback).not.toBeNull();
        (callback as unknown as FrameRequestCallback)(1000);
        expect(visualizerRendererDiagnostics.lastSongTimeSeconds).toBe(frame.timeSeconds);
        expect(visualizerRendererDiagnostics.lastFrameAtMs).toBeGreaterThan(0);
        expect(visualizerRendererDiagnostics.lastFrameHash).toBe('v6:412.345678');
        expect(canvas.dataset.frameTime).toBe('412.345678');

        frame = { ...frame, timeSeconds: 899.999999 };
        host.requestFrame();
        (callback as unknown as FrameRequestCallback)(1016);
        expect(visualizerRendererDiagnostics.lastSongTimeSeconds).toBe(899.999999);
        expect(visualizerRendererDiagnostics.activeHosts).toBe(baseline.hosts + 1);
        expect(visualizerRendererDiagnostics.activeRenderers).toBe(baseline.renderers + 1);
        host.dispose();
        host.dispose();
        expect(visualizerRendererDiagnostics.activeHosts).toBe(baseline.hosts);
        expect(visualizerRendererDiagnostics.activeRenderers).toBe(baseline.renderers);
        expect(listenerCount()).toBe(0);
    });

    test('keeps exactly one host RAF alive while a paused capture lease is active', () => {
        const descriptor: SceneTemplateDescriptor = {
            id: 'cube-swarm',
            version: 1,
            title: 'V6 capture fixture',
            description: 'V6 capture fixture',
            parameters: [],
            create: () => ({
                kind: 'rendered',
                render: () => ({ hash: 'capture', needsSourcePrompt: false }),
                resize() {},
                dispose() {},
            } satisfies VisualizerScene),
        };
        const callbacks = new Map<number, FrameRequestCallback>();
        let nextHandle = 1;
        const { canvas } = fakeCanvas();
        const host = new VisualizerRendererHost({
            canvas,
            registry: new SceneRegistry([descriptor]),
            readFrame: () => ({
                trackIdentity: 'v6-capture-track',
                templateId: 'cube-swarm',
                templateVersion: 1,
                seed: 607,
                timeSeconds: 0,
                bindingRevision: 1,
                playbackState: 'paused',
            }),
            resolveValuesAt: () => new Map(),
            onFrame() {},
            onStatus() {},
            createRenderer: fakeRenderer,
            requestAnimationFrame: (callback) => {
                const handle = nextHandle++;
                callbacks.set(handle, callback);
                return handle;
            },
            cancelAnimationFrame: (handle) => { callbacks.delete(handle); },
        });
        const runNextFrame = () => {
            const entry = callbacks.entries().next().value as
                | [number, FrameRequestCallback]
                | undefined;
            expect(entry).toBeDefined();
            callbacks.delete(entry![0]);
            entry![1](performance.now());
        };

        const lease = host.acquireRecordingSurface(1280, 720);
        lease.renderNow();
        expect(callbacks.size).toBe(1);
        runNextFrame();
        expect(callbacks.size).toBe(1);

        lease.release();
        expect(callbacks.size).toBe(1);
        runNextFrame();
        expect(callbacks.size).toBe(0);
        host.dispose();
    });
});
