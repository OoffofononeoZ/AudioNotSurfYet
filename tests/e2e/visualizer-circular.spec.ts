import { chooseVisualizerProjectExport, openRealtimeStyleExport } from '../support/project-actions';
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { chooseFiles, installFilePickerStub, savedPickerEntries, queuePickerData } from '../support/file-picker';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';
import { resourcePack, assetsRoot } from '../support/visualizer-assets.mjs';
const artifact = 'artifacts/visualizer-composition/circular';
async function open(page: Page) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    if ((await page.locator('#music-bar-container').getAttribute('data-playback-state')) === 'playing')
        await page.getByTestId('toggle-playback').click();
}
async function exported(page: Page): Promise<VisualizerProjectV6> {
    const count = (await savedPickerEntries(page)).length;
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}
async function load(page: Page, project: VisualizerProjectV6) {
    await queuePickerData(page, [
        { name: 'circular.json', mimeType: 'application/json', text: JSON.stringify(project) },
    ]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
async function seek(page: Page, time: number) {
    if (!(await page.getByTestId('visualizer-seek').count())) {
        await page.getByTestId('visualizer-preview-frame').hover();
        await page.getByTestId('visualizer-fullscreen-toggle').click();
    }
    const slider = page.getByTestId('visualizer-seek');
    await slider.fill(String(time));
    await slider.dispatchEvent('input');
    await expect(page.getByTestId('visualizer-preview-canvas')).toHaveAttribute('data-frame-time', time.toFixed(6));
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    return page.getByTestId('visualizer-preview-canvas').getAttribute('data-frame-state-hash');
}
test('seven standalone circular elements compile, render and reconstruct after seeks', async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    for (const id of ['background', 'particles', 'depth', 'bars', 'outer', 'center', 'foreground']) {
        await page.getByTestId('add-visualizer-element').click();
        await page.getByRole('button', { name: '元素', exact: true }).click();
        await page.locator('[data-element-type="circular-' + id + '"]').click();
        await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    }
    const p = await exported(page);
    for (const e of p.elements) {
        if (e.resource.id === 'circular-depth' || e.resource.id === 'circular-foreground') e.enabled = false;
        for (const b of e.bindings)
            if (b.parameterId === 'spectrum')
                b.source = {
                    kind: 'constant',
                    value: Array.from({ length: 128 }, (_, i) => 0.12 + 0.6 * Math.sin(i * 0.3) ** 2),
                };
    }
    await load(page, p);
    const first = await seek(page, 2);
    await seek(page, 2.7);
    await seek(page, 0.5);
    expect(await seek(page, 2)).toBe(first);
    await fs.mkdir(artifact, { recursive: true });
    await page
        .getByTestId('visualizer-preview-canvas')
        .screenshot({ path: artifact + '/standalone.png', style: '.viz-video-controls{visibility:hidden!important}' });
    expect(errors).toEqual([]);
});
test('isolated circular smoothing follows reference 0/50/100 semantics independently of rendering cadence', async ({
    page,
}) => {
    await page.goto('/');
    const algorithm = resourcePack('elements/circular-bars').algorithms[0];
    const result = await page.evaluate(async algorithm => {
        const modulePath = '/src/visualizer/isolatedAlgorithmRuntime.ts';
        const { IsolatedAlgorithmRuntime } = await import(modulePath);
        const runtime = new IsolatedAlgorithmRuntime();
        const results: Record<string, number[]> = {};
        try {
            await runtime.initialize([0, 50, 100].map(r => ({ id: 'r' + r, algorithm })));
            for (const r of [0, 50, 100]) {
                const values: number[] = [];
                for (let tick = 0; tick <= 4; tick += 2) {
                    const frame = {
                        time: tick / 60,
                        seed: 0,
                        revision: 'test',
                        width: 1920,
                        height: 1080,
                        range: null,
                        mode: 'realtime' as const,
                        parameters: {
                            spectrum: { value: Array(128).fill(1) },
                            responsiveness: { value: r },
                            noise: { value: false },
                            normalize: { value: false },
                        },
                    };
                    const packets = await runtime.prepareFrames([{ id: 'r' + r, frame }], async () => {
                        throw Error('Unexpected realtime history');
                    });
                    values.push(packets.get('r' + r)!.state![0]!);
                }
                results[r] = values;
            }
        } finally {
            runtime.dispose();
        }
        return results;
    }, algorithm);
    expect(result['0']).toEqual([0, 0, 0]);
    expect(result['50']).toEqual([0.5, 0.75, 0.875]);
    expect(result['100']).toEqual([1, 1, 1]);
});

async function add(page: Page, id: string) {
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '元素', exact: true }).click();
    await page.locator('[data-element-type="' + id + '"]').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
