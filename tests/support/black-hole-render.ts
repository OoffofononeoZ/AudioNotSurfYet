import { CompositionScene } from '../../src/visualizer/compositionScene';
import { createDefinitionElement } from '../../src/visualizer/elementRegistry';
import { lyricHostDiagnostics } from '../../src/visualizer/lyricHost';
import { lyricFixture, lyricAsset } from './lyric-fixture';
import { createSceneTestRenderer } from './scene3d-fixture';

export async function renderBlackHole(packs: any[]) {
    const project = lyricFixture().project;
    project.resources = {
        algorithms: packs.flatMap(p => p.algorithms),
        elements: packs.flatMap(p => p.elements),
        presets: [],
    };
    const elements = project.resources.elements.map((d, i) => createDefinitionElement(d, 10, i));
    project.elements = elements;
    project.items = elements.map(e => ({ kind: 'element' as const, id: e.id }));
    const lyric = elements.find(e => e.resource.id === 'black-hole-lyrics')!;
    const asset = lyricAsset('[00:02]Gravity bends 星河流动\n[00:06]Falling into light');
    project.lyricAssets = [asset];
    lyric.lyricBindings!['lyrics'] = {
        kind: 'lyrics',
        assetId: asset.id,
        leadSeconds: 0.6,
        tailSeconds: 1.5,
        offsetSeconds: 0,
    };
    const values = new Map<string, any>();
    const reset = (level: number) => {
        for (const e of elements)
            for (const b of e.bindings)
                values.set(e.id + ':' + b.parameterId, {
                    parameterId: b.parameterId,
                    state: 'ready',
                    value: b.parameterId === 'spectrum' ? Array(128).fill(level) : (b.source as any).value,
                    unit: b.parameterId === 'spectrum' ? 'we-strength' : undefined,
                });
    };
    reset(0.25);
    const baseline = lyricHostDiagnostics.textures;
    const canvas = document.createElement('canvas'),
        renderer = createSceneTestRenderer(canvas);
    renderer.setSize(1280, 720, false);
    const scene = new CompositionScene({ renderer, readProject: () => project, resolveAt: () => values });
    const captures: any[] = [],
        timings: any[] = [];
    const render = async (time: number) => {
        const input = {
            elementSeeds: new Map(elements.map(e => [e.id, 123456789])),
            timeSeconds: time,
            values,
            bindingRevision: 0,
        };
        await scene.prepare(input);
        scene.render(input);
        return input;
    };
    const capture = async (name: string, ids: string[], time = 3, level = 0.25) => {
        reset(level);
        for (const e of elements) e.enabled = ids.includes(e.resource.id);
        await render(time);
        const gl = renderer.getContext(),
            w = canvas.width,
            h = canvas.height,
            pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let sum = 0,
            lit = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            const l = pixels[i]! + pixels[i + 1]! + pixels[i + 2]!;
            sum += l;
            if (l > 45) lit++;
        }
        const center = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
        captures.push({
            name,
            image: canvas.toDataURL('image/png'),
            sum,
            lit,
            center: Array.from(pixels.slice(center, center + 3)),
        });
    };
    const visual = elements.filter(e => e !== lyric).map(e => e.resource.id);
    try {
        scene.resize(1280, 720, 1);
        for (const id of visual) await capture(id, [id]);
        await capture('silent', visual, 3, 0);
        await capture('low', visual, 3, 0.1);
        await capture('high', visual, 3, 2);
        await capture('combined', visual);
        await capture('combined-later', visual, 4);
        await capture('seek-repeat', visual);
        await capture('lyrics-display', [...visual, lyric.resource.id], 3);
        await capture('lyrics-spiral', [...visual, lyric.resource.id], 5.55);
        reset(0.25);
        for (const e of elements) e.enabled = e !== lyric;
        for (const [width, height] of [
            [1920, 1080],
            [3840, 2160],
        ]) {
            renderer.setSize(width, height, false);
            scene.resize(width, height, 1);
            for (let i = 0; i < 8; i++) await render(3 + i / 60);
            const gl = renderer.getContext(),
                gpu = gl as any,
                timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
            const samples: number[] = [],
                queries: any[] = [];
            for (let i = 0; i < 20; i++) {
                const input = {
                    elementSeeds: new Map(elements.map(e => [e.id, 123456789])),
                    timeSeconds: 4 + i / 60,
                    values,
                    bindingRevision: 0,
                };
                const start = performance.now();
                await scene.prepare(input);
                const query = timer ? gpu.createQuery() : null;
                if (query) gpu.beginQuery(timer.TIME_ELAPSED_EXT, query);
                scene.render(input);
                if (query) gpu.endQuery(timer.TIME_ELAPSED_EXT);
                gl.finish();
                samples.push(performance.now() - start);
                if (query) queries.push(query);
            }
            const deadline = performance.now() + 10000;
            while (queries.some(q => !gpu.getQueryParameter(q, gpu.QUERY_RESULT_AVAILABLE))) {
                if (performance.now() > deadline) throw Error('GPU timer timeout');
                await new Promise(resolve => setTimeout(resolve, 5));
            }
            const valid = timer && !gl.getParameter(timer.GPU_DISJOINT_EXT);
            const gpuSamples = valid
                ? queries.map(q => gpu.getQueryParameter(q, gpu.QUERY_RESULT) / 1e6).sort((a, b) => a - b)
                : [];
            for (const q of queries) gpu.deleteQuery(q);
            samples.sort((a, b) => a - b);
            timings.push({
                width,
                height,
                drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
                medianMs: samples[10],
                p95Ms: samples[18],
                gpuMedianMs: gpuSamples[10] ?? null,
                gpuP95Ms: gpuSamples[18] ?? null,
                gpuTimer: valid ? 'EXT_disjoint_timer_query_webgl2' : 'unavailable or disjoint',
                includes:
                    'Wall time includes Worker prepare + host composition submission; GPU query covers composition rendering only; neither is display FPS',
            });
        }
        renderer.setSize(720, 1280, false);
        scene.resize(720, 1280, 1);
        await capture('portrait', visual);
    } finally {
        scene.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
    }
    const recoveredCanvas = document.createElement('canvas'),
        recoveredRenderer = createSceneTestRenderer(recoveredCanvas);
    recoveredRenderer.setSize(1280, 720, false);
    const recoveredScene = new CompositionScene({
        renderer: recoveredRenderer,
        readProject: () => project,
        resolveAt: () => values,
        realtime: true,
    });
    let recreated = false;
    try {
        recoveredScene.resize(1280, 720, 1);
        const input = {
            elementSeeds: new Map(elements.map(e => [e.id, 123456789])),
            timeSeconds: 3,
            values,
            bindingRevision: 0,
        };
        await recoveredScene.prepare(input);
        recoveredScene.render(input);
        recreated = recoveredCanvas.toDataURL('image/png') === captures.find(c => c.name === 'combined').image;
    } finally {
        recoveredScene.dispose();
        recoveredRenderer.dispose();
        recoveredRenderer.forceContextLoss();
    }
    return { captures, timings, recreated, released: lyricHostDiagnostics.textures === baseline };
}

export async function captureBlackHoleProject(project: any) {
    const values = new Map<string, any>();
    for (const e of project.elements)
        for (const b of e.bindings)
            values.set(e.id + ':' + b.parameterId, {
                parameterId: b.parameterId,
                state: 'ready',
                value: b.source.value,
            });
    const canvas = document.createElement('canvas'),
        renderer = createSceneTestRenderer(canvas);
    renderer.setSize(1280, 720, false);
    const scene = new CompositionScene({ renderer, readProject: () => project, resolveAt: () => values });
    try {
        scene.resize(1280, 720, 1);
        const input = {
            elementSeeds: new Map<string, number>(
                project.elements.map((e: any): [string, number] => [e.id, 123456789]),
            ),
            timeSeconds: 1.5,
            values,
            bindingRevision: 0,
        };
        await scene.prepare(input);
        scene.render(input);
        return { image: canvas.toDataURL('image/png') };
    } finally {
        scene.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
    }
}
