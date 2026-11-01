import path from 'node:path';
import { chooseFiles, installFilePickerStub, savedPickerEntries, queuePickerData } from '../support/file-picker';
import { chooseVisualizerProjectExport } from '../support/project-actions';
import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resourcePack } from '../support/visualizer-assets.mjs';

const output = 'artifacts/black-hole-visualizer-v3';
test('black hole components compile, layer, react, seek, resize and release in the isolated renderer', async ({
    page,
}, info) => {
    test.setTimeout(120000);
    await page.goto('/');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const result = await page.evaluate(async packs => {
        const file = '/tests/support/black-hole-render.ts';
        const { renderBlackHole } = await import(file);
        return renderBlackHole(packs);
    }, ['black-hole-core', 'black-hole-accretion-disk', 'black-hole-flare', 'black-hole-lyrics'].map(resourcePack));
    await mkdir(output, { recursive: true });
    for (const c of result.captures)
        await writeFile(
            output + '/' + info.project.name + '-' + c.name + '.png',
            Buffer.from(c.image.split(',')[1], 'base64'),
        );
    await writeFile(
        output + '/' + info.project.name + '-render.json',
        JSON.stringify({ ...result, captures: result.captures.map(({ image, ...c }: any) => c) }, null, 2),
        'utf8',
    );
    expect(result.released).toBe(true);
    expect(result.recreated).toBe(true);
    expect(errors).toEqual([]);
    const by = Object.fromEntries(result.captures.map((c: any) => [c.name, c]));
    for (const name of ['black-hole-core', 'black-hole-accretion-disk', 'black-hole-flare']) {
        expect(by[name].lit).toBeGreaterThan(50);
        expect(Math.max(...by[name].center)).toBeLessThan(12);
    }
    expect(by.high.sum).toBeGreaterThan(by.low.sum);
    expect(by.low.sum).toBeGreaterThan(by.silent.sum);
    expect(by['seek-repeat'].repeatDiff.maxChannel).toBeLessThanOrEqual(1);
    expect(by['seek-repeat'].repeatDiff.changedPixels).toBeLessThanOrEqual(
        by['seek-repeat'].repeatDiff.pixelCount * 0.0001,
    );
    expect(by.combined.image !== by['combined-later'].image).toBe(true);
    expect(by['lyrics-display'].image !== by.combined.image).toBe(true);
    expect(by['view-90'].image !== by['view-90-no-points'].image).toBe(true);
    // Same zero-layer packet; tolerate the same sparse 8-bit GPU rounding as seeking.
    expect(by['view-90-density-zero'].repeatDiff.maxChannel).toBeLessThanOrEqual(1);
    expect(by['view-90-density-zero'].repeatDiff.changedPixels).toBeLessThanOrEqual(
        by['view-90-density-zero'].repeatDiff.pixelCount * 0.0001,
    );
    expect(by['view-90-spiral-zero'].image !== by['view-90'].image).toBe(true);
    expect(by['view-90'].lit).toBeGreaterThan(by.combined.lit);
    const long = result.captures.filter((c: any) => c.name.startsWith('top-time-'));
    expect(long).toHaveLength(10);
    const peaks = long.map((c: any) => c.peaks);
    expect(Math.max(...peaks) - Math.min(...peaks)).toBeLessThanOrEqual(2);
    for (const name of ['max-core', 'ultrawide-max-core'])
        for (const rgb of by[name].corners) expect(Math.max(...rgb)).toBeLessThan(12);
    for (const name of ['max-halo', 'ultrawide-max-halo'])
        for (const rgb of by[name].corners) expect(rgb.reduce((a: number, b: number) => a + b, 0)).toBeGreaterThan(20);
});

