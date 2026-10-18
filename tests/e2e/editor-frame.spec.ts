import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, savedPickerEntries } from '../support/file-picker';
import { addMarkerLane } from '../support/editor-marking';
import { openEditorWorkspace } from '../support/editor-workspaces';

async function openEditor(page: Page) {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, ['format-master.wav', 'format-master.mp3'].map(name => path.resolve('tests/fixtures/audio', name)));
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
}

test('MusicBar protects selection, export, deletion and clearing before mutation', async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await openEditor(page);
    const bar = page.locator('#music-bar-container');
    const first = await bar.getAttribute('data-current-track-id');
    await page.getByTestId('playback-progress').focus();
    await page.keyboard.press('ArrowRight');
    const position = await bar.getAttribute('data-current-time');
    await page.getByTestId('toggle-queue').click();
    const items = page.getByTestId('queue-item');
    const second = await items.nth(1).getAttribute('data-track-id');
    await items.nth(1).click();
    await expect(page.getByTestId('editor-track-change-dialog')).toBeVisible();
    await page.getByTestId('editor-track-change-export').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    await expect(page.getByTestId('editor-track-change-dialog')).toBeVisible();
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(bar).toHaveAttribute('data-current-track-id', first!);
    await expect(bar).toHaveAttribute('data-playback-state', 'paused');
    await expect(bar).toHaveAttribute('data-current-time', position!);
    await expect(page).toHaveURL(new RegExp('/editor/' + first + '$'));
    await items.nth(1).click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page).toHaveURL(new RegExp('/editor/' + second + '$'));
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.getByTestId('editor-draft-conflict')).toHaveCount(0);
    await expect(bar).toHaveAttribute('data-current-track-id', second!);
    await expect(bar).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(bar).toHaveAttribute('data-playback-state', 'paused');
    await page.getByTestId('toggle-queue').click();
    await items.nth(1).hover();
    await items.nth(1).getByTestId('delete-track').click();
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(items).toHaveCount(2);
    await items.nth(1).hover();
    await items.nth(1).getByTestId('delete-track').click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(items).toHaveCount(1);
    await expect(bar).toHaveAttribute('data-current-track-id', first!);
    await page.getByTestId('clear-queue').click();
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(items).toHaveCount(1);
    await page.getByTestId('clear-queue').click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page.getByTestId('editor-empty')).toBeVisible();
    await expect(bar).toHaveAttribute('data-playback-state', 'empty');
    expect(errors).toEqual([]);
});

test('a failed draft save blocks switching while export and cancellation remain available', async ({ page }) => {
    await openEditor(page);
    const bar = page.locator('#music-bar-container');
    const first = await bar.getAttribute('data-current-track-id');
    await page.evaluate(() => {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
            if (this.transaction.db.name === 'audionotsurfyet-editor' && this.name === 'draft') {
                throw new DOMException('test quota', 'QuotaExceededError');
            }
            return put.apply(this, args);
        };
    });
    await addMarkerLane(page,'point');
    await expect(page.getByTestId('editor-page').getByRole('alert')).toContainText('无法保存草稿');
    await page.getByTestId('toggle-queue').click();
    await page.getByTestId('queue-item').nth(1).click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page.getByTestId('editor-track-change-dialog').getByRole('alert')).toContainText('尚未保存');
    await expect(bar).toHaveAttribute('data-current-track-id', first!);
    await page.getByTestId('editor-track-change-export').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(bar).toHaveAttribute('data-playback-state', 'paused');
    await expect(page.getByTestId('editor-point-workspace').locator('article')).toHaveCount(1);
});

