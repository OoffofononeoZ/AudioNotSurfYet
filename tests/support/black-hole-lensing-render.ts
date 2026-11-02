import * as THREE from 'three';
import { AlgorithmDrawRenderer } from '../../src/visualizer/algorithmDrawRenderer';
import { IsolatedAlgorithmRuntime, algorithmRuntimeDiagnostics } from '../../src/visualizer/isolatedAlgorithmRuntime';
import { createComposition } from '../../src/visualizer/compositionCodec';
import { createDefinitionElement } from '../../src/visualizer/elementRegistry';
import { CompositionScene } from '../../src/visualizer/compositionScene';
import { resourceHash } from '../../src/visualizer/resourceIdentity';

export function lensingProject(track: any, packs: any[]) {
    const p = createComposition(track);
    p.resources = {
        algorithms: packs.flatMap(p => p.algorithms),
        elements: packs.flatMap(p => p.elements),
        presets: [],
    };
    p.elements = p.resources.elements.map((d, i) => createDefinitionElement(d, track.durationSeconds, i));
    const stars = p.elements.find(e => e.resource.id === 'black-hole-starfield')!;
    const lens = p.elements.find(e => e.resource.id === 'black-hole-lensing')!;
    lens.targets = { kind: 'elements', ids: [stars.id] };
    for (const e of p.elements) {
        if (e.seed !== undefined) e.seed = 123456789;
        for (const b of e.bindings)
            if (b.parameterId === 'spectrum') b.source = { kind: 'constant', value: Array(128).fill(0.25) };
    }
    p.items = p.elements.map(e => ({ kind: 'element', id: e.id }));
    p.output.resolution = '720p';
    return p;
}

