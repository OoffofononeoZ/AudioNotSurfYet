import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/audio/format-master.wav');

const captureIssues = (page: Page): string[] => {
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
    await chooseFiles(page, [FIXTURE]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 30_000 },
    );
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('editor-buffer-state')).toHaveText('波形已就绪', {
        timeout: 30_000,
    });
    await page.getByTestId('editor-playback-toggle').click();
    await page.getByTestId('tempo-bpm-0').fill('100');
    await page.getByTestId('tempo-bpm-0').press('Enter');
};

const seekAndAddBoundary = async (page: Page, ratio: number) => {
    const stage = page.getByTestId('editor-timeline');
    const bounds = await stage.boundingBox();
    expect(bounds).toBeTruthy();
    await stage.click({ position: { x: bounds!.width * ratio, y: bounds!.height / 2 } });
    await page.getByTestId('add-tempo-boundary').click();
};

const installLifecycleProbe = async (page: Page) => {
    await page.addInitScript(() => {
        const counters = {
            resizeObserversCreated: 0,
            resizeObserversLive: 0,
        };
        (
            window as typeof window & {
                __e9Resources?: typeof counters;
            }
        ).__e9Resources = counters;
        const NativeResizeObserver = window.ResizeObserver;
        window.ResizeObserver = new Proxy(NativeResizeObserver, {
            construct(Target, args) {
                const observer = Reflect.construct(Target, args) as ResizeObserver;
                counters.resizeObserversCreated += 1;
                counters.resizeObserversLive += 1;
                const disconnect = observer.disconnect.bind(observer);
                let disconnected = false;
                observer.disconnect = () => {
                    if (!disconnected) {
                        disconnected = true;
                        counters.resizeObserversLive -= 1;
                    }
                    disconnect();
                };
                return observer;
            },
        });
    });
};

const probeSharedGeometry = async (
    page: Page,
    width: number,
    expectedDpr: number,
) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const panel = page.locator('[aria-label="Editor 时间轴"]');
    await expect(page.getByTestId('editor-tempo-lane')).toBeVisible();
    await panel.evaluate((element, shouldScroll) => {
        element.scrollLeft = shouldScroll ? 120 : 0;
    }, width === 390);
    await expect.poll(async () => panel.evaluate((element) => element.scrollLeft))
        .toBe(width === 390 ? 120 : 0);
    await expect.poll(async () => page.locator('canvas.timeline-canvas').first().evaluate(
        (element) => (element as HTMLCanvasElement).width
            / Math.max(1, element.getBoundingClientRect().width),
    )).toBeCloseTo(expectedDpr, 1);

    return page.evaluate(() => {
        const panelElement = document.querySelector<HTMLElement>('[aria-label="Editor 时间轴"]');
        const waveform = document.querySelector<HTMLElement>('[data-testid="editor-timeline"]');
        const lane = document.querySelector<HTMLElement>('[data-testid="editor-tempo-lane"]');
        const boundary = document.querySelector<HTMLElement>('button[data-testid^="tempo-boundary-"]');
        const status = document.querySelector<HTMLElement>('.timeline-status');
        const boundaryTime = boundary?.dataset.timeSeconds;
        const guide = boundaryTime
            ? document.querySelector<HTMLElement>(`.tempo-boundary-guide[data-time-seconds="${boundaryTime}"]`)
            : null;
        const caret = boundary?.querySelector<HTMLElement>('.boundary-caret');
        if (!panelElement || !waveform || !lane || !boundary || !status || !guide || !caret) {
            throw new Error('E9 shared geometry is incomplete.');
        }
        const waveformBounds = waveform.getBoundingClientRect();
        const laneBounds = lane.getBoundingClientRect();
        const boundaryBounds = boundary.getBoundingClientRect();
        const statusBounds = status.getBoundingClientRect();
        const guideBounds = guide.getBoundingClientRect();
        const caretBounds = caret.getBoundingClientRect();
        const percent = Number.parseFloat(boundary.style.left) / 100;
        return {
            viewportWidth: innerWidth,
            dpr: devicePixelRatio,
            leftError: Math.abs(waveformBounds.left - laneBounds.left),
            widthError: Math.abs(waveformBounds.width - laneBounds.width),
            boundaryError: Math.abs(
                boundaryBounds.left + boundaryBounds.width / 2
                - (laneBounds.left + laneBounds.width * percent),
            ),
            panelScrollLeft: panelElement.scrollLeft,
            panelOverflowX: getComputedStyle(panelElement).overflowX,
            panelScrollbarWidth: getComputedStyle(panelElement).scrollbarWidth,
            tempoScrollLeft: lane.scrollLeft,
            tempoOverflowX: getComputedStyle(lane).overflowX,
            fixedBoundaryCount: lane.querySelectorAll('.tempo-lane-boundary--fixed').length,
            stripHeight: laneBounds.height,
            statusHeight: statusBounds.height,
            waveformGap: Math.abs(laneBounds.top - waveformBounds.bottom),
            guideWidth: guideBounds.width,
            guideHeight: guideBounds.height,
            guideBottomError: Math.abs(guideBounds.bottom - waveformBounds.bottom),
            caretGap: Math.abs(caretBounds.top - waveformBounds.bottom),
            duplicateTempoRailCount: document.querySelectorAll(
                '.tempo-row, .tempo-track-rail, .tempo-class-rail',
            ).length,
        };
    });
};

