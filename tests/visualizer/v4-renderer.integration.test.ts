import * as THREE from 'three';
import { describe, expect, test, vi } from 'vitest';
import type { VisualizerResolvedParameter } from '../../src/visualizer/bindingResolver';
import { CubeSwarmScene } from '../../src/visualizer/cubeSwarmScene';
import {
    createInitialVisualizerProject,
    decodeVisualizerProjectV1,
    encodeVisualizerProjectV1,
} from '../../src/visualizer/projectCodec';
import { SceneRegistry, type SceneTemplateDescriptor } from '../../src/visualizer/sceneRegistry';
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
    parameterId: 'coreScale',
    state: 'ready',
    value: 1,
};

const frame = (templateId: 'orthogonal-lines' | 'cube-swarm' = 'cube-swarm'):
VisualizerRenderFrame => ({
    trackIdentity: 'v4-track-hash',
    templateId,
    templateVersion: 1,
    seed: 41,
    timeSeconds: 2.5,
    bindingRevision: 7,
    playbackState: 'paused',
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

const fakeCanvas = () => {
    const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    const canvas = {
        dataset: {},
        width: 1280,
        height: 720,
        addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
            const entries = listeners.get(type) ?? new Set();
            entries.add(listener);
            listeners.set(type, entries);
        },
        removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
            listeners.get(type)?.delete(listener);
        },
    } as unknown as HTMLCanvasElement;
    return {
        canvas,
        listenerCount(type: string) { return listeners.get(type)?.size ?? 0; },
        dispatch(type: string, event: Event = new Event(type)) {
            for (const listener of listeners.get(type) ?? []) {
                if (typeof listener === 'function') listener.call(canvas, event);
                else listener.handleEvent(event);
            }
            return event;
        },
    };
};

const fakeRenderer = (canvas: HTMLCanvasElement, counters: {
    render: number;
    dispose: number;
    forceLoss: number;
    resize: number;
}): VisualizerRenderer => ({
    domElement: canvas,
    setPixelRatio() {},
    setSize() { counters.resize += 1; },
    setClearColor() {},
    render() { counters.render += 1; },
    dispose() { counters.dispose += 1; },
    forceContextLoss() { counters.forceLoss += 1; },
});

const registryHarness = (events: {
    renderedMaps: VisualizerResolvedParameterMap[];
    created: string[];
    disposed: string[];
    failNextDispose?: boolean;
}) => {
    let sequence = 0;
    const descriptor = (id: 'orthogonal-lines' | 'cube-swarm'): SceneTemplateDescriptor => ({
        id,
        version: 1,
        title: id,
        description: id,
        parameters: [],
        create: () => {
            const sceneId = `${id}-${++sequence}`;
            events.created.push(sceneId);
            return {
                kind: 'rendered',
                render(input: VisualizerSceneRenderInput) {
                    events.renderedMaps.push(input.values);
                    return { hash: `${sceneId}:${input.timeSeconds}`, needsSourcePrompt: false };
                },
                resize() {},
                dispose() {
                    if (events.failNextDispose) {
                        events.failNextDispose = false;
                        throw new Error('fixture restore disposal failure');
                    }
                    events.disposed.push(sceneId);
                },
            } satisfies VisualizerScene;
        },
    });
    return new SceneRegistry([descriptor('orthogonal-lines'), descriptor('cube-swarm')]);
};

