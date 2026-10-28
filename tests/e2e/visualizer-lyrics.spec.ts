import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { resourcePack } from '../support/visualizer-assets.mjs';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';

const artifact = 'artifacts/visualizer-composition/lyrics';
test.use({ viewport: { width: 1920, height: 1080 } });

test('real lyric resource renders readable glyphs at both anchors and directions, seeks and releases', async ({
    page,
}, info) => {
    await page.goto('/');
    const result = await page.evaluate(async pack => {
        const load = (name: string) => import('/src/visualizer/' + name + '.ts');
        const fixturePath = '/tests/support/lyric-fixture.ts',
            sceneFixturePath = '/tests/support/scene3d-fixture.ts';
        const { lyricFixture, lyricAsset } = await import(fixturePath);
        const { createSceneTestRenderer } = await import(sceneFixturePath);
        const { createDefinitionElement } = await load('elementRegistry');
        const { CompositionScene } = await load('compositionScene');
        const { lyricHostDiagnostics } = await load('lyricHost');
        const { IsolatedAlgorithmRuntime } = await load('isolatedAlgorithmRuntime');
        const p = lyricFixture().project,
            e = createDefinitionElement(pack.elements[0], 10, 0);
        const asset = lyricAsset('[00:03.125]Hello world\n[00:07.125]你好世界');
        p.resources = { algorithms: pack.algorithms, elements: pack.elements, presets: [] };
        p.elements = [e];
        p.items = [{ kind: 'element', id: e.id }];
        p.lyricAssets = [asset];
        e.lyricBindings.lyrics = {
            kind: 'lyrics',
            assetId: asset.id,
            leadSeconds: 2,
            tailSeconds: 1.5,
            offsetSeconds: 0,
        };
        const values = new Map(
            e.bindings.map((b: any) => [
                e.id + ':' + b.parameterId,
                {
                    state: 'ready',
                    value: b.parameterId === 'spectrum' ? Array(128).fill(0.4) : b.source.value,
                },
            ]),
        );
        const baseline = lyricHostDiagnostics.textures,
            captures: any[] = [],
            runtime = new IsolatedAlgorithmRuntime();
        const canvas = document.createElement('canvas'),
            renderer = createSceneTestRenderer(canvas);
        renderer.setSize(1920, 1080, false);
        const scene = new CompositionScene({
            renderer,
            readProject: () => p,
            resolveAt: () => values,
            runtimeFactory: () => ({
                initialize: (...args: any[]) => runtime.initialize(...args),
                dispose: () => runtime.dispose(),
                async prepareFrames(...args: any[]) {
                    const r = await runtime.prepareFrames(...args);
                    captures.push(r.get(e.id));
                    return r;
                },
            }),
        });
        const results: any[] = [];
        let image = '',
            uprightError = 0,
            flippedError = 0;
        try {
            scene.resize(1920, 1080, 1);
            for (const reverse of [false, true])
                for (const time of [3.125, 7.125, 0.5, 3.125]) {
                    (values.get(e.id + ':reverse') as { value: boolean }).value = reverse;
                    const input = {
                        elementSeeds: new Map([[e.id, 123]]),
                        timeSeconds: time,
                        values,
                        bindingRevision: 0,
                    };
                    await scene.prepare(input);
                    scene.render(input);
                    const packet = captures.at(-1),
                        gl = renderer.getContext(),
                        pixels = new Uint8Array(1920 * 1080 * 4);
                    gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                    let lit = 0;
                    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 30) lit++;
                    results.push({ reverse, time, lit, state: packet?.state });
                    if (time === 3.125 && !reverse) {
                        image = canvas.toDataURL('image/png');
                        const positions = packet.passes[0].mesh.positions;
                        const x = 960 + positions[0] * 1080,
                            y = 540 + positions[1] * 1080;
                        const width = (positions[3] - positions[0]) * 1080;
                        const height = (positions[7] - positions[1]) * 1080;
                        const token = (scene as any).lyrics.texture(e.id, 'lyrics', 0).image;
                        const edges = packet.passes[0].mesh.edges;
                        const sx = edges[0] * 2048,
                            sy = (1 - edges[1]) * 2048;
                        const sw = (edges[2] - edges[0]) * 2048,
                            sh = (edges[1] - edges[5]) * 2048;
                        const reference = document.createElement('canvas');
                        reference.width = 1920;
                        reference.height = 1080;
                        const context = reference.getContext('2d')!;
                        context.drawImage(token, sx, sy, sw, sh, x, y, width, height);
                        const normal = context.getImageData(0, 0, 1920, 1080).data;
                        uprightError = flippedError = 0;
                        for (let py = Math.ceil(y); py < Math.floor(y + height); py++)
                            for (let px = Math.ceil(x); px < Math.floor(x + width); px++) {
                                const actual = pixels[((1079 - py) * 1920 + px) * 4]! > 64;
                                const expected = normal[(py * 1920 + px) * 4 + 3]! > 64;
                                const flipY = Math.max(0, Math.min(1079, Math.round(2 * y + height - py)));
                                const flipped = normal[(flipY * 1920 + px) * 4 + 3]! > 64;
                                uprightError += actual !== expected ? 1 : 0;
                                flippedError += actual !== flipped ? 1 : 0;
                            }
                    }
                }
        } finally {
            scene.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
        }
        return { results, image, uprightError, flippedError, released: lyricHostDiagnostics.textures === baseline };
    }, resourcePack('elements/circular-depth-lyrics'));
    for (const r of result.results.filter((r: any) => r.time > 1)) expect(r.lit).toBeGreaterThan(100);
    for (const reverse of [false, true]) {
        const repeated = result.results.filter((r: any) => r.reverse === reverse && r.time === 3.125);
        expect(repeated[0].state).toEqual(repeated[1].state);
    }
    expect(result.released).toBe(true);
    expect(result.uprightError).toBeLessThan(result.flippedError * 0.7);
    await mkdir(artifact, { recursive: true });
    await writeFile(
        path.join(artifact, `render-${info.project.name}.png`),
        Buffer.from(result.image.split(',')[1]!, 'base64'),
    );
});