test('toolbar tabs and overlay icons preserve keyboard access and menu focus', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);
    const toolbar = page.getByTestId('editor-toolbar');
    await expect(toolbar).toHaveCSS('height', '64px');
    await expect(page.getByRole('combobox', { name: '工程格式' })).toHaveCount(0);
    await expect(page.getByTestId('import-editor-project')).toHaveAttribute('title', '导入工程（JSON V1）');
    await expect(page.getByTestId('editor-playback-toggle')).toHaveCount(0);
    await page.getByTestId('editor-marking-tab').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('editor-separation-tab')).toBeFocused();
    await expect(page.locator('#editor-separation-panel')).toBeVisible();
    await expect(page.getByTestId('editor-overlay-toggle')).toHaveCount(0);
    await page.keyboard.press('End');
    await expect(page.getByTestId('editor-transcription-tab')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('editor-marking-tab')).toBeFocused();
    await page.getByTestId('editor-overlay-toggle').click();
    const menu = page.getByTestId('editor-overlay-feature-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitemradio').first()).toBeFocused();
    const menuRect = await menu.boundingBox(), controlsRect = await page.getByTestId('editor-overlay-controls').boundingBox();
    expect(menuRect!.y).toBeGreaterThanOrEqual(controlsRect!.y + controlsRect!.height);
    expect(Math.abs(menuRect!.x + menuRect!.width - controlsRect!.x - controlsRect!.width)).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('editor-overlay-toggle')).toBeFocused();
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await menu.locator('[data-feature-id="energy"]').click();
    await expect(page.getByTestId('editor-overlay-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('editor-analysis-overlay-panel')).toHaveAttribute('data-analysis-state', 'ready', { timeout: 30000 });
    for (const handle of ['top', 'move', 'bottom']) await expect(page.getByTestId('editor-overlay-handle-' + handle)).toBeVisible();
    await page.getByTestId('editor-overlay-toggle').click();
    await expect(page.getByTestId('editor-analysis-overlay-panel')).toHaveCount(0);
});

test('independent workspaces retain nodes and scroll positions inside the player inset', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);
    const markerScroll = page.locator('.marker-scroll');
    const unusedGutters = () => page.locator('#editor-marking-panel,.marker-scroll,.editor-timeline-panel').evaluateAll(elements => elements.map(element => {
        const node = element as HTMLElement, style = getComputedStyle(node);
        return {
            x: node.offsetWidth - node.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth),
            y: node.offsetHeight - node.clientHeight - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth),
        };
    }));
    expect(await markerScroll.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
    for (const gutter of await unusedGutters()) { expect(gutter.x).toBe(0); expect(gutter.y).toBe(0); }
    await page.setViewportSize({ width: 1280, height: 460 });
    for (let index = 0; index < 14; index++) await addMarkerLane(page,'point');
    const positions: Record<string, number> = {};
    for (const name of ['marking', 'separation', 'transcription'] as const) {
        await openEditorWorkspace(page, name);
        const panel = name === 'marking' ? page.locator('.marker-scroll') : page.locator(`#editor-${name}-panel`);
        positions[name] = await panel.evaluate(element => {
            element.scrollTop = element.scrollHeight;
            return element.scrollTop;
        });
        expect(positions[name]).toBeGreaterThan(0);
        await panel.evaluate(element => element.setAttribute('data-retained-node', 'yes'));
    }
    for (const name of ['marking', 'separation', 'transcription'] as const) {
        await openEditorWorkspace(page, name);
        const panel = name === 'marking' ? page.locator('.marker-scroll') : page.locator(`#editor-${name}-panel`);
        await expect(panel).toHaveAttribute('data-retained-node', 'yes');
        expect(await panel.evaluate(element => element.scrollTop)).toBe(positions[name]);
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByTestId('editor-toolbar')).toHaveCSS('height', '64px');
    await page.getByTestId('editor-marking-tab').click();
    await page.setViewportSize({ width: 1280, height: 2160 });
    await expect.poll(() => markerScroll.evaluate(element => element.scrollHeight <= element.clientHeight)).toBe(true);
    for (const gutter of await unusedGutters()) { expect(gutter.x).toBe(0); expect(gutter.y).toBe(0); }
});

