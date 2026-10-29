import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import { chooseVisualizerProjectExport, openRealtimeStyleExport } from '../support/project-actions';
test.use({ viewport: { width: 1920, height: 1080 } });
async function open(page: Page, resource = 'solid') {
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await page.getByTestId('add-visualizer-element').click();
    await page.locator(`[data-resource-id="${resource}"]`).click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
const modal = (page: Page) => page.locator('.realtime-actions');

// Browser-hosted desktop presentation policy; this is not native Electron evidence.
test('application display pages open inside the app without an external address or copy action', async ({ page }) => {
    await open(page);
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const project = JSON.parse(Buffer.from((await savedPickerEntries(page))[0]!.base64, 'base64').toString('utf8'));
    await page.evaluate(async project => {
        const from = (path: string) => import(/* @vite-ignore */ path);
        const vue = await from('/node_modules/.vite/deps/vue.js');
        const { createPinia } = await from('/node_modules/.vite/deps/pinia.js');
        const { default: Actions } = await from('/src/components/visualizer/VisualizerRealtimeActions.vue');
        const { default: router } = await from('/src/router/index.ts');
        const { createPlatformPorts, platformPortsKey } = await from('/src/platform/platformPorts.ts');
        const { applicationDisplayPages } = await from('/src/platform/displayPages.ts');
        const cover = await (await fetch('/default_cover.png')).blob();
        const root = document.createElement('div');
        root.dataset.testid = 'desktop-display-test';
        document.body.append(root);
        const app = vue.createApp({
            setup: () => () =>
                vue.h(Actions, {
                    open: true,
                    project,
                    locked: false,
                    captureCover: async () => cover,
                }),
        });
        app.provide(platformPortsKey, { ...createPlatformPorts(), displayPages: applicationDisplayPages });
        app.use(createPinia());
        app.use(router);
        app.mount(root);
        (window as any).__displayActions = {
            unmount: () => {
                app.unmount();
                root.remove();
            },
        };
    }, project);
    const desktop = page.getByTestId('desktop-display-test');
    await expect(desktop.getByTestId('create-display-page')).toHaveText(/创建展示页/);
    await desktop.getByTestId('create-display-page').click();
    await expect(desktop.getByRole('heading', { name: '展示页已创建' })).toBeVisible();
    await expect(desktop.getByLabel('本地展示地址')).toHaveCount(0);
    await expect(desktop.getByRole('button', { name: /复制展示地址/ })).toHaveCount(0);
    await expect(desktop).toContainText('样式保存在当前应用中。');
    const link = desktop.getByRole('link', { name: '打开展示页' });
    await expect(link).toHaveAttribute('href', /^\/display\/[0-9a-f-]+$/);
    const target = await link.getAttribute('href');
    await link.click();
    await page.evaluate(() => (window as any).__displayActions.unmount());
    await expect(page).toHaveURL(new RegExp(target + '$'));
    await expect(page.getByTestId('visualizer-display')).toBeVisible();
    await expect(page.getByTestId('realtime-visualizer-canvas')).toHaveAttribute('data-webgl-context-state', 'ready');
});

test('snapshot, address feedback, copy failures and return navigation share the dialog lifecycle', async ({
    page,
}, info) => {
    await open(page, 'circular-particles');
    await page.evaluate(() => {
        const host = window as any;
        host.revokedCovers = [];
        const revoke = URL.revokeObjectURL;
        URL.revokeObjectURL = value => {
            host.revokedCovers.push(value);
            revoke(value);
        };
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async (value: string) => {
                    host.copiedAddress = value;
                },
            },
        });
    });
    await openRealtimeStyleExport(page);
    const cover = modal(page).locator('.realtime-preview img');
    await expect(cover).toBeVisible();
    await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const firstCover = await cover.getAttribute('src');
    expect(await page.getByTestId('visualizer-preview-canvas').count()).toBe(1);
    expect(await page.evaluate(() => (window as any).__VISUALIZER_DIAGNOSTICS__.activeRenderers)).toBe(1);
    const name = modal(page).getByLabel('样式名称');
    await name.fill('');
    for (const action of await modal(page).locator('.destination-card').all()) await expect(action).toBeDisabled();
    await name.fill('测试实时样式');
    await modal(page).screenshot({
        path: `artifacts/visualizer-composition/action-dialogs/realtime-${info.project.name}.png`,
    });
    await page.getByTestId('create-display-page').click();
    const address = page.getByLabel('本地展示地址');
    await expect(address).toHaveValue(/\/display\/[0-9a-f-]+$/);
    const value = await address.inputValue();
    await page.getByRole('button', { name: '复制展示地址', exact: true }).click();
    await expect(page.getByRole('button', { name: '已复制展示地址', exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).copiedAddress)).toBe(value);
    await page.evaluate(() => {
        (navigator.clipboard as any).writeText = async () => {
            throw Error('denied');
        };
    });
    await page.getByRole('button', { name: '已复制展示地址', exact: true }).click();
    await expect(modal(page).getByRole('status')).toHaveText('无法复制，请选中地址后手动复制。');
    await page.setViewportSize({ width: 1024, height: 720 });
    const geometry = await modal(page).evaluate(dialog => {
        const body = dialog.querySelector('.realtime-body')!;
        return {
            x: body.scrollWidth - body.clientWidth,
            y: dialog.scrollHeight - dialog.clientHeight,
            height: dialog.getBoundingClientRect().height,
            headerTop: dialog.querySelector('header')!.getBoundingClientRect().top,
        };
    });
    expect(geometry.x).toBe(0);
    expect(geometry.y).toBe(0);
    expect(geometry.height).toBeLessThanOrEqual(656);
    expect(geometry.headerTop).toBeGreaterThanOrEqual(31);
    await modal(page).screenshot({
        path: `artifacts/visualizer-composition/action-dialogs/address-1024-${info.project.name}.png`,
    });
    await name.fill('修改名称');
    await expect(address).toHaveCount(0);
    await page.getByRole('button', { name: '返回导出选项', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '导出', exact: true })).toBeVisible();
    await expect
        .poll(() => page.evaluate(value => (window as any).revokedCovers.includes(value), firstCover))
        .toBe(true);
    await page.getByTestId('realtime-style-actions').click();
    await expect(cover).toBeVisible();
    await expect(cover).not.toHaveAttribute('src', firstCover!);
    await expect(address).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('export-visualizer-project')).toBeFocused();
});

