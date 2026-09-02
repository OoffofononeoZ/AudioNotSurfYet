import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_FILE = path.join(ROOT, 'tests/fixtures/audio/visualizer-v3-lines-v1.wav');

const browserIssues = (page: Page): string[] => {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
    return issues;
};

const openV3 = async (page: Page) => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [AUDIO_FILE]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('visualizer-preview-frame'))
        .toHaveAttribute('data-scene-status', 'ready');
    const toggle = page.getByTestId('visualizer-playback-toggle');
    if (await toggle.textContent() === '暂停') await toggle.click();
    await expect(toggle).toHaveText('播放');
};

const changeNumberAndMeasure = async (
    page: Page,
    parameterId: string,
    value: number,
    observedSelector: string,
): Promise<number> => page.evaluate(({ parameterId: id, value: nextValue, observedSelector: selector }) => {
    const input = document.querySelector(
        `[data-parameter-id="${id}"] input[type="number"]`,
    ) as HTMLInputElement | null;
    const observed = document.querySelector(selector);
    if (!input || !observed) throw new Error(`Missing V3 metric target for ${id}`);
    return new Promise<number>((resolve, reject) => {
        const startedAt = performance.now();
        const timeout = window.setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timed out waiting for ${selector}`));
        }, 1_000);
        const observer = new MutationObserver(() => {
            window.clearTimeout(timeout);
            observer.disconnect();
            resolve(performance.now() - startedAt);
        });
        observer.observe(observed, { attributes: true, childList: true, subtree: true });
        input.value = String(nextValue);
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
}, { parameterId, value, observedSelector });

const seekTo = async (page: Page, seconds: number) => {
    await page.getByTestId('visualizer-seek').evaluate((element, value) => {
        const input = element as HTMLInputElement;
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, seconds);
};

test('renders deterministic orthogonal lines and recovers scene failures in one host', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = browserIssues(page);
    await openV3(page);
    const frame = page.getByTestId('visualizer-preview-frame');
    const canvas = page.getByTestId('visualizer-preview-canvas');
    await expect(page.getByText('请选择主要音色/鼓点数据源', { exact: true })).toBeVisible();

    const visualFeedbackMs = await changeNumberAndMeasure(
        page,
        'horizontalIntensity',
        0.8,
        '[data-testid="visualizer-preview-frame"]',
    );
    expect(visualFeedbackMs).toBeLessThanOrEqual(50);
    await expect(page.getByText('请选择主要音色/鼓点数据源', { exact: true })).toBeHidden();
    await canvas.evaluate((element) => {
        element.dispatchEvent(new Event('visualizer-sample-center-test'));
    });
    await expect(canvas).toHaveAttribute('data-center-pixel', /.+/);
    const centerPixel = (await canvas.getAttribute('data-center-pixel'))!
        .split(',')
        .map(Number);
    expect(centerPixel[0]! + centerPixel[1]! + centerPixel[2]!).toBeGreaterThan(20);

    const settingsFeedbackMs = await changeNumberAndMeasure(
        page,
        'horizontalBrightness',
        1.8,
        '[data-testid="resolved-horizontalBrightness"]',
    );
    expect(settingsFeedbackMs).toBeLessThanOrEqual(100);
    console.log(JSON.stringify({
        metric: 'v3-feedback-ms',
        visual: visualFeedbackMs,
        settings: settingsFeedbackMs,
        centerPixel,
    }));

    await seekTo(page, 2.25);
    await expect(canvas).toHaveAttribute('data-frame-time', '2.250000');
    const expectedHash = await frame.getAttribute('data-frame-state-hash');
    await expect(page.getByText('草稿已保存', { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible({ timeout: 20_000 });
    await seekTo(page, 2.25);
    await expect(page.getByTestId('visualizer-preview-canvas'))
        .toHaveAttribute('data-frame-time', '2.250000');
    await expect(page.getByTestId('visualizer-preview-frame'))
        .toHaveAttribute('data-frame-state-hash', expectedHash ?? '', { timeout: 10_000 });

    const hostId = await canvas.getAttribute('data-renderer-host-id');
    for (const width of [1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(async () => canvas.evaluate((element) => {
            const target = element as HTMLCanvasElement;
            const rect = target.getBoundingClientRect();
            return target.width === Math.round(
                rect.width * Math.min(window.devicePixelRatio || 1, 2),
            );
        })).toBe(true);
        const geometry = await canvas.evaluate((element) => {
            const target = element as HTMLCanvasElement;
            const rect = target.getBoundingClientRect();
            return {
                ratio: rect.width / rect.height,
                dpr: Number(target.dataset.renderDpr),
                backingWidth: target.width,
                expectedWidth: Math.round(rect.width * Math.min(window.devicePixelRatio || 1, 2)),
            };
        });
        expect(geometry.ratio).toBeCloseTo(16 / 9, 2);
        expect(geometry.dpr).toBeLessThanOrEqual(2);
        expect(geometry.backingWidth).toBe(geometry.expectedWidth);
    }

    await page.getByRole('button', { name: /立方体群/ }).click();
    await expect(frame).toHaveAttribute('data-scene-status', 'ready');
    await expect(page.getByText('Visualizer · 立方体群', { exact: true })).toBeVisible();
    await expect(page.getByText('V4 中性预览', { exact: true })).toHaveCount(0);
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(hostId);
    await page.getByRole('button', { name: /正交线条/ }).click();
    await expect(frame).toHaveAttribute('data-scene-status', 'ready');

    const beforeFailure = await page.evaluate(() => ({
        targetResolveCount: window.__VISUALIZER_V3_DIAGNOSTICS__?.targetResolveCount,
        renderedFrames: window.__VISUALIZER_V3_DIAGNOSTICS__?.renderedFrames,
    }));
    expect(beforeFailure.targetResolveCount).toBe(beforeFailure.renderedFrames);
    await canvas.evaluate((element) => {
        element.dispatchEvent(new Event('visualizer-scene-error-test'));
    });
    await expect(frame).toHaveAttribute('data-scene-status', 'error');
    await expect(page.getByTestId('visualizer-playback-toggle')).toBeVisible();
    await page.getByTestId('retry-visualizer-scene').click();
    await expect(frame).toHaveAttribute('data-scene-status', 'ready');
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(hostId);

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.getByRole('button', { name: '工程设置' }).click();
    await page.getByTestId('binding-source-horizontalIntensity').focus();
    await expect(page.getByTestId('binding-source-horizontalIntensity')).toBeFocused();
    expect(issues).toEqual([]);
});

test('keeps one canvas, renderer host, and visual RAF through 20 route loops', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = browserIssues(page);
    await openV3(page);
    for (let cycle = 0; cycle < 20; cycle += 1) {
        await expect(page.getByTestId('visualizer-preview-canvas')).toHaveCount(1);
        await page.getByRole('link', { name: 'AUDIOSURF' }).click();
        await expect(page.getByTestId('visualizer-preview-canvas')).toHaveCount(0);
        await page.getByTestId('header-visualizer-link').click();
        await expect(page.getByTestId('visualizer-preview-frame'))
            .toHaveAttribute('data-scene-status', 'ready');
    }
    const resources = await page.evaluate(() => ({
        canvases: document.querySelectorAll('[data-testid="visualizer-preview-canvas"]').length,
        ...window.__VISUALIZER_V3_DIAGNOSTICS__,
    }));
    console.log(JSON.stringify({ metric: 'v3-route-resources', cycles: 20, ...resources }));
    expect(resources.canvases).toBe(1);
    expect(resources.activeHosts).toBe(1);
    expect(resources.activeRenderers).toBe(1);
    expect(resources.activeVisualAnimationFrames).toBeLessThanOrEqual(1);
    expect((resources.scenesCreated ?? 0) - (resources.scenesDisposed ?? 0)).toBe(1);
    expect(resources.maxFrameDurationMs).toBeLessThanOrEqual(50);
    expect(issues).toEqual([]);
});
