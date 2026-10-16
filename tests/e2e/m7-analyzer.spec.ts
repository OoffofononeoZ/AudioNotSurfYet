import {
    expect,
    test,
    type Page,
} from '@playwright/test';
import {
    mkdir,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
} from '../support/file-picker';
import {
    createM7LearningPcm,
    encodeMonoWav,
} from '../support/m7-learning-fixture';
import { expectAnalyzerList, readAnalyzerViewport, zoomAnalyzer } from '../support/analyzer-list';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const LEARNING_WAV_FIXTURE = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/m7-learning-v1.wav',
);

test.beforeAll(async () => {
    await mkdir(path.dirname(LEARNING_WAV_FIXTURE), { recursive: true });
    await writeFile(
        LEARNING_WAV_FIXTURE,
        encodeMonoWav(createM7LearningPcm()),
    );
});

const captureBrowserIssues = (page: Page): string[] => {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => {
        issues.push(`pageerror: ${error.message}`);
    });
    return issues;
};

const installCursorRequestCounters = async (page: Page) => {
    await page.addInitScript(() => {
        const target = window as typeof window & {
            __m7CursorRequests?: Record<string, number>;
        };
        target.__m7CursorRequests = {};
        const NativeWorker = window.Worker;
        window.Worker = new Proxy(NativeWorker, {
            construct(Target, argumentsList) {
                const worker = Reflect.construct(
                    Target,
                    argumentsList,
                ) as Worker;
                const nativePostMessage = worker.postMessage.bind(worker);
                worker.postMessage = ((message: {
                    kind?: string;
                    featureId?: string;
                }, transfer?: Transferable[]) => {
                    if (
                        message?.kind === 'cursor-value'
                        && message.featureId
                    ) {
                        const counters = target.__m7CursorRequests ?? {};
                        counters[message.featureId] =
                            (counters[message.featureId] ?? 0) + 1;
                        target.__m7CursorRequests = counters;
                    }
                    nativePostMessage(message, transfer ?? []);
                }) as typeof worker.postMessage;
                return worker;
            },
        });
    });
};

