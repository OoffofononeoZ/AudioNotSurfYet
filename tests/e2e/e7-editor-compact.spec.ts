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
    await expect(page.locator('#music-bar-container')).toHaveCount(0);
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
        const toolbar = rect('[data-testid="editor-ready"]');
        const waveform = rect('[data-testid="editor-timeline"]');
        const pointRow = rect('.marker-surface');
        const rangeRow = rect('.range-surface');
        const majorRadii = Array.from(
            document.querySelectorAll<HTMLElement>('[data-editor-major-region="true"]'),
        ).map((element) => Number.parseFloat(getComputedStyle(element).borderRadius) || 0);
        const controlHeights = Array.from(
            document.querySelectorAll<HTMLElement>('[data-testid="editor-ready"] button, [data-testid="editor-ready"] select'),
        ).map((element) => element.getBoundingClientRect().height);
        return {
            toolbarHeight: toolbar.height,
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

    expect(desktopMetrics.toolbarHeight).toBeLessThanOrEqual(84);
    expect(desktopMetrics.waveformHeight).toBe(176);
    expect(desktopMetrics.pointRowHeight).toBe(44);
    expect(desktopMetrics.rangeRowHeight).toBe(44);
    expect(desktopMetrics.laneNameWidth).toBe(152);
    expect(desktopMetrics.innerClassWidth).toBe(144);
    expect(Math.max(...desktopMetrics.majorRadii)).toBeLessThanOrEqual(2);
    expect(Math.max(...desktopMetrics.controlHeights)).toBeLessThanOrEqual(30.5);
    expect(desktopMetrics.pagePaddingTop).toBe(72);

    const playbackToggle = page.getByTestId('editor-playback-toggle');
    await playbackToggle.click();
    await expect(playbackToggle).toHaveText('播放');
    await playbackToggle.click();
    await expect(playbackToggle).toHaveText('暂停');

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
            const toolbar = document.querySelector<HTMLElement>('[data-testid="editor-ready"]');
            if (!stage || !point || !toolbar) throw new Error('Editor workbench is incomplete.');
            return {
                waveformHeight: stage.getBoundingClientRect().height,
                pointBottom: point.getBoundingClientRect().bottom,
                toolbarBottom: toolbar.getBoundingClientRect().bottom,
                bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            };
        });
        expect(responsive.waveformHeight).toBe(viewport.width < 900 ? 144 : 176);
        expect(responsive.toolbarBottom).toBeGreaterThan(72);
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
