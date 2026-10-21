import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { visiblePointEvents } from '../../src/editor/pointAnnotations';
import { visibleRangeEvents } from '../../src/editor/rangeAnnotations';
import type { EditorProjectV2 } from '../../src/editor/types';
import { createMarkerTimeView } from '../../src/editor/markerTimeView';
import { addMarkerLane } from '../support/editor-marking';
import {
    buildE6StressProject,
    E6_STRESS_DURATION_SECONDS,
    summarizeE6StressProject,
} from '../support/e6-stress-project';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_ROOT = path.join(ROOT, 'tests/fixtures/audio');
const FORMAT_FIXTURES = ['wav', 'mp3', 'flac'].map(extension => path.join(AUDIO_ROOT, `format-master.${extension}`));

const issuesFor = (page: Page): string[] => {
    const issues: string[] = [];
    page.on('console', message => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', error => issues.push(`pageerror: ${error.stack ?? error.message}`));
    return issues;
};

const browserIdentity = (page: Page) =>
    page.evaluate(() => ({
        userAgent: navigator.userAgent,
        vendor: navigator.vendor,
    }));

const decodeSavedProject = async (page: Page, index = 0) => {
    const entry = (await savedPickerEntries(page))[index];
    expect(entry).toBeTruthy();
    return JSON.parse(Buffer.from(entry!.base64, 'base64').toString('utf8')) as EditorProjectV2;
};

const openCurrentEditor = async (page: Page) => {
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('playback-mode')).toHaveAttribute('aria-label', /单曲循环/);
    await expect(page.locator('#music-bar-container')).toBeVisible();
};

const createFifteenMinuteFixture = async (page: Page) => {
    await page.evaluate(
        async ({ durationSeconds }) => {
            const sampleRate = 48_000;
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
            const directory = await root.getDirectoryHandle(`e6-capacity-${crypto.randomUUID()}`, { create: true });
            const handle = await directory.getFileHandle('editor-e6-stress.wav', { create: true });
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
        },
        { durationSeconds: E6_STRESS_DURATION_SECONDS },
    );
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 120_000,
    });
};

const expectedVisibleCounts = (project: EditorProjectV2) => {
    const view = createMarkerTimeView(0, project.track.durationSeconds);
    let points = 0;
    let ranges = 0;
    for (const lane of project.lanes) {
        for (const innerClass of lane.innerClasses) {
            if (lane.eventKind === 'point') {
                points += visiblePointEvents(lane, innerClass.id, view).length;
            } else {
                ranges += visibleRangeEvents(lane, innerClass.id, view).length;
            }
        }
    }
    return { points, ranges };
};

const observeInputToMutation = async (page: Page, inputSelector: string, mutationSelector: string, key: string) => {
    await page.evaluate(
        ({ inputSelector: sourceSelector, mutationSelector: targetSelector, key: targetKey }) => {
            const source = document.querySelector(sourceSelector);
            const target = document.querySelector(targetSelector);
            const record = {
                startedAt: null as number | null,
                value: null as number | null,
            };
            const diagnostics = window as typeof window & {
                __e6Feedback?: Record<string, typeof record>;
            };
            diagnostics.__e6Feedback ??= {};
            diagnostics.__e6Feedback[targetKey] = record;
            const start = () => {
                record.startedAt ??= performance.now();
            };
            const inputEvents = ['pointerdown', 'keydown', 'input', 'change', 'click', 'wheel'];
            for (const eventName of inputEvents) {
                source?.addEventListener(eventName, start, { capture: true });
            }
            const observer = new MutationObserver(() => {
                if (record.value !== null || record.startedAt === null) return;
                record.value = performance.now() - record.startedAt;
                observer.disconnect();
                for (const eventName of inputEvents) {
                    source?.removeEventListener(eventName, start, { capture: true });
                }
            });
            if (target)
                observer.observe(target, {
                    attributes: true,
                    childList: true,
                    characterData: true,
                    subtree: true,
                });
        },
        { inputSelector, mutationSelector, key },
    );
};

const readFeedback = (page: Page, key: string) =>
    page.evaluate(
        targetKey =>
            (
                window as typeof window & {
                    __e6Feedback?: Record<string, { value: number | null }>;
                }
            ).__e6Feedback?.[targetKey]?.value ?? Number.POSITIVE_INFINITY,
        key,
    );

