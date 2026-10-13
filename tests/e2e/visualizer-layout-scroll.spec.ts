import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
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

const openVisualizer = async (page: Page): Promise<void> => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [AUDIO_FILE]);
    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 20_000,
    });
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible({
        timeout: 20_000,
    });
};

const readScrollbarStyle = (locator: Locator) => locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
        className: element.className,
        color: style.scrollbarColor,
        gutter: style.scrollbarGutter,
        hoverToken: style.getPropertyValue('--app-scrollbar-thumb-hover').trim(),
        width: style.scrollbarWidth,
        webkitWidth: getComputedStyle(element, '::-webkit-scrollbar').width,
        track: getComputedStyle(element, '::-webkit-scrollbar-track').backgroundColor,
        thumb: getComputedStyle(element, '::-webkit-scrollbar-thumb').backgroundColor,
    };
});

test('keeps the supported Visualizer workspace inside one viewport', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureBrowserIssues(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openVisualizer(page);

    for (const viewport of [
        { width: 1024, height: 720 },
        { width: 1280, height: 720 },
        { width: 1280, height: 900 },
        { width: 1920, height: 1080 },
    ]) {
        await page.setViewportSize(viewport);
        await page.evaluate(() => new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }));

        const compact = await page.getByRole('button', { name: '工程设置', exact: true }).isVisible();
        if (compact) {
            await page.getByRole('button', { name: '工程设置' }).click();
            await expect(page.getByTestId('visualizer-settings-panel')).toBeVisible();
        }

        const geometry = await page.evaluate(() => {
            const rect = (selector: string) => document.querySelector<HTMLElement>(selector)!
                .getBoundingClientRect();
            const pageRect = rect('[data-testid="visualizer-page"]');
            const workspaceRect = rect('[data-testid="visualizer-ready"]');
            const gridRect = rect('.workspace-grid');
            const recordingRect = rect('.recording-bar');
            const transportRect = rect('.transport');
            const canvas = document.querySelector<HTMLCanvasElement>(
                '[data-testid="visualizer-preview-canvas"]',
            )!;
            const canvasRect = canvas.getBoundingClientRect();
            const diagnostics = window.__VISUALIZER_DIAGNOSTICS__;
            return {
                viewportHeight: window.innerHeight,
                windowScrollY: window.scrollY,
                documentHeight: document.documentElement.scrollHeight,
                bodyHeight: document.body.scrollHeight,
                pageTop: pageRect.top,
                pageBottom: pageRect.bottom,
                workspaceTop: workspaceRect.top,
                workspaceBottom: workspaceRect.bottom,
                gridTop: gridRect.top,
                gridBottom: gridRect.bottom,
                recordingTop: recordingRect.top,
                recordingBottom: recordingRect.bottom,
                transportTop: transportRect.top,
                canvasRatio: canvasRect.width / canvasRect.height,
                canvasCount: document.querySelectorAll(
                    '[data-testid="visualizer-preview-canvas"]',
                ).length,
                activeHosts: diagnostics?.activeHosts,
                activeRenderers: diagnostics?.activeRenderers,
                activeVisualAnimationFrames: diagnostics?.activeVisualAnimationFrames,
                devicePixelRatio: window.devicePixelRatio,
                renderDpr: Number(canvas.dataset.renderDpr),
            };
        });

        expect(geometry.windowScrollY).toBe(0);
        expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.viewportHeight);
        expect(geometry.bodyHeight).toBeLessThanOrEqual(geometry.viewportHeight);
        expect(geometry.pageTop).toBe(0);
        expect(geometry.pageBottom).toBeLessThanOrEqual(geometry.viewportHeight);
        expect(geometry.workspaceTop).toBeGreaterThanOrEqual(12);
        expect(geometry.workspaceBottom).toBeLessThanOrEqual(geometry.viewportHeight);
        expect(geometry.gridTop).toBeLessThan(geometry.gridBottom);
        expect(geometry.gridBottom).toBeLessThanOrEqual(geometry.recordingTop + 1);
        expect(geometry.recordingBottom).toBeLessThanOrEqual(geometry.transportTop + 1);
        expect(geometry.canvasRatio).toBeCloseTo(16 / 9, 2);
        expect(geometry.canvasCount).toBe(1);
        expect(geometry.activeHosts).toBe(1);
        expect(geometry.activeRenderers).toBe(1);
        expect(geometry.activeVisualAnimationFrames).toBeLessThanOrEqual(1);
        expect(geometry.renderDpr).toBe(geometry.devicePixelRatio);

        if (compact) {
            const containment = await page.evaluate(() => {
                const panel = document.querySelector<HTMLElement>(
                    '[data-testid="visualizer-settings-panel"]',
                )!.getBoundingClientRect();
                const grid = document.querySelector<HTMLElement>('.workspace-grid')!
                    .getBoundingClientRect();
                const recording = document.querySelector<HTMLElement>('.recording-bar')!
                    .getBoundingClientRect();
                const transport = document.querySelector<HTMLElement>('.transport')!
                    .getBoundingClientRect();
                return {
                    insideGrid: panel.top >= grid.top - 1
                        && panel.bottom <= grid.bottom + 1,
                    aboveRecording: panel.bottom <= recording.top + 1,
                    aboveTransport: panel.bottom <= transport.top + 1,
                };
            });
            expect(containment).toEqual({
                insideGrid: true,
                aboveRecording: true,
                aboveTransport: true,
            });
            await page.locator('.drawer-close').filter({ visible: true }).click();
        }
    }

    await page.evaluate(() => {
        Object.defineProperty(window, 'devicePixelRatio', {
            configurable: true,
            value: 2,
        });
    });
    await page.setViewportSize({ width: 1279, height: 900 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('visualizer-preview-canvas'))
        .toHaveAttribute('data-render-dpr', '2');
    const highDprGeometry = await page.evaluate(() => ({
        bodyHeight: document.body.scrollHeight,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        windowScrollY: window.scrollY,
    }));
    expect(highDprGeometry.bodyHeight)
        .toBeLessThanOrEqual(highDprGeometry.viewportHeight);
    expect(highDprGeometry.documentHeight)
        .toBeLessThanOrEqual(highDprGeometry.viewportHeight);
    expect(highDprGeometry.windowScrollY).toBe(0);

    const startRecording = page.getByTestId('start-visualizer-recording');
    await startRecording.focus();
    await expect(startRecording).toBeFocused();
    expect(issues).toEqual([]);
});

