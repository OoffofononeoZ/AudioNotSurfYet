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
import { expectAnalyzerMasonry } from '../support/analyzer-masonry';

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

test('defaults to three unique cards in four slots and shares seek/zoom', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await installCursorRequestCounters(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/analyzer');

    const cards = page.locator('[data-feature-id]');
    await expect(cards).toHaveCount(3);
    await expect(page.locator('[data-feature-id="rms"]')).toHaveCount(1);
    await expect(page.locator('[data-feature-id="amplitudeSpectrum"]'))
        .toHaveCount(1);
    await expect(page.locator('[data-feature-id="chroma"]')).toHaveCount(1);
    await expect(page.locator('.empty-slot')).toHaveCount(1);
    await expect(page.locator('.empty-slot')).toContainText(
        '最多四张且不会重复',
    );

    const selects = cards.locator('select');
    await expect(selects.first().locator('option:disabled')).toHaveCount(2);

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

    await page.getByRole('button', { name: '放大时间轴' }).click();
    await expect(page.locator('.timeline-toolbar')).toContainText('2.0×');

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

    await expectAnalyzerMasonry(page, 1_024);
    const columns1280 = (await expectAnalyzerMasonry(page, 1_280)).columns;
    const columns1920 = (await expectAnalyzerMasonry(page, 1_920, 1_080))
        .columns;

    console.log(JSON.stringify({
        metric: 'm7-three-card-interaction',
        activeCards: 3,
        slots: 4,
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

test('persists an intentionally empty workspace without restoring defaults', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.goto('/analyzer');
    await expect(page.locator('[data-feature-id]')).toHaveCount(3);

    for (let remaining = 3; remaining > 0; remaining -= 1) {
        await page.locator('[data-feature-id]').first()
            .getByRole('button', { name: '移除' })
            .click();
        await expect(page.locator('[data-feature-id]'))
            .toHaveCount(remaining - 1);
    }
    await expect(page.locator('.empty-slot')).toHaveCount(4);

    await page.reload();
    await expect(page.locator('[data-feature-id]')).toHaveCount(0);
    await expect(page.locator('.empty-slot')).toHaveCount(4);

    await page.locator('.empty-slot').first()
        .getByRole('button', { name: /RMS/ })
        .click();
    await expect(page.locator('[data-feature-id="rms"]')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('[data-feature-id="rms"]')).toHaveCount(1);
    await expect(page.locator('[data-feature-id]')).toHaveCount(1);
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
            return nativeGetContext.call(
                this,
                contextId,
                ...args,
            ) as RenderingContext | null;
        } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto('/analyzer');

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

test('keeps the shared toolbar below the header and player overlays above it', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/analyzer');

    await page.locator('.analyzer-content').evaluate((element) => {
        element.scrollTop = 360;
    });
    await expect.poll(async () => page.evaluate(() => {
        const header = document.querySelector<HTMLElement>('#main-header');
        const toolbar = document.querySelector<HTMLElement>(
            '.timeline-toolbar',
        );
        if (!header || !toolbar) return Number.POSITIVE_INFINITY;
        return Math.abs(
            toolbar.getBoundingClientRect().top
            - header.getBoundingClientRect().bottom
            - 8,
        );
    })).toBeLessThanOrEqual(1);

    const layers = await page.evaluate(() => ({
        toolbar: Number(getComputedStyle(
            document.querySelector<HTMLElement>('.timeline-toolbar')!,
        ).zIndex),
        header: Number(getComputedStyle(
            document.querySelector<HTMLElement>('#main-header')!,
        ).zIndex),
        player: Number(getComputedStyle(
            document.querySelector<HTMLElement>('#music-bar-container')!,
        ).zIndex),
    }));
    expect(layers.toolbar).toBeLessThan(layers.header);
    expect(layers.header).toBeLessThan(layers.player);

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

    const zoomButton = page.getByRole('button', { name: '放大时间轴' });
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
        color: getComputedStyle(element).scrollbarColor,
        width: getComputedStyle(element).scrollbarWidth,
        webkitWidth: getComputedStyle(
            element,
            '::-webkit-scrollbar',
        ).width,
    }));
    expect(scrollbar.color).not.toBe('auto');
    expect(scrollbar.webkitWidth).toBe('10px');
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
    await page.evaluate(async () => {
        await (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__: {
                    setActiveFeatures(ids: string[]): Promise<void>;
                };
            }
        ).__AUDIO_NOT_SURF_YET_M6__.setActiveFeatures([
            'rms',
            'amplitudeSpectrum',
            'chroma',
        ]);
    });
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
        const zoom = document.querySelector<HTMLButtonElement>(
            '[aria-label="放大时间轴"]',
        )!;
        const beforeZoom = zoom.disabled;
        const zoomStarted = performance.now();
        zoom.click();
        while (
            zoom.disabled === beforeZoom
            && performance.now() - zoomStarted < 1_000
        ) {
            await new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()));
            break;
        }
        durations.push(performance.now() - zoomStarted);
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