async function exported(page: Page): Promise<VisualizerProjectV6> {
    const count = (await savedPickerEntries(page)).length;
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}
async function load(page: Page, p: VisualizerProjectV6) {
    await queuePickerData(page, [{ name: 'lyrics.json', mimeType: 'application/json', text: JSON.stringify(p) }]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}

test('LRC selection retains errors and rejects stale replacements; snapshots export both directions at 30/60 fps', async ({
    page,
}, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    if ((await page.getByTestId('toggle-playback').getAttribute('aria-label')) === '暂停')
        await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    const card = page.locator('[data-element-type="circular-depth-lyrics"]');
    await expect
        .poll(() =>
            card.locator('img').evaluate(node => {
                const img = node as HTMLImageElement;
                return img.complete && img.naturalWidth > 0 && img.src.startsWith('blob:');
            }),
        )
        .toBe(true);
    await card.click();
    const before = await exported(page);
    expect(before.elements[0]!.lyricBindings).toEqual({ lyrics: { kind: 'unbound' } });
    const file = page.locator('[data-lyric-input=lyrics] input[type=file]');
    await file.setInputFiles({
        name: 'synthetic.lrc',
        mimeType: 'text/plain',
        buffer: Buffer.from('[00:00.500]Hello world\n[00:01.125]你好世界\n[00:01.800]Again'),
    });
    await expect(page.getByRole('button', { name: '清除歌词', exact: true })).toBeVisible();
    const bound = await exported(page);
    expect(bound.lyricAssets).toHaveLength(1);
    await file.setInputFiles({ name: 'bad.lrc', mimeType: 'text/plain', buffer: Buffer.from('untimed') });
    await expect(page.locator('[data-lyric-input=lyrics] [role=alert]')).toContainText('时间戳');
    expect((await exported(page)).lyricAssets).toEqual(bound.lyricAssets);
    await page.evaluate(() => {
        const original = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = async function () {
            if (this.name === 'slow.lrc')
                await new Promise<void>(resolve => {
                    (window as any).releaseLyric = resolve;
                });
            return original.call(this);
        };
    });
    await file.setInputFiles({ name: 'slow.lrc', mimeType: 'text/plain', buffer: Buffer.from('[00:01]stale') });
    await expect(page.getByText('正在读取歌词…')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await page.locator('[data-element-type="solid"]').click();
    await page.evaluate(() => (window as any).releaseLyric());
    expect((await exported(page)).lyricAssets).toEqual(bound.lyricAssets);
    const p = bound;
    p.elements[0]!.seed = 123;
    p.elements[0]!.bindings = p.elements[0]!.bindings.map(b =>
        b.parameterId === 'spectrum' ? { ...b, source: { kind: 'constant', value: Array(128).fill(0.4) } } : b,
    );
    await mkdir(artifact, { recursive: true });
    for (const [fps, reverse] of [
        [30, false],
        [60, true],
    ] as const) {
        p.output.frameRate = fps;
        p.elements[0]!.bindings.find(b => b.parameterId === 'reverse')!.source = { kind: 'constant', value: reverse };
        await load(page, p);
        await page.getByTestId('visualizer-preview-frame').hover();
        await page.getByTestId('start-visualizer-export').click();
        await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 40000 });
        await page.getByTestId('save-visualizer-export').click();
        await expect(page.locator('[data-export-status=idle]')).toBeVisible();
        const video = (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).at(-1)!;
        await writeFile(path.join(artifact, `${info.project.name}-${fps}.webm`), Buffer.from(video.base64, 'base64'));
    }
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry('visualizer-library-fixture', { recursive: true });
    });
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    expect((await exported(page)).lyricAssets).toEqual(bound.lyricAssets);
    expect(errors).toEqual([]);
});
