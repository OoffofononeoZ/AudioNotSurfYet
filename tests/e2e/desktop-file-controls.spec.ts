import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('media import survives a definition refresh but discards a changed project revision', async ({ page }) => {
    const image = (await readFile('tests/fixtures/visualizer-media/red.png')).toString('base64');
    await page.goto('/');
    await page.evaluate(async image => {
        const from = (path: string) => import(/* @vite-ignore */ path);
        const vue = await from('/node_modules/.vite/deps/vue.js');
        const { default: Media } = await from('/src/components/visualizer/VisualizerMediaInput.vue');
        const { platformPortsKey } = await from('/src/platform/platformPorts.ts');
        const definition = vue.ref({ id: 'background', label: '测试媒体', kinds: ['image'], multiple: false });
        const revision = vue.ref('project:1'),
            changes: unknown[] = [],
            releases: (() => void)[] = [];
        const bytes = Uint8Array.from(atob(image), c => c.charCodeAt(0));
        const root = document.createElement('div');
        document.body.append(root);
        const app = vue.createApp({
            setup: () => () =>
                vue.h(Media, {
                    elementId: 'element',
                    projectRevision: revision.value,
                    definition: definition.value,
                    binding: { kind: 'none' },
                    assets: [],
                    disabled: false,
                    onChange: (change: unknown) => changes.push(change),
                }),
        });
        app.provide(platformPortsKey, { kind: 'web' });
        app.mount(root);
        (window as any).__mediaControl = {
            changes,
            refresh: () => (definition.value = { ...definition.value }),
            revise: () => (revision.value = 'project:2'),
            start: async () => {
                const file = new File([bytes], 'delayed.png', { type: 'image/png' });
                file.arrayBuffer = () => new Promise(resolve => releases.push(() => resolve(bytes.slice().buffer)));
                const input = root.querySelector('input')!;
                Object.defineProperty(input, 'files', { configurable: true, value: [file] });
                input.dispatchEvent(new Event('change', { bubbles: true }));
                await vue.nextTick();
            },
            finish: (index: number) => releases[index]!(),
        };
    }, image);
    const state = () => page.evaluate(() => (window as any).__mediaControl.changes.length);
    await page.evaluate(() => (window as any).__mediaControl.start());
    await page.evaluate(() => (window as any).__mediaControl.refresh());
    await expect(page.getByRole('status').filter({ hasText: '正在读取并验证素材' })).toBeVisible();
    await page.evaluate(() => (window as any).__mediaControl.finish(0));
    await expect.poll(state).toBe(1);
    await page.evaluate(() => (window as any).__mediaControl.start());
    await page.evaluate(() => (window as any).__mediaControl.revise());
    await page.evaluate(() => (window as any).__mediaControl.finish(1));
    await page.evaluate(() => (window as any).__mediaControl.start());
    await page.evaluate(() => (window as any).__mediaControl.finish(2));
    await expect.poll(state).toBe(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
});

// Browser-hosted adapter tests. These do not claim Electron or OS dialog coverage.
test('desktop input control discards a late selection after identity changes and accepts the next selection', async ({
    page,
}) => {
    await page.goto('/');
    await page.evaluate(async () => {
        const from = (path: string) => import(/* @vite-ignore */ path);
        const vue = await from('/node_modules/.vite/deps/vue.js');
        const { default: Input } = await from('/src/components/platform/PlatformFileInput.vue');
        const { platformPortsKey } = await from('/src/platform/platformPorts.ts');
        const identity = vue.ref('old'),
            selected: string[][] = [],
            errors: string[] = [];
        let finish!: (files: File[]) => void, signal: AbortSignal | undefined;
        const root = document.createElement('div');
        root.style.cssText = 'position:fixed;left:350px;top:180px;z-index:10000;background:white;padding:20px';
        document.body.append(root);
        const app = vue.createApp({
            setup() {
                return () =>
                    vue.h(Input, {
                        purpose: 'image',
                        accept: 'image/png',
                        multiple: true,
                        selectionKey: identity.value,
                        'aria-label': '测试桌面素材选择',
                        onFiles: (files: File[]) => selected.push(files.map(file => file.name)),
                        onError: (message: string) => errors.push(message),
                    });
            },
        });
        app.provide(platformPortsKey, {
            kind: 'electron',
            transfers: {
                openMany: async (_purpose: string, _multiple: boolean, next: AbortSignal) => {
                    signal = next;
                    return new Promise<File[]>(resolve => {
                        finish = resolve;
                    });
                },
            },
        });
        app.mount(root);
        (window as any).__inputControl = {
            selected,
            errors,
            revise: () => (identity.value = 'new'),
            aborted: () => signal?.aborted,
            finish: () => finish([new File(['a'], 'one.png'), new File(['b'], 'two.png')]),
        };
    });
    const picker = page.getByRole('button', { name: '测试桌面素材选择' });
    await picker.click();
    await page.evaluate(() => (window as any).__inputControl.revise());
    expect(await page.evaluate(() => (window as any).__inputControl.aborted())).toBe(true);
    await page.evaluate(() => (window as any).__inputControl.finish());
    await expect(picker).toBeEnabled();
    expect(await page.evaluate(() => (window as any).__inputControl.selected)).toEqual([]);
    await picker.click();
    await page.evaluate(() => (window as any).__inputControl.finish());
    await expect
        .poll(() => page.evaluate(() => (window as any).__inputControl.selected))
        .toEqual([['one.png', 'two.png']]);
});

test('desktop download control cancels an old source without unlocking a newer save', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
        const from = (path: string) => import(/* @vite-ignore */ path);
        const vue = await from('/node_modules/.vite/deps/vue.js');
        const { default: Download } = await from('/src/components/platform/PlatformDownload.vue');
        const { platformPortsKey } = await from('/src/platform/platformPorts.ts');
        const source = vue.ref('blob:old'),
            signals: AbortSignal[] = [],
            finishes: Array<(value: string) => void> = [];
        const root = document.createElement('div');
        root.style.cssText = 'position:fixed;left:350px;top:180px;z-index:10000;background:white;padding:20px';
        document.body.append(root);
        const app = vue.createApp({
            setup() {
                return () =>
                    vue.h(
                        Download,
                        {
                            purpose: 'wav',
                            name: 'stem.wav',
                            href: source.value,
                            load: async () => new Blob(['wav']),
                            'aria-label': '测试桌面WAV保存',
                        },
                        () => 'WAV',
                    );
            },
        });
        app.provide(platformPortsKey, {
            kind: 'electron',
            transfers: {
                save: async (_purpose: string, _name: string, _file: Blob, signal: AbortSignal) => {
                    signals.push(signal);
                    return new Promise<string>(resolve => finishes.push(resolve));
                },
            },
        });
        app.mount(root);
        (window as any).__downloadControl = {
            revise: () => (source.value = 'blob:new'),
            count: () => signals.length,
            aborted: () => signals[0]?.aborted,
            finish: (index: number) => finishes[index]!('saved'),
        };
    });
    const save = page.getByRole('button', { name: '测试桌面WAV保存' });
    await save.click();
    await expect.poll(() => page.evaluate(() => (window as any).__downloadControl.count())).toBe(1);
    await page.evaluate(() => (window as any).__downloadControl.revise());
    await expect(save).toBeEnabled();
    expect(await page.evaluate(() => (window as any).__downloadControl.aborted())).toBe(true);
    await save.click();
    await expect.poll(() => page.evaluate(() => (window as any).__downloadControl.count())).toBe(2);
    await page.evaluate(() => (window as any).__downloadControl.finish(0));
    await expect(save).toBeDisabled();
    await page.evaluate(() => (window as any).__downloadControl.finish(1));
    await expect(save).toBeEnabled();
});
