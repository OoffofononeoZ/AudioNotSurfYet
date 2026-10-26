import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import type { VisualizerSessionController } from '../../src/visualizer/visualizerSessionController';
import type { CompositionSessionSnapshot } from '../../src/visualizer/compositionTypes';
import type { VisualizerExportState } from '../../src/visualizer/exportTypes';

async function open(page: Page) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    if ((await page.locator('#music-bar-container').getAttribute('data-playback-state')) === 'playing')
        await page.getByTestId('toggle-playback').click();
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
}
// Drive observable UI states through the existing injected controller; no production debug API or encoder timing dependency.
async function state(page: Page, kind: 'loading' | 'progress' | 'next-progress' | 'ready' | 'failure') {
    await page.getByTestId('visualizer-ready').evaluate(async (node, kind) => {
        const provides = (
            node as HTMLElement & { __vueParentComponent: { provides: Record<symbol, VisualizerSessionController> } }
        ).__vueParentComponent.provides;
        const modulePath = '/src/visualizer/visualizerSessionController.ts';
        const { visualizerSessionControllerKey } = await import(modulePath);
        const controller = provides[visualizerSessionControllerKey]!,
            snapshot = controller.getSnapshot();
        snapshot.bindingRuntime = {
            ...snapshot.bindingRuntime,
            activeFeatureIds: ['rms', 'energy'],
            analysisState: kind === 'failure' ? 'error' : kind === 'ready' ? 'ready' : 'loading',
            analysisProgress: kind === 'ready' ? 1 : 0.37,
            readyFeatureIds: kind === 'ready' ? ['rms', 'energy'] : [],
            analysisMessage: kind === 'failure' ? '受控分析错误' : undefined,
        };
        snapshot.export =
            kind === 'ready'
                ? { status: 'ready', mimeType: 'video/webm', byteLength: 1024 }
                : kind === 'failure'
                  ? { status: 'error', code: 'encode-failed', message: '受控导出错误' }
                  : kind === 'loading'
                    ? { status: 'preparing' }
                    : {
                          status: 'exporting',
                          framesDone: kind === 'next-progress' ? 1234568 : 1234567,
                          totalFrames: 2000000,
                      };
        (controller as unknown as { publish(value: CompositionSessionSnapshot): void }).publish(snapshot);
    }, kind);
}
async function sameRow(page: Page) {
    const geometry = await page.locator('.viz-bottom-tabs').evaluate(node => {
        const rect = (selector: string) => node.querySelector(selector)!.getBoundingClientRect();
        const tabs = rect('[role=tablist]'),
            status = rect('.viz-bottom-status'),
            saved = rect('.viz-save-state'),
            toggle = rect('button[aria-expanded]'),
            row = node.getBoundingClientRect();
        return {
            tabsRight: tabs.right,
            statusLeft: status.left,
            statusRight: status.right,
            savedLeft: saved.left,
            savedRight: saved.right,
            toggleLeft: toggle.left,
            toggleRight: toggle.right,
            rowRight: row.right,
            centers: [tabs, status, saved, toggle].map(r => r.top + r.height / 2),
        };
    });
    expect(geometry.statusLeft).toBeGreaterThanOrEqual(geometry.tabsRight);
    expect(geometry.statusRight).toBeLessThanOrEqual(geometry.savedLeft);
    expect(geometry.savedRight).toBeLessThanOrEqual(geometry.toggleLeft);
    expect(geometry.toggleRight).toBeLessThanOrEqual(geometry.rowRight);
    expect(Math.max(...geometry.centers) - Math.min(...geometry.centers)).toBeLessThan(1);
}

async function exportState(page: Page, value: VisualizerExportState) {
    await page.getByTestId('visualizer-ready').evaluate(async (node, value) => {
        const provides = (
            node as HTMLElement & {
                __vueParentComponent: { provides: Record<symbol, VisualizerSessionController> };
            }
        ).__vueParentComponent.provides;
        const modulePath = '/src/visualizer/visualizerSessionController.ts';
        const { visualizerSessionControllerKey } = await import(modulePath);
        const controller = provides[visualizerSessionControllerKey]!,
            snapshot = controller.getSnapshot();
        snapshot.export = value;
        (controller as unknown as { publish(value: CompositionSessionSnapshot): void }).publish(snapshot);
    }, value);
}