test('shares waveform geometry and switches tempo content without wrapping', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);

    const firstSegment = page.getByTestId('tempo-segment-0');
    await expect(firstSegment).toHaveAttribute('data-presentation', 'full');
    await page.getByTestId('editor-timeline').focus();
    const compactControls = await page.evaluate(() => {
        const bpm = document.querySelector<HTMLElement>('[data-testid="tempo-bpm-0"]');
        const numerator = document.querySelector<HTMLElement>('.tempo-meter-numerator');
        const denominator = document.querySelector<HTMLElement>('.tempo-meter-denominator');
        const segment = document.querySelector<HTMLElement>('[data-testid="tempo-segment-0"]');
        if (!bpm || !numerator || !denominator || !segment) {
            throw new Error('E9 compact controls are incomplete.');
        }
        const bpmStyle = getComputedStyle(bpm);
        const controls = [bpm, numerator, denominator].map((control) =>
            control.getBoundingClientRect());
        return {
            fontSize: bpmStyle.fontSize,
            height: controls[0]!.height,
            baselineError: Math.max(...controls.map((bounds) => bounds.top))
                - Math.min(...controls.map((bounds) => bounds.top)),
            background: bpmStyle.backgroundColor,
            borderTop: bpmStyle.borderTopWidth,
            borderRight: bpmStyle.borderRightWidth,
            borderBottomColor: bpmStyle.borderBottomColor,
            sourceVisible: document.querySelectorAll('.tempo-source').length,
            accessibleSource: segment.getAttribute('aria-label'),
        };
    });
    expect(compactControls).toMatchObject({
        fontSize: '11px',
        height: 18,
        baselineError: 0,
        background: 'rgba(0, 0, 0, 0)',
        borderTop: '0px',
        borderRight: '0px',
        borderBottomColor: 'rgba(0, 0, 0, 0)',
        sourceVisible: 0,
    });
    expect(compactControls.accessibleSource).toContain('用户输入');
    await page.getByTestId('tempo-bpm-0').focus();
    await expect.poll(async () => page.getByTestId('tempo-bpm-0').evaluate(
        (element) => getComputedStyle(element).borderBottomColor,
    )).toBe('rgb(101, 255, 169)');
    await page.getByTestId('editor-timeline').focus();

    await seekAndAddBoundary(page, 0.25);
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(firstSegment).toHaveAttribute('data-presentation', 'summary');
    await seekAndAddBoundary(page, 0.28);
    await expect(page.locator('[data-presentation="hidden"]')).toHaveCount(1);

    const geometry = await page.evaluate(() => {
        const waveform = document.querySelector<HTMLElement>('[data-testid="editor-timeline"]');
        const lane = document.querySelector<HTMLElement>('[data-testid="editor-tempo-lane"]');
        const boundary = document.querySelector<HTMLElement>('button[data-testid^="tempo-boundary-"]');
        const summary = document.querySelector<HTMLElement>('.tempo-segment-summary');
        const guide = boundary?.dataset.timeSeconds
            ? document.querySelector<HTMLElement>(`.tempo-boundary-guide[data-time-seconds="${boundary.dataset.timeSeconds}"]`)
            : null;
        const caret = boundary?.querySelector<HTMLElement>('.boundary-caret');
        const status = document.querySelector<HTMLElement>('.timeline-status');
        if (!waveform || !lane || !boundary || !summary || !guide || !caret || !status) {
            throw new Error('E9 tempo geometry is incomplete.');
        }
        const waveformBounds = waveform.getBoundingClientRect();
        const laneBounds = lane.getBoundingClientRect();
        const boundaryBounds = boundary.getBoundingClientRect();
        const guideBounds = guide.getBoundingClientRect();
        const caretBounds = caret.getBoundingClientRect();
        const percent = Number.parseFloat(boundary.style.left) / 100;
        const expectedX = laneBounds.left + laneBounds.width * percent;
        return {
            leftError: Math.abs(waveformBounds.left - laneBounds.left),
            widthError: Math.abs(waveformBounds.width - laneBounds.width),
            boundaryError: Math.abs(
                boundaryBounds.left + boundaryBounds.width / 2 - expectedX,
            ),
            summaryWraps: summary.scrollHeight > summary.clientHeight,
            tempoOverflowX: getComputedStyle(lane).overflowX,
            tempoScrollLeft: lane.scrollLeft,
            panelHasScrollbar: document.querySelector('[aria-label="Editor 时间轴"]')
                ?.classList.contains('app-scrollbar') ?? false,
            stripHeight: laneBounds.height,
            statusHeight: status.getBoundingClientRect().height,
            waveformGap: Math.abs(laneBounds.top - waveformBounds.bottom),
            guideWidth: guideBounds.width,
            guideHeight: guideBounds.height,
            guideBottomError: Math.abs(guideBounds.bottom - waveformBounds.bottom),
            caretGap: Math.abs(caretBounds.top - waveformBounds.bottom),
            duplicateTempoRailCount: document.querySelectorAll(
                '.tempo-row, .tempo-track-rail, .tempo-class-rail',
            ).length,
        };
    });
    expect(Math.max(geometry.leftError, geometry.widthError, geometry.boundaryError))
        .toBeLessThanOrEqual(1);
    expect(geometry.summaryWraps).toBe(false);
    expect(geometry.tempoOverflowX).toBe('hidden');
    expect(geometry.tempoScrollLeft).toBe(0);
    expect(geometry.panelHasScrollbar).toBe(true);
    expect(geometry).toMatchObject({
        stripHeight: 28,
        statusHeight: 28,
        guideWidth: 1,
        guideHeight: 12,
        duplicateTempoRailCount: 0,
    });
    expect(Math.max(
        geometry.waveformGap,
        geometry.guideBottomError,
        geometry.caretGap,
    )).toBeLessThanOrEqual(1);

    const responsiveMetrics = [];
    for (const width of [390, 1_024, 1_280, 1_920]) {
        const metric = await probeSharedGeometry(page, width, 1);
        expect(Math.max(metric.leftError, metric.widthError, metric.boundaryError))
            .toBeLessThanOrEqual(1);
        expect(metric.tempoScrollLeft).toBe(0);
        expect(metric.tempoOverflowX).toBe('hidden');
        expect(metric.fixedBoundaryCount).toBe(2);
        expect(metric.panelScrollbarWidth).toBe('thin');
        expect(metric).toMatchObject({
            stripHeight: 28,
            statusHeight: 28,
            guideWidth: 1,
            guideHeight: 12,
            duplicateTempoRailCount: 0,
        });
        expect(Math.max(metric.waveformGap, metric.guideBottomError, metric.caretGap))
            .toBeLessThanOrEqual(1);
        if (width === 390) {
            expect(metric.panelOverflowX).toBe('auto');
            expect(metric.panelScrollLeft).toBe(120);
        }
        responsiveMetrics.push(metric);
    }
    console.log(JSON.stringify({
        metric: 'e9-shared-tempo-geometry',
        deviceScaleFactor: 1,
        viewports: responsiveMetrics,
    }));

    await page.getByTestId('editor-zoom-in').click();
    await page.getByTestId('editor-zoom-in').click();
    await page.getByTestId('editor-zoom-in').click();
    await page.getByTestId('editor-zoom-in').click();
    await page.getByTestId('editor-zoom-in').click();
    await page.getByTestId('editor-pan-forward').click();
    await page.getByTestId('editor-pan-forward').click();
    await page.getByTestId('editor-zoom-in').click();
    await expect.poll(async () => page.locator('[data-presentation="full"]').count())
        .toBeGreaterThan(0);
    expect(issues).toEqual([]);
});

