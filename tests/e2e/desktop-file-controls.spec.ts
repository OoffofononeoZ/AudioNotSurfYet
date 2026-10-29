import { expect, test } from '@playwright/test';

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
