import { CompositionScene } from '../../src/visualizer/compositionScene';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { instantiatePreset } from '../../src/visualizer/compositionPresets';
import { lyricFixture } from './lyric-fixture';
import { createSceneTestRenderer } from './scene3d-fixture';

export async function benchmarkBlackHolePreset(packs: any[]) {
    const unique = (rows: any[]) => [...new Map(rows.map(r => [r.hash, r])).values()];
    elementRegistry.replace({
        algorithms: unique(packs.flatMap(p => p.algorithms)),
        elements: unique(packs.flatMap(p => p.elements)),
        presets: packs.flatMap(p => p.presets),
    });
    const instance = instantiatePreset('black-hole-visualizer-2903479369', 10),
        project = lyricFixture().project;
    project.resources = instance.resources;
    project.elements = instance.elements;
    project.items = [instance.group];
    const values = new Map<string, any>();
    for (const e of project.elements)
        for (const b of e.bindings) {
            if (b.parameterId === 'spectrum') b.source = { kind: 'constant', value: Array(128).fill(0.25) };
            values.set(e.id + ':' + b.parameterId, {
                parameterId: b.parameterId,
                state: 'ready',
                value: (b.source as any).value,
            });
        }
    const canvas = document.createElement('canvas'),
        renderer = createSceneTestRenderer(canvas);
    const scene = new CompositionScene({ renderer, readProject: () => project, resolveAt: () => values }),
        timings = [];
    try {
        for (const [width, height] of [
            [1920, 1080],
            [3840, 2160],
        ]) {
            renderer.setSize(width, height, false);
            scene.resize(width, height, 1);
            const gl = renderer.getContext(),
                gpu = gl as any,
                timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
            const queries: any[] = [],
                cpu: number[] = [];
            for (let i = 0; i < 50; i++) {
                const input = {
                    elementSeeds: new Map(project.elements.map(e => [e.id, 123456789])),
                    timeSeconds: 3 + i / 60,
                    values,
                    bindingRevision: 0,
                };
                const start = performance.now();
                await scene.prepare(input);
                const q = i >= 20 && timer ? gpu.createQuery() : null;
                if (q) gpu.beginQuery(timer.TIME_ELAPSED_EXT, q);
                scene.render(input);
                if (q) gpu.endQuery(timer.TIME_ELAPSED_EXT);
                gl.finish();
                if (i >= 20) cpu.push(performance.now() - start);
                if (q) queries.push(q);
            }
            const deadline = performance.now() + 10000;
            while (queries.some(q => !gpu.getQueryParameter(q, gpu.QUERY_RESULT_AVAILABLE))) {
                if (performance.now() > deadline) throw Error('GPU timer timeout');
                await new Promise(r => setTimeout(r, 5));
            }
            const valid = timer && !gl.getParameter(timer.GPU_DISJOINT_EXT),
                samples = valid
                    ? queries.map(q => gpu.getQueryParameter(q, gpu.QUERY_RESULT) / 1e6).sort((a, b) => a - b)
                    : [];
            for (const q of queries) gpu.deleteQuery(q);
            cpu.sort((a, b) => a - b);
            timings.push({
                width,
                height,
                maxMs: cpu.at(-1),
                gpuMaxMs: samples.at(-1) ?? null,
                medianMs: cpu[15],
                p95Ms: cpu[28],
                gpuMedianMs: samples[15] ?? null,
                gpuP95Ms: samples[28] ?? null,
                scope: 'full preset, default visibility; lyrics disabled; constant WE .25; 20 warmup/30 measured frames',
            });
        }
    } finally {
        scene.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
    }
    return timings;
}