test('wallpaper preparation waits for a second gesture and supports cancellation, retry and success', async ({
    page,
}, info) => {
    await open(page);
    await page.evaluate(() => {
        const host = window as any;
        host.wallpaperPick = { count: 0, active: false, mode: 'cancel' };
        host.showDirectoryPicker = () => {
            host.wallpaperPick.count++;
            host.wallpaperPick.active = navigator.userActivation.isActive;
            if (host.wallpaperPick.mode === 'cancel') throw new DOMException('cancel', 'AbortError');
            if (host.wallpaperPick.mode === 'denied') throw new DOMException('directory denied', 'NotAllowedError');
            return navigator.storage.getDirectory();
        };
    });
    await openRealtimeStyleExport(page);
    await page.getByTestId('prepare-wallpaper-export').click();
    const save = page.getByTestId('save-wallpaper-directory');
    await expect(save).toBeVisible();
    expect(await page.evaluate(() => (window as any).wallpaperPick.count)).toBe(0);
    await save.click();
    await expect(save).toBeEnabled();
    await expect(modal(page).getByRole('alert')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).wallpaperPick)).toMatchObject({ count: 1, active: true });
    await page.evaluate(() => {
        (window as any).wallpaperPick.mode = 'denied';
    });
    await save.click();
    await expect(modal(page).getByRole('alert')).toContainText('directory denied');
    await page.evaluate(() => {
        (window as any).wallpaperPick.mode = 'ok';
    });
    await save.click();
    await expect(modal(page).getByRole('status')).toContainText('已导出 audiosurf-');
    await expect(modal(page).getByRole('alert')).toHaveCount(0);
    await modal(page).screenshot({
        path: `artifacts/visualizer-composition/action-dialogs/wallpaper-${info.project.name}.png`,
    });
    const exported = await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        const names = [];
        for await (const [name] of (root as any).entries()) if (name.startsWith('audiosurf-')) names.push(name);
        const dir = await root.getDirectoryHandle(names[0]!);
        return {
            count: names.length,
            project: JSON.parse(await (await (await dir.getFileHandle('project.json')).getFile()).text()),
        };
    });
    expect(exported.count).toBe(1);
    expect(exported.project.type).toBe('web');
});