test('new preset keeps hidden lyrics exportable, enforces missing LRC, roundtrips and exports 30/60fps', async ({
    page,
}, info) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="black-hole-visualizer-2903479369"]').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    const exported = async () => {
        const count = (await savedPickerEntries(page)).length;
        await chooseVisualizerProjectExport(page);
        await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
        return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
    };
    const load = async (p: any) => {
        await queuePickerData(page, [
            { name: 'black-hole.json', mimeType: 'application/json', text: JSON.stringify(p) },
        ]);
        await page.getByTestId('import-visualizer-project').click();
        await expect(page.getByTestId('import-visualizer-project')).toHaveAttribute('aria-busy', 'false');
    };
    const p = await exported();
    expect(p.elements).toHaveLength(8);
    const lyric = p.elements.find((e: any) => e.resource.id === 'black-hole-lyrics');
    expect(lyric.enabled).toBe(false);
    expect(lyric.lyricBindings.lyrics).toEqual({ kind: 'unbound' });
    for (const e of p.elements) {
        if (e.seed !== undefined) e.seed = 123456789;
        for (const b of e.bindings)
            if (b.parameterId === 'spectrum') b.source = { kind: 'constant', value: Array(128).fill(0.25) };
    }
    // Instantiate the template twice in the real registry and check independent UUIDs.
    const checks = await page.evaluate(async project => {
        const load = (name: string) => import('/src/visualizer/' + name + '.ts');
        const { elementRegistry } = await load('elementRegistry'),
            { instantiatePreset } = await load('compositionPresets');
        const { inspectRealtimeProject } = await load('realtimeCapabilities');
        const { validateComposition } = await load('compositionCodec');
        elementRegistry.replace(project.resources);
        const a = instantiatePreset('black-hole-visualizer-2903479369', 3),
            b = instantiatePreset('black-hole-visualizer-2903479369', 3);
        return {
            distinct: !a.elements.some((e: any) => b.elements.some((f: any) => e.id === f.id)),
            realtime: inspectRealtimeProject(validateComposition(project)).browser,
        };
    }, p);
    expect(checks).toEqual({ distinct: true, realtime: true });
    p.output.resolution = '720p';
    p.output.frameRate = 30;
    await load(p);
    await expect(page.getByTestId('start-visualizer-export')).toBeEnabled();
    const capture = await page.evaluate(async project => {
        const file = '/tests/support/black-hole-render.ts';
        const { captureBlackHoleProject } = await import(file);
        return captureBlackHoleProject(project);
    }, p);
    await mkdir(output, { recursive: true });
    await writeFile(
        output + '/' + info.project.name + '-preset.png',
        Buffer.from(capture.image.split(',')[1], 'base64'),
    );
    const exportVideo = async (fps: number) => {
        await page.getByTestId('visualizer-preview-frame').hover();
        await page.getByTestId('start-visualizer-export').click();
        await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 70000 });
        await page.getByTestId('save-visualizer-export').click();
        await expect(page.locator('[data-export-status=idle]')).toBeVisible();
        const video = (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).at(-1)!;
        await writeFile(
            output + '/black-hole-' + info.project.name + '-' + fps + '.webm',
            Buffer.from(video.base64, 'base64'),
        );
    };
    await exportVideo(30);
    lyric.enabled = true;
    await load(p);
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=error]')).toBeVisible();
    await expect(page.getByText('黑洞歌词：歌词未配置', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: '清除错误', exact: true }).click();
    const bytes = new TextEncoder().encode('[00:00.500]Fall into the light\n[00:01.800]星河汇入黑洞');
    const asset = await page.evaluate(async data => {
        const file = '/src/processing/sha256.ts';
        const { hashBytes } = await import(file);
        const bytes = new Uint8Array(data);
        return { id: hashBytes(bytes), name: 'black-hole.lrc', data: btoa(String.fromCharCode(...bytes)) };
    }, Array.from(bytes));
    p.lyricAssets = [asset];
    lyric.lyricBindings.lyrics = {
        kind: 'lyrics',
        assetId: asset.id,
        leadSeconds: 0.6,
        tailSeconds: 1.5,
        offsetSeconds: 0,
    };
    p.output.frameRate = 60;
    for (const e of p.elements)
        for (const b of e.bindings) if (b.parameterId === 'inclination') b.source = { kind: 'constant', value: 90 };
    const topProject = structuredClone(p);
    topProject.elements.find((e: any) => e.resource.id === 'black-hole-lyrics').enabled = false;
    const top = await page.evaluate(async project => {
        const file = '/tests/support/black-hole-render.ts';
        return (await import(file)).captureBlackHoleProject(project);
    }, topProject);
    await writeFile(
        output + '/' + info.project.name + '-preset-top.png',
        Buffer.from(top.image.split(',')[1], 'base64'),
    );
    await load(p);
    await expect(page.getByTestId('start-visualizer-export')).toBeEnabled();
    const restored = await exported();
    expect(restored.resources).toEqual(p.resources);
    expect(restored.lyricAssets).toEqual(p.lyricAssets);
    expect(restored.elements).toEqual(p.elements);
    await exportVideo(60);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry('visualizer-library-fixture', { recursive: true });
    });
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    expect((await exported()).resources).toEqual(p.resources);
    expect(errors).toEqual([]);
    await writeFile(
        output + '/' + info.project.name + '-preset.json',
        JSON.stringify(
            {
                result: 'passed',
                checks,
                components: 8,
                exports: [30, 60],
                hiddenLyrics: true,
                missingLyricsBlocked: true,
                snapshotRestored: true,
            },
            null,
            2,
        ),
        'utf8',
    );
});

test('60 second fixed-input stability demonstration', async ({ page }, info) => {
    test.skip(
        info.project.name !== 'chrome',
        'Long clip is recorded once; both engines cover long-time GPU samples and short exports',
    );
    test.setTimeout(300000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const seconds = 60,
        sampleRate = 48000,
        bytes = Buffer.alloc(44 + seconds * sampleRate * 4);
    bytes.write('RIFF', 0);
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(2, 22);
    bytes.writeUInt32LE(sampleRate, 24);
    bytes.writeUInt32LE(sampleRate * 4, 28);
    bytes.writeUInt16LE(4, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36);
    bytes.writeUInt32LE(bytes.length - 44, 40);
    for (let i = 0; i < seconds * sampleRate; i++) {
        const v = Math.round(Math.sin((i / sampleRate) * Math.PI * 440) * 1500);
        bytes.writeInt16LE(v, 44 + i * 4);
        bytes.writeInt16LE(v, 46 + i * 4);
    }
    await mkdir(output, { recursive: true });
    const audio = path.resolve(output, 'stability-60s.wav');
    await writeFile(audio, bytes);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [audio]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="black-hole-visualizer-2903479369"]').click();
    const before = (await savedPickerEntries(page)).length;
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(before + 1);
    const p = JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
    expect(p.track.durationSeconds).toBe(60);
    p.output.resolution = '720p';
    p.output.frameRate = 30;
    for (const e of p.elements) {
        if (e.seed !== undefined) e.seed = 123456789;
        for (const b of e.bindings)
            if (b.parameterId === 'spectrum') b.source = { kind: 'constant', value: Array(128).fill(0.25) };
    }
    await queuePickerData(page, [{ name: 'stability.json', mimeType: 'application/json', text: JSON.stringify(p) }]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('import-visualizer-project')).toHaveAttribute('aria-busy', 'false');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 240000 });
    await page.getByTestId('save-visualizer-export').click();
    await expect(page.locator('[data-export-status=idle]')).toBeVisible();
    const video = (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).at(-1)!;
    await writeFile(output + '/black-hole-chrome-stability-60s-30.webm', Buffer.from(video.base64, 'base64'));
    expect(errors).toEqual([]);
});
