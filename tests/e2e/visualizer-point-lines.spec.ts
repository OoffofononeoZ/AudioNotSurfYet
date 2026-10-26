import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';
import { resourcePack } from '../support/visualizer-assets.mjs';
import { createDefinitionElement } from '../../src/visualizer/elementRegistry';
const artifact = 'artifacts/visualizer-composition/point-lines';

async function exported(page: Page): Promise<VisualizerProjectV6> {
    const count = (await savedPickerEntries(page)).length;
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}
async function seek(page: Page, time: number) {
    const slider = page.getByTestId('visualizer-seek');
    await slider.fill(String(time));
    await slider.dispatchEvent('input');
    await expect(page.getByTestId('visualizer-preview-canvas')).toHaveAttribute('data-frame-time', time.toFixed(6));
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
async function pixels(page: Page, vertical: boolean, file?: string) {
    const png = await page.getByTestId('visualizer-preview-canvas').screenshot({
        ...(file ? { path: file } : {}),
        style: '.viz-video-controls { visibility: hidden !important; }',
    });
    return page.evaluate(
        async ({ base64, vertical }) => {
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
            const scratch = new OffscreenCanvas(bitmap.width, bitmap.height),
                context = scratch.getContext('2d')!;
            context.drawImage(bitmap, 0, 0);
            bitmap.close();
            const { data, width, height } = context.getImageData(0, 0, scratch.width, scratch.height);
            const counts = new Uint32Array(vertical ? width : height),
                brightness = new Float64Array(counts.length);
            for (let y = 0; y < height; y++)
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4,
                        axis = vertical ? x : y;
                    if (data[i]! > 32 && data[i + 1]! > 32 && data[i + 2]! > 32) counts[axis]++;
                    brightness[axis] += data[i]!;
                }
            let strongest = 0;
            for (let i = 1; i < counts.length; i++) if (counts[i]! > counts[strongest]!) strongest = i;
            return {
                coverage: counts.reduce((sum, n) => sum + n, 0) / (width * height),
                span: counts[strongest]! / (vertical ? height : width),
                position: strongest / counts.length,
                brightness: brightness[strongest]! / (vertical ? height : width),
            };
        },
        { base64: png.toString('base64'), vertical },
    );
}

