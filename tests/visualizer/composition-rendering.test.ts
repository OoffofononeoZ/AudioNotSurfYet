import { sourceModule } from '../support/visualizer-assets.mjs';
const { SpectralStringsState } = await import(/* @vite-ignore */ sourceModule('spectral-strings', 'shared/strings.js'));
import { AlgorithmRuntimeFixture, createTestAlgorithm } from './algorithm-runtime-fixture';
import { attachElements } from './resource-fixtures';
import * as THREE from 'three';
import { describe, expect, test, vi } from 'vitest';
import { createComposition, validateComposition } from '../../src/visualizer/compositionCodec';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { CompositionScene, type CompositionRenderPort } from '../../src/visualizer/compositionScene';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { ElementSeedSession } from '../../src/visualizer/seed';
import { effectsFor, parameterKey } from '../../src/visualizer/compositionEffects';

const track = { contentHash: 'a'.repeat(64), fileName: 'render.wav', durationSeconds: 10, sampleRate: 48000 };
function harness() {
    const p = createComposition(track);
    p.elements = elementRegistry
        .list()
        .filter(e => !e.markerInputs?.length && !e.lyricInputs?.length && !e.scene3dDefaults)
        .map((e, i) => elementRegistry.create(e.id, 10, i));
    attachElements(p);
    const values = new Map<
        string,
        { parameterId: string; state: 'ready'; value: number | string | boolean | number[] }
    >();
    for (const e of p.elements)
        for (const b of e.bindings)
            values.set(parameterKey(e.id, b.parameterId), {
                parameterId: b.parameterId,
                state: 'ready',
                value:
                    b.source.kind === 'constant'
                        ? b.source.value
                        : b.source.kind === 'analysis' && b.source.featureId === 'wallpaperEngineSpectrum'
                          ? Array(128).fill(0.2)
                          : b.parameterId === 'spectrum'
                            ? Array(512).fill(40)
                            : 1.1,
            });
    const calls: Array<{
        target: THREE.WebGLRenderTarget | null;
        op: number;
        final: boolean;
        blend: boolean;
        copy: boolean;
    }> = [];
    let target: THREE.WebGLRenderTarget | null = null;
    const targets = new Set<THREE.WebGLRenderTarget>();
    let releases = 0;
    const port: CompositionRenderPort = {
        autoClear: true,
        setClearColor() {
            return this as never;
        },
        clear() {},
        setRenderTarget(value) {
            target = value as THREE.WebGLRenderTarget | null;
            if (target && !targets.has(target)) {
                targets.add(target);
                target.addEventListener('dispose', () => releases++);
            }
        },
        render(scene) {
            const m = (scene.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material;
            calls.push({
                target,
                op: m.uniforms.uOperation?.value ?? -1,
                final: m.uniforms.uFinal?.value ?? false,
                blend: m.transparent,
                copy: !!m.uniforms.uImage && !m.uniforms.uOperation,
            });
        },
    };
    const scene = new CompositionScene({
        renderer: port,
        readProject: () => p,
        resolveAt: () => values,
        runtimeFactory: () => new AlgorithmRuntimeFixture(),
    });
    const seeds = new ElementSeedSession();
    scene.resize(640, 360, 2);
    return {
        p,
        values,
        scene,
        port,
        calls,
        targets,
        seedValues: () => seeds.sync(p.elements),
        releases: () => releases,
    };
}
describe('composition rendering', () => {
    test('automatic projects pass the resolved numeric seed to algorithms', async () => {
        const h = harness();
        const seeded = h.p.elements.filter(e => e.seed !== undefined);
        const elementSeeds = new Map(seeded.map(e => [e.id, 12345]));
        const changed = new Map(seeded.map(e => [e.id, 54321]));
        const prepare = vi.spyOn(AlgorithmRuntimeFixture.prototype, 'prepareFrames');
        try {
            const input = { elementSeeds, timeSeconds: 1, values: h.values, bindingRevision: 1 };
            await h.scene.prepare(input);
            const hash = h.scene.render(input).hash;
            expect(prepare.mock.lastCall![0].every(e => (elementSeeds.get(e.id) ?? 0) === e.frame.seed)).toBe(true);
            h.scene.resize(1280, 720, 1);
            await h.scene.prepare(input);
            expect(h.scene.render(input).hash).toBe(hash);
            await h.scene.prepare({ ...input, elementSeeds: changed });
            expect(prepare.mock.lastCall![0].every(e => (changed.get(e.id) ?? 0) === e.frame.seed)).toBe(true);
            expect(h.scene.render({ ...input, elementSeeds: changed }).hash).not.toBe(hash);
            expect(h.p).not.toHaveProperty('seed');
        } finally {
            h.scene.dispose();
            prepare.mockRestore();
        }
    });
    test('marker-driven fade preserves linear/smooth interpolation and held endpoints independently of frame.range', async () => {
        const definition = elementRegistry.get('fade');
        const instance = await createTestAlgorithm(
            elementRegistry.algorithms.find(a => a.hash === definition.algorithm.hash)!,
        );
        try {
            for (const smooth of [false, true])
                for (const time of [0, 1, 1.2, 1.5, 1.8, 2, 3]) {
                    const packet = await instance.prepareFrame(
                        {
                            time,
                            seed: 1,
                            revision: '1',
                            width: 640,
                            height: 360,
                            range: { startSeconds: 0, endSeconds: 10 },
                            parameters: { from: { value: 0.9 }, to: { value: 0.2 }, smooth: { value: smooth } },
                        },
                        {
                            history: async () => [],
                            markers: async () => ({
                                eventKind: 'range',
                                events: [{ id: 'range', innerClassId: 'class', startSeconds: 1, endSeconds: 2 }],
                                nextCursor: null,
                            }),
                        },
                    );
                    const linear = Math.max(0, Math.min(1, time - 1)),
                        progress = smooth ? linear * linear * (3 - 2 * linear) : linear;
                    expect(packet.passes[0]!.uniforms.uOpacity).toBeCloseTo(0.9 + (0.2 - 0.9) * progress, 12);
                }
        } finally {
            instance.dispose?.();
        }
    });
    test('removing the last element releases its algorithm runtime before leaving the page', async () => {
        const release = vi.spyOn(AlgorithmRuntimeFixture.prototype, 'dispose');
        const h = harness();
        try {
            const input = { elementSeeds: h.seedValues(), timeSeconds: 1, values: h.values, bindingRevision: 1 };
            await h.scene.prepare(input);
            h.p.elements = [];
            await h.scene.prepare(input);
            h.scene.render(input);
            expect(release).toHaveBeenCalledTimes(1);
            h.scene.dispose();
            expect(release).toHaveBeenCalledTimes(1);
        } finally {
            h.scene.dispose();
            release.mockRestore();
        }
    });
    test('uses three reusable targets, composits visual layers and applies global effects', async () => {
        const h = harness();
        const blur = h.p.elements.find(e => e.resource.id === 'blur')!;
        h.values.set(parameterKey(blur.id, 'amount'), { parameterId: 'amount', state: 'ready', value: 8 });
        await h.scene.prepare({ elementSeeds: h.seedValues(), timeSeconds: 1, values: h.values, bindingRevision: 1 });
        h.scene.render({ elementSeeds: h.seedValues(), timeSeconds: 1, values: h.values, bindingRevision: 1 });
        expect(h.targets.size).toBe(3);
        expect(h.calls.filter(c => c.blend && c.copy)).toHaveLength(
            h.p.elements.filter(e => elementRegistry.get(e.resource.id).kind === 'visual').length,
        );
        expect(h.calls.filter(c => c.op === 1)).toHaveLength(2);
        expect(h.calls.at(-1)).toMatchObject({ target: null, final: true });
        expect(h.port.autoClear).toBe(true);
        h.scene.dispose();
        h.scene.dispose();
        expect(h.releases()).toBe(3);
    });
    test('direct seek and sequential rendering produce the same frame state', async () => {
        const h = harness();
        const at = async (time: number) => {
            const input = { elementSeeds: h.seedValues(), timeSeconds: time, values: h.values, bindingRevision: 1 };
            await h.scene.prepare(input);
            return h.scene.render(input).hash;
        };
        for (let t = 0; t < 180; t++) await at(t / 60);
        const expected = await at(3);
        await at(0.5);
        expect(await at(3)).toBe(expected);
        h.scene.dispose();
        const direct = harness();
        direct.p.projectId = h.p.projectId;
        direct.p.elements = h.p.elements;
        attachElements(direct.p);
        direct.values.clear();
        for (const [key, value] of h.values) direct.values.set(key, value);
        await direct.scene.prepare({
            elementSeeds: h.seedValues(),
            timeSeconds: 3,
            values: direct.values,
            bindingRevision: 1,
        });
        expect(
            direct.scene.render({
                elementSeeds: h.seedValues(),
                timeSeconds: 3,
                values: direct.values,
                bindingRevision: 1,
            }).hash,
        ).toBe(expected);
        direct.scene.dispose();
    });
    test('fixed string integration remains deterministic across backward seeks', () => {
        const source = (t: number) =>
            Array.from({ length: 512 }, (_, i) => Math.max(0, Math.sin(t * 4 + i * 0.03)) * 100);
        const state = new SpectralStringsState();
        let expected: number[] = [];
        for (let i = 0; i <= 180; i++) expected = [...state.resolve(i / 60, 'key', 0.6, source).position];
        state.resolve(0.25, 'key', 0.6, source);
        expect([...state.resolve(3, 'key', 0.6, source).position]).toEqual(expected);
        expect([...new SpectralStringsState().resolve(3, 'key', 0.6, source).position]).toEqual(expected);
    });
    test('multi-target effects are isolated and later transitions take over the held value', async () => {
        const p = createComposition(track);
        const visual = elementRegistry.create('solid', 10, 0),
            other = elementRegistry.create('solid', 10, 1),
            blur = elementRegistry.create('blur', 10, 2);
        blur.targets = { kind: 'elements', ids: [visual.id] };
        const editor = createInitialEditorProject({ track }),
            laneId = crypto.randomUUID(),
            innerClassId = crypto.randomUUID(),
            aId = crypto.randomUUID(),
            bId = crypto.randomUUID();
        editor.lanes.push({
            id: laneId,
            name: 'FX',
            eventKind: 'range',
            innerClasses: [{ id: innerClassId, label: '切换' }],
            events: [
                { id: aId, innerClassId, startSeconds: 1, endSeconds: 2 },
                { id: bId, innerClassId, startSeconds: 4, endSeconds: 5 },
            ],
        });
        p.editorSnapshot = { capturedAt: new Date().toISOString(), project: editor };
        const a = elementRegistry.create('fade', 10, 3),
            b = elementRegistry.create('fade', 10, 4);
        a.timing = { kind: 'editor-range', laneId, eventId: aId };
        b.timing = { kind: 'editor-range', laneId, eventId: bId };
        p.elements = [visual, other, blur, a, b];
        attachElements(p);
        validateComposition(p);
        expect(effectsFor(p, visual.id, 2)).toEqual([blur]);
        expect(effectsFor(p, other.id, 2)).toEqual([]);
        expect(effectsFor(p, null, 3)).toEqual([a]);
        expect(effectsFor(p, null, 4.5)).toEqual([b]);
        const definition = elementRegistry.get('fade');
        const instance = await createTestAlgorithm(
            elementRegistry.algorithms.find(v => v.hash === definition.algorithm.hash)!,
        );
        const packet = await instance.prepareFrame(
            {
                time: 3,
                seed: 1,
                revision: '1',
                width: 640,
                height: 360,
                range: { startSeconds: 1, endSeconds: 2 },
                parameters: { from: { value: 1 }, to: { value: 0 }, smooth: { value: false } },
            },
            {
                history: async () => [],
                markers: async () => ({
                    eventKind: 'range',
                    events: [{ id: 'range', innerClassId: 'class', startSeconds: 1, endSeconds: 2 }],
                    nextCursor: null,
                }),
            },
        );
        expect(packet.passes[0]!.uniforms.uOpacity).toBe(0);
        instance.dispose?.();
    });
});
describe('composition algorithm runtime lifetime', () => {
    function lifetimeHarness() {
        const p = createComposition(track);
        p.elements = ['solid', 'radial-spectrum'].map((id, layer) => elementRegistry.create(id, 10, layer));
        attachElements(p);
        const values = new Map<
            string,
            { parameterId: string; state: 'ready'; value: number | string | boolean | number[] }
        >();
        const writeValues = (spectrum: number[]) => {
            values.clear();
            for (const e of p.elements)
                for (const b of e.bindings)
                    values.set(parameterKey(e.id, b.parameterId), {
                        parameterId: b.parameterId,
                        state: 'ready',
                        value:
                            b.source.kind === 'constant'
                                ? b.source.value
                                : b.parameterId === 'spectrum'
                                  ? spectrum
                                  : 0.5,
                    });
        };
        writeValues(Array(128).fill(0.2));
        const renderer: CompositionRenderPort = {
            autoClear: true,
            setClearColor: () => renderer as never,
            clear() {},
            setRenderTarget() {},
            render() {},
        };
        const runtimes: AlgorithmRuntimeFixture[] = [];
        const scene = new CompositionScene({
            renderer,
            readProject: () => p,
            resolveAt: () => values,
            runtimeFactory: () => {
                const runtime = new AlgorithmRuntimeFixture();
                runtimes.push(runtime);
                return runtime;
            },
        });
        const seeds = new ElementSeedSession();
        scene.resize(320, 180, 1);
        const input = (bindingRevision: number, timeSeconds = 1) => ({
            elementSeeds: seeds.sync(p.elements),
            timeSeconds,
            values,
            bindingRevision,
        });
        return { p, scene, runtimes, writeValues, input };
    }
    test('parameter edits keep the running algorithm runtime', async () => {
        const h = lifetimeHarness();
        try {
            await h.scene.prepare(h.input(1));
            expect(h.runtimes).toHaveLength(1);
            const dispose = vi.spyOn(h.runtimes[0]!, 'dispose');
            h.writeValues(Array(128).fill(0.9));
            await h.scene.prepare(h.input(2));
            await h.scene.prepare(h.input(3, 1.5));
            expect(h.runtimes).toHaveLength(1);
            expect(dispose).not.toHaveBeenCalled();
        } finally {
            h.scene.dispose();
        }
    });
    test('structural edits still recreate the algorithm runtime', async () => {
        const h = lifetimeHarness();
        try {
            await h.scene.prepare(h.input(1));
            expect(h.runtimes).toHaveLength(1);
            const dispose = vi.spyOn(h.runtimes[0]!, 'dispose');
            h.p.elements = [...h.p.elements, elementRegistry.create('solid', 10, 2)];
            attachElements(h.p);
            h.writeValues(Array(128).fill(0.2));
            await h.scene.prepare(h.input(2));
            expect(dispose).toHaveBeenCalledTimes(1);
            expect(h.runtimes).toHaveLength(2);
        } finally {
            h.scene.dispose();
        }
    });
});
