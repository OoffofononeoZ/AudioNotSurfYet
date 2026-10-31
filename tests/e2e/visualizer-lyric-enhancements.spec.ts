import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resourcePack } from '../support/visualizer-assets.mjs';

test('real local font metrics, extended retention and enhanced glitch/shake shader rendering', async ({
    page,
    context,
}, info) => {
    await context.grantPermissions(['local-fonts']);
    await page.goto('/');
    await page.evaluate(() => {
        const b = document.createElement('button');
        b.id = 'font-test-read';
        b.style.cssText = 'position:fixed;left:450px;top:20px;z-index:99999;background:white;color:black;padding:12px';
        b.textContent = '读取字体测试';
        b.onclick = () => {
            (window as any).queryLocalFonts().then((fonts: any[]) => {
                (window as any).testFont = fonts.find(f => f.fullName === 'Georgia') ?? fonts[0];
            });
        };
        document.body.append(b);
    });
    await page.locator('#font-test-read').click();
    await expect.poll(() => page.evaluate(() => !!(window as any).testFont)).toBe(true);
    const font = await page.evaluate(() => {
        const f = (window as any).testFont;
        return { family: f.family, fullName: f.fullName, postscriptName: f.postscriptName };
    });
    const result = await page.evaluate(
        async ({ pack, font }) => {
            const load = (name: string) => import('/src/visualizer/' + name + '.ts');
            const fixturePath = '/tests/support/lyric-fixture.ts',
                renderPath = '/tests/support/scene3d-fixture.ts';
            const { lyricFixture, lyricAsset } = await import(fixturePath),
                { createSceneTestRenderer } = await import(renderPath);
            const { createDefinitionElement } = await load('elementRegistry'),
                { CompositionScene } = await load('compositionScene'),
                { CompositionLyricHost, lyricHostDiagnostics } = await load('lyricHost');
            await document.fonts.ready;
            const baselineFonts = document.fonts.size,
                baselineTextures = lyricHostDiagnostics.textures;
            const project = lyricFixture().project,
                e = createDefinitionElement(pack.elements[0], 12, 0),
                asset = lyricAsset('[00:02]Gravity bends 星河流动 e\u0301 👩‍🚀');
            project.resources = { algorithms: pack.algorithms, elements: pack.elements, presets: [] };
            project.elements = [e];
            project.items = [{ kind: 'element', id: e.id }];
            project.lyricAssets = [asset];
            e.lyricBindings.lyrics = {
                kind: 'lyrics',
                assetId: asset.id,
                leadSeconds: 0.6,
                tailSeconds: 0.01,
                offsetSeconds: 0,
                font,
            };
            e.bindings.find((b: any) => b.parameterId === 'destroyDurationSeconds').source = {
                kind: 'constant',
                value: 4,
            };
            const host = new CompositionLyricHost();
            let retained = 0,
                height = 0,
                missing = '',
                kept = false;
            try {
                const f = (await host.prepare(project, [e], 8, () => true)).get(e.id).lyrics;
                retained = f.cues.length;
                height = f.cues[0].tokens[0].height;
                const texture = host.texture(e.id, 'lyrics', 0);
                e.lyricBindings.lyrics.font = {
                    family: 'missing',
                    fullName: 'Missing Test Font',
                    postscriptName: 'MissingFont-0123456789',
                };
                try {
                    await host.prepare(project, [e], 8, () => true);
                } catch (error) {
                    missing = (error as Error).message;
                }
                kept = host.texture(e.id, 'lyrics', 0) === texture;
                e.lyricBindings.lyrics.font = font;
            } finally {
                host.dispose();
            }
            const canvas = document.createElement('canvas'),
                renderer = createSceneTestRenderer(canvas);
            renderer.setSize(1280, 720, false);
            const values = new Map(
                e.bindings.map((b: any) => [e.id + ':' + b.parameterId, { state: 'ready', value: b.source.value }]),
            );
            const scene = new CompositionScene({ renderer, readProject: () => project, resolveAt: () => values });
            const captures: { name: string; image: string; lit: number }[] = [];
            const capture = async (name: string, time: number, changes: Record<string, number | boolean> = {}) => {
                for (const [key, value] of Object.entries(changes)) (values.get(e.id + ':' + key) as any).value = value;
                const input = { elementSeeds: new Map([[e.id, 123]]), timeSeconds: time, values, bindingRevision: 0 };
                await scene.prepare(input);
                scene.render(input);
                const pixels = new Uint8Array(1280 * 720 * 4),
                    gl = renderer.getContext();
                gl.readPixels(0, 0, 1280, 720, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                let lit = 0;
                for (let i = 0; i < pixels.length; i += 4)
                    if (pixels[i] > 15 || pixels[i + 1] > 15 || pixels[i + 2] > 15) lit++;
                captures.push({ name, image: canvas.toDataURL('image/png'), lit });
            };
            try {
                scene.resize(1280, 720, 1);
                await capture('glitch-low', 1.45, { glitchIntensity: 1 });
                await capture('glitch-high', 1.45, { glitchIntensity: 5 });
                await capture('stable', 3);
                await capture('stable-repeat', 3.04);
                await capture('shake', 3, { shakeEnabled: true, shakeIntensity: 3 });
                await capture('shake-next', 3.04);
                await capture('spiral', 7.2);
                await capture('retained-spiral', 8);
                await capture('expired', 9.2);
            } finally {
                scene.dispose();
                renderer.dispose();
                renderer.forceContextLoss();
            }
            return {
                retained,
                height,
                missing,
                kept,
                captures,
                released: lyricHostDiagnostics.textures === baselineTextures,
                fontsReleased: document.fonts.size === baselineFonts,
            };
        },
        { pack: resourcePack('elements/black-hole-lyrics'), font },
    );
    expect(result.retained).toBe(1);
    expect(result.height).toBeGreaterThanOrEqual(88);
    expect(result.missing).toContain('不可用');
    expect(result.kept && result.released && result.fontsReleased).toBe(true);
    const byName = Object.fromEntries(result.captures.map(c => [c.name, c]));
    expect(byName.stable!.image).toBe(byName['stable-repeat']!.image);
    expect(byName.shake!.image).not.toBe(byName['shake-next']!.image);
    expect(byName['glitch-low']!.image).not.toBe(byName['glitch-high']!.image);
    expect(byName['retained-spiral']!.lit).toBeGreaterThan(0);
    expect(byName.expired!.lit).toBe(0);
    const dir = 'artifacts/black-hole-lyrics';
    await mkdir(dir, { recursive: true });
    for (const c of result.captures)
        await writeFile(
            dir + '/' + info.project.name + '-' + c.name + '.png',
            Buffer.from(c.image.split(',')[1]!, 'base64'),
        );
});
