import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { installFilePickerStub, chooseFiles } from '../support/file-picker';

for (const resource of ['radial-spectrum', 'shared-camera-demo', 'circular-particles', 'circular-depth'])
    test(
        'exports ' + resource + ' and executes the production runtime offline with WE callbacks',
        async ({ page }, info) => {
            const errors: string[] = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.setViewportSize({ width: 1920, height: 1080 });
            await installFilePickerStub(page, { visualizerAssets: true });
            await page.goto('/');
            await chooseFiles(page, [
                path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav'),
            ]);
            await page.getByTestId('header-visualizer-link').click();
            await expect(page.getByTestId('visualizer-ready')).toBeVisible();
            await page.getByTestId('add-visualizer-element').click();
            if (resource === 'radial-spectrum') {
                await page.locator('[data-resource-id="radial-spectrum"]').click();
                await page
                    .getByRole('combobox', { name: '频谱输入分析特征', exact: true })
                    .selectOption('wallpaperEngineSpectrum');
                await expect(page.getByRole('spinbutton', { name: '元素 Seed', exact: true })).toHaveValue('');
            } else if (resource.startsWith('circular-')) {
                await page.locator(`[data-resource-id="${resource}"]`).click();
            } else {
                await page.getByRole('button', { name: '预设', exact: true }).click();
                await page.locator('[data-preset-id="shared-camera-demo"]').click();
            }
            await page.getByTestId('realtime-style-actions').click();
            await page.getByTestId('prepare-wallpaper-export').click();
            await expect(page.getByTestId('save-wallpaper-directory')).toBeVisible();
            await page.evaluate(() => {
                (window as any).showDirectoryPicker = () => navigator.storage.getDirectory();
            });
            await page.getByTestId('save-wallpaper-directory').click();
            await expect(page.getByRole('status').filter({ hasText: '已导出' })).toBeVisible();
            const exported = await page.evaluate(async () => {
                const root = await navigator.storage.getDirectory();
                const dirs: string[] = [];
                for await (const [name] of (root as any).entries()) if (name.startsWith('audiosurf-')) dirs.push(name);
                const dir = await root.getDirectoryHandle(dirs[0]!);
                const files: { name: string; content: string }[] = [];
                for await (const [name, handle] of (dir as any).entries())
                    files.push({ name, content: await (await handle.getFile()).text() });
                return files;
            });
            expect(exported.map(f => f.name).sort()).toEqual(
                ['THIRD_PARTY_LICENSES.txt', 'index.html', 'project.json', 'runtime.js', 'style-data.js'].sort(),
            );
            expect(exported.find(f => f.name === 'style-data.js')!.content).toContain(
                resource === 'shared-camera-demo' ? '"scenes3d"' : '"seed":null',
            );
            const root = path.resolve(
                'artifacts/visualizer-composition/wallpaper-' +
                    (resource === 'radial-spectrum'
                        ? ''
                        : resource === 'shared-camera-demo'
                          ? 'scene3d-'
                          : resource + '-') +
                    info.project.name,
            );
            await mkdir(root, { recursive: true });
            for (const file of exported) await writeFile(path.join(root, file.name), file.content);
            await page.addInitScript(() => {
                (window as any).__weRegistrations = 0;
                (window as any).wallpaperRegisterAudioListener = (listener: (values: number[]) => void) => {
                    (window as any).__weListener = listener;
                    (window as any).__weRegistrations++;
                };
            });
            const remote: string[] = [];
            page.on('request', req => {
                if (/^https?:/.test(req.url())) remote.push(req.url());
            });
            await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
            const canvas = page.locator('canvas');
            await expect(canvas).toHaveAttribute('data-webgl-context-state', 'ready');
            await expect(page.locator('#error')).toBeHidden();
            expect(await page.evaluate(() => (window as any).__weRegistrations)).toBe(1);
            await page.evaluate(() => {
                (window as any).__weListener(Array.from({ length: 128 }, (_, i) => (i < 64 ? 1.5 : 0.2)));
                (window as any).wallpaperPropertyListener.applyGeneralProperties({ fps: 10 });
            });
            await expect(canvas).toHaveAttribute('data-webgl-context-state', 'ready');
            await page.evaluate(() => (window as any).wallpaperPropertyListener.setPaused(true));
            await page.waitForTimeout(250);
            const time = await canvas.getAttribute('data-frame-time');
            await page.waitForTimeout(250);
            expect(await canvas.getAttribute('data-frame-time')).toBe(time);
            await page.evaluate(() => (window as any).wallpaperPropertyListener.setPaused(false));
            await expect.poll(() => canvas.getAttribute('data-frame-time')).not.toBe(time);
            const beforeResize = await canvas.getAttribute('data-frame-time');
            await page.setViewportSize({ width: 1440, height: 600 });
            await expect.poll(async () => (await canvas.boundingBox())?.width).toBe(1440);
            await expect.poll(() => canvas.getAttribute('data-frame-time')).not.toBe(beforeResize);
            // The 30 Hz outward emitter needs time to populate the frame at its default density.
            if (resource === 'circular-particles')
                await expect.poll(async () => Number(await canvas.getAttribute('data-frame-time'))).toBeGreaterThan(2);
            const screenshot = await page.screenshot({ path: path.join(root, 'preview.png') });
            const visiblePixels = await page.evaluate(async base64 => {
                const image = new Image();
                image.src = 'data:image/png;base64,' + base64;
                await image.decode();
                const surface = document.createElement('canvas');
                surface.width = image.width;
                surface.height = image.height;
                const context = surface.getContext('2d')!;
                context.drawImage(image, 0, 0);
                const pixels = context.getImageData(0, 0, image.width, image.height).data;
                let count = 0;
                for (let i = 0; i < pixels.length; i += 4)
                    if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > 30) count++;
                return count;
            }, screenshot.toString('base64'));
            expect(visiblePixels).toBeGreaterThan(20);
            expect(remote).toEqual([]);
            expect(errors).toEqual([]);
            await page.evaluate(() => (window as any).__weListener([1]));
            await expect(page.locator('#error')).toContainText('128');
        },
    );
