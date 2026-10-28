import { chooseVisualizerProjectExport } from '../support/project-actions';
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { chooseFiles, installFilePickerStub, savedPickerEntries } from '../support/file-picker';

test.use({ viewport: { width: 1920, height: 1080 } });
async function exported(page: Page) {
    const count = (await savedPickerEntries(page)).length;
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}
test('external moving-camera demo renders, saves a reusable preset and exports real 3D video', async ({
    page,
}, info) => {
    test.setTimeout(60000);
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
    await page.locator('[data-preset-id="shared-camera-demo"]').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    const p = await exported(page);
    expect(p.schemaVersion).toBe(6);
    expect(p.elements).toHaveLength(2);
    expect(p.items[0].scenes3d[0].children).toEqual(p.elements.map((e: any) => e.id));
    expect(p.items[0].scenes3d[0].camera.animation.durationSeconds).toBe(10);
    await page.screenshot({ path: `artifacts/visualizer-composition/scene3d/demo-${info.project.name}.png` });
    await page.getByTestId('export-visualizer-preset').click();
    await expect(page.getByTestId('save-visualizer-preset')).toBeEnabled();
    await page.getByTestId('save-visualizer-preset').click();
    await expect(page.getByRole('status').filter({ hasText: '请刷新资源商城后添加' })).toBeVisible();
    const saved = await page.evaluate(async () => {
        let root = await (await navigator.storage.getDirectory()).getDirectoryHandle('visualizer-library-fixture');
        for (const name of ['assets', 'presets']) root = await root.getDirectoryHandle(name);
        for await (const [name, handle] of (root as any).entries())
            if (name.startsWith('user-preset-'))
                return JSON.parse(await (await (await handle.getFileHandle('resource-package.json')).getFile()).text());
    });
    expect(saved.presets[0].scenes3d[0].camera).toEqual(p.items[0].scenes3d[0].camera);
    expect(saved.presets[0].elements.map((e: any) => e.transform3d)).toEqual(p.elements.map((e: any) => e.transform3d));
    await page
        .getByRole('dialog', { name: '导出预设', exact: true })
        .getByRole('button', { name: '关闭导出预设', exact: true })
        .click();
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.getByTestId('save-visualizer-export')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('save-visualizer-export').click();
    await expect.poll(async () => (await savedPickerEntries(page)).some(e => e.name.endsWith('.webm'))).toBe(true);
    const entries = await savedPickerEntries(page),
        video = entries.find(e => e.name.endsWith('.webm'));
    expect(video).toBeDefined();
    const root = path.resolve('artifacts/visualizer-composition/scene3d');
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, `shared-camera-${info.project.name}.webm`), Buffer.from(video!.base64, 'base64'));
    expect(errors).toEqual([]);
});