test('isolates both panel scroll positions and reuses the Analyzer scrollbar contract', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureBrowserIssues(page);
    await page.setViewportSize({ width: 1920, height: 900 });
    await openVisualizer(page);

    const templates = page.getByTestId('visualizer-template-panel');
    const settings = page.getByTestId('visualizer-settings-panel');
    await page.evaluate(() => {
        for (const selector of [
            '[data-testid="visualizer-template-panel"]',
            '[data-testid="visualizer-settings-panel"]',
        ]) {
            const panel = document.querySelector<HTMLElement>(selector)!;
            const spacer = document.createElement('div');
            spacer.dataset.testScrollSpacer = 'true';
            spacer.style.height = '1600px';
            spacer.style.pointerEvents = 'none';
            panel.append(spacer);
            panel.scrollTop = 0;
        }
        window.scrollTo(0, 0);
    });

    const templateStyle = await readScrollbarStyle(templates);
    const settingsStyle = await readScrollbarStyle(settings);
    const { className: templateClassName, ...templateContract } = templateStyle;
    const { className: settingsClassName, ...settingsContract } = settingsStyle;
    expect(templateContract).toEqual(settingsContract);
    expect(templateClassName).toContain('app-scrollbar');
    expect(settingsClassName).toContain('app-scrollbar');
    expect(templateStyle.color).toBe(
        'rgba(125, 255, 179, 0.65) rgba(5, 17, 11, 0.9)',
    );
    expect(templateStyle.gutter).toContain('stable');
    expect(templateStyle.width).toBe('thin');
    expect(templateStyle.webkitWidth).toBe('10px');
    expect(templateStyle.track).toBe('rgba(5, 17, 11, 0.9)');
    expect(templateStyle.thumb).toBe('rgba(125, 255, 179, 0.58)');
    expect(templateStyle.hoverToken).toBe('rgba(181, 255, 210, 0.82)');

    await settings.hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(async () => settings.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    const afterSettings = await page.evaluate(() => ({
        window: window.scrollY,
        templates: document.querySelector<HTMLElement>(
            '[data-testid="visualizer-template-panel"]',
        )!.scrollTop,
        settings: document.querySelector<HTMLElement>(
            '[data-testid="visualizer-settings-panel"]',
        )!.scrollTop,
    }));
    expect(afterSettings.window).toBe(0);
    expect(afterSettings.templates).toBe(0);
    expect(afterSettings.settings).toBeGreaterThan(0);

    const settingsBeforeTemplateScroll = afterSettings.settings;
    await templates.hover();
    await page.mouse.wheel(0, 600);
    await expect.poll(async () => templates.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
    const afterTemplates = await page.evaluate(() => ({
        window: window.scrollY,
        settings: document.querySelector<HTMLElement>(
            '[data-testid="visualizer-settings-panel"]',
        )!.scrollTop,
    }));
    expect(afterTemplates.window).toBe(0);
    expect(afterTemplates.settings).toBe(settingsBeforeTemplateScroll);

    await settings.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    await settings.hover();
    await page.mouse.wheel(0, 1_200);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.evaluate(() => {
        document.querySelectorAll('[data-test-scroll-spacer="true"]')
            .forEach((element) => element.remove());
    });
    expect(issues).toEqual([]);
});

test('switches drawers and columns with sidebar width while retaining the preview canvas', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openVisualizer(page);
    const drawerButton = page.getByRole('button', { name: '工程设置', exact: true });
    await expect(drawerButton).toBeVisible();
    await page.getByTestId('visualizer-preview-canvas').evaluate(element => {
        (window as typeof window & { __shellCanvas?: Element }).__shellCanvas = element;
    });
    for (const collapsed of [true, false, true]) {
        await page.getByTestId('sidebar-toggle').click();
        await expect(page.locator('#app-sidebar')).toHaveAttribute('data-collapsed', String(collapsed));
        if (collapsed) {
            await expect(drawerButton).not.toBeVisible();
            await expect(page.getByTestId('visualizer-template-panel')).toBeVisible();
            await expect(page.getByTestId('visualizer-settings-panel')).toBeVisible();
        } else await expect(drawerButton).toBeVisible();
        const resource = await page.getByTestId('visualizer-preview-canvas').evaluate(element => ({
            sameCanvas: (window as typeof window & { __shellCanvas?: Element }).__shellCanvas === element,
            hosts: window.__VISUALIZER_DIAGNOSTICS__?.activeHosts,
            renderers: window.__VISUALIZER_DIAGNOSTICS__?.activeRenderers,
        }));
        expect(resource).toEqual({ sameCanvas: true, hosts: 1, renderers: 1 });
    }
    expect(issues).toEqual([]);
});