const mediaFile = (name: string) => path.resolve('tests/fixtures/visualizer-media', name);
async function imageData(page: Page, testId = 'visualizer-preview-canvas') {
    const png = await page
        .getByTestId(testId)
        .screenshot({ style: '.viz-video-controls{visibility:hidden!important}' });
    return page.evaluate(async data => {
        const b = await createImageBitmap(
            new Blob([Uint8Array.from(atob(data), c => c.charCodeAt(0))], { type: 'image/png' }),
        );
        const canvas = new OffscreenCanvas(16, 9),
            ctx = canvas.getContext('2d')!;
        ctx.drawImage(b, 0, 0, 16, 9);
        b.close();
        const pixels = Array.from(ctx.getImageData(0, 0, 16, 9).data);
        return { pixel: pixels.slice((2 * 16 + 3) * 4, (2 * 16 + 3) * 4 + 4), pixels };
    }, png.toString('base64'));
}
async function upload(page: Page, names: string[]) {
    const before = await page.getByTestId('visualizer-preview-canvas').getAttribute('data-binding-revision');
    await page.locator('[data-media-input="background"] input[type=file]').setInputFiles(names.map(mediaFile));
    for (const name of names) await expect(page.locator('[data-media-input="background"]')).toContainText(name);
    await expect
        .poll(() => page.getByTestId('visualizer-preview-canvas').getAttribute('data-binding-revision'))
        .not.toBe(before);
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
test('media UI validates images, keeps failed replacements, crossfades and restores embedded bytes', async ({
    page,
}) => {
    test.setTimeout(90000);
    await open(page);
    await add(page, 'circular-background');
    await upload(page, ['red.png']);
    await expect.poll(async () => (await imageData(page)).pixel[0]).toBeGreaterThan(200);
    await upload(page, ['blue.webp']);
    await expect.poll(async () => (await imageData(page)).pixel[2]).toBeGreaterThan(200);
    await upload(page, ['green.jpg']);
    await expect.poll(async () => (await imageData(page)).pixel[1]).toBeGreaterThan(110);
    const before = await exported(page);
    await page
        .locator('[data-media-input="background"] input[type=file]')
        .setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
    await expect(page.locator('[data-media-input="background"] [role=alert]')).toBeVisible();
    expect((await exported(page)).mediaAssets).toEqual(before.mediaAssets);
    await upload(page, ['red.png', 'blue.webp']);
    const interval = page.getByRole('spinbutton', { name: '轮播间隔', exact: true });
    await interval.fill('1');
    await interval.dispatchEvent('change');
    const fade = page.getByRole('spinbutton', { name: '轮播淡化', exact: true });
    await fade.fill('.2');
    await fade.dispatchEvent('change');
    await seek(page, 0.1);
    expect((await imageData(page)).pixel[0]).toBeGreaterThan(200);
    await seek(page, 0.9);
    const mixed = (await imageData(page)).pixel;
    expect(mixed[0]).toBeGreaterThan(70);
    expect(mixed[2]).toBeGreaterThan(70);
    await seek(page, 1.1);
    expect((await imageData(page)).pixel[2]).toBeGreaterThan(200);
    await page.keyboard.press('Escape');
    const embedded = await exported(page);
    expect(embedded.mediaAssets).toHaveLength(2);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    expect((await exported(page)).mediaAssets).toEqual(embedded.mediaAssets);
    await page.getByRole('button', { name: '可变背景', exact: true }).click();
    await page.getByRole('button', { name: '清除素材', exact: true }).click();
    expect((await exported(page)).mediaAssets).toHaveLength(0);
    await page.goto('/');
    await expect
        .poll(() =>
            page.evaluate(async () => {
                const modulePath = '/src/visualizer/mediaHost.ts';
                return (await import(modulePath)).mediaHostDiagnostics.assets;
            }),
        )
        .toBe(0);
});
test('video backgrounds seek, loop and survive JSON and realtime snapshots', async ({ page }) => {
    test.setTimeout(90000);
    await open(page);
    await add(page, 'circular-background');
    for (const file of ['moving.webm', 'moving.mp4']) {
        await upload(page, [file]);
        await seek(page, 0.2);
        const first = (await imageData(page)).pixels;
        await seek(page, 0.6);
        expect((await imageData(page)).pixels).not.toEqual(first);
        await seek(page, 0.2);
        expect((await imageData(page)).pixels).toEqual(first);
        await page.keyboard.press('Escape');
    }
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    const p = await exported(page);
    await load(page, p);
    expect((await exported(page)).mediaAssets).toEqual(p.mediaAssets);
    await openRealtimeStyleExport(page);
    await expect(page.getByTestId('create-display-page')).toBeEnabled();
    await page.getByTestId('create-display-page').click();
    await expect(page.getByRole('textbox', { name: '本地展示地址' })).toHaveValue(/display/);
    await page.getByRole('link', { name: '打开展示页' }).click();
    await expect(page.getByTestId('realtime-visualizer-canvas')).toHaveAttribute('data-webgl-context-state', 'ready');
    await expect
        .poll(async () => {
            const p = (await imageData(page, 'realtime-visualizer-canvas')).pixel;
            return p[0]! + p[1]! + p[2]!;
        })
        .toBeGreaterThan(40);
    await fs.mkdir(artifact, { recursive: true });
    await page.getByTestId('realtime-visualizer-canvas').screenshot({ path: artifact + '/media-display.png' });
});
test('preset defaults and shared responsiveness apply to all five reactive leaves', async ({ page }) => {
    await open(page);
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="circular-visualizer-893418273"]').click();
    const control = page.getByRole('spinbutton', { name: 'Responsiveness', exact: true });
    await expect(control).toHaveValue('50');
    await control.fill('65');
    await control.dispatchEvent('change');
    const p = await exported(page);
    expect(p.elements).toHaveLength(7);
    expect(
        p.elements
            .filter(e => e.bindings.some(b => b.parameterId === 'responsiveness'))
            .every(
                e =>
                    e.bindings.find(b => b.parameterId === 'responsiveness')!.source.kind === 'constant' &&
                    (e.bindings.find(b => b.parameterId === 'responsiveness')!.source as { value: number }).value ===
                        65,
            ),
    ).toBe(true);
    await openRealtimeStyleExport(page);
    await expect(page.getByTestId('apply-home-style')).toBeEnabled();
    await page.getByTestId('create-display-page').click();
    await page.getByRole('link', { name: '打开展示页' }).click();
    await expect(page.getByTestId('realtime-visualizer-canvas')).toHaveAttribute('data-webgl-context-state', 'ready');
});