test('deletes internal boundaries and applies the marker polish contract', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureIssues(page);
    await installLifecycleProbe(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);
    await seekAndAddBoundary(page, 0.5);
    await expect(page.locator('button[data-testid^="tempo-boundary-"]')).toHaveCount(1);
    const internal = page.locator('button[data-testid^="tempo-boundary-"]').first();
    await page.getByTestId('editor-zoom-in').click();
    await page.getByTestId('editor-pan-forward').click();
    await page.getByTestId('tempo-bpm-1').fill('301');
    await page.getByTestId('tempo-bpm-1').blur();
    await expect(page.getByTestId('tempo-bpm-1')).toHaveAttribute('aria-invalid', 'true');
    await internal.click({ button: 'right' });
    await expect(page.locator('.tempo-segment')).toHaveCount(1);
    await expect(page.locator('[id^="tempo-error-"]')).toHaveCount(0);
    await expect(page.getByTestId('tempo-live-message')).toContainText('前一区间已向右延伸');

    await seekAndAddBoundary(page, 0.65);
    const keyboardBoundary = page.locator('button[data-testid^="tempo-boundary-"]').first();
    await keyboardBoundary.focus();
    expect(await keyboardBoundary.evaluate((element) => document.activeElement === element))
        .toBe(true);
    await keyboardBoundary.press('Delete');
    await expect(page.locator('.tempo-segment')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('.tempo-segment')).toHaveCount(1, { timeout: 30_000 });

    await page.getByTestId('add-point-lane').click();
    const lane = page.locator('[data-testid^="point-lane-"]').first();
    const addClass = lane.locator('[data-testid^="add-inner-class-"]');
    const surface = lane.locator('[data-testid^="marker-surface-"]').first();
    await surface.scrollIntoViewIfNeeded();
    const surfaceBounds = await surface.boundingBox();
    expect(surfaceBounds).toBeTruthy();
    await surface.hover({ position: { x: surfaceBounds!.width / 2, y: 20 } });
    await expect(lane.locator('.point-candidate')).toBeVisible();

    const polish = await page.evaluate(() => {
        const button = document.querySelector<HTMLElement>('[data-testid^="add-inner-class-"]');
        const candidate = document.querySelector<HTMLElement>('.point-candidate');
        const timeline = document.querySelector<HTMLElement>('[aria-label="Editor 时间轴"]');
        const points = document.querySelector<HTMLElement>('[data-testid="editor-point-workspace"]');
        if (!button || !candidate || !timeline || !points) {
            throw new Error('E9 polish geometry is incomplete.');
        }
        const buttonStyle = getComputedStyle(button);
        const candidateStyle = getComputedStyle(candidate);
        const timelineBounds = timeline.getBoundingClientRect();
        const pointBounds = points.getBoundingClientRect();
        return {
            buttonDisplay: buttonStyle.display,
            buttonAlign: buttonStyle.alignItems,
            buttonJustify: buttonStyle.justifyContent,
            candidateWidth: candidate.getBoundingClientRect().width,
            candidateBackground: candidateStyle.backgroundColor,
            candidateBorder: candidateStyle.borderTopWidth,
            candidateRadius: candidateStyle.borderRadius,
            candidateShadow: candidateStyle.boxShadow,
            dividerGap: Math.abs(pointBounds.top - timelineBounds.bottom),
            timelineBottom: getComputedStyle(timeline).borderBottomWidth,
            pointTop: getComputedStyle(points).borderTopWidth,
            pointScrollbar: points.classList.contains('app-scrollbar'),
        };
    });
    expect(addClass).toBeVisible();
    expect(polish).toMatchObject({
        buttonDisplay: 'flex',
        buttonAlign: 'center',
        buttonJustify: 'center',
        candidateWidth: 3,
        candidateBackground: 'rgb(101, 255, 169)',
        candidateBorder: '0px',
        candidateRadius: '0px',
        candidateShadow: 'none',
        timelineBottom: '1px',
        pointTop: '0px',
        pointScrollbar: true,
    });
    expect(polish.dividerGap).toBeLessThanOrEqual(1);

    const lifecycle: Array<{
        resizeObserversCreated?: number;
        resizeObserversLive?: number;
        canvasLive: number;
    }> = [];
    for (let cycle = 0; cycle < 10; cycle += 1) {
        await page.getByRole('link', { name: 'Analyzer' }).click();
        const leaveEditor = page.getByRole('button', { name: '仍然离开' });
        if (await leaveEditor.isVisible()) await leaveEditor.click();
        await expect(page).toHaveURL(/\/analyzer$/);
        await page.getByTestId('header-editor-link').click();
        await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30_000 });
        lifecycle.push(await page.evaluate(() => ({
            ...(
                window as typeof window & {
                    __e9Resources?: Record<string, number>;
                }
            ).__e9Resources,
            canvasLive: document.querySelectorAll('canvas').length,
        })));
    }
    const liveObservers = lifecycle.map((sample) => sample.resizeObserversLive ?? 0);
    const liveCanvases = lifecycle.map((sample) => sample.canvasLive);
    expect(Math.max(...liveObservers) - Math.min(...liveObservers)).toBeLessThanOrEqual(1);
    expect(Math.max(...liveCanvases) - Math.min(...liveCanvases)).toBeLessThanOrEqual(1);
    console.log(JSON.stringify({
        metric: 'e9-route-resources',
        cycles: lifecycle.length,
        reducedMotion: true,
        final: lifecycle.at(-1),
        observerRange: [Math.min(...liveObservers), Math.max(...liveObservers)],
        canvasRange: [Math.min(...liveCanvases), Math.max(...liveCanvases)],
    }));
    expect(issues).toEqual([]);
});