test('starts with 22 collapsed cards and shares seek/zoom across three expanded cards', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await installCursorRequestCounters(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/analyzer');

    const cards = page.locator('[data-feature-id]');
    await expect(cards).toHaveCount(22);
    await expect(page.locator('[data-feature-id="rms"]')).toHaveCount(1);
    await expect(page.locator('[data-feature-id="amplitudeSpectrum"]'))
        .toHaveCount(1);
    await expect(page.locator('[data-feature-id="chroma"]')).toHaveCount(1);
    await expect(cards.locator('select')).toHaveCount(0);
    await expect(cards.getByRole('button', { name: '移除' })).toHaveCount(0);
    await expect(page.locator('[data-feature-id] canvas')).toHaveCount(0);
    for (const featureId of ['rms', 'amplitudeSpectrum', 'chroma']) {
        await page.locator(`[data-feature-id="${featureId}"]`)
            .getByRole('button', { name: '展开分析' })
            .click();
    }
    await expect(page.locator('.analyzer-status')).toContainText(
        '3/4 项',
    );

    await chooseFiles(page, [LEARNING_WAV_FIXTURE]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await expect(page.locator('[data-feature-id="rms"] .plot-message'))
        .toHaveCount(0, { timeout: 30_000 });

    // Analysis can finish close to the end of the short learning fixture on a
    // busy runner. Start a fresh playing window so the cadence assertion
    // measures cursor updates instead of an already-ended track.
    const playbackProgress = page.getByTestId('playback-progress');
    await playbackProgress.focus();
    await page.keyboard.press('Home');
    await expect.poll(async () => Number(
        await page.locator('#music-bar-container')
            .getAttribute('data-current-time'),
    )).toBeLessThanOrEqual(0.1);
    if (
        await page.locator('#music-bar-container')
            .getAttribute('data-playback-state') !== 'playing'
    ) {
        await page.getByTestId('toggle-playback').click();
    }
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
    );

    const cursorWindowStartedAt = await page.evaluate(() => {
        const target = window as typeof window & {
            __m7CursorRequests?: Record<string, number>;
        };
        target.__m7CursorRequests = {};
        return performance.now();
    });
    await page.waitForTimeout(550);
    const cursorWindow = await page.evaluate((startedAt) => ({
        counts: (
            window as typeof window & {
                __m7CursorRequests?: Record<string, number>;
            }
        ).__m7CursorRequests ?? {},
        elapsedMs: performance.now() - startedAt,
    }), cursorWindowStartedAt);
    const cursorCounts = cursorWindow.counts;
    const maximumCursorRequests = Math.ceil(
        cursorWindow.elapsedMs * 30 / 1_000,
    ) + 1;
    expect(Object.keys(cursorCounts).sort()).toEqual([
        'amplitudeSpectrum',
        'chroma',
        'rms',
    ]);
    for (const [featureId, count] of Object.entries(cursorCounts)) {
        expect(count, `${featureId} exact cursor requests`)
            .toBeGreaterThan(0);
        expect(
            count,
            `${featureId} exact cursor requests in `
                + `${cursorWindow.elapsedMs.toFixed(1)}ms`,
        ).toBeLessThanOrEqual(maximumCursorRequests);
    }

    const canvases = page.locator('[data-feature-id] .plot canvas');
    await expect(canvases).toHaveCount(6);
    const canvasRatios = await canvases.evaluateAll((elements) =>
        elements.map((element) => {
            const canvas = element as HTMLCanvasElement;
            const rect = canvas.getBoundingClientRect();
            return {
                cssWidth: rect.width,
                cssHeight: rect.height,
                backingWidth: canvas.width,
                backingHeight: canvas.height,
                dpr: window.devicePixelRatio,
            };
        }));
    expect(canvasRatios.every((entry) =>
        Math.abs(entry.backingWidth - entry.cssWidth * entry.dpr) <= 1
        && Math.abs(entry.backingHeight - entry.cssHeight * entry.dpr) <= 1))
        .toBe(true);

    await zoomAnalyzer(page);
    await expect.poll(async () => (await readAnalyzerViewport(page)).zoom).toBeCloseTo(1.12 ** 6, 10);

    const rmsPlot = page.locator('[data-feature-id="rms"] .plot');
    await page.getByTestId('toggle-playback').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'paused',
    );
    const seekFeedbackMs = await page.evaluate(async () => {
        const plot = document.querySelector<HTMLElement>(
            '[data-feature-id="rms"] .plot',
        );
        const musicBar = document.querySelector<HTMLElement>(
            '#music-bar-container',
        );
        if (!plot || !musicBar) throw new Error('M7 seek targets missing.');
        const before = Number(musicBar.dataset.currentTime ?? 0);
        const rect = plot.getBoundingClientRect();
        const startedAt = performance.now();
        plot.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            clientX: rect.left + rect.width * 0.6,
            clientY: rect.top + rect.height / 2,
        }));
        await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                observer.disconnect();
                reject(new Error('seek feedback timeout'));
            }, 1_000);
            const observer = new MutationObserver(() => {
                const current = Number(musicBar.dataset.currentTime ?? 0);
                if (Math.abs(current - before) > 0.1) {
                    window.clearTimeout(timeout);
                    observer.disconnect();
                    resolve();
                }
            });
            observer.observe(musicBar, { attributes: true });
        });
        return performance.now() - startedAt;
    });
    expect(seekFeedbackMs).toBeLessThanOrEqual(100);

    await rmsPlot.focus();
    const beforeKeyboard = Number(
        await page.locator('#music-bar-container')
            .getAttribute('data-current-time'),
    );
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () =>
        Number(await page.locator('#music-bar-container')
            .getAttribute('data-current-time'))).toBeGreaterThan(
        beforeKeyboard,
    );

    await expectAnalyzerList(page, 1_024);
    const columns1280 = (await expectAnalyzerList(page, 1_280)).columns;
    const columns1920 = (await expectAnalyzerList(page, 1_920, 1_080))
        .columns;

    console.log(JSON.stringify({
        metric: 'm13-three-expanded-card-interaction',
        activeCards: 3,
        cards: 22,
        cursorRequestsIn550ms: cursorCounts,
        cursorWindowElapsedMs: cursorWindow.elapsedMs,
        maximumCursorRequests,
        seekFeedbackMs,
        canvasLayers: canvasRatios.length,
        columns1280,
        columns1920,
    }));
    expect(issues).toEqual([]);
});