test('circular preset and video background export all four offline profiles', async ({ page }, info) => {
    test.setTimeout(240000);
    await open(page);
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="circular-visualizer-893418273"]').click();
    await page.getByRole('button', { name: '展开Circular Visualizer', exact: true }).click();
    await page.getByRole('button', { name: '可变背景', exact: true }).click();
    await upload(page, ['moving.webm']);
    const p = await exported(page);
    await fs.mkdir(artifact, { recursive: true });
    for (const resolution of ['720p', '1080p'] as const)
        for (const frameRate of [30, 60] as const) {
            p.output = { aspectRatio: '16:9', resolution, frameRate, audioVideoOffsetMs: 0 };
            await load(page, p);
            await page.getByTestId('visualizer-preview-frame').hover();
            await page.getByTestId('start-visualizer-export').click();
            await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 90000 });
            const diagnostics = await page.evaluate(() => (window as any).__VISUALIZER_DIAGNOSTICS__);
            expect(diagnostics.exportFramesDone).toBe(Math.ceil(p.track.durationSeconds * frameRate));
            await page.getByTestId('save-visualizer-export').click();
            await expect(page.locator('[data-export-status=idle]')).toBeVisible();
            const saved = (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).at(-1)!;
            await fs.writeFile(
                artifact + '/' + info.project.name + '-' + resolution + frameRate + '.webm',
                Buffer.from(saved.base64, 'base64'),
            );
        }
});
test('circular media wallpaper exports and runs from a server-free file directory', async ({ page, browser }, info) => {
    test.setTimeout(60000);
    await open(page);
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="circular-visualizer-893418273"]').click();
    await page.getByRole('button', { name: '展开Circular Visualizer', exact: true }).click();
    await page.getByRole('button', { name: '可变背景', exact: true }).click();
    await upload(page, ['moving.webm']);
    await openRealtimeStyleExport(page);
    await page.getByTestId('prepare-wallpaper-export').click();
    await expect(page.getByTestId('save-wallpaper-directory')).toBeVisible();
    await page.evaluate(() => {
        (window as any).showDirectoryPicker = () => navigator.storage.getDirectory();
    });
    await page.getByTestId('save-wallpaper-directory').click();
    await expect(page.getByRole('status').filter({ hasText: '已导出' })).toBeVisible();
    const files = await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        for await (const [name, handle] of (root as any).entries())
            if (name.startsWith('audiosurf-')) {
                const files: { name: string; content: string }[] = [];
                for await (const [name, file] of handle.entries())
                    files.push({ name, content: await (await file.getFile()).text() });
                return files;
            }
        throw Error('Output missing');
    });
    const root = path.resolve(artifact, 'wallpaper-' + info.project.name);
    await fs.mkdir(root, { recursive: true });
    for (const file of files) await fs.writeFile(path.join(root, file.name), file.content);
    expect(files.find(f => f.name === 'THIRD_PARTY_LICENSES.txt')!.content).toContain('Mediabunny');
    const context = await browser.newContext();
    const offline = await context.newPage();
    const errors: string[] = [];
    offline.on('pageerror', e => errors.push(e.message));
    await offline.addInitScript(() => {
        (window as any).wallpaperRegisterAudioListener = (callback: (v: number[]) => void) => {
            setInterval(
                () =>
                    callback(
                        Array.from(
                            { length: 128 },
                            (_, i) => 0.2 + 0.15 * Math.sin(performance.now() / 300 + i * 0.2) ** 2,
                        ),
                    ),
                33,
            );
        };
    });
    try {
        await offline.goto('file:///' + path.join(root, 'index.html').replaceAll('\\', '/'));
        await expect(offline.locator('canvas')).toHaveAttribute('data-webgl-context-state', 'ready');
        await expect
            .poll(async () => Number(await offline.locator('canvas').getAttribute('data-frame-time')))
            .toBeGreaterThan(0.3);
        await offline.locator('canvas').evaluate(n => n.setAttribute('data-testid', 'wallpaper-canvas'));
        await expect
            .poll(async () => {
                const p = (await imageData(offline, 'wallpaper-canvas')).pixel;
                return p[0]! + p[1]! + p[2]!;
            })
            .toBeGreaterThan(40);
        await offline.locator('canvas').screenshot({ path: artifact + '/wallpaper-' + info.project.name + '.png' });
        expect(errors).toEqual([]);
    } finally {
        await context.close();
    }
});

