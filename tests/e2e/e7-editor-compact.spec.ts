import {
    expect,
    test,
    type Page,
} from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
} from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_FILE = path.join(ROOT, 'tests/fixtures/audio/format-master.wav');

const captureIssues = (page: Page) => {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => {
        issues.push(`pageerror: ${error.stack ?? error.message}`);
    });
    return issues;
};

const openEditor = async (page: Page) => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [AUDIO_FILE]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 30_000 },
    );
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#music-bar-container')).toBeVisible();
};

const selectOverlay = async (page: Page, featureId: string) => {
    await page.getByTestId('editor-overlay-menu-toggle').click();
    const menu = page.getByTestId('editor-overlay-feature-menu');
    await expect(menu).toBeVisible();
    await menu.locator(`[data-feature-id="${featureId}"]`).click();
    const panel = page.getByTestId('editor-analysis-overlay-panel');
    await expect(panel).toHaveAttribute('data-feature-id', featureId);
    await expect(panel).toHaveAttribute('data-analysis-state', 'ready', {
        timeout: 30_000,
    });
};

test('keeps the Editor workbench compact and functional across viewports', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    await page.getByTestId('add-point-lane').click();
    await page.getByTestId('add-range-lane').click();
    await expect(page.locator('.lane-card')).toHaveCount(1);
    await expect(page.locator('.range-lane-card')).toHaveCount(1);

    const desktopMetrics = await page.evaluate(() => {
        const rect = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) throw new Error(`Missing ${selector}`);
            return element.getBoundingClientRect();
        };
        const style = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) throw new Error(`Missing ${selector}`);
            return getComputedStyle(element);
        };
        const toolbar = rect('[data-testid="editor-toolbar"]');
        const waveform = rect('[data-testid="editor-timeline"]');
        const pointRow = rect('.marker-surface');
        const rangeRow = rect('.range-surface');
        const majorRadii = Array.from(
            document.querySelectorAll<HTMLElement>('[data-editor-major-region="true"]'),
        ).filter((element) => element.dataset.testid !== 'editor-ready')
            .map((element) => Number.parseFloat(getComputedStyle(element).borderRadius) || 0);
        const controlHeights = Array.from(
            document.querySelectorAll<HTMLElement>('[data-testid="editor-toolbar"] .project-actions button'),
        ).map((element) => element.getBoundingClientRect().height);
        return {
            toolbarHeight: toolbar.height,
            toolbarRadius: Number.parseFloat(style('[data-testid="editor-toolbar"]').borderRadius) || 0,
            waveformHeight: waveform.height,
            pointRowHeight: pointRow.height,
            rangeRowHeight: rangeRow.height,
            majorRadii,
            controlHeights,
            laneNameWidth: rect('.lane-meta').width,
            innerClassWidth: rect('.inner-class-cell').width,
            pagePaddingTop: Number.parseFloat(style('.editor-page').paddingTop),
        };
    });

    expect(desktopMetrics.toolbarHeight).toBe(64);
    expect(desktopMetrics.waveformHeight).toBe(88);
    expect(desktopMetrics.pointRowHeight).toBe(44);
    expect(desktopMetrics.rangeRowHeight).toBe(44);
    expect(desktopMetrics.laneNameWidth).toBe(152);
    expect(desktopMetrics.innerClassWidth).toBe(144);
    expect(desktopMetrics.toolbarRadius).toBe(0);
    expect(Math.max(...desktopMetrics.majorRadii)).toBeLessThanOrEqual(2);
    expect(Math.max(...desktopMetrics.controlHeights)).toBe(34);
    expect(desktopMetrics.pagePaddingTop).toBe(0);

    const playbackToggle = page.getByTestId('toggle-playback');
    await playbackToggle.click();
    await expect(playbackToggle).toHaveAttribute('aria-label', '播放');
    await playbackToggle.click();
    await expect(playbackToggle).toHaveAttribute('aria-label', '暂停');

    const viewportBefore = await page.getByTestId('editor-viewport-state').textContent();
    await page.getByTestId('editor-zoom-in').click();
    await expect(page.getByTestId('editor-viewport-state')).not.toHaveText(viewportBefore ?? '');
    await page.getByTestId('editor-reset-viewport').click();

    for (const viewport of [
        { width: 390, height: 844 },
        { width: 1024, height: 900 },
        { width: 1280, height: 900 },
        { width: 1920, height: 1080 },
    ]) {
        await page.setViewportSize(viewport);
        await expect(page.getByTestId('editor-ready')).toBeVisible();
        await expect(page.getByTestId('editor-timeline')).toBeVisible();
        await expect(page.getByTestId('add-point-lane')).toBeVisible();
        const responsive = await page.evaluate(() => {
            const stage = document.querySelector<HTMLElement>('[data-testid="editor-timeline"]');
            const point = document.querySelector<HTMLElement>('.marker-surface');
            const toolbar = document.querySelector<HTMLElement>('[data-testid="editor-toolbar"]');
            if (!stage || !point || !toolbar) throw new Error('Editor workbench is incomplete.');
            return {
                waveformHeight: stage.getBoundingClientRect().height,
                pointBottom: point.getBoundingClientRect().bottom,
                toolbarBottom: toolbar.getBoundingClientRect().bottom,
                bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            };
        });
        expect(responsive.waveformHeight).toBe(viewport.width < 900 ? 72 : 88);
        expect(responsive.toolbarBottom).toBeGreaterThan(viewport.width < 768 ? 64 : 12);
        expect(responsive.bodyOverflow).toBeLessThanOrEqual(1);
        if (viewport.width === 1024) {
            expect(responsive.pointBottom).toBeLessThanOrEqual(viewport.height);
        }
        await page.screenshot({
            path: testInfo.outputPath(`e7-${viewport.width}x${viewport.height}.png`),
            fullPage: false,
        });
    }

    const identity = await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        vendor: navigator.vendor,
    }));
    console.log(JSON.stringify({
        metric: 'e7-compact-workbench',
        identity,
        ...desktopMetrics,
        viewports: ['390x844', '1024x900', '1280x900', '1920x1080'],
    }));
    expect(issues).toEqual([]);
});