test('persists the empty FIFO and a subsequently expanded feature', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.goto('/analyzer');
    await expect(page.locator('[data-feature-id]')).toHaveCount(22);
    await expect(page.locator('.analysis-card .toggle-card[aria-expanded="true"]'))
        .toHaveCount(0);

    await page.reload();
    await expect(page.locator('[data-feature-id]')).toHaveCount(22);
    await expect(page.locator('.analysis-card .toggle-card[aria-expanded="true"]'))
        .toHaveCount(0);

    await page.locator('[data-feature-id="rms"]')
        .getByRole('button', { name: '展开分析' })
        .click();
    await expect(page.locator('[data-feature-id="rms"] [aria-expanded="true"]'))
        .toHaveCount(1);
    await page.reload();
    await expect(page.locator('[data-feature-id]')).toHaveCount(22);
    await expect(page.locator('[data-feature-id="rms"] [aria-expanded="true"]'))
        .toHaveCount(1);
    expect(issues).toEqual([]);
});

test('isolates a single-card Canvas context failure', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.addInitScript(() => {
        const nativeGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function getContext(
            this: HTMLCanvasElement,
            contextId: string,
            ...args: unknown[]
        ) {
            if (
                contextId === '2d'
                && this.closest('[data-feature-id="rms"]')
            ) {
                return null;
            }
            return Reflect.apply(
                nativeGetContext,
                this,
                [contextId, ...args],
            ) as RenderingContext | null;
        } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto('/analyzer');

    for (const featureId of ['rms', 'amplitudeSpectrum', 'chroma']) {
        await page.locator(`[data-feature-id="${featureId}"]`)
            .getByRole('button', { name: '展开分析' })
            .click();
    }

    await expect(page.locator('[data-feature-id="rms"] .plot-error'))
        .toBeVisible();
    await expect(page.locator('[data-feature-id="amplitudeSpectrum"] .plot-error'))
        .toHaveCount(0);
    await expect(page.locator('[data-feature-id="chroma"] .plot-error'))
        .toHaveCount(0);
    await expect(page.getByRole('button', { name: '重试此卡' }))
        .toBeVisible();
    await expect(page.locator('#music-bar-container')).toBeVisible();
    expect(issues).toEqual([]);
});

test('keeps Analyzer status and height controls below Settings and player overlays above content', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/analyzer');
    await page.locator('[data-feature-id="amplitudeSpectrum"]')
        .getByRole('button', { name: '展开分析' })
        .click();

    await page.locator('.original-list').evaluate((element) => {
        element.scrollTop = 360;
    });
    await expect.poll(async () => page.evaluate(() => {
        const toolbar = document.querySelector<HTMLElement>(
            '.analyzer-status',
        );
        if (!toolbar) return Number.POSITIVE_INFINITY;
        return Math.abs(
            toolbar.getBoundingClientRect().top
            - 64,
        );
    })).toBeLessThanOrEqual(1);

    const layers = await page.evaluate(() => ({
        toolbar: Number(getComputedStyle(
            document.querySelector<HTMLElement>('.analyzer-page')!,
        ).zIndex),
        navigation: Number(getComputedStyle(
            document.querySelector<HTMLElement>('#app-sidebar')!,
        ).zIndex),
        player: Number(getComputedStyle(
            document.querySelector<HTMLElement>('#music-bar-container')!,
        ).zIndex),
    }));
    expect(layers.toolbar).toBeLessThan(layers.navigation);
    expect(layers.navigation).toBeLessThan(layers.player);

    await page.getByTestId('toggle-queue').click();
    await page.waitForTimeout(400);
    const overlayHit = await page.evaluate(() => {
        const list = document.querySelector<HTMLElement>(
            '.music-list-container',
        );
        if (!list) return false;
        const rect = list.getBoundingClientRect();
        const hit = document.elementFromPoint(
            rect.left + Math.min(24, rect.width / 2),
            rect.top + Math.min(24, rect.height / 2),
        );
        return Boolean(hit?.closest('.music-list-container'));
    });
    expect(overlayHit).toBe(true);
    await page.getByTestId('toggle-queue').click();
    await page.waitForTimeout(400);

    const zoomButton = page.getByTestId('analyzer-height-handle');
    await zoomButton.hover();
    const box = await zoomButton.boundingBox();
    if (!box) throw new Error('Zoom button geometry missing.');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(() => zoomButton.evaluate((element) =>
        element.matches(':active'))).toBe(true);
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await zoomButton.evaluate((element) => element.blur());
    await expect.poll(() => zoomButton.evaluate((element) => ({
        active: element.matches(':active'),
        transform: getComputedStyle(element).transform,
    }))).toEqual({ active: false, transform: 'none' });

    const scrollbar = await page.locator(
        '[data-feature-id="amplitudeSpectrum"] .table-scroll',
    ).evaluate((element) => ({
        sharedClass: element.classList.contains('app-scrollbar'),
        color: getComputedStyle(element).scrollbarColor,
        width: getComputedStyle(element).scrollbarWidth,
        gutter: getComputedStyle(element).scrollbarGutter,
        hoverToken: getComputedStyle(element)
            .getPropertyValue('--app-scrollbar-thumb-hover')
            .trim(),
        webkitWidth: getComputedStyle(
            element,
            '::-webkit-scrollbar',
        ).width,
        track: getComputedStyle(
            element,
            '::-webkit-scrollbar-track',
        ).backgroundColor,
        thumb: getComputedStyle(
            element,
            '::-webkit-scrollbar-thumb',
        ).backgroundColor,
    }));
    expect(scrollbar.sharedClass).toBe(true);
    expect(scrollbar.color).toBe(
        'rgba(125, 255, 179, 0.65) rgba(5, 17, 11, 0.9)',
    );
    expect(scrollbar.width).toBe('thin');
    expect(scrollbar.gutter).toContain('stable');
    expect(scrollbar.webkitWidth).toBe('10px');
    expect(scrollbar.track).toBe('rgba(5, 17, 11, 0.9)');
    expect(scrollbar.thumb).toBe('rgba(125, 255, 179, 0.58)');
    expect(scrollbar.hoverToken).toBe('rgba(181, 255, 210, 0.82)');
    expect(issues).toEqual([]);
});

