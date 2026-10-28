import { chooseVisualizerProjectExport } from '../support/project-actions';
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { scene3dFixture } from '../support/scene3d-fixture';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';

test.use({ viewport: { width: 1920, height: 1080 } });
async function exported(page: Page): Promise<VisualizerProjectV6> {
    const count = (await savedPickerEntries(page)).length;
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}
test('edits camera keyframes and transforms, moves members, and restores the independent draft', async ({
    page,
}, info) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    const empty = await exported(page),
        fixture = scene3dFixture();
    fixture.track = empty.track;
    fixture.elements.forEach(e => {
        e.timing = { kind: 'manual', startSeconds: 0, endSeconds: empty.track.durationSeconds };
    });
    const scene = fixture.items[0];
    if (scene.kind !== 'scene3d') throw Error('Expected scene');
    scene.endSeconds = empty.track.durationSeconds;
    await queuePickerData(page, [{ name: 'scene.json', mimeType: 'application/json', text: JSON.stringify(fixture) }]);
    await page.getByTestId('import-visualizer-project').click();
    const row = page.locator(`[data-scene-instance-id="${scene.id}"]`);
    await expect(row).toBeVisible();
    await row.locator('.viz-element-select').click();
    await page.getByRole('spinbutton', { name: '镜头位置 X', exact: true }).fill('1.5');
    await page.getByRole('spinbutton', { name: '镜头位置 X', exact: true }).press('Tab');
    await page.getByLabel('使用镜头关键帧', { exact: true }).check();
    await page.getByRole('spinbutton', { name: '镜头轨迹时长', exact: true }).fill('12');
    await page.getByRole('spinbutton', { name: '镜头轨迹时长', exact: true }).press('Tab');
    await page.getByLabel('循环镜头轨迹', { exact: true }).check();
    await page.getByRole('spinbutton', { name: '关键帧 2 位置 X', exact: true }).fill('-2');
    await page.getByRole('spinbutton', { name: '关键帧 2 位置 X', exact: true }).press('Tab');
    await page.getByTestId('add-camera-keyframe').click();
    await expect(page.locator('[data-camera-keyframe]')).toHaveCount(3);
    let p = await exported(page);
    let s = p.items[0];
    if (s.kind !== 'scene3d') throw Error('Expected scene');
    expect(s.camera.position[0]).toBe(1.5);
    expect(s.camera.animation).toMatchObject({ durationSeconds: 12, loop: true });
    await page.locator(`[data-element-id="${fixture.elements[0]!.id}"] .viz-element-select`).click();
    await page.getByRole('spinbutton', { name: '三维位置 X', exact: true }).fill('2.25');
    await page.getByRole('spinbutton', { name: '三维位置 X', exact: true }).press('Tab');
    await page.getByRole('combobox', { name: '所属三维场景', exact: true }).selectOption('');
    await expect(page.locator('[data-scene-instance-id]')).toHaveCount(2);
    await page.getByRole('combobox', { name: '所属三维场景', exact: true }).selectOption(scene.id);
    await expect(page.locator('[data-scene-instance-id]')).toHaveCount(1);
    p = await exported(page);
    expect(p.elements.find(e => e.id === fixture.elements[0]!.id)!.transform3d!.position[0]).toBe(2.25);
    const restoredScene = p.items.find(i => i.id === scene.id);
    if (restoredScene?.kind !== 'scene3d') throw Error('Missing scene');
    expect(restoredScene.camera.animation?.keyframes).toHaveLength(3);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.reload();
    await expect(row).toBeVisible();
    await row.locator('.viz-element-select').click();
    await expect(page.locator('[data-camera-keyframe]')).toHaveCount(3);
    await expect(page.getByRole('spinbutton', { name: '镜头轨迹时长', exact: true })).toHaveValue('12');
    expect(
        await page
            .locator('[data-scene-inspector-id]')
            .evaluate(panel =>
                [...panel.querySelectorAll('.viz-vector-field input')].every(
                    input => input.getBoundingClientRect().right <= panel.getBoundingClientRect().right + 1,
                ),
            ),
    ).toBe(true);
    await page.screenshot({ path: `artifacts/visualizer-composition/scene3d/editor-${info.project.name}.png` });
    for (const width of [1024, 390]) {
        await page.setViewportSize({ width, height: 720 });
        await page.getByRole('button', { name: '元素属性', exact: true }).click();
        await expect(page.getByTestId('visualizer-settings-panel')).toBeVisible();
        expect(
            await page
                .locator('[data-scene-inspector-id]')
                .evaluate(panel =>
                    [...panel.querySelectorAll('.viz-vector-field input')].every(
                        input => input.getBoundingClientRect().right <= panel.getBoundingClientRect().right + 1,
                    ),
                ),
        ).toBe(true);
        await page.getByRole('button', { name: '关闭元素属性', exact: true }).click();
    }
    expect(errors).toEqual([]);
});