describe('Visualizer V4 renderer integration', () => {
    test('creates exactly the two approved default analysis bindings', () => {
        const bindings = new SceneRegistry().createDefaultBindings('cube-swarm');
        const dynamic = bindings.filter((binding) => binding.source.kind === 'analysis');
        expect(dynamic).toEqual([
            {
                parameterId: 'centerSpectrum',
                source: {
                    kind: 'analysis',
                    featureId: 'amplitudeSpectrum',
                    projection: { kind: 'full' },
                },
            },
            {
                parameterId: 'riseSpeed',
                source: {
                    kind: 'analysis',
                    featureId: 'energy',
                    projection: { kind: 'scalar' },
                },
                transform: {
                    inputMin: 0,
                    inputMax: 25,
                    outputMin: 0.25,
                    outputMax: 3,
                    clamp: true,
                    invert: false,
                    attackSeconds: 0,
                    releaseSeconds: 0,
                },
            },
        ]);
        expect(bindings.find((binding) => binding.parameterId === 'coreScale')?.source)
            .toEqual({ kind: 'constant', value: 1 });
        expect(bindings.find((binding) => binding.parameterId === 'orbitSpeed')?.source)
            .toEqual({ kind: 'constant', value: 0.3 });
    });

    test('round-trips persisted Cube bindings without replacing them with defaults', () => {
        const registry = new SceneRegistry();
        const project = createInitialVisualizerProject({
            track: {
                contentHash: '4'.repeat(64),
                fileName: 'visualizer-v4-cube-swarm-v1.wav',
                durationSeconds: 6,
                sampleRate: 48_000,
            },
            registry,
            createId: () => '00000000-0000-4000-8000-000000000401',
            createSeed: () => 41,
            now: () => new Date('2026-09-03T00:00:00.000Z'),
        });
        project.scene.templateId = 'cube-swarm';
        project.scene.bindings = registry.createDefaultBindings('cube-swarm');
        const core = project.scene.bindings.find((binding) => binding.parameterId === 'coreScale')!;
        core.source = { kind: 'constant', value: 2.25 };
        const orbit = project.scene.bindings.find((binding) => binding.parameterId === 'orbitSpeed')!;
        orbit.source = { kind: 'constant', value: 1.75 };
        const decoded = decodeVisualizerProjectV1(
            encodeVisualizerProjectV1(project, registry),
            undefined,
            registry,
        );
        expect(decoded.scene.bindings).toEqual(project.scene.bindings);
        expect(decoded.scene.bindings).not.toEqual(registry.createDefaultBindings('cube-swarm'));
    });

    test('renders three instanced meshes with shared resources and disposes symmetrically', () => {
        const counters = { render: 0, dispose: 0, forceLoss: 0, resize: 0 };
        const { canvas } = fakeCanvas();
        const resolved = new SceneRegistry().createDefaultBindings('cube-swarm');
        const map: VisualizerResolvedParameterMap = new Map(resolved.map((binding) => [
            binding.parameterId,
            {
                parameterId: binding.parameterId,
                state: 'ready' as const,
                value: binding.source.kind === 'constant'
                    ? binding.source.value
                    : binding.parameterId === 'centerSpectrum' ? [0, 1, 16, 128] : 1,
            },
        ]));
        const scene = new CubeSwarmScene({
            canvas,
            renderer: fakeRenderer(canvas, counters),
            resolveValuesAt: () => map,
        }, 41);
        const internals = scene as unknown as {
            core: THREE.InstancedMesh;
            peripheral: THREE.InstancedMesh;
            satellites: THREE.InstancedMesh;
            geometry: THREE.BoxGeometry;
            coreMaterial: THREE.MeshStandardMaterial;
            peripheralMaterial: THREE.MeshStandardMaterial;
        };
        expect(internals.core.geometry).toBe(internals.geometry);
        expect(internals.peripheral.geometry).toBe(internals.geometry);
        expect(internals.satellites.geometry).toBe(internals.geometry);
        expect(internals.satellites.material).toBe(internals.coreMaterial);
        expect(internals.peripheral.material).toBe(internals.peripheralMaterial);
        const disposeGeometry = vi.spyOn(internals.geometry, 'dispose');
        const disposeCoreMaterial = vi.spyOn(internals.coreMaterial, 'dispose');
        const disposePeripheralMaterial = vi.spyOn(internals.peripheralMaterial, 'dispose');
        const first = scene.render({ timeSeconds: 2.5, bindingRevision: 1, values: map });
        const repeated = scene.render({ timeSeconds: 2.5, bindingRevision: 1, values: map });
        expect(first.hash).toBe(repeated.hash);
        expect(internals.core.count).toBe(64);
        expect(internals.peripheral.count).toBe(48);
        expect(internals.satellites.count).toBe(3);
        const coreMatrix = new THREE.Matrix4();
        const corePosition = new THREE.Vector3();
        const coreRotation = new THREE.Quaternion();
        const coreScale = new THREE.Vector3();
        internals.core.getMatrixAt(0, coreMatrix);
        coreMatrix.decompose(corePosition, coreRotation, coreScale);
        expect(corePosition.x).toBeCloseTo(0.85, 6);
        expect(corePosition.y).toBeCloseTo(0, 6);
        expect(coreScale.x).toBeCloseTo(0.12, 6);
        expect(coreScale.y).toBeCloseTo(0.08, 6);
        expect(coreScale.z).toBeCloseTo(0.08, 6);
        expect(counters.render).toBe(2);
        scene.dispose();
        scene.dispose();
        expect(disposeGeometry).toHaveBeenCalledTimes(1);
        expect(disposeCoreMaterial).toHaveBeenCalledTimes(1);
        expect(disposePeripheralMaterial).toHaveBeenCalledTimes(1);
    });

    test('recovers context and retries disposal in one host, renderer, Canvas, and RAF', () => {
        const initial = { ...visualizerRendererDiagnostics };
        const raf = createRafHarness();
        const canvasHarness = fakeCanvas();
        const targetMap: VisualizerResolvedParameterMap = new Map([['coreScale', resolvedEntry]]);
        const events: {
            renderedMaps: VisualizerResolvedParameterMap[];
            created: string[];
            disposed: string[];
            failNextDispose?: boolean;
        } = { renderedMaps: [], created: [], disposed: [] };
        const statuses: string[] = [];
        const counters = { render: 0, dispose: 0, forceLoss: 0, resize: 0 };
        let rendererCreateCount = 0;
        let currentFrame = frame();
        const host = new VisualizerRendererHost({
            canvas: canvasHarness.canvas,
            registry: registryHarness(events),
            readFrame: () => currentFrame,
            resolveValuesAt: () => targetMap,
            onFrame(values) { expect(values).toBe(targetMap); },
            onStatus(status) { statuses.push(status.state); },
            createRenderer: (canvas) => {
                rendererCreateCount += 1;
                return fakeRenderer(canvas, counters);
            },
            requestAnimationFrame: (callback) => raf.request(callback),
            cancelAnimationFrame: (handle) => raf.cancel(handle),
        });
        host.resize(1280, 720, 2);
        raf.flush();
        const hostId = host.id;
        expect(events.renderedMaps).toEqual([targetMap]);

        host.requestFrame();
        const lost = new Event('webglcontextlost', { cancelable: true });
        canvasHarness.dispatch('webglcontextlost', lost);
        expect(lost.defaultPrevented).toBe(true);
        expect(raf.callbacks.size).toBe(0);
        expect(statuses.at(-1)).toBe('recovering');
        expect(canvasHarness.canvas.dataset.webglContextState).toBe('lost');

        canvasHarness.dispatch('webglcontextrestored');
        expect(statuses.at(-1)).toBe('recovering');
        expect(canvasHarness.canvas.dataset.webglContextState).toBe('restoring');
        expect(raf.callbacks.size).toBe(1);
        raf.flush();
        expect(statuses.at(-1)).toBe('ready');
        expect(canvasHarness.canvas.dataset.frameTime).toBe('2.500000');
        expect(events.created).toHaveLength(2);
        expect(events.disposed).toEqual(['cube-swarm-1']);
        expect(rendererCreateCount).toBe(1);
        expect(host.id).toBe(hostId);

        for (let cycle = 0; cycle < 20; cycle += 1) {
            currentFrame = frame(cycle % 2 === 0 ? 'orthogonal-lines' : 'cube-swarm');
            host.requestFrame();
            raf.flush();
        }
        expect(events.created.length - events.disposed.length).toBe(1);

        events.failNextDispose = true;
        canvasHarness.dispatch('webglcontextlost', new Event('webglcontextlost', { cancelable: true }));
        events.failNextDispose = true;
        canvasHarness.dispatch('webglcontextrestored');
        expect(statuses.at(-1)).toBe('error');
        expect(raf.callbacks.size).toBe(0);
        host.retry();
        raf.flush();
        expect(statuses.at(-1)).toBe('ready');
        expect(rendererCreateCount).toBe(1);
        expect(canvasHarness.listenerCount('webglcontextlost')).toBe(1);
        expect(canvasHarness.listenerCount('webglcontextrestored')).toBe(1);

        host.dispose();
        expect(counters.dispose).toBe(1);
        expect(counters.forceLoss).toBe(1);
        expect(canvasHarness.listenerCount('webglcontextlost')).toBe(0);
        expect(canvasHarness.listenerCount('webglcontextrestored')).toBe(0);
        expect(visualizerRendererDiagnostics.activeHosts).toBe(initial.activeHosts);
        expect(visualizerRendererDiagnostics.activeRenderers).toBe(initial.activeRenderers);
        expect(visualizerRendererDiagnostics.activeVisualAnimationFrames)
            .toBe(initial.activeVisualAnimationFrames);
        expect(visualizerRendererDiagnostics.contextLosses - initial.contextLosses).toBe(2);
        expect(visualizerRendererDiagnostics.contextRestores - initial.contextRestores).toBe(2);
        expect(visualizerRendererDiagnostics.contextRestoreFailures - initial.contextRestoreFailures)
            .toBe(1);
    });
});