test.describe('DPR 2 shared geometry', () => {
    test.use({ deviceScaleFactor: 2 });

    test('keeps the waveform and BPM lane aligned across the viewport matrix', async ({ page }) => {
        test.setTimeout(120_000);
        const issues = captureIssues(page);
        await page.setViewportSize({ width: 1_280, height: 900 });
        await openEditor(page);
        await seekAndAddBoundary(page, 0.5);
        const metrics = [];
        for (const width of [390, 1_024, 1_280, 1_920]) {
            const metric = await probeSharedGeometry(page, width, 2);
            expect(Math.max(metric.leftError, metric.widthError, metric.boundaryError))
                .toBeLessThanOrEqual(1);
            expect(metric.dpr).toBe(2);
            expect(metric.tempoScrollLeft).toBe(0);
            expect(metric.fixedBoundaryCount).toBe(2);
            expect(metric).toMatchObject({
                stripHeight: 28,
                statusHeight: 28,
                guideWidth: 1,
                guideHeight: 12,
                duplicateTempoRailCount: 0,
            });
            expect(Math.max(metric.waveformGap, metric.guideBottomError, metric.caretGap))
                .toBeLessThanOrEqual(1);
            metrics.push(metric);
        }
        console.log(JSON.stringify({
            metric: 'e9-shared-tempo-geometry',
            deviceScaleFactor: 2,
            viewports: metrics,
        }));
        expect(issues).toEqual([]);
    });
});