test('responsive shell stays within the viewport for both sidebars and all player styles', async ({ page }, info) => {
    test.setTimeout(90000);
    await openEditor(page);
    const style = page.getByTestId('change-musicbar-style');
    for (const width of [1024, 1280, 1920, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const collapsed of [false, true]) {
            if (width >= 768) {
                await page.evaluate(async value => {
                    const url = '/src/stores/configStore.ts';
                    const { useConfigstore } = await import(url);
                    useConfigstore().sidebarCollapsed = value;
                }, collapsed);
            }
            for (let mode = 0; mode < 3; mode++) {
                await expect(style).toBeEnabled();
                await style.click();
                await expect(style).toBeEnabled();
                await expect.poll(() => page.evaluate(() => {
                    const frame = document.querySelector('[data-testid="editor-page"]')!.getBoundingClientRect();
                    const player = document.querySelector('#music-bar-container')!.getBoundingClientRect();
                    return Math.abs(frame.bottom - player.top);
                })).toBeLessThanOrEqual(1);
                const metrics = await page.evaluate(() => {
                    const toolbar = document.querySelector('[data-testid="editor-toolbar"]')!.getBoundingClientRect();
                    const panel = document.querySelector('#editor-marking-panel')!.getBoundingClientRect();
                    const settings = document.querySelector('[data-testid="app-settings"]')!;
                    const r = settings.getBoundingClientRect();
                    const settingReachable = settings.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
                    return { toolbar: toolbar.height, panelTop: panel.top, panelBottom: panel.bottom, frameBottom: document.querySelector('[data-testid="editor-page"]')!.getBoundingClientRect().bottom,
                        available: document.querySelector('.app-content')!.getBoundingClientRect().width,
                        scrollHeight: document.documentElement.scrollHeight, height: innerHeight, overflow: document.documentElement.scrollWidth - innerWidth, settingReachable };
                });
                expect(metrics.toolbar).toBe(metrics.available < 800 ? 106 : 64);
                const padding = width <= 600 ? 12 : 16;
                expect(metrics.panelTop).toBe(metrics.toolbar + padding);
                expect(Math.abs(metrics.panelBottom - metrics.frameBottom + padding)).toBeLessThanOrEqual(1);
                expect(metrics.scrollHeight).toBe(metrics.height);
                expect(metrics.overflow).toBeLessThanOrEqual(1);
                expect(metrics.settingReachable).toBe(true);
                await expect(page.getByTestId('editor-overlay-menu-toggle')).toBeInViewport();
                await expect(page.getByTestId('export-editor-project')).toBeInViewport();
            }
        }
        await page.screenshot({ path: info.outputPath(`editor-frame-${width}.png`) });
    }
});

test('player style animation keeps the workspace aligned with its measured top edge', async ({ page }) => {
    await openEditor(page);
    for (let mode = 0; mode < 3; mode++) {
        await page.evaluate(() => {
            const samples: number[] = [];
            (window as typeof window & { __insetSamples?: number[] }).__insetSamples = samples;
            const started = performance.now();
            const sample = () => {
                const frame = document.querySelector('[data-testid="editor-page"]')!.getBoundingClientRect();
                const player = document.querySelector('#music-bar-container')!.getBoundingClientRect();
                samples.push(Math.abs(frame.bottom - player.top));
                if (performance.now() - started < 400) requestAnimationFrame(() => setTimeout(sample, 0));
            };
            requestAnimationFrame(() => setTimeout(sample, 0));
        });
        await page.getByTestId('change-musicbar-style').click();
        await page.waitForTimeout(450);
        const samples = await page.evaluate(() => (window as typeof window & { __insetSamples?: number[] }).__insetSamples!);
        expect(samples.length).toBeGreaterThan(5);
        expect(Math.max(...samples)).toBeLessThanOrEqual(1);
    }
});

test('MusicBar supports drag, keyboard seek, volume and restores the preferred mode on leaving', async ({ page }) => {
    await openEditor(page);
    const bar = page.locator('#music-bar-container');
    const progress = page.getByTestId('playback-progress');
    const bounds = (await progress.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * .2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Number(await bar.getAttribute('data-current-time'))).toBeGreaterThan(2);
    await expect(bar).toHaveAttribute('data-playback-state', 'paused');
    await progress.focus();
    await page.keyboard.press('Home');
    await expect(bar).toHaveAttribute('data-current-time', '0');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(await bar.getAttribute('data-current-time'))).toBeGreaterThan(0);
    await page.getByTestId('volume-control').focus();
    await page.keyboard.press('Home');
    await expect(bar).toHaveAttribute('data-volume', '0');
    await page.keyboard.press('End');
    await expect(bar).toHaveAttribute('data-volume', '1');
    await expect(page.getByTestId('playback-mode')).toBeDisabled();
    await expect(page.getByTestId('playback-mode')).toHaveAttribute('aria-label', /单曲循环/);
    await page.getByTestId('export-editor-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    await page.getByRole('link', { name: 'AUDIOSURF' }).click();
    await expect(page.getByTestId('playback-mode')).toBeEnabled();
    await expect(page.getByTestId('playback-mode')).toHaveAttribute('aria-label', /顺序/);
});
