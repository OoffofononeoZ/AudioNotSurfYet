import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
    queuePickerData,
    savedPickerEntries,
} from '../support/file-picker';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_FILE = path.join(
    REPOSITORY_ROOT,
    'tests/fixtures/audio/format-master.wav',
);

const captureBrowserIssues = (page: Page): string[] => {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
    return issues;
};

const openVisualizer = async (page: Page) => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [AUDIO_FILE]);
    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 20_000,
    });
    const trackId = await musicBar.getAttribute('data-current-track-id');
    expect(trackId).toBeTruthy();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page).toHaveURL(new RegExp(`/visualizer/${trackId}$`));
    await expect(page.getByTestId('visualizer-ready')).toBeVisible({
        timeout: 20_000,
    });
    return trackId!;
};

test('opens the current track, pauses at end and restores the V1 draft', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    const trackId = await openVisualizer(page);
    await expect(page.locator('#music-bar-container')).toHaveCount(0);
    await expect(page.getByTestId('visualizer-ended-policy')).toHaveText('播完暂停');

    const seek = page.getByTestId('visualizer-seek');
    const maximum = Number(await seek.getAttribute('max'));
    await seek.evaluate((element, value) => {
        const input = element as HTMLInputElement;
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, Math.max(0, maximum - 0.08));
    await expect(page.getByTestId('visualizer-playback-toggle')).toHaveText('播放', {
        timeout: 5_000,
    });
    await expect(page.getByTestId('header-visualizer-link')).toHaveAttribute(
        'href',
        `/visualizer/${trackId}`,
    );

    await page.getByTestId('visualizer-playback-toggle').click();
    await expect(page.getByTestId('visualizer-playback-toggle')).toHaveText('暂停');
    await expect.poll(async () => Number(await seek.inputValue())).toBeLessThan(1);

    await page.getByTestId('visualizer-frame-rate').selectOption('60');
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const exported = (await savedPickerEntries(page))[0]!;
    expect(exported.name).toBe('format-master.audiosurf-visualizer.json');
    const project = JSON.parse(
        Buffer.from(exported.base64, 'base64').toString('utf8'),
    ) as { format: string; output: { frameRate: number }; scene: { templateId: string } };
    expect(project).toMatchObject({
        format: 'audiosurf-visualizer',
        output: { frameRate: 60 },
        scene: { templateId: 'orthogonal-lines' },
    });

    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('草稿已恢复', { exact: true })).toBeVisible();
    await expect(page.getByTestId('visualizer-frame-rate')).toHaveValue('60');
    await expect(page.getByTestId('visualizer-playback-toggle')).toHaveText('播放');
    await expect(page.locator('#music-bar-container')).toHaveCount(0);
    expect(issues).toEqual([]);
});

test('keeps one 16:9 Canvas across full desktop and mutually exclusive drawers', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await openVisualizer(page);

    for (const width of [1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        const grid = page.locator('.workspace-grid');
        const columns = await grid.evaluate((element) =>
            getComputedStyle(element).gridTemplateColumns);
        const values = columns.split(' ').map((value) => Number.parseFloat(value));
        expect(values[0]).toBeCloseTo(220, 0);
        expect(values.at(-1)).toBeCloseTo(336, 0);
        await expect(page.getByTestId('visualizer-template-panel')).toBeVisible();
        await expect(page.getByTestId('visualizer-settings-panel')).toBeVisible();
        const geometry = await page.getByTestId('visualizer-preview-canvas').evaluate(
            (canvas) => {
                const element = canvas as HTMLCanvasElement;
                const rect = element.getBoundingClientRect();
                return {
                    ratio: rect.width / rect.height,
                    canvasCount: document.querySelectorAll('[data-testid="visualizer-preview-canvas"]').length,
                    backingWidth: element.width,
                    cssWidth: rect.width,
                    dpr: window.devicePixelRatio,
                };
            },
        );
        expect(geometry.ratio).toBeCloseTo(16 / 9, 2);
        expect(geometry.canvasCount).toBe(1);
        expect(geometry.backingWidth).toBeCloseTo(
            geometry.cssWidth * geometry.dpr,
            0,
        );
    }

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByTestId('visualizer-template-panel')).toBeHidden();
    await expect(page.getByTestId('visualizer-settings-panel')).toBeHidden();
    await page.getByRole('button', { name: '场景模板' }).click();
    await expect(page.getByTestId('visualizer-template-panel')).toBeVisible();
    await page.getByRole('button', { name: '工程设置' }).click();
    await expect(page.getByTestId('visualizer-template-panel')).toBeHidden();
    await expect(page.getByTestId('visualizer-settings-panel')).toBeVisible();

    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'SELECT', 'INPUT', 'A']).toContain(focused);
    expect(issues).toEqual([]);
});