test('keeps the fullscreen overlay fixed, transient and pointer-through', async ({ page }) => {
    test.setTimeout(180_000);
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);
    await page.getByTestId('tempo-bpm-0').fill('100');
    await page.getByTestId('tempo-bpm-0').press('Enter');
    await page.getByTestId('add-point-lane').click();
    for (let index = 0; index < 16; index += 1) {
        await page.getByTestId('add-range-lane').click();
    }

    await expect(page.getByTestId('editor-overlay-toggle'))
        .toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('editor-overlay-feature')).toHaveCount(0);
    await page.getByTestId('editor-overlay-toggle').click();
    const firstMenu = page.getByTestId('editor-overlay-feature-menu');
    await expect(firstMenu.locator('[role="menuitemradio"]')).toHaveCount(21);
    await expect(firstMenu.locator('[role="menuitemradio"]').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(firstMenu).toHaveCount(0);

    await selectOverlay(page, 'rms');
    const backdrop = page.getByTestId('editor-overlay-backdrop');
    const panel = page.getByTestId('editor-analysis-overlay-panel');
    const staticCanvas = page.locator('.overlay-canvas.static');
    const markerSurface = page.locator('.marker-surface').first();
    await markerSurface.scrollIntoViewIfNeeded();

    const initial = await page.evaluate(() => {
        const metrics = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) throw new Error(`Missing ${selector}`);
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                position: style.position,
                pointerEvents: style.pointerEvents,
                backgroundColor: style.backgroundColor,
            };
        };
        return {
            host: metrics('[data-testid="editor-analysis-overlay-host"]'),
            backdrop: metrics('[data-testid="editor-overlay-backdrop"]'),
            panel: metrics('[data-testid="editor-analysis-overlay-panel"]'),
            controls: metrics('[data-testid="editor-overlay-controls"]'),
            canvas: metrics('.overlay-canvas.static'),
            marker: metrics('.marker-surface'),
        };
    });
    expect(initial.host).toMatchObject({
        left: 0,
        top: 0,
        width: 1280,
        height: 900,
        position: 'fixed',
        pointerEvents: 'none',
    });
    expect(initial.backdrop.backgroundColor).toBe('rgba(132, 136, 135, 0.28)');
    expect(initial.backdrop.pointerEvents).toBe('none');
    expect(initial.canvas).toMatchObject({
        left: 0,
        top: 0,
        width: 1280,
        height: 900,
        position: 'fixed',
        pointerEvents: 'none',
    });
    expect(initial.controls.left + initial.controls.width).toBe(1220);
    expect(initial.controls.top).toBe(15);
    expect(Math.abs(initial.panel.left - initial.marker.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(initial.panel.width - initial.marker.width)).toBeLessThanOrEqual(1);

    await page.locator('#editor-marking-panel').evaluate(element => element.scrollTo({ top: 420, behavior: 'instant' }));
    await expect.poll(() => page.locator('#editor-marking-panel').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const afterScroll = await page.evaluate(() => {
        const rect = (selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) throw new Error(`Missing ${selector}`);
            const value = element.getBoundingClientRect();
            return { left: value.left, top: value.top, width: value.width, height: value.height };
        };
        return {
            host: rect('[data-testid="editor-analysis-overlay-host"]'),
            panel: rect('[data-testid="editor-analysis-overlay-panel"]'),
            controls: rect('[data-testid="editor-overlay-controls"]'),
            canvas: rect('.overlay-canvas.static'),
        };
    });
    expect(afterScroll.host).toEqual({ left: 0, top: 0, width: 1280, height: 900 });
    expect(afterScroll.controls).toEqual({
        left: initial.controls.left,
        top: initial.controls.top,
        width: initial.controls.width,
        height: initial.controls.height,
    });
    expect(afterScroll.canvas).toEqual({ left: 0, top: 0, width: 1280, height: 900 });
    expect(afterScroll.panel.top).toBe(initial.panel.top);
    expect(afterScroll.panel.height).toBe(initial.panel.height);

    await page.getByTestId('header-editor-link').click();
    await markerSurface.scrollIntoViewIfNeeded();
    const markerCount = await page.locator('.point-marker').count();
    await markerSurface.click({ position: { x: 460, y: 22 } });
    await expect(page.locator('.point-marker')).toHaveCount(markerCount + 1);

    await page.getByTestId('editor-overlay-toggle').click();
    await expect(page.getByTestId('editor-overlay-toggle'))
        .toHaveAttribute('aria-pressed', 'false');
    await expect(panel).toHaveCount(0);
    await expect(backdrop).toHaveCount(0);
    await expect(staticCanvas).toHaveCount(0);
    await expect(page.locator('.overlay-handle')).toHaveCount(0);

    await page.getByTestId('editor-overlay-toggle').click();
    await expect(panel).toHaveAttribute('data-feature-id', 'rms');
    await page.reload();
    await expect(page.getByTestId('editor-overlay-toggle'))
        .toHaveAttribute('aria-pressed', 'true', { timeout: 30_000 });
    await expect(page.getByTestId('editor-analysis-overlay-panel'))
        .toHaveAttribute('data-feature-id', 'rms');

    console.log(JSON.stringify({
        metric: 'e7-fullscreen-overlay',
        viewport: '1280x900',
        geometryErrorCssPx: Math.max(
            Math.abs(initial.panel.left - initial.marker.left),
            Math.abs(initial.panel.width - initial.marker.width),
        ),
        fixedAfterScroll: true,
        featureCount: 21,
    }));
    expect(issues).toEqual([]);
});