const installResourceDiagnostics = async (page: Page) => {
    await page.addInitScript(() => {
        const diagnosticWindow = window as typeof window & {
            __e6Resources?: {
                workersCreated: number;
                workersLive: number;
                audioContextsCreated: number;
                audioContextsLive: number;
                rafLive: number;
                objectUrlsLive: number;
                resizeObserversLive: number;
            };
        };
        const counters = {
            workersCreated: 0,
            workersLive: 0,
            audioContextsCreated: 0,
            audioContextsLive: 0,
            rafLive: 0,
            objectUrlsLive: 0,
            resizeObserversLive: 0,
        };
        diagnosticWindow.__e6Resources = counters;

        const NativeWorker = window.Worker;
        window.Worker = new Proxy(NativeWorker, {
            construct(Target, args) {
                const worker = Reflect.construct(Target, args) as Worker;
                counters.workersCreated += 1;
                counters.workersLive += 1;
                const terminate = worker.terminate.bind(worker);
                let terminated = false;
                worker.terminate = () => {
                    if (!terminated) {
                        terminated = true;
                        counters.workersLive -= 1;
                    }
                    terminate();
                };
                return worker;
            },
        });

        const NativeAudioContext = window.AudioContext;
        window.AudioContext = new Proxy(NativeAudioContext, {
            construct(Target, args) {
                const context = Reflect.construct(Target, args) as AudioContext;
                counters.audioContextsCreated += 1;
                counters.audioContextsLive += 1;
                const close = context.close.bind(context);
                let closed = false;
                context.close = async () => {
                    try {
                        return await close();
                    } finally {
                        if (!closed) {
                            closed = true;
                            counters.audioContextsLive -= 1;
                        }
                    }
                };
                return context;
            },
        });

        const nativeRequest = window.requestAnimationFrame.bind(window);
        const nativeCancel = window.cancelAnimationFrame.bind(window);
        const activeRaf = new Set<number>();
        window.requestAnimationFrame = callback => {
            const handle = nativeRequest(timestamp => {
                activeRaf.delete(handle);
                counters.rafLive = activeRaf.size;
                callback(timestamp);
            });
            activeRaf.add(handle);
            counters.rafLive = activeRaf.size;
            return handle;
        };
        window.cancelAnimationFrame = handle => {
            activeRaf.delete(handle);
            counters.rafLive = activeRaf.size;
            nativeCancel(handle);
        };

        const nativeCreateObjectUrl = URL.createObjectURL.bind(URL);
        const nativeRevokeObjectUrl = URL.revokeObjectURL.bind(URL);
        const urls = new Set<string>();
        URL.createObjectURL = value => {
            const url = nativeCreateObjectUrl(value);
            urls.add(url);
            counters.objectUrlsLive = urls.size;
            return url;
        };
        URL.revokeObjectURL = url => {
            urls.delete(url);
            counters.objectUrlsLive = urls.size;
            nativeRevokeObjectUrl(url);
        };

        const NativeResizeObserver = window.ResizeObserver;
        window.ResizeObserver = new Proxy(NativeResizeObserver, {
            construct(Target, args) {
                const observer = Reflect.construct(Target, args) as ResizeObserver;
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

test('hardens the three audio formats and project file failure boundaries', async ({ page }) => {
    test.setTimeout(180_000);
    const issues = issuesFor(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, FORMAT_FIXTURES);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 20_000,
    });

    const observedFormats: string[] = [];
    let firstProjectText = '';
    for (let index = 0; index < FORMAT_FIXTURES.length; index += 1) {
        const extension = path.extname(FORMAT_FIXTURES[index]!).slice(1);
        await expect(page.locator('#music-info-container')).toContainText(`format-master.${extension}`);
        await openCurrentEditor(page);
        await page.getByTestId('export-editor-project').click();
        await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(index + 1);
        const project = await decodeSavedProject(page, index);
        expect(project.track.fileName).toBe(`format-master.${extension}`);
        if (index === 0) {
            firstProjectText = Buffer.from((await savedPickerEntries(page))[0]!.base64, 'base64').toString('utf8');
        }
        observedFormats.push(extension);
        if (index < FORMAT_FIXTURES.length - 1) {
            const playbackToggle = page.getByTestId('toggle-playback');
            if ((await playbackToggle.getAttribute('aria-label')) === '暂停') {
                await playbackToggle.click();
            }
            await page.getByRole('link', { name: 'AUDIOSURF' }).click();
            await expect(page.locator('#music-bar-container')).toBeVisible();
            await page.getByTestId('next-track').click();
            await expect(page.locator('#music-info-container')).toContainText(
                `format-master.${path.extname(FORMAT_FIXTURES[index + 1]!).slice(1)}`,
            );
            await page.getByTestId('header-editor-link').click();
            await expect(page.getByTestId('editor-draft-conflict')).toBeVisible();
            await page.getByTestId('overwrite-conflicting-draft').click();
            await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30_000 });
            await page.getByRole('link', { name: 'AUDIOSURF' }).click();
        }
    }

    const title = await page.locator('#music-info-container').textContent();
    await queuePickerData(page, [
        {
            name: 'wrong-track.audiosurf-editor.json',
            mimeType: 'application/json',
            text: firstProjectText,
        },
    ]);
    await page.getByTestId('import-editor-project').click();
    await expect(page.locator('.el-message--error')).toBeVisible();
    await expect(page.locator('#music-info-container')).toHaveText(title ?? '');
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('toggle-playback')).toHaveAttribute('aria-label', '播放');

    console.log(
        JSON.stringify({
            metric: 'e6-format-project-matrix',
            browser: await browserIdentity(page),
            observedFormats,
            repeatOne: true,
            mismatchIsolated: true,
            refreshPaused: true,
        }),
    );
    expect(issues).toEqual([]);
});

test('keeps a deterministic 10,000-event project virtualized and responsive', async ({ page }) => {
    test.setTimeout(300_000);
    const issues = issuesFor(page);
    await installFilePickerStub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await createFifteenMinuteFixture(page);
    await openCurrentEditor(page);
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('editor-timeline').press('Home');
    await page.getByTestId('export-editor-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const initial = await decodeSavedProject(page);
    const stressProject = buildE6StressProject(initial.track);
    const stressSummary = summarizeE6StressProject(stressProject);
    const expectedVisible = expectedVisibleCounts(stressProject);
    await queuePickerData(page, [
        {
            name: 'editor-e6-stress.audiosurf-editor.json',
            mimeType: 'application/json',
            text: `${JSON.stringify(stressProject, null, 2)}\n`,
        },
    ]);
    await page.getByTestId('import-editor-project').click();
    await expect(page.locator('.marker-lane')).toHaveCount(20, { timeout: 60000 });
    const firstPointSurface = page.locator('.marker-surface').first();
    await firstPointSurface.scrollIntoViewIfNeeded();
    await expect.poll(async () => page.locator('.marker-point, .marker-range').count()).toBeGreaterThan(0);
    const visibleEventDom = {
        points: await page.locator('.marker-point').count(),
        ranges: await page.locator('.marker-range').count(),
    };
    expect(visibleEventDom.points).toBeLessThanOrEqual(expectedVisible.points);
    expect(visibleEventDom.ranges).toBeLessThanOrEqual(expectedVisible.ranges);
    expect(visibleEventDom.points + visibleEventDom.ranges).toBeLessThan(10_000);
    expect(expectedVisible.points + expectedVisible.ranges).toBeLessThan(10_000);
    await expect(page.getByTestId('editor-buffer-state')).toHaveText('波形已就绪', {
        timeout: 120_000,
    });
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await page.getByTestId('editor-overlay-feature-menu').locator('[data-feature-id="rms"]').click();
    await expect(page.getByTestId('editor-analysis-overlay-panel')).toHaveAttribute('data-analysis-state', 'ready', {
        timeout: 120_000,
    });

    await page.evaluate(() => {
        const diagnostics = window as typeof window & { __e6LongTasks?: number[] };
        diagnostics.__e6LongTasks = [];
        const observer = new PerformanceObserver(list => {
            diagnostics.__e6LongTasks?.push(...list.getEntries().map(entry => entry.duration));
        });
        observer.observe({ entryTypes: ['longtask'] });
    });

    const feedback: Record<string, number> = {};
    const timeline = page.getByTestId('editor-timeline');
    await timeline.scrollIntoViewIfNeeded();
    await page.evaluate(
        () =>
            new Promise<void>(resolve => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            }),
    );
    await observeInputToMutation(
        page,
        '[data-testid="editor-timeline"]',
        '[data-testid="editor-viewport-state"]',
        'zoom',
    );
    await timeline.press('+');
    feedback.zoom = await readFeedback(page, 'zoom');
    await observeInputToMutation(
        page,
        '[data-testid="editor-timeline"]',
        '[data-testid="editor-viewport-state"]',
        'pan',
    );
    await timeline.press(']');
    feedback.pan = await readFeedback(page, 'pan');

    const timelineBounds = await timeline.boundingBox();
    expect(timelineBounds).toBeTruthy();
    const beforeSeek = await page.getByTestId('playback-progress').getAttribute('aria-valuenow');
    await observeInputToMutation(page, '[data-testid="editor-timeline"]', '[data-testid="playback-progress"]', 'seek');
    await timeline.click({
        position: { x: timelineBounds!.width * 0.6, y: timelineBounds!.height * 0.5 },
    });
    await expect(page.getByTestId('playback-progress')).not.toHaveAttribute('aria-valuenow', beforeSeek ?? '');
    feedback.seek = await readFeedback(page, 'seek');

    await firstPointSurface.scrollIntoViewIfNeeded();
    const pointBefore = await page.locator('.marker-point').count();
    await observeInputToMutation(page, '.marker-surface', '[data-testid="editor-point-workspace"]', 'point');
    await firstPointSurface.click({ position: { x: (await firstPointSurface.boundingBox())!.width * 0.7, y: 20 } });
    await expect.poll(async () => page.locator('.marker-point').count()).toBeGreaterThanOrEqual(pointBefore);
    feedback.point = await readFeedback(page, 'point');

    await timeline.press('Home');
    await page.locator('[data-testid^="range-surface-"]').first().scrollIntoViewIfNeeded();
    const firstRangeHandle = page.locator('[data-testid^="range-end-handle-"]').first();
    await firstRangeHandle.scrollIntoViewIfNeeded();
    await observeInputToMutation(
        page,
        '[data-testid^="range-end-handle-"]',
        '[data-testid="editor-point-workspace"]',
        'range',
    );
    await firstRangeHandle.press('ArrowLeft');
    feedback.range = await readFeedback(page, 'range');

    await page.getByTestId('editor-overlay-menu-toggle').click();
    await observeInputToMutation(
        page,
        '[data-feature-id="chroma"]',
        '[data-testid="editor-analysis-overlay-panel"]',
        'overlay',
    );
    await page.getByTestId('editor-overlay-feature-menu').locator('[data-feature-id="chroma"]').click();
    await expect(page.getByTestId('editor-analysis-overlay-panel')).toHaveAttribute('data-feature-id', 'chroma');
    feedback.overlay = await readFeedback(page, 'overlay');
    await expect(page.locator('[data-state="saved"]')).toBeVisible({ timeout: 10_000 });
    feedback.autosave = feedback.point;

    console.log(JSON.stringify({ metric: 'e6-feedback-sample', feedbackMs: feedback }));
    for (const [name, value] of Object.entries(feedback)) {
        expect(value, `${name} feedback`).toBeLessThanOrEqual(100);
    }
    const longTasks = await page.evaluate(
        () => (window as typeof window & { __e6LongTasks?: number[] }).__e6LongTasks ?? [],
    );
    expect(longTasks.filter(duration => duration > 50)).toEqual([]);

    const geometries: Record<number, unknown> = {};
    for (const width of [1_024, 1_280, 1_920]) {
        await page.setViewportSize({ width, height: 900 });
        await firstPointSurface.scrollIntoViewIfNeeded();
        const [surfaceBounds, timelineBox, overlayBox] = await Promise.all([
            firstPointSurface.boundingBox(),
            page.getByTestId('marker-ruler-time').boundingBox(),
            page.getByTestId('editor-analysis-overlay-panel').boundingBox(),
        ]);
        expect(surfaceBounds).toBeTruthy();
        expect(timelineBox).toBeTruthy();
        expect(overlayBox).toBeTruthy();
        const error = Math.max(
            Math.abs(surfaceBounds!.x - timelineBox!.x),
            Math.abs(surfaceBounds!.width - timelineBox!.width),
            Math.abs(surfaceBounds!.x - overlayBox!.x),
            Math.abs(surfaceBounds!.width - overlayBox!.width),
        );
        expect(error).toBeLessThanOrEqual(1);
        geometries[width] = { error };
    }
    const canvasDiagnostics = await page.locator('canvas').evaluateAll(canvases => ({
        count: canvases.length,
        invalidBackingStores: canvases.filter(element => {
            const canvas = element as HTMLCanvasElement;
            const bounds = canvas.getBoundingClientRect();
            const scroll = canvas.closest('.marker-scroll')?.getBoundingClientRect();
            if (scroll && (bounds.bottom <= scroll.top || bounds.top >= scroll.bottom)) return false;
            const visible =
                bounds.bottom >= 0 && bounds.top <= innerHeight && bounds.right >= 0 && bounds.left <= innerWidth;
            if (!visible) return false;
            return (
                canvas.width + 1 < bounds.width * devicePixelRatio ||
                canvas.height + 1 < bounds.height * devicePixelRatio
            );
        }).length,
    }));
    expect(canvasDiagnostics.invalidBackingStores).toBe(0);

    console.log(
        JSON.stringify({
            metric: 'e6-stress-project',
            browser: await browserIdentity(page),
            ...stressSummary,
            temporalVisibleEventBound: expectedVisible,
            visibleEventDom,
            feedbackMs: feedback,
            maximumLongTaskMs: Math.max(0, ...longTasks),
            geometries,
            canvasDiagnostics,
        }),
    );
    expect(issues).toEqual([]);
});

test('keeps keyboard semantics, focus and stable resources over 20 cycles', async ({ page }) => {
    test.setTimeout(300_000);
    const issues = issuesFor(page);
    await installResourceDiagnostics(page);
    await installFilePickerStub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await chooseFiles(page, FORMAT_FIXTURES.slice(0, 2));
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 20_000,
    });

    const samples: Array<Record<string, number>> = [];
    for (let index = 0; index < 20; index += 1) {
        await page.getByTestId('header-editor-link').click();
        await expect
            .poll(
                async () => {
                    if (await page.getByTestId('editor-ready').isVisible()) return 'ready';
                    if (await page.getByTestId('editor-draft-conflict').isVisible()) {
                        return 'conflict';
                    }
                    return 'pending';
                },
                { timeout: 30_000 },
            )
            .toMatch(/^(ready|conflict)$/);
        if (await page.getByTestId('editor-draft-conflict').isVisible()) {
            await page.getByTestId('overwrite-conflicting-draft').click();
        }
        await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30_000 });
        if ((await page.locator('#music-bar-container').getAttribute('data-playback-state')) === 'playing')
            await page.getByTestId('toggle-playback').click();
        await addMarkerLane(page, 'point');
        await addMarkerLane(page, 'range');
        await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
        const playback = page.getByTestId('toggle-playback');
        await playback.focus();
        await page.keyboard.press('Space');
        await expect(playback).toBeFocused();
        await page.keyboard.press('Space');
        await page.getByRole('link', { name: 'Analyzer' }).click();
        if (await page.getByTestId('editor-leave-dialog').isVisible()) {
            await page.getByTestId('editor-leave-suppress').check();
            await page.getByTestId('editor-leave-confirm').click();
        }
        await expect(page).toHaveURL(/\/analyzer$/);
        await page.getByRole('link', { name: 'AUDIOSURF' }).click();
        await expect(page.locator('#music-bar-container')).toBeVisible();
        await page.getByTestId('next-track').click();
        await page.waitForTimeout(50);
        samples.push(
            await page.evaluate(() => ({
                ...(
                    window as typeof window & {
                        __e6Resources?: Record<string, number>;
                    }
                ).__e6Resources,
                canvasLive: document.querySelectorAll('canvas').length,
            })),
        );
    }
    const final = samples.at(-1)!;
    expect(final.audioContextsCreated).toBe(1);
    expect(final.audioContextsLive).toBe(1);
    expect(final.workersCreated).toBeLessThanOrEqual(1);
    expect(final.workersLive).toBeLessThanOrEqual(1);
    for (const key of ['rafLive', 'objectUrlsLive', 'resizeObserversLive', 'canvasLive']) {
        const tail = samples.slice(4).map(sample => sample[key]!);
        expect(Math.max(...tail) - Math.min(...tail), key).toBeLessThanOrEqual(2);
    }
    console.log(
        JSON.stringify({
            metric: 'e6-resource-cycles',
            browser: await browserIdentity(page),
            cycles: 20,
            final,
            tailRanges: Object.fromEntries(
                ['rafLive', 'objectUrlsLive', 'resizeObserversLive', 'canvasLive'].map(key => {
                    const values = samples.slice(4).map(sample => sample[key]!);
                    return [key, { minimum: Math.min(...values), maximum: Math.max(...values) }];
                }),
            ),
            reducedMotion: true,
        }),
    );
    expect(issues).toEqual([]);
});
