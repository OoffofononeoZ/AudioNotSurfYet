import path from 'node:path';
import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { resourcePack } from '../support/visualizer-assets.mjs';
import { chooseFiles, installFilePickerStub, savedPickerEntries, queuePickerData } from '../support/file-picker';
import { chooseVisualizerProjectExport } from '../support/project-actions';
const output = 'artifacts/black-hole-lensing-starfield';
const ids = [
    'black-hole-starfield',
    'black-hole-core',
    'black-hole-accretion-disk',
    'black-hole-flare',
    'black-hole-lensing',
];
test('transparent lensing and seeded stars compile, preserve alpha, seek, wrap, resize and release', async ({
    page,
}, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    const result = await page.evaluate(async packs => {
        const file = '/tests/support/black-hole-lensing-render.ts';
        return (await import(file)).renderLensingResources(packs);
    }, ['black-hole-lensing', 'black-hole-starfield'].map(resourcePack));
    await fs.mkdir(output, { recursive: true });
    for (const c of result.captures)
        await fs.writeFile(
            output + '/' + info.project.name + '-' + c.name + '.png',
            Buffer.from(c.image.split(',')[1], 'base64'),
        );
    await fs.writeFile(
        output + '/' + info.project.name + '-gpu.json',
        JSON.stringify({ ...result, captures: result.captures.map(({ image, ...c }: any) => c) }, null, 2),
        'utf8',
    );
    const by = Object.fromEntries(result.captures.map((c: any) => [c.name, c]));
    expect(errors).toEqual([]);
    expect(result.released).toBe(true);
    expect(result.stats.changed.changed).toBeGreaterThan(5000);
    expect(result.stats.outside.max).toBe(0);
    expect(result.stats.center.max).toBe(0);
    expect(result.stats.zero.max).toBe(0);
    expect(result.stats.alpha).toBe(true);
    expect(result.stats.narrowAlpha).toBe(true);
    expect(by.transparent.maxAlpha).toBe(0);
    expect(by['edge-alpha'].premultiplied).toBe(true);
    expect(by['stars-zero'].maxAlpha).toBe(0);
    expect(by.stars.transparent).toBeGreaterThan(1280 * 720 * 0.8);
    expect(by.stars.lit).toBeGreaterThan(500);
    for (const t of [0, 60, 1800, 86400]) expect(result.stats['static-' + t].max).toBeLessThanOrEqual(1);
    expect(result.stats.seek.max).toBeLessThanOrEqual(1);
    expect(result.stats.wrap.max).toBeLessThanOrEqual(3);
});

test('target selector, self-contained project and combined 30/60fps exports', async ({ page }, info) => {
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
    for (const id of ['black-hole-starfield', 'black-hole-lensing']) {
        await page.getByTestId('add-visualizer-element').click();
        await page.locator('[data-resource-id="' + id + '"]').click();
    }
    if (!(await page.getByTestId('visualizer-settings-panel').isVisible()))
        await page.getByRole('button', { name: '元素属性', exact: true }).click();
    await page.getByRole('combobox', { name: '影响对象范围', exact: true }).selectOption('elements');
    const inspector = page.getByTestId('visualizer-settings-panel');
    await inspector.locator('.viz-targets label').filter({ hasText: '黑洞背景星空' }).getByRole('checkbox').check();
    const snapshot = async () => {
        const n = (await savedPickerEntries(page)).length;
        await chooseVisualizerProjectExport(page);
        await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(n + 1);
        return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
    };
    const original = await snapshot(),
        star = original.elements.find((e: any) => e.resource.id === 'black-hole-starfield'),
        lens = original.elements.find((e: any) => e.resource.id === 'black-hole-lensing');
    expect(lens.targets).toEqual({ kind: 'elements', ids: [star.id] });
    const p = await page.evaluate(
        async ({ track, packs }) => {
            const file = '/tests/support/black-hole-lensing-render.ts';
            return (await import(file)).lensingProject(track, packs);
        },
        { track: original.track, packs: ids.map(resourcePack) },
    );
    const selection = await page.evaluate(async packs => {
        const file = '/tests/support/black-hole-lensing-render.ts';
        return (await import(file)).checkLensingComposition(packs);
    }, ids.map(resourcePack));
    expect(selection.selective.red).toBeGreaterThan(100);
    expect(selection.selective.redChanged).toBe(0);
    expect(selection.selective.otherChanged).toBeGreaterThan(100);
    await fs.writeFile(
        output + '/' + info.project.name + '-composition.json',
        JSON.stringify(selection, null, 2),
        'utf8',
    );
    const load = async () => {
        await queuePickerData(page, [{ name: 'lensing.json', mimeType: 'application/json', text: JSON.stringify(p) }]);
        await page.getByTestId('import-visualizer-project').click();
        await expect(page.getByTestId('import-visualizer-project')).toHaveAttribute('aria-busy', 'false');
        await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    };
    await load();
    const restored = await snapshot();
    expect(restored.elements).toEqual(p.elements);
    expect(restored.resources).toEqual(p.resources);
    const capture = await page.evaluate(async p => {
        const file = '/tests/support/black-hole-render.ts';
        return (await import(file)).captureBlackHoleProject(p);
    }, p);
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(
        output + '/' + info.project.name + '-combined.png',
        Buffer.from(capture.image.split(',')[1], 'base64'),
    );
    await fs.writeFile(output + '/' + info.project.name + '-project.json', JSON.stringify(p, null, 2), 'utf8');
    // Disconnected resource library must not prevent the embedded snapshot from rendering/exporting.
    await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry('visualizer-library-fixture', { recursive: true });
    });
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    for (const fps of [30, 60]) {
        p.output.frameRate = fps;
        await load();
        await page.getByTestId('visualizer-preview-frame').hover();
        await page.getByTestId('start-visualizer-export').click();
        await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 90000 });
        await page.getByTestId('save-visualizer-export').click();
        await expect(page.locator('[data-export-status=idle]')).toBeVisible();
        const file = (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).at(-1)!;
        await fs.writeFile(
            output + '/lensing-' + info.project.name + '-' + fps + '.webm',
            Buffer.from(file.base64, 'base64'),
        );
    }
    expect(errors).toEqual([]);
});