test('keeps the 15-minute M7 workspace responsive and cancellable', async ({ page }) => {
    test.setTimeout(180_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/analyzer');
    await page.waitForFunction(() => Boolean((
        window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__?: unknown;
        }
    ).__AUDIO_NOT_SURF_YET_M6__));
    await page.evaluate(async () => {
        await (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__: {
                    setActiveFeatures(ids: string[]): Promise<void>;
                };
            }
        ).__AUDIO_NOT_SURF_YET_M6__.setActiveFeatures([]);
    });

    await page.evaluate(async () => {
        const sampleRate = 48_000;
        const durationSeconds = 15 * 60;
        const sampleCount = sampleRate * durationSeconds;
        const dataBytes = sampleCount * 2;
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        const text = (offset: number, value: string) => {
            for (let index = 0; index < value.length; index += 1) {
                view.setUint8(offset + index, value.charCodeAt(index));
            }
        };
        text(0, 'RIFF');
        view.setUint32(4, 36 + dataBytes, true);
        text(8, 'WAVE');
        text(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        text(36, 'data');
        view.setUint32(40, dataBytes, true);

        const root = await navigator.storage.getDirectory();
        const directory = await root.getDirectoryHandle(
            `m7-capacity-${crypto.randomUUID()}`,
            { create: true },
        );
        const handle = await directory.getFileHandle(
            'deterministic-15-minute.wav',
            { create: true },
        );
        const writable = await handle.createWritable();
        await writable.write(header);
        const chunk = new Uint8Array(sampleRate * 2 * 5);
        for (let seconds = 0; seconds < durationSeconds; seconds += 5) {
            await writable.write(chunk);
        }
        await writable.close();
        (
            window as typeof window & {
                __audioNotSurfYetPickerQueue: FileSystemFileHandle[][];
            }
        ).__audioNotSurfYetPickerQueue.push([handle]);
    });
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 90_000 },
    );
    await page.evaluate(() => {
        const target = window as typeof window & {
            __m7LongTasks?: number[];
        };
        target.__m7LongTasks = [];
        const observer = new PerformanceObserver((list) => {
            target.__m7LongTasks?.push(
                ...list.getEntries().map((entry) => entry.duration),
            );
        });
        observer.observe({ entryTypes: ['longtask'] });
    });
    for (const id of ['rms', 'amplitudeSpectrum', 'chroma']) {
        await page.locator('[data-feature-id="'+id+'"] .toggle-card').click();
    }
    await page.waitForFunction(() => {
        const bridge = (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__?: {
                    getState(): { state: string; progress: number };
                };
            }
        ).__AUDIO_NOT_SURF_YET_M6__;
        const state = bridge?.getState();
        return state?.state === 'analyzing' && state.progress > 0;
    }, undefined, { timeout: 90_000 });

    const feedbackDurations = await page.evaluate(async () => {
        const durations: number[] = [];
        const musicBar = document.getElementById('music-bar-container')!;
        const toggle = document.querySelector<SVGElement>(
            '[data-testid="toggle-playback"]',
        )!;
        for (let index = 0; index < 2; index += 1) {
            const before = musicBar.dataset.playbackState;
            const started = performance.now();
            toggle.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                button: 0,
            }));
            while (
                musicBar.dataset.playbackState === before
                && performance.now() - started < 1_000
            ) {
                await new Promise<void>((resolve) =>
                    requestAnimationFrame(() => resolve()));
            }
            durations.push(performance.now() - started);
        }
        const plot = document.querySelector<HTMLElement>('.plot')!;
        const beforeZoom = plot.dataset.zoom;
        const started = performance.now();
        const rect = plot.getBoundingClientRect();
        plot.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: rect.left + 100, bubbles: true, cancelable: true }));
        while (plot.dataset.zoom === beforeZoom && performance.now() - started < 1000) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        }
        durations.push(performance.now() - started);
        return durations;
    });
    expect(feedbackDurations.every((duration) => duration <= 100))
        .toBe(true);

    const progressSamples = await page.evaluate(async () => {
        const bridge = (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__: {
                    getState(): { progress: number };
                    cancel(): void;
                };
            }
        ).__AUDIO_NOT_SURF_YET_M6__;
        const samples: number[] = [];
        for (let index = 0; index < 20; index += 1) {
            samples.push(bridge.getState().progress);
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        bridge.cancel();
        return samples;
    });
    expect(progressSamples.some((value) => value > 0)).toBe(true);
    expect(progressSamples.every((value, index) =>
        index === 0 || value >= progressSamples[index - 1]!)).toBe(true);

    const longTasks = await page.evaluate(() => (
        window as typeof window & {
            __m7LongTasks?: number[];
        }
    ).__m7LongTasks ?? []);
    expect(longTasks.filter((duration) => duration > 50)).toEqual([]);
    console.log(JSON.stringify({
        metric: 'm7-capacity-feedback',
        feedbackDurations,
        progressSamples: progressSamples.length,
        analysisLongTasksOver50ms: 0,
    }));
    expect(issues).toEqual([]);
});