test('closing a pending save prevents its late result from replacing a new result', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
        const original = IDBDatabase.prototype.transaction;
        let first = true;
        IDBDatabase.prototype.transaction = function (...args) {
            const transaction = original.apply(this, args);
            if (first && args[0] === 'styles' && args[1] === 'readwrite') {
                first = false;
                let completed: ((event: Event) => void) | null = null;
                Object.defineProperty(transaction, 'oncomplete', {
                    configurable: true,
                    get: () => completed,
                    set: value => {
                        completed = value;
                    },
                });
                transaction.addEventListener('complete', event => {
                    (window as any).releaseStyleSave = () => {
                        completed?.call(transaction, event);
                        (window as any).lateStyleFinished = true;
                    };
                });
            }
            return transaction;
        };
    });
    await openRealtimeStyleExport(page);
    await page.getByTestId('create-display-page').click();
    await expect.poll(() => page.evaluate(() => typeof (window as any).releaseStyleSave)).toBe('function');
    await expect(page.getByTestId('apply-home-style')).toBeDisabled();
    await page.getByRole('button', { name: '关闭实时样式', exact: true }).click();
    await openRealtimeStyleExport(page);
    await page.getByTestId('create-display-page').click();
    const address = page.getByLabel('本地展示地址');
    await expect(address).toHaveValue(/\/display\/[0-9a-f-]+$/);
    const newest = await address.inputValue();
    await page.evaluate(() => (window as any).releaseStyleSave());
    await expect.poll(() => page.evaluate(() => (window as any).lateStyleFinished)).toBe(true);
    await expect(address).toHaveValue(newest);
    await expect(modal(page).getByRole('alert')).toHaveCount(0);
});

test('an unavailable snapshot does not disable otherwise supported destinations', async ({ page }) => {
    await open(page);
    await page.getByTestId('visualizer-preview-canvas').dispatchEvent('visualizer-scene-error-test');
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'error');
    await openRealtimeStyleExport(page);
    await expect(modal(page).getByText('画面暂不可用', { exact: true })).toBeVisible();
    await expect(page.getByTestId('create-display-page')).toBeEnabled();
    await expect(page.getByTestId('prepare-wallpaper-export')).toBeEnabled();
});

test('project replacement invalidates generated results and refreshes the optional snapshot', async ({ page }) => {
    await open(page);
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const saved = (await savedPickerEntries(page))[0]!;
    const project = JSON.parse(Buffer.from(saved.base64, 'base64').toString('utf8'));
    project.elements[0].name = '导入后更新的元素';
    await queuePickerData(page, [
        { name: 'replacement.json', mimeType: 'application/json', text: JSON.stringify(project) },
    ]);
    await openRealtimeStyleExport(page);
    const image = modal(page).locator('.realtime-preview img');
    await expect(image).toBeVisible();
    const before = await image.getAttribute('src');
    await page.getByTestId('create-display-page').click();
    await expect(page.getByLabel('本地展示地址')).toHaveValue(/\/display\//);
    // An external project update may arrive while the modal owns normal pointer input.
    await page.getByTestId('import-visualizer-project').dispatchEvent('click');
    await expect(page.locator('.viz-element-select .viz-row-name')).toHaveText('导入后更新的元素');
    await expect(page.getByLabel('本地展示地址')).toHaveCount(0);
    await expect(image).toBeVisible();
    await expect(image).not.toHaveAttribute('src', before!);
    await expect(page.getByTestId('create-display-page')).toBeEnabled();
});
