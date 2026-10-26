import { expect, test } from 'vitest';
import { createComposition } from '../../src/visualizer/compositionCodec';
import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import { CompositionScene, type CompositionRenderPort } from '../../src/visualizer/compositionScene';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { parameterKey } from '../../src/visualizer/compositionEffects';
import { ElementSeedSession } from '../../src/visualizer/seed';
import { FrameSupersededError } from '../../src/visualizer/framePreparation';
import { AlgorithmRuntimeFixture } from './algorithm-runtime-fixture';
import type { DrawPacket } from '../../src/visualizer/algorithmTypes';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';
import type { VisualizerResolvedParameterMap } from '../../src/visualizer/rendererTypes';

const track = { contentHash: 'a'.repeat(64), fileName: 'editing.wav', durationSeconds: 180, sampleRate: 48000 };
function harness(initial?: VisualizerProjectV6) {
    let project =
        initial ??
        appendStandaloneElements(
            createComposition(track),
            ['solid', 'spectral-strings', 'circular-particles'].map((id, i) => {
                const element = elementRegistry.create(id, 180, i);
                return element.seed === undefined ? element : { ...element, seed: 123 };
            }),
        );
    const calls = new Map<string, number>();
    let packets = new Map<string, DrawPacket>(),
        runtimes = 0;
    const renderer: CompositionRenderPort = {
        autoClear: true,
        setClearColor: () => renderer as never,
        clear() {},
        setRenderTarget() {},
        render() {},
    };
    const resolveAt = (time: number): VisualizerResolvedParameterMap =>
        new Map(
            project.elements.flatMap(e =>
                e.bindings.map(
                    b =>
                        [
                            parameterKey(e.id, b.parameterId),
                            {
                                parameterId: b.parameterId,
                                state: 'ready' as const,
                                value:
                                    b.parameterId === 'spectrum'
                                        ? Array.from({ length: 128 }, (_, i) => 0.05 + 0.1 * Math.sin(time + i) ** 2)
                                        : b.source.kind === 'constant'
                                          ? b.source.value
                                          : 1,
                                ...(b.parameterId === 'spectrum' ? { unit: 'we-strength' as const } : {}),
                            },
                        ] as const,
                ),
            ),
        );
    let prepareAt = async (_time: number) => {};
    const scene = new CompositionScene({
        renderer,
        readProject: () => project,
        resolveAt,
        prepareAt: time => prepareAt(time),
        runtimeFactory: () => {
            runtimes++;
            const runtime = new AlgorithmRuntimeFixture();
            const prepare = runtime.prepareFrames.bind(runtime);
            runtime.prepareFrames = async (frames, history, signal, markers) => {
                packets = await prepare(
                    frames,
                    async (id, request) => {
                        calls.set(id, (calls.get(id) ?? 0) + 1);
                        return history(id, request);
                    },
                    signal,
                    markers,
                );
                return packets;
            };
            return runtime;
        },
    });
    const seeds = new ElementSeedSession();
    scene.resize(640, 360, 1);
    const edit = (type: string, parameterId: string, value: number | string) => {
        project = {
            ...project,
            elements: project.elements.map(e =>
                e.resource.id === type
                    ? {
                          ...e,
                          bindings: e.bindings.map(b =>
                              b.parameterId === parameterId
                                  ? { ...b, source: { kind: 'constant' as const, value } }
                                  : b,
                          ),
                      }
                    : e,
            ),
        };
    };
    const at = async (time: number, revision: number) => {
        const input = {
            timeSeconds: time,
            bindingRevision: revision,
            elementSeeds: seeds.sync(project.elements),
            values: resolveAt(time),
        };
        await scene.prepare(input);
        return scene.render(input);
    };
    return {
        scene,
        calls,
        at,
        edit,
        read: () => project,
        packets: () => packets,
        runtimes: () => runtimes,
        prepareWith: (fn: typeof prepareAt) => {
            prepareAt = fn;
        },
    };
}

test('later-song edits keep unrelated history and drawing-only edits warm; dynamics rebuild deterministically', async () => {
    const h = harness();
    try {
        await h.at(120, 1);
        const before = structuredClone(h.packets());
        h.calls.clear();
        for (const [type, id, value] of [
            ['solid', 'opacity', 0.5],
            ['spectral-strings', 'color', '#ff0000'],
            ['circular-particles', 'color', '#00ff00'],
            ['circular-particles', 'opacity', 0.7],
        ] as const) {
            h.edit(type, id, value);
            await h.at(120, 2);
        }
        expect(h.calls.size).toBe(0);
        for (const e of h.read().elements) expect(h.packets().get(e.id)?.state).toEqual(before.get(e.id)?.state);
        h.edit('spectral-strings', 'decay', 0.3);
        await h.at(120, 3);
        const strings = h.read().elements.find(e => e.resource.id === 'spectral-strings')!;
        expect(h.calls.get(strings.id)).toBe(120);
        expect(h.calls.size).toBe(1);
        expect(h.runtimes()).toBe(1);
        const fresh = harness(h.read());
        try {
            await fresh.at(120, 1);
            expect(h.packets().get(strings.id)).toEqual(fresh.packets().get(strings.id));
        } finally {
            fresh.scene.dispose();
        }
    } finally {
        h.scene.dispose();
    }
});

test('editing during an awaited history read ends the old frame and the existing runtime accepts the latest project', async () => {
    const h = harness();
    let release!: () => void, reading!: () => void;
    const started = new Promise<void>(resolve => {
        reading = resolve;
    });
    h.prepareWith(async time => {
        if (time === 0) {
            reading();
            await new Promise<void>(resolve => {
                release = resolve;
            });
        }
    });
    try {
        const pending = h.at(60, 1);
        const rejected = expect(pending).rejects.toBeInstanceOf(FrameSupersededError);
        await started;
        h.edit('solid', 'opacity', 0.2);
        release();
        await rejected;
        h.prepareWith(async () => {});
        await h.at(60, 2);
        expect(h.runtimes()).toBe(1);
    } finally {
        h.scene.dispose();
    }
});