export async function renderLensingResources(packs: any[]) {
    const baseline = algorithmRuntimeDiagnostics.activeSandboxes;
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    const gpu = new AlgorithmDrawRenderer();
    const runtime = new IsolatedAlgorithmRuntime();
    const [lens, stars] = packs;
    const target = new THREE.WebGLRenderTarget(1280, 720, { depthBuffer: false });
    const starsTarget = target.clone();
    const captures: any[] = [];
    let gridBefore: HTMLCanvasElement | undefined;
    const textures: THREE.Texture[] = [];
    const frame = (pack: any, time: number, changes: any = {}, width = 1280, height = 720) => ({
        mode: 'timeline' as const,
        time,
        width,
        height,
        seed: 123456789,
        revision: 'fixture',
        range: null,
        parameters: Object.fromEntries(
            pack.elements[0].parameters.map((p: any) => [p.id, { value: changes[p.id] ?? p.defaultValue }]),
        ),
    });
    const packet = async (pack: any, time = 3, changes = {}, width = 1280, height = 720) =>
        (
            await runtime.prepareFrames(
                [{ id: pack.id, frame: frame(pack, time, changes, width, height) }],
                async () => {
                    throw Error('Unexpected history query');
                },
            )
        ).get(pack.id)!;
    const pixels = () => {
        const data = new Uint8Array(target.width * target.height * 4);
        renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, data);
        return data;
    };
    const draw = (pack: any, value: any, source?: THREE.Texture, to = target) => {
        renderer.setRenderTarget(to);
        renderer.setClearColor(0, 0);
        renderer.clear();
        gpu.draw(renderer, pack.algorithms[0], value.passes[0], source);
    };
    const capture = (name: string) => {
        const data = pixels(),
            w = target.width,
            h = target.height;
        const preview = document.createElement('canvas');
        preview.width = w;
        preview.height = h;
        const ctx = preview.getContext('2d')!,
            image = ctx.createImageData(w, h);
        let lit = 0,
            transparent = 0,
            maxAlpha = 0,
            premultiplied = true;
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4,
                    j = ((h - y - 1) * w + x) * 4,
                    a = data[i + 3]!;
                maxAlpha = Math.max(maxAlpha, a);
                if (a === 0) transparent++;
                if (data[i]! + data[i + 1]! + data[i + 2]! > 45) lit++;
                for (let k = 0; k < 3; k++) {
                    premultiplied &&= data[i + k]! <= a + 1;
                    image.data[j + k] = a ? Math.min(255, Math.round((data[i + k]! * 255) / a)) : 0;
                }
                image.data[j + 3] = a;
            }
        ctx.putImageData(image, 0, 0);
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        captures.push({ name, image: preview.toDataURL(), lit, transparent, maxAlpha, premultiplied });
        if (name === 'grid-before') gridBefore = preview;
        if (name === 'grid-after' && gridBefore) {
            const compare = document.createElement('canvas');
            compare.width = 1280;
            compare.height = 400;
            const c = compare.getContext('2d')!;
            c.fillStyle = '#080b10';
            c.fillRect(0, 0, 1280, 400);
            c.fillStyle = '#eee';
            c.font = '18px sans-serif';
            c.fillText('Before', 20, 27);
            c.fillText('Transparent lensing', 660, 27);
            c.drawImage(gridBefore, 0, 40, 640, 360);
            c.drawImage(preview, 640, 40, 640, 360);
            captures.push({ name: 'lensing-preview', image: compare.toDataURL() });
        }
        return data;
    };
    const difference = (a: Uint8Array, b: Uint8Array, predicate = (_x: number, _y: number) => true) => {
        let max = 0,
            changed = 0;
        for (let y = 0; y < target.height; y++)
            for (let x = 0; x < target.width; x++)
                if (predicate(x, y)) {
                    const i = (y * target.width + x) * 4;
                    let d = 0;
                    for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a[i + k]! - b[i + k]!));
                    max = Math.max(max, d);
                    if (d) changed++;
                }
        return { max, changed };
    };
    const texture = (fill: (x: number, y: number) => number[]) => {
        const bytes = new Uint8Array(1280 * 720 * 4);
        for (let y = 0; y < 720; y++) for (let x = 0; x < 1280; x++) bytes.set(fill(x, y), (y * 1280 + x) * 4);
        const t = new THREE.DataTexture(bytes, 1280, 720);
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.needsUpdate = true;
        textures.push(t);
        return t;
    };
    const stats: any = {};
    const timings: any[] = [];
    try {
        renderer.setSize(1280, 720, false);
        gpu.resize(1280, 720);
        await runtime.initialize(packs.map(p => ({ id: p.id, algorithm: p.algorithms[0] })));
        const grid = texture((x, y) => {
            const line = x % 32 < 2 || y % 32 < 2;
            return line ? [100, 75, 45, 128] : [5, 12, 18, 128];
        });
        draw(lens, await packet(lens, 3, { amount: 0 }), grid);
        const before = capture('grid-before');
        draw(lens, await packet(lens), grid);
        const after = capture('grid-after');
        stats.changed = difference(before, after);
        stats.outside = difference(before, after, (x, y) => Math.hypot((x - 640) * 1.5, (y - 360) * 1.5) > 782);
        stats.center = difference(before, after, (x, y) => Math.hypot((x - 640) * 1.5, (y - 360) * 1.5) < 120);
        stats.alpha = Array.from(after.filter((_, i) => i % 4 === 3)).every(a => a === 128);
        draw(lens, await packet(lens, 3, { outerRadius: 228, softness: 1 }), grid);
        stats.narrowAlpha = pixels().every((v, i) => i % 4 !== 3 || v === 128);
        draw(lens, await packet(lens, 3, { amount: 0 }), grid);
        stats.zero = difference(before, capture('grid-zero'));
        const text = document.createElement('canvas');
        text.width = 1280;
        text.height = 720;
        const tc = text.getContext('2d')!;
        tc.fillStyle = '#102030';
        tc.fillRect(0, 0, 1280, 720);
        tc.fillStyle = 'white';
        tc.font = '32px sans-serif';
        for (let yy = 80; yy < 720; yy += 100) tc.fillText('GRAVITY  ·  BLACK HOLE  ·  STARLIGHT', 220, yy);
        const textTexture = new THREE.CanvasTexture(text);
        textTexture.minFilter = THREE.LinearFilter;
        textTexture.magFilter = THREE.LinearFilter;
        textures.push(textTexture);
        draw(lens, await packet(lens, 3, { amount: 0 }), textTexture);
        capture('text-before');
        draw(lens, await packet(lens), textTexture);
        capture('text-after');
        const empty = texture(() => [0, 0, 0, 0]);
        draw(lens, await packet(lens), empty);
        capture('transparent');
        const edge = texture((x, y) => (x < 640 && y > 200 && y < 520 ? [80, 40, 20, 128] : [0, 0, 0, 0]));
        draw(
            lens,
            await packet(lens, 3, { positionX: 0, positionY: 1, lensStrength: 3, swirlStrength: 2, stretch: 4 }),
            edge,
        );
        capture('edge-alpha');
        draw(stars, await packet(stars));
        const first = capture('stars');
        draw(stars, await packet(stars, 3, { density: 0 }));
        capture('stars-zero');
        for (const time of [0, 60, 1800, 86400]) {
            draw(stars, await packet(stars, time));
            stats['static-' + time] = difference(first, capture('stars-time-' + time));
            draw(stars, await packet(stars, time, { twinkle: 0.4, driftSpeed: 3 }));
            capture('moving-stars-' + time);
            draw(stars, await packet(stars, time), undefined, starsTarget);
            draw(lens, await packet(lens, time), starsTarget.texture);
            capture('lensed-stars-' + time);
        }
        draw(lens, await packet(lens), grid);
        stats.seek = difference(after, capture('seek-repeat'));
        // Absolute drift periods: the periodic field must join seamlessly at the wrap.
        for (const time of [23040 / 3 - 0.0001, 23040 / 3 + 0.0001]) {
            draw(stars, await packet(stars, time, { driftSpeed: 3 }));
            const now = pixels();
            if (stats.wrapPixels) {
                stats.wrap = difference(stats.wrapPixels, now);
                delete stats.wrapPixels;
            } else stats.wrapPixels = now;
        }
        for (const [width, height] of [
            [1920, 1080],
            [3840, 2160],
        ]) {
            renderer.setSize(width, height, false);
            gpu.resize(width, height);
            target.setSize(width, height);
            starsTarget.setSize(width, height);
            for (const pack of packs) {
                const value = await packet(pack, 3, {}, width, height),
                    times: number[] = [],
                    queries: WebGLQuery[] = [];
                const gl = renderer.getContext() as WebGL2RenderingContext,
                    timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
                for (let i = 0; i < 28; i++) {
                    const start = performance.now(),
                        q = i >= 8 && timer ? gl.createQuery() : null;
                    if (q) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
                    draw(pack, value, pack === lens ? grid : undefined);
                    if (q) {
                        gl.endQuery(timer!.TIME_ELAPSED_EXT);
                        queries.push(q);
                    }
                    gl.finish();
                    if (i >= 8) times.push(performance.now() - start);
                }
                const deadline = performance.now() + 10000;
                while (queries.some(q => !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) {
                    if (performance.now() > deadline) throw Error('GPU query timeout');
                    await new Promise(r => setTimeout(r, 5));
                }
                const gpuTimes =
                    timer && !gl.getParameter(timer.GPU_DISJOINT_EXT)
                        ? queries.map(q => gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6).sort((a, b) => a - b)
                        : [];
                for (const q of queries) gl.deleteQuery(q);
                times.sort((a, b) => a - b);
                timings.push({
                    id: pack.id,
                    width,
                    height,
                    wallMedian: times[10],
                    wallP95: times[18],
                    gpuMedian: gpuTimes[10] ?? null,
                    gpuP95: gpuTimes[18] ?? null,
                });
            }
        }
        for (const [width, height] of [
            [720, 1280],
            [3840, 1080],
        ]) {
            renderer.setSize(width, height, false);
            gpu.resize(width, height);
            target.setSize(width, height);
            draw(stars, await packet(stars, 3, {}, width, height));
            capture('stars-' + width + 'x' + height);
        }
    } finally {
        runtime.dispose();
        gpu.dispose();
        target.dispose();
        starsTarget.dispose();
        for (const t of textures) t.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
    }
    return { captures, stats, timings, released: algorithmRuntimeDiagnostics.activeSandboxes === baseline };
}

