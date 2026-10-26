import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1920, height: 1080 } });

test('isolated algorithms cannot mutate the shared camera snapshot', async ({ page }) => {
    await page.goto('/');
    const state = await page.evaluate(async () => {
        const load = (name: string) => import('/src/visualizer/' + name + '.ts');
        const fixturePath = '/tests/support/scene3d-fixture.ts';
        const { scene3dFixture } = await import(fixturePath);
        const { IsolatedAlgorithmRuntime } = await load('isolatedAlgorithmRuntime');
        const { resourceHash } = await load('resourceIdentity');
        const { resolveSceneCamera } = await load('scene3dCamera');
        const p = scene3dFixture(),
            a = p.resources.algorithms[0];
        a.source =
            'export function create(){return {prepareFrame(frame){let blocked=0;try{frame.camera.position[0]=999}catch{blocked=1}return {passes:[],state:[blocked,frame.camera.position[0]]}}}}';
        a.hash = resourceHash(a);
        const runtime = new IsolatedAlgorithmRuntime();
        try {
            await runtime.initialize([{ id: 'world', algorithm: a }]);
            const result = await runtime.prepareFrames(
                [
                    {
                        id: 'world',
                        frame: {
                            mode: 'timeline',
                            time: 0,
                            seed: 0,
                            revision: '0',
                            width: 320,
                            height: 180,
                            range: null,
                            parameters: {},
                            camera: resolveSceneCamera(p.items[0].camera, 0, 320, 180),
                        },
                    },
                ],
                async () => [],
            );
            return result.get('world').state;
        } finally {
            runtime.dispose();
        }
    });
    expect(state).toEqual([1, 0]);
});

test('shared scene depth handles reversed submission, multiple passes, cutout and separate containers', async ({
    page,
}) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const fixturePath = '/tests/support/scene3d-fixture.ts';
        const scenePath = '/src/visualizer/compositionScene.ts';
        const { scene3dFixture, createSceneTestRenderer } = await import(fixturePath);
        const { CompositionScene } = await import(scenePath);
        const results: Record<string, number[]> = {};
        for (const mode of ['normal', 'reverse', 'passes', 'mask', 'separate']) {
            const p = scene3dFixture();
            const group = p.items[0];
            group.camera = { ...group.camera, position: [0, 0, 5], target: [0, 0, 0] };
            const program = p.resources.algorithms[0].programs.mesh;
            program.vertex =
                'attribute vec4 ink; varying vec4 vInk; void main(){vInk=ink;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
            program.fragment =
                'varying vec4 vInk; vec4 shade(){ vec4 c=vInk; ' +
                (mode === 'mask' ? 'if(vInk.r>0.5 && gl_FragCoord.x>140. && gl_FragCoord.x<180.)c.a=0.;' : '') +
                'return c;}';
            program.alphaMode = mode === 'mask' ? 'mask' : 'opaque';
            const first = p.elements[0].id,
                second = p.elements[1].id;
            if (mode === 'reverse') group.children.reverse();
            if (mode === 'separate')
                p.items = [
                    { ...group, children: [first] },
                    { ...group, id: crypto.randomUUID(), children: [second] },
                ];
            const pass = (near: boolean) => ({
                program: 'mesh',
                uniforms: {},
                mesh: {
                    positions: new Float32Array([
                        -1,
                        -1,
                        near ? 0 : -1,
                        1,
                        -1,
                        near ? 0 : -1,
                        1,
                        1,
                        near ? 0 : -1,
                        -1,
                        -1,
                        near ? 0 : -1,
                        1,
                        1,
                        near ? 0 : -1,
                        -1,
                        1,
                        near ? 0 : -1,
                    ]),
                    colors: new Float32Array(
                        Array.from({ length: 6 }, () => (near ? [1, 0, 0, 1] : [0, 0, 1, 1])).flat(),
                    ),
                    edges: new Float32Array(12),
                },
            });
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 180;
            const renderer = createSceneTestRenderer(canvas);
            renderer.setSize(320, 180, false);
            const scene = new CompositionScene({
                renderer,
                readProject: () => p,
                resolveAt: () => new Map(),
                runtimeFactory: () => ({
                    async initialize() {},
                    dispose() {},
                    async prepareFrames(frames: any[]) {
                        return new Map(
                            frames.map(f => [
                                f.id,
                                {
                                    passes:
                                        mode === 'passes'
                                            ? f.id === first
                                                ? [pass(true), pass(false)]
                                                : []
                                            : [pass(f.id === first)],
                                },
                            ]),
                        );
                    },
                }),
            });
            try {
                scene.resize(320, 180, 1);
                const input = { elementSeeds: new Map(), timeSeconds: 0, values: new Map(), bindingRevision: 0 };
                await scene.prepare(input);
                scene.render(input);
                const gl = renderer.getContext(),
                    pixel = new Uint8Array(4);
                gl.readPixels(160, 90, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
                results[mode] = [...pixel];
            } finally {
                scene.dispose();
                renderer.dispose();
                renderer.forceContextLoss();
            }
        }
        return results;
    });
    for (const mode of ['normal', 'reverse', 'passes']) expect(result[mode]).toEqual([255, 0, 0, 255]);
    for (const mode of ['mask', 'separate']) expect(result[mode]).toEqual([0, 0, 255, 255]);
});

test('camera pose and GPU result are deterministic after arbitrary seeks and resizing', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const fixturePath = '/tests/support/scene3d-fixture.ts',
            scenePath = '/src/visualizer/compositionScene.ts';
        const { scene3dFixture, createSceneTestRenderer } = await import(fixturePath);
        const { CompositionScene } = await import(scenePath);
        const p = scene3dFixture(),
            s = p.items[0];
        s.camera.animation = {
            durationSeconds: 10,
            loop: true,
            keyframes: [
                { timeSeconds: 0, position: [0, 2, 6], target: [0, 0, 0], fov: 50 },
                { timeSeconds: 5, position: [3, 2, 6], target: [0, 0, 0], fov: 60 },
                { timeSeconds: 10, position: [0, 2, 6], target: [0, 0, 0], fov: 50 },
            ],
        };
        const captured: any[] = [];
        const renderer = createSceneTestRenderer(document.createElement('canvas'));
        const scene = new CompositionScene({
            renderer,
            readProject: () => p,
            resolveAt: () => new Map(),
            runtimeFactory: () => ({
                async initialize() {},
                dispose() {},
                async prepareFrames(frames: any[]) {
                    captured.push(frames.map(f => f.frame.camera));
                    return new Map(frames.map(f => [f.id, { passes: [] }]));
                },
            }),
        });
        const frames = [];
        try {
            for (const t of [4, 0, 9, 4]) {
                scene.resize(320, 180, 1);
                const input = { elementSeeds: new Map(), timeSeconds: t, values: new Map(), bindingRevision: 0 };
                await scene.prepare(input);
                frames.push(scene.render(input).hash);
            }
            scene.resize(640, 360, 1);
            const input = { elementSeeds: new Map(), timeSeconds: 4, values: new Map(), bindingRevision: 0 };
            await scene.prepare(input);
            scene.render(input);
            return {
                samePose: captured.every(c => JSON.stringify(c[0]) === JSON.stringify(c[1])),
                seekSame: frames[0] === frames[3],
                resizePose: JSON.stringify(captured[0]) === JSON.stringify(captured[4]),
            };
        } finally {
            scene.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
        }
    });
    expect(result).toEqual({ samePose: true, seekSame: true, resizePose: true });
});
