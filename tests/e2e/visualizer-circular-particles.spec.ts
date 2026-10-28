import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { resourcePack } from '../support/visualizer-assets.mjs';
import { installFilePickerStub, chooseFiles, savedPickerEntries, queuePickerData } from '../support/file-picker';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';

const artifact = 'artifacts/visualizer-composition/circular-particles';
test.use({ viewport: { width: 1920, height: 1080 } });
test('isolated particle packets retain the same state and geometry at 30 and 60 drawing fps', async ({ page }) => {
    await page.goto('/');
    const resources = ['particles', 'depth'].map(kind => resourcePack('elements/circular-' + kind));
    const result = await page.evaluate(async packs => {
        const modulePath = '/src/visualizer/isolatedAlgorithmRuntime.ts';
        const { IsolatedAlgorithmRuntime } = await import(modulePath);
        const runtime = new IsolatedAlgorithmRuntime();
        let identical = true;
        try {
            await runtime.initialize(
                packs.flatMap((pack: any, i: number) =>
                    ['30', '60'].map(rate => ({ id: i + rate, algorithm: pack.algorithms[0] })),
                ),
            );
            let last: any[] = [];
            for (let tick = 0; tick <= 120; tick++) {
                const frames = packs.flatMap((pack: any, i: number) =>
                    (tick % 2 ? ['60'] : ['30', '60']).map(rate => ({
                        id: i + rate,
                        frame: {
                            time: tick / 60,
                            seed: 123,
                            revision: 'fixed',
                            width: 1920,
                            height: 1080,
                            mode: 'realtime',
                            range: null,
                            parameters: Object.fromEntries(
                                pack.elements[0].parameters.map((p: any) => [
                                    p.id,
                                    { value: p.id === 'spectrum' ? Array(128).fill(0.4) : p.defaultValue },
                                ]),
                            ),
                        },
                    })),
                );
                const packets = await runtime.prepareFrames(frames, async () => {
                    throw Error('Realtime history');
                });
                const comparable = (packet: any) =>
                    JSON.stringify({
                        state: packet.state,
                        passes: packet.passes.map((p: any) => ({
                            uniforms: p.uniforms,
                            positions: Array.from(p.mesh.positions),
                            colors: Array.from(p.mesh.colors),
                        })),
                    });
                for (let i = 0; i < packs.length; i++) {
                    const value = comparable(packets.get(i + '60'));
                    identical &&= value === (tick % 2 ? last[i] : comparable(packets.get(i + '30')));
                    last[i] = value;
                }
            }
            return identical;
        } finally {
            runtime.dispose();
        }
    }, resources);
    expect(result).toBe(true);
});

async function exported(page: Page): Promise<VisualizerProjectV6> {
    const count = (await savedPickerEntries(page)).length;
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}
async function load(page: Page, project: VisualizerProjectV6) {
    await queuePickerData(page, [
        { name: 'particles.json', mimeType: 'application/json', text: JSON.stringify(project) },
    ]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
test('updated presets preserve defaults, render both particles and export 30/60 fps before home and display use', async ({
    page,
}, info) => {
    test.setTimeout(90000);
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
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="circular-visualizer-893418273"]').click();
    const original = await exported(page);
    for (const id of ['particles', 'depth']) {
        const e = original.elements.find(e => e.resource.id === 'circular-' + id)!;
        expect(e.resource.version).toBe(3);
        for (const [key, expected] of [
            ['responsiveness', 50],
            ['noise', true],
            ['normalize', true],
        ] as const)
            expect(e.bindings.find(b => b.parameterId === key)!.source).toEqual({ kind: 'constant', value: expected });
    }
    expect(original.elements.find(e => e.resource.id === 'circular-depth')!.enabled).toBe(false);
    const p = structuredClone(original);
    p.elements = p.elements
        .filter(e => ['circular-particles', 'circular-depth'].includes(e.resource.id))
        .map((e, layer) => ({
            ...e,
            layer,
            enabled: true,
            seed: 123,
            bindings: e.bindings.map(b =>
                b.parameterId === 'spectrum' ? { ...b, source: { kind: 'constant', value: Array(128).fill(0.4) } } : b,
            ),
        }));
    p.items = p.elements.map(e => ({ kind: 'element', id: e.id }));
    await mkdir(artifact, { recursive: true });
    for (const fps of [30, 60] as const) {
        p.output.frameRate = fps;
        await load(page, p);
        await page.getByTestId('visualizer-preview-frame').hover();
        await page.getByTestId('start-visualizer-export').click();
        await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
        expect(await page.evaluate(() => (window as any).__VISUALIZER_DIAGNOSTICS__.exportFramesDone)).toBe(
            Math.ceil(p.track.durationSeconds * fps),
        );
        await page.getByTestId('save-visualizer-export').click();
        await expect(page.locator('[data-export-status=idle]')).toBeVisible();
        const video = (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).at(-1)!;
        await writeFile(path.join(artifact, `${info.project.name}-${fps}.webm`), Buffer.from(video.base64, 'base64'));
    }
    await page.screenshot({ path: path.join(artifact, `preview-${info.project.name}.png`) });
    await page.getByTestId('realtime-style-actions').click();
    await page.getByTestId('apply-home-style').click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('[data-realtime-state]')).toHaveAttribute('data-realtime-state', 'ready');
    await page.reload();
    await expect(page.getByTestId('realtime-visualizer-canvas')).toHaveAttribute('data-webgl-context-state', 'ready');
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('realtime-style-actions').click();
    await page.getByTestId('create-display-page').click();
    await page.getByRole('link', { name: '打开展示页' }).click();
    await expect(page.getByTestId('realtime-visualizer-canvas')).toHaveAttribute('data-webgl-context-state', 'ready');
    expect(errors).toEqual([]);
});