for (const id of ['point-line-horizontal', 'point-line-vertical'])
    test(
        id + ' binds one category, draws full-length GPU lines, restores without its library and exports',
        async ({ page }, info) => {
            test.setTimeout(60000);
            const vertical = id.endsWith('vertical'),
                errors: string[] = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', m => {
                if (m.type() === 'error') errors.push(m.text());
            });

            await page.setViewportSize({ width: 1920, height: 1080 });
            await installFilePickerStub(page, { visualizerAssets: true });
            await page.goto('/');
            await chooseFiles(page, [
                path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav'),
            ]);
            await page.getByTestId('header-visualizer-link').click();
            await expect(page.getByTestId('visualizer-ready')).toBeVisible();
            if ((await page.locator('#music-bar-container').getAttribute('data-playback-state')) === 'playing')
                await page.getByTestId('toggle-playback').click();
            const initial = await exported(page),
                editor = createInitialEditorProject({ track: initial.track });
            const laneId = crypto.randomUUID(),
                chosen = crypto.randomUUID(),
                ignored = crypto.randomUUID();
            editor.lanes = [
                {
                    id: laneId,
                    name: '测试点轨道',
                    eventKind: 'point',
                    innerClasses: [
                        { id: chosen, label: '测试触发' },
                        { id: ignored, label: '不触发' },
                    ],
                    events: [
                        ...[0.4, 0.9, 1.4, 1.9, 2.4, initial.track.durationSeconds].map(atSeconds => ({
                            id: crypto.randomUUID(),
                            innerClassId: chosen,
                            atSeconds,
                        })),
                        ...[0.7, 1.2, 1.7, 2.2, 2.7].map(atSeconds => ({
                            id: crypto.randomUUID(),
                            innerClassId: ignored,
                            atSeconds,
                        })),
                    ],
                },
            ];
            await page.getByRole('tab', { name: 'Editor 数据', exact: true }).click();
            await queuePickerData(page, [
                { name: 'line-points.json', mimeType: 'application/json', text: JSON.stringify(editor) },
            ]);
            await page.getByRole('button', { name: '导入 Editor JSON', exact: true }).click();
            await page.getByTestId('add-visualizer-element').click();
            await page.locator(`[data-resource-id="${id}"]`).click();
            await page.getByLabel('点标记轨道', { exact: true }).selectOption(laneId);
            await expect(page.getByLabel('点标记分类', { exact: true })).toHaveValue('');
            await expect(page.getByLabel('点标记全部分类', { exact: true })).toHaveCount(0);
            await page.getByLabel('点标记分类', { exact: true }).selectOption(chosen);
            const before = await exported(page);
            expect(before.elements[0]!.markerBindings!.points).toEqual({
                kind: 'collection',
                laneId,
                innerClassIds: [chosen],
            });
            await mkdir(artifact, { recursive: true });
            await page.screenshot({ path: `${artifact}/${id}-${info.project.name}-ui.png` });
            await page.getByTestId('visualizer-preview-frame').hover();
            await page.getByTestId('visualizer-fullscreen-toggle').click();
            await expect(page.getByTestId('visualizer-seek')).toBeVisible();
            await seek(page, 0.9);
            const peak = await pixels(page, vertical, `${artifact}/${id}-${info.project.name}-peak.png`),
                hash = await page.getByTestId('visualizer-preview-canvas').getAttribute('data-frame-state-hash');
            expect(peak.span).toBeGreaterThan(0.95);
            await seek(page, 0.88);
            const fade = await pixels(page, vertical);
            expect(fade.span).toBeGreaterThan(0.95);
            expect(fade.brightness).toBeLessThan(peak.brightness * 0.8);
            await seek(page, 0.7);
            expect((await pixels(page, vertical)).span).toBeLessThan(0.2);
            await seek(page, 1.4);
            const next = await pixels(page, vertical);
            expect(next.span).toBeGreaterThan(0.95);
            expect(Math.abs(next.position - peak.position)).toBeGreaterThan(0.047);
            await seek(page, 0.9);
            expect(await page.getByTestId('visualizer-preview-canvas').getAttribute('data-frame-state-hash')).toBe(
                hash,
            );
            await seek(page, initial.track.durationSeconds - 0.02);
            expect(
                (await pixels(page, vertical, `${artifact}/${id}-${info.project.name}-tail.png`)).span,
            ).toBeGreaterThan(0.95);
            await page.keyboard.press('Escape');
            await expect(page.getByText('已保存', { exact: true })).toBeVisible();
            await page.evaluate(async () => {
                await new Promise<void>((resolve, reject) => {
                    const request = indexedDB.deleteDatabase('audionotsurfyet-resource-directory');
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            });
            await page.reload();
            await expect(page.getByTestId('visualizer-ready')).toBeVisible();
            await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
            expect((await exported(page)).elements).toEqual(before.elements);
            await expect(page.locator('.viz-element-select img')).toHaveCount(0);
            await page.getByTestId('visualizer-preview-frame').hover();
            await page.getByTestId('start-visualizer-export').click();
            await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
            await page.getByTestId('save-visualizer-export').click();
            await expect
                .poll(async () => (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).length)
                .toBe(1);
            const bytes = Buffer.from(
                (await savedPickerEntries(page)).find(e => e.name.endsWith('.webm'))!.base64,
                'base64',
            );
            expect(bytes.length).toBeGreaterThan(1000);
            await writeFile(`${artifact}/${id}-${info.project.name}.webm`, bytes);
            expect(errors).toEqual([]);
        },
    );

test('dense point-line GPU batches retain the preceding batch instead of replacing it', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    if ((await page.locator('#music-bar-container').getAttribute('data-playback-state')) === 'playing')
        await page.getByTestId('toggle-playback').click();
    const project = await exported(page),
        pack = resourcePack('elements/point-line-horizontal.json');
    project.resources = { algorithms: pack.algorithms, elements: pack.elements, presets: [] };
    const element = createDefinitionElement(pack.elements[0]!, project.track.durationSeconds, 0),
        laneId = crypto.randomUUID(),
        classId = crypto.randomUUID();
    element.markerBindings = { points: { kind: 'collection', laneId, innerClassIds: [classId] } };
    element.bindings.find(b => b.parameterId === 'lineWidth')!.source = { kind: 'constant', value: 0.0005 };
    project.elements = [element];
    project.items = [{ kind: 'element', id: element.id }];
    const editor = createInitialEditorProject({ track: project.track });
    editor.lanes = [
        {
            id: laneId,
            name: '密集点',
            eventKind: 'point',
            innerClasses: [{ id: classId, label: '测试' }],
            events: Array.from({ length: 11000 }, (_, i) => ({
                id: crypto.randomUUID(),
                innerClassId: classId,
                atSeconds: 1 + i * 0.000001,
            })),
        },
    ];
    project.editorSnapshot = { capturedAt: editor.updatedAt, project: editor };
    await queuePickerData(page, [
        { name: 'dense-lines.json', mimeType: 'application/json', text: JSON.stringify(project) },
    ]);
    await page.getByTestId('import-visualizer-project').click();
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('visualizer-fullscreen-toggle').click();
    await expect(page.getByTestId('visualizer-seek')).toBeVisible();
    await seek(page, 1.02);
    expect((await pixels(page, false)).coverage).toBeGreaterThan(0.7);
});