test('logo clipping, foreground media and context recovery retain host-owned textures', async ({ page }) => {
    await open(page);
    await add(page, 'circular-center');
    await page.locator('[data-media-input="logo"] input[type=file]').setInputFiles(mediaFile('red.png'));
    await expect(page.locator('[data-media-input="logo"]')).toContainText('red.png');
    await add(page, 'circular-foreground');
    await page.locator('[data-media-input="foreground"] input[type=file]').setInputFiles(mediaFile('blue.webp'));
    await expect.poll(async () => (await imageData(page)).pixel[2]).toBeGreaterThan(200);
    const canvas = page.getByTestId('visualizer-preview-canvas');
    await canvas.evaluate(c => {
        const extension = (c as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
        extension.loseContext();
        setTimeout(() => extension.restoreContext(), 100);
    });
    await expect(canvas).toHaveAttribute('data-webgl-context-state', 'ready');
    await expect.poll(async () => (await imageData(page)).pixel[2]).toBeGreaterThan(200);
    const p = await exported(page);
    p.elements = p.elements.filter(e => e.resource.id !== 'circular-foreground');
    p.items = p.elements.map(e => ({ kind: 'element', id: e.id }));
    await load(page, p);
    const png = await canvas.screenshot();
    const pixels = await page.evaluate(async base64 => {
        const image = await createImageBitmap(
            new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: 'image/png' }),
        );
        const c = new OffscreenCanvas(image.width, image.height),
            ctx = c.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        const center = Array.from(ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data),
            corner = Array.from(ctx.getImageData(10, 10, 1, 1).data);
        image.close();
        return { center, corner };
    }, png.toString('base64'));
    expect(pixels.center[0]).toBeGreaterThan(200);
    expect(pixels.center[2]).toBeLessThan(30);
    expect(pixels.corner[0]).toBeLessThan(20);
    await page.goto('/');
    await expect
        .poll(() =>
            page.evaluate(async () => {
                const modulePath = '/src/visualizer/mediaHost.ts';
                return (await import(modulePath)).mediaHostDiagnostics.assets;
            }),
        )
        .toBe(0);
});
test('all eight resource preview images decode and show their individual artwork', async ({ page }) => {
    const resources = ['background', 'particles', 'depth', 'bars', 'outer', 'center', 'foreground']
        .map(id => 'elements/circular-' + id)
        .concat(['presets/circular-visualizer-893418273']);
    const cards = [];
    for (const resource of resources) {
        const file = path.resolve(assetsRoot, resource, 'preview.svg');
        const svg = await fs.readFile(file);
        cards.push('<img alt="' + resource + '" src="data:image/svg+xml;base64,' + svg.toString('base64') + '">');
    }
    await page.setViewportSize({ width: 960, height: 1080 });
    await page.setContent(
        '<style>body{margin:0;background:black;display:grid;grid-template-columns:1fr 1fr}img{width:480px;height:270px;display:block}</style>' +
            cards.join(''),
    );
    await expect
        .poll(() =>
            page
                .locator('img')
                .evaluateAll(images =>
                    images.every(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0),
                ),
        )
        .toBe(true);
    await fs.mkdir(artifact, { recursive: true });
    await page.screenshot({ path: artifact + '/previews.png', fullPage: true });
});
