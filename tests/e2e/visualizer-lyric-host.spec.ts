import { expect, test } from '@playwright/test';

test('lyric atlas windows, readonly worker input, stale preparation and disposal', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const load = (name: string) => import('/src/visualizer/' + name + '.ts');
        const fixturePath = '/tests/support/lyric-fixture.ts';
        const { lyricFixture, lyricAsset } = await import(fixturePath);
        const { CompositionLyricHost, lyricHostDiagnostics } = await load('lyricHost');
        const { IsolatedAlgorithmRuntime } = await load('isolatedAlgorithmRuntime');
        const { resourceHash } = await load('resourceIdentity');
        const { project, element, algorithm } = lyricFixture();
        const asset = lyricAsset('[00:03.125]Hello world\n[00:05]你好世界\n[00:07]Last');
        project.lyricAssets = [asset];
        element.lyricBindings.lyrics = {
            kind: 'lyrics',
            assetId: asset.id,
            leadSeconds: 2,
            tailSeconds: 1.5,
            offsetSeconds: 0.25,
        };
        const baseline = lyricHostDiagnostics.textures;
        const host = new CompositionLyricHost();
        const runtime = new IsolatedAlgorithmRuntime();
        try {
            const early = await host.prepare(project, [element], 1.374, () => true);
            const active = await host.prepare(project, [element], 3.375, () => true);
            const info = active.get(element.id).lyrics;
            const texture = host.texture(element.id, 'lyrics', 0);
            await host.prepare(project, [element], 3.4, () => true);
            const reuse = host.texture(element.id, 'lyrics', 0) === texture;
            const a = {
                ...algorithm,
                source: 'export function create(){return {prepareFrame(f){let blocked=0;try{f.lyrics.lyrics.cues[0].tokens[0].time=99}catch{blocked=1}return {passes:[],state:[blocked,f.lyrics.lyrics.cues[0].tokens[0].time]}}}}',
            };
            a.hash = resourceHash(a);
            await runtime.initialize([{ id: element.id, algorithm: a }]);
            const packet = await runtime.prepareFrames(
                [
                    {
                        id: element.id,
                        frame: {
                            time: 3.375,
                            width: 320,
                            height: 180,
                            mode: 'timeline',
                            range: null,
                            seed: 0,
                            revision: '0',
                            parameters: {},
                            lyrics: active.get(element.id),
                        },
                    },
                ],
                async () => [],
            );
            let stale = false;
            try {
                await host.prepare(project, [element], 3.375, () => false);
            } catch {
                stale = true;
            }
            const keep = host.texture(element.id, 'lyrics', 0) === texture;
            const abandoned = new CompositionLyricHost();
            const pending = abandoned.prepare(project, [element], 3.375, () => true);
            abandoned.dispose();
            let disposedPending = false;
            try {
                await pending;
            } catch {
                disposedPending = true;
            }
            await host.prepare(project, [], 10, () => true);
            return {
                early: early.get(element.id).lyrics.cues.length,
                time: info.cues[0].tokens[0].time,
                second: info.cues[0].tokens[1].time,
                uv: info.cues[0].tokens[0].uv,
                reuse,
                stale,
                keep,
                disposedPending,
                state: packet.get(element.id).state,
                released: lyricHostDiagnostics.textures === baseline,
                imageReleased: texture.image === null,
            };
        } finally {
            runtime.dispose();
            host.dispose();
        }
    });
    expect(result.early).toBe(0);
    expect(result.time).toBe(3.375);
    expect(result.second).toBe(4.3125);
    expect(result.uv.every((n: number) => n >= 0 && n <= 1)).toBe(true);
    expect(result).toMatchObject({
        reuse: true,
        stale: true,
        keep: true,
        disposedPending: true,
        released: true,
        imageReleased: true,
        state: [1, 3.375],
    });
});

test('all lyric atlas pages blend into the same target with upright glyphs', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const fixturePath = '/tests/support/lyric-fixture.ts',
            rendererPath = '/tests/support/scene3d-fixture.ts';
        const scenePath = '/src/visualizer/compositionScene.ts';
        const { lyricFixture, lyricAsset } = await import(fixturePath);
        const { createSceneTestRenderer } = await import(rendererPath);
        const { CompositionScene } = await import(scenePath);
        const { project, element } = lyricFixture();
        const asset = lyricAsset(
            '[00:01]' + Array.from({ length: 350 }, (_, i) => 'word' + String(i).padStart(4, '0')).join(' '),
        );
        project.lyricAssets = [asset];
        element.lyricBindings.lyrics = {
            kind: 'lyrics',
            assetId: asset.id,
            leadSeconds: 2,
            tailSeconds: 1.5,
            offsetSeconds: 0,
        };
        const renderer = createSceneTestRenderer(document.createElement('canvas'));
        renderer.setSize(960, 540, false);
        let pages = 0;
        const scene = new CompositionScene({
            renderer,
            readProject: () => project,
            resolveAt: () => new Map(),
            runtimeFactory: () => ({
                async initialize() {},
                dispose() {},
                async prepareFrames(frames: any[]) {
                    const tokens: any[] = [
                        ...new Map(frames[0].frame.lyrics.lyrics.cues[0].tokens.map((t: any) => [t.page, t])).values(),
                    ];
                    pages = tokens.length;
                    return new Map([
                        [
                            element.id,
                            {
                                passes: tokens.map(token => {
                                    const x = (token.page - 1) * 0.5,
                                        [u0, v0, u1, v1] = token.uv;
                                    const points = [
                                        [x - 0.2, -0.055],
                                        [x + 0.2, -0.055],
                                        [x + 0.2, 0.055],
                                        [x - 0.2, 0.055],
                                    ];
                                    const uv = [
                                            [u0, v1],
                                            [u1, v1],
                                            [u1, v0],
                                            [u0, v0],
                                        ],
                                        order = [0, 1, 2, 0, 2, 3];
                                    return {
                                        program: 'text',
                                        uniforms: { uText: token.page },
                                        mesh: {
                                            positions: new Float32Array(order.flatMap(i => [...points[i], 0])),
                                            colors: new Float32Array(order.flatMap(() => [1, 1, 1, 1])),
                                            edges: new Float32Array(order.flatMap(i => uv[i])),
                                        },
                                    };
                                }),
                            },
                        ],
                    ]);
                },
            }),
        });
        try {
            scene.resize(960, 540, 1);
            const input = { elementSeeds: new Map(), timeSeconds: 1, values: new Map(), bindingRevision: 0 };
            await scene.prepare(input);
            scene.render(input);
            const gl = renderer.getContext(),
                counts = [];
            for (let i = 0; i < pages; i++) {
                const pixels = new Uint8Array(220 * 80 * 4);
                gl.readPixels(Math.round(480 + (i - 1) * 270 - 110), 230, 220, 80, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                let count = 0;
                for (let n = 0; n < pixels.length; n += 4) if (pixels[n] > 50) count++;
                counts.push(count);
            }
            return { pages, counts };
        } finally {
            scene.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
        }
    });
    expect(result.pages).toBeGreaterThanOrEqual(2);
    expect(result.counts.every((n: number) => n > 100)).toBe(true);
});