export async function checkLensingComposition(packs: any[]) {
    const project = lensingProject(
        { contentHash: 'a'.repeat(64), fileName: 'test.wav', durationSeconds: 86401, sampleRate: 48000 },
        packs,
    );
    const algorithm: any = {
        id: 'lensing-overlay-fixture',
        version: 1,
        hash: '',
        apiVersion: 3,
        contract: {
            kind: 'visual',
            parameters: [],
            sharedParameters: [],
            historyParameters: [],
            executionModes: ['timeline', 'realtime'],
        },
        source: 'export function create(){return {prepareFrame(){return {passes:[{program:"draw",uniforms:{}}]}}}}',
        programs: {
            draw: {
                geometry: 'quad',
                uniforms: {},
                vertex: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
                fragment:
                    'varying vec2 vUv;void main(){float a=step(.68,vUv.x)*step(vUv.x,.72)*step(.46,vUv.y)*step(vUv.y,.54);gl_FragColor=vec4(a,0.,0.,a);}',
            },
        },
    };
    algorithm.hash = resourceHash(algorithm);
    const definition: any = {
        id: algorithm.id,
        version: 1,
        hash: '',
        algorithm: { id: algorithm.id, version: 1, hash: algorithm.hash },
        kind: 'visual',
        title: 'unselected red overlay',
        icon: 'square',
        parameters: [],
    };
    definition.hash = resourceHash(definition);
    project.resources.algorithms.push(algorithm);
    project.resources.elements.push(definition);
    const e = createDefinitionElement(definition, 86401, project.elements.length);
    project.elements.push(e);
    project.items.push({ kind: 'element', id: e.id });
    const lens = project.elements.find(e => e.resource.id === 'black-hole-lensing')!;
    const values = new Map<string, any>();
    for (const e of project.elements)
        for (const b of e.bindings)
            values.set(e.id + ':' + b.parameterId, {
                parameterId: b.parameterId,
                state: 'ready',
                value: (b.source as any).value,
            });
    const canvas = document.createElement('canvas'),
        renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false });
    const scene = new CompositionScene({ renderer, readProject: () => project, resolveAt: () => values });
    const render = async (time = 3) => {
        const input = {
            elementSeeds: new Map(project.elements.map(e => [e.id, 123456789])),
            timeSeconds: time,
            values,
            bindingRevision: 0,
        };
        await scene.prepare(input);
        scene.render(input);
    };
    const pixels = () => {
        const gl = renderer.getContext(),
            p = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, p);
        return p;
    };
    const timings = [];
    let selective: any;
    try {
        renderer.setSize(1280, 720, false);
        scene.resize(1280, 720, 1);
        values.get(lens.id + ':amount').value = 0;
        await render();
        const before = pixels();
        values.get(lens.id + ':amount').value = 1;
        await render();
        const after = pixels();
        let red = 0,
            redChanged = 0,
            otherChanged = 0;
        for (let i = 0; i < before.length; i += 4) {
            if (before[i] === 255 && before[i + 1] === 0 && before[i + 2] === 0) {
                red++;
                if (after[i] !== 255 || after[i + 1] !== 0 || after[i + 2] !== 0) redChanged++;
            } else if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2])
                otherChanged++;
        }
        selective = { red, redChanged, otherChanged };
        // Exclude the synthetic overlay from the real combination benchmark.
        e.enabled = false;
        for (const [width, height] of [
            [1920, 1080],
            [3840, 2160],
        ]) {
            renderer.setSize(width, height, false);
            scene.resize(width, height, 1);
            const gl = renderer.getContext() as WebGL2RenderingContext,
                timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
            const wall: number[] = [],
                queries: WebGLQuery[] = [];
            for (let i = 0; i < 40; i++) {
                const input = {
                    elementSeeds: new Map(project.elements.map(e => [e.id, 123456789])),
                    timeSeconds: 3 + i / 60,
                    values,
                    bindingRevision: 0,
                };
                const start = performance.now();
                await scene.prepare(input);
                const q = i >= 20 && timer ? gl.createQuery() : null;
                if (q) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
                scene.render(input);
                if (q) {
                    gl.endQuery(timer!.TIME_ELAPSED_EXT);
                    queries.push(q);
                }
                gl.finish();
                if (i >= 20) wall.push(performance.now() - start);
            }
            const deadline = performance.now() + 10000;
            while (queries.some(q => !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) {
                if (performance.now() > deadline) throw Error('GPU timer timeout');
                await new Promise(r => setTimeout(r, 5));
            }
            const gpu =
                timer && !gl.getParameter(timer.GPU_DISJOINT_EXT)
                    ? queries.map(q => gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6).sort((a, b) => a - b)
                    : [];
            queries.forEach(q => gl.deleteQuery(q));
            wall.sort((a, b) => a - b);
            timings.push({
                width,
                height,
                wallMedian: wall[10],
                wallP95: wall[18],
                gpuMedian: gpu[10] ?? null,
                gpuP95: gpu[18] ?? null,
            });
        }
    } finally {
        scene.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
    }
    return { selective, timings };
}