test('export progress shows real percentages and accessible phases without overflowing; reduced motion stops animations', async ({
    page,
}, info) => {
    await open(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('tab', { name: '状态', exact: true }).click();
    const progress = page.getByRole('progressbar', { name: '视频导出进度', exact: true });
    const fill = progress.locator('span');
    await exportState(page, { status: 'preparing' });
    await expect(progress).not.toHaveAttribute('aria-valuenow');
    await expect(progress).toHaveAttribute('aria-valuetext', '准备导出');
    await page
        .locator('.viz-bottom')
        .screenshot({ path: `artifacts/visualizer-composition/export-preparing-${info.project.name}.png` });
    for (const width of [1920, 1440, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [framesDone, expected] of [
            [0, '0'],
            [1234567, '61.7'],
            [2000000, '100'],
        ] as const) {
            await exportState(page, { status: 'exporting', framesDone, totalFrames: 2000000 });
            await expect(progress).toHaveAttribute('aria-valuenow', expected);
            await expect(progress).toHaveAttribute('aria-valuetext', Number(expected).toFixed(1) + '%');
            await expect(progress).toBeInViewport();
            await sameRow(page);
            const geometry = await progress.evaluate(node => {
                const card = node.parentElement!,
                    panel = card.closest('[role=tabpanel]')!;
                const a = card.getBoundingClientRect(),
                    b = panel.getBoundingClientRect();
                return {
                    contained: a.left >= b.left && a.right <= b.right,
                    overflow: card.scrollWidth > card.clientWidth,
                };
            });
            expect(geometry).toEqual({ contained: true, overflow: false });
            if (framesDone === 1234567) {
                await expect
                    .poll(() =>
                        progress.evaluate(
                            node =>
                                node.firstElementChild!.getBoundingClientRect().width /
                                node.getBoundingClientRect().width,
                        ),
                    )
                    .toBeCloseTo(0.617, 2);
                await page.locator('.viz-bottom').screenshot({
                    path: `artifacts/visualizer-composition/export-progress-${info.project.name}-${width}.png`,
                });
            }
        }
    }
    await exportState(page, { status: 'exporting', framesDone: 0, totalFrames: 0 });
    await expect(progress).not.toHaveAttribute('aria-valuenow');
    await exportState(page, { status: 'exporting', framesDone: -1, totalFrames: 100 });
    await expect(progress).toHaveAttribute('aria-valuenow', '0');
    await exportState(page, { status: 'exporting', framesDone: 200, totalFrames: 100 });
    await expect(progress).toHaveAttribute('aria-valuenow', '100');
    await exportState(page, { status: 'finalizing' });
    await expect(progress).not.toHaveAttribute('aria-valuenow');
    await expect(progress).toHaveAttribute('aria-valuetext', '正在生成 WebM');
    await page
        .locator('.viz-bottom')
        .screenshot({ path: `artifacts/visualizer-composition/export-finalizing-${info.project.name}.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(fill).toHaveCSS('animation-name', 'none');
    await exportState(page, { status: 'exporting', framesDone: 1, totalFrames: 2 });
    await expect(fill).toHaveCSS('transition-property', 'none');
    await state(page, 'ready');
    await expect(progress).toHaveCount(0);
    await expect(page.getByTestId('save-visualizer-export')).toBeVisible();
    await state(page, 'failure');
    await expect(progress).toHaveCount(0);
    await expect(page.getByRole('button', { name: '清除错误', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});
test('status summaries precede saved state on every tab and while collapsed at supported desktop widths', async ({
    page,
}, info) => {
    await open(page);
    const summary = page.getByRole('status', { name: '工程状态' });
    for (const width of [1920, 1440, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const tab of ['输出', 'Editor 数据', '状态']) {
            await page.getByRole('tab', { name: tab, exact: true }).click();
            await expect(summary).toContainText('分析 未使用 · 0% · 0/4');
            await expect(summary).toContainText('导出待命');
            await sameRow(page);
        }
        await expect(page.locator('.viz-status-lines')).not.toContainText('导出待命');
        await page.getByRole('button', { name: '折叠工程底栏', exact: true }).click();
        await expect(summary).toBeVisible();
        await expect(page.getByRole('tabpanel')).toBeHidden();
        await sameRow(page);
        await page.screenshot({ path: `artifacts/visualizer-composition/status-${info.project.name}-${width}.png` });
    }
});
test('progress does not reopen a collapsed panel; ready/error retain actions and narrow status content scrolls by keyboard', async ({
    page,
}, info) => {
    await open(page);
    const summary = page.getByRole('status', { name: '工程状态' });
    await page.getByRole('tab', { name: 'Editor 数据', exact: true }).click();
    await state(page, 'loading');
    await expect(summary).toContainText('分析 分析中 · 37% · 2/4');
    await expect(summary).toContainText('正在准备导出');
    await expect(page.getByRole('tab', { name: 'Editor 数据', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: '折叠工程底栏', exact: true }).click();
    await state(page, 'progress');
    await expect(summary).toContainText('1234567 / 2000000 帧');
    await state(page, 'next-progress');
    await expect(summary).toContainText('1234568 / 2000000 帧');
    await expect(page.getByRole('tabpanel')).toBeHidden();
    await page.locator('.viz-preview-column').evaluate(node => ((node as HTMLElement).style.width = '480px'));
    await sameRow(page);
    expect(await summary.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await summary.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => summary.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    await expect(page.getByText('已保存', { exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: '展开工程底栏', exact: true })).toBeInViewport();
    await page.screenshot({ path: `artifacts/visualizer-composition/status-${info.project.name}-overflow.png` });
    await page.locator('.viz-preview-column').evaluate(node => ((node as HTMLElement).style.width = ''));
    await state(page, 'ready');
    await expect(page.getByRole('tab', { name: '状态', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(summary).toContainText('已就绪 · 100% · 2/4');
    await expect(summary).toContainText('WebM 已就绪');
    await expect(page.getByTestId('save-visualizer-export')).toBeVisible();
    await expect(page.getByTestId('discard-visualizer-export')).toBeVisible();
    await expect(page.locator('.viz-status-lines')).not.toContainText('WebM 已就绪');
    await state(page, 'failure');
    await expect(summary).toContainText('分析 失败');
    await expect(summary).toContainText('导出失败');
    await expect(page.getByRole('button', { name: '重试分析', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: '清除错误', exact: true })).toBeEnabled();
    await expect(page.locator('.viz-status-lines')).toContainText('受控分析错误');
    await expect(page.locator('.viz-status-lines')).toContainText('受控导出错误');
});