test('keeps invalid native import atomic and exposes empty/unavailable recovery states', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await openVisualizer(page);
    const initialTemplate = await page.locator('.template-button[aria-pressed="true"] strong')
        .textContent();
    await queuePickerData(page, [{
        name: 'invalid.audiosurf-visualizer.json',
        mimeType: 'application/json',
        text: '{"format":"audiosurf-visualizer","schemaVersion":99}',
    }]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByRole('alert')).toContainText('Unsupported Visualizer schema');
    await expect(page.locator('.template-button[aria-pressed="true"] strong'))
        .toHaveText(initialTemplate ?? '');

    await page.goto('/visualizer/missing-track');
    await expect(page.getByTestId('visualizer-unavailable')).toBeVisible();
    await expect(page.locator('#music-bar-container')).toBeVisible();
    await page.goto('/visualizer');
    await expect(page.getByTestId('visualizer-empty')).toBeVisible();
    await expect(page.locator('#music-bar-container')).toBeVisible();
    expect(issues).toEqual([]);
});

test('keeps the neutral V1 lifecycle to one Canvas and zero analysis Workers', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await page.addInitScript(() => {
        const runtime = window as typeof window & {
            __V1_RESOURCE_PROBE__?: {
                workersCreated: number;
                liveAnimationFrames: Set<number>;
            };
        };
        const NativeWorker = window.Worker;
        const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
        const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
        const probe = {
            workersCreated: 0,
            liveAnimationFrames: new Set<number>(),
        };
        runtime.__V1_RESOURCE_PROBE__ = probe;
        window.Worker = new Proxy(NativeWorker, {
            construct(target, args) {
                probe.workersCreated += 1;
                return Reflect.construct(target, args);
            },
        });
        window.requestAnimationFrame = (callback) => {
            let handle = 0;
            handle = nativeRequestAnimationFrame((time) => {
                probe.liveAnimationFrames.delete(handle);
                callback(time);
            });
            probe.liveAnimationFrames.add(handle);
            return handle;
        };
        window.cancelAnimationFrame = (handle) => {
            probe.liveAnimationFrames.delete(handle);
            nativeCancelAnimationFrame(handle);
        };
    });
    await openVisualizer(page);
    const toggle = page.getByTestId('visualizer-playback-toggle');
    if (await toggle.textContent() === '暂停') await toggle.click();
    await page.waitForTimeout(50);
    const baselineFrames = await page.evaluate(() => (
        window as typeof window & {
            __V1_RESOURCE_PROBE__?: { liveAnimationFrames: Set<number> };
        }
    ).__V1_RESOURCE_PROBE__!.liveAnimationFrames.size);

    for (let cycle = 0; cycle < 20; cycle += 1) {
        await expect(page.getByTestId('visualizer-preview-canvas')).toHaveCount(1);
        await page.getByRole('link', { name: 'AUDIOSURF' }).click();
        await expect(page.getByTestId('visualizer-preview-canvas')).toHaveCount(0);
        await page.getByTestId('header-visualizer-link').click();
        await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    }

    const resources = await page.evaluate(() => {
        const probe = (window as typeof window & {
            __V1_RESOURCE_PROBE__?: {
                workersCreated: number;
                liveAnimationFrames: Set<number>;
            };
        }).__V1_RESOURCE_PROBE__!;
        return {
            workersCreated: probe.workersCreated,
            liveAnimationFrames: probe.liveAnimationFrames.size,
            previewCanvases: document.querySelectorAll(
                '[data-testid="visualizer-preview-canvas"]',
            ).length,
        };
    });
    console.log(JSON.stringify({
        metric: 'v1-route-resources',
        cycles: 20,
        baselineFrames,
        ...resources,
    }));
    expect(resources.workersCreated).toBe(0);
    expect(resources.previewCanvases).toBe(1);
    expect(resources.liveAnimationFrames).toBeLessThanOrEqual(
        Math.max(1, baselineFrames),
    );
    expect(issues).toEqual([]);
});
