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

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const WAV_FIXTURE = path.join(
    REPOSITORY_ROOT,
    'tests/fixtures/audio/format-master.wav',
);
const MP3_FIXTURE = path.join(
    REPOSITORY_ROOT,
    'tests/fixtures/audio/format-master.mp3',
);
const ACTIVE_FEATURES = [
    'rms',
    'energy',
    'amplitudeSpectrum',
    'chroma',
];

interface BridgeState {
    state: string;
    progress: number;
    cacheState: string;
    activeFeatureIds: string[];
    readyFeatureIds: string[];
    staleMessageCount: number;
    series: Array<{
        featureId: string;
        sampleCount: number;
        sampleStepSeconds: number;
        payloadKind: string;
        dimensions: number[];
    }>;
}

interface Bridge {
    setActiveFeatures(ids: string[]): Promise<void>;
    cancel(): void;
    retry(): Promise<void>;
    getState(): BridgeState;
    getCursorValue(
        featureId: string,
        timeSeconds: number,
    ): Promise<{
        featureId: string;
        frameStartSeconds: number;
        value: number | number[];
    } | null>;
}

function captureBrowserIssues(page: Page): string[] {
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
}

async function waitForBridge(page: Page) {
    await page.waitForFunction(() => Boolean((
        window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__?: Bridge;
        }
    ).__AUDIO_NOT_SURF_YET_M6__));
}

async function installResourceCounters(page: Page) {
    await page.addInitScript(() => {
        const resourceWindow = window as typeof window & {
            __m6Resources?: {
                workersCreated: number;
                workersLive: number;
                audioContextsCreated: number;
                audioContextsLive: number;
                rafLive: number;
            };
        };
        const counters = {
            workersCreated: 0,
            workersLive: 0,
            audioContextsCreated: 0,
            audioContextsLive: 0,
            rafLive: 0,
        };
        resourceWindow.__m6Resources = counters;

        const NativeWorker = window.Worker;
        window.Worker = new Proxy(NativeWorker, {
            construct(Target, argumentsList) {
                const instance = Reflect.construct(
                    Target,
                    argumentsList,
                ) as Worker;
                counters.workersCreated += 1;
                counters.workersLive += 1;
                const terminate = instance.terminate.bind(instance);
                let terminated = false;
                instance.terminate = () => {
                    if (!terminated) {
                        terminated = true;
                        counters.workersLive -= 1;
                    }
                    terminate();
                };
                return instance;
            },
        });

        const NativeAudioContext = window.AudioContext;
        window.AudioContext = new Proxy(NativeAudioContext, {
            construct(Target, argumentsList) {
                const instance = Reflect.construct(
                    Target,
                    argumentsList,
                ) as AudioContext;
                counters.audioContextsCreated += 1;
                counters.audioContextsLive += 1;
                const close = instance.close.bind(instance);
                let closed = false;
                instance.close = async () => {
                    try {
                        return await close();
                    } finally {
                        if (!closed) {
                            closed = true;
                            counters.audioContextsLive -= 1;
                        }
                    }
                };
                return instance;
            },
        });

        const nativeRequest = window.requestAnimationFrame.bind(window);
        const nativeCancel = window.cancelAnimationFrame.bind(window);
        const active = new Set<number>();
        window.requestAnimationFrame = (callback) => {
            const handle = nativeRequest((timestamp) => {
                active.delete(handle);
                counters.rafLive = active.size;
                callback(timestamp);
            });
            active.add(handle);
            counters.rafLive = active.size;
            return handle;
        };
        window.cancelAnimationFrame = (handle) => {
            active.delete(handle);
            counters.rafLive = active.size;
            nativeCancel(handle);
        };
    });
}

test('runs the real M6 Worker, exact cursor, cache write and refresh hit', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await waitForBridge(page);
    await chooseFiles(page, [WAV_FIXTURE]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await page.getByRole('link', { name: 'Analyzer' }).click();

    await page.evaluate(async (ids) => {
        await (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__: Bridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__.setActiveFeatures(ids);
    }, ACTIVE_FEATURES);
    await page.waitForFunction(() => {
        const state = (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__?: Bridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__?.getState();
        return state?.state === 'ready'
            && state.cacheState === 'persisted';
    }, undefined, { timeout: 30_000 });
    const firstState = await page.evaluate(() => (
        window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__: Bridge;
        }
    ).__AUDIO_NOT_SURF_YET_M6__.getState());
    expect(firstState.readyFeatureIds).toEqual(ACTIVE_FEATURES);
    expect(firstState.series).toHaveLength(4);
    expect(firstState.series.every((entry) =>
        entry.sampleStepSeconds >= 1 / 30)).toBe(true);
    expect(firstState.series.find((entry) =>
        entry.featureId === 'amplitudeSpectrum')?.dimensions).toEqual([512]);
    expect(firstState.series.find((entry) =>
        entry.featureId === 'chroma')?.dimensions).toEqual([12]);

    const cursor = await page.evaluate(async () => (
        window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__: Bridge;
        }
    ).__AUDIO_NOT_SURF_YET_M6__.getCursorValue('rms', 1));
    expect(cursor?.featureId).toBe('rms');
    expect(cursor?.frameStartSeconds).toBeLessThanOrEqual(1);
    expect(typeof cursor?.value).toBe('number');

    const persisted = await page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('audionotsurfyet-session', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction(
            ['session', 'current-analysis-cache'],
            'readonly',
        );
        const read = <T>(request: IDBRequest<T>) =>
            new Promise<T>((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        const [session, cache] = await Promise.all([
            read<Record<string, unknown>>(
                transaction.objectStore('session').get('latest'),
            ),
            read<{
                manifest: { featureIds: string[] };
                payloads: Array<{ payload: ArrayBuffer }>;
            }>(
                transaction
                    .objectStore('current-analysis-cache')
                    .get('current'),
            ),
        ]);
        database.close();
        return {
            manifestFeatures:
                (session.currentAnalysisCache as { featureIds: string[] })
                    .featureIds,
            cacheFeatures: cache.manifest.featureIds,
            payloadCount: cache.payloads.length,
            payloadBytes: cache.payloads.reduce(
                (sum, entry) => sum + entry.payload.byteLength,
                0,
            ),
        };
    });
    expect(persisted).toMatchObject({
        manifestFeatures: ACTIVE_FEATURES,
        cacheFeatures: ACTIVE_FEATURES,
        payloadCount: 4,
    });
    expect(persisted.payloadBytes).toBeGreaterThan(0);
    console.log(JSON.stringify({
        metric: 'm6-short-worker-cache',
        readyFeatures: firstState.readyFeatureIds.length,
        payloadCount: persisted.payloadCount,
        payloadBytes: persisted.payloadBytes,
        cursorFrameStartSeconds: cursor?.frameStartSeconds,
    }));

    await page.reload();
    await waitForBridge(page);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'paused',
        { timeout: 20_000 },
    );
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-persistence-state',
        'ready',
        { timeout: 20_000 },
    );
    await page.evaluate(async (ids) => {
        await (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__: Bridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__.setActiveFeatures(ids);
    }, ACTIVE_FEATURES);
    const restoredState = await page.evaluate(() => (
        window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__: Bridge;
        }
    ).__AUDIO_NOT_SURF_YET_M6__.getState());
    expect(restoredState.state).toBe('ready');
    expect(restoredState.cacheState).toBe('hit');
    expect(restoredState.readyFeatureIds).toEqual(ACTIVE_FEATURES);
    const restoredCursor = await page.evaluate(async () => (
        window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__: Bridge;
        }
    ).__AUDIO_NOT_SURF_YET_M6__.getCursorValue('rms', 1));
    expect(restoredCursor?.featureId).toBe('rms');
    expect(restoredCursor?.frameStartSeconds).toBeLessThanOrEqual(1);
    expect(typeof restoredCursor?.value).toBe('number');
    console.log(JSON.stringify({
        metric: 'm6-refresh-cache',
        cacheState: restoredState.cacheState,
        readyFeatures: restoredState.readyFeatureIds.length,
        cursorFrameStartSeconds: restoredCursor?.frameStartSeconds,
    }));
    expect(issues).toEqual([]);
});

test('does not accumulate Worker, AudioContext or RAF resources over 20 lifecycle cycles', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await installResourceCounters(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [WAV_FIXTURE, MP3_FIXTURE]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await waitForBridge(page);

    const rafSamples: number[] = [];
    for (let index = 0; index < 20; index += 1) {
        await page.getByRole('link', { name: 'Analyzer' }).click();
        await page.evaluate(async () => {
            const api = (
                window as typeof window & {
                    __AUDIO_NOT_SURF_YET_M6__: Bridge;
                }
            ).__AUDIO_NOT_SURF_YET_M6__;
            await api.setActiveFeatures(['rms']);
            api.cancel();
        });
        await page.getByTestId('next-track').click();
        await expect(page.locator('#music-bar-container')).toHaveAttribute(
            'data-playback-state',
            'playing',
            { timeout: 20_000 },
        );
        await page.getByRole('link', { name: 'AUDIOSURF' }).click();
        rafSamples.push(await page.evaluate(() =>
            (
                window as typeof window & {
                    __m6Resources?: { rafLive: number };
                }
            ).__m6Resources?.rafLive ?? -1));
    }
    const resources = await page.evaluate(() =>
        (
            window as typeof window & {
                __m6Resources?: {
                    workersCreated: number;
                    workersLive: number;
                    audioContextsCreated: number;
                    audioContextsLive: number;
                    rafLive: number;
                };
            }
        ).__m6Resources);
    expect(resources).toMatchObject({
        workersLive: 1,
        audioContextsCreated: 1,
        audioContextsLive: 1,
    });
    expect(resources!.workersCreated).toBeLessThanOrEqual(1);
    expect(Math.max(...rafSamples) - Math.min(...rafSamples))
        .toBeLessThanOrEqual(2);
    console.log(JSON.stringify({
        metric: 'm6-resource-cycles',
        cycles: 20,
        ...resources,
        rafMinimum: Math.min(...rafSamples),
        rafMaximum: Math.max(...rafSamples),
    }));
    expect(issues).toEqual([]);
});

test('keeps 15-minute analysis responsive, progressive and cancellable', async ({ page }) => {
    test.setTimeout(180_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await waitForBridge(page);

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
            `m6-capacity-${crypto.randomUUID()}`,
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
    await page.getByRole('link', { name: 'Analyzer' }).click();

    await page.evaluate(() => {
        const performanceWindow = window as typeof window & {
            __m6LongTasks?: number[];
        };
        performanceWindow.__m6LongTasks = [];
        const observer = new PerformanceObserver((list) => {
            performanceWindow.__m6LongTasks?.push(
                ...list.getEntries().map((entry) => entry.duration),
            );
        });
        observer.observe({ entryTypes: ['longtask'] });
        void (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__: Bridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__.setActiveFeatures([
            'rms',
            'energy',
            'amplitudeSpectrum',
            'chroma',
        ]);
    });
    await page.waitForFunction(() => {
        const state = (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__?: Bridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__?.getState();
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
        const progress = document.getElementById(
            'progress-bar-container',
        )!;
        const rect = progress.getBoundingClientRect();
        const started = performance.now();
        progress.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            button: 0,
            clientX: rect.left + rect.width * 0.25,
        }));
        window.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            button: 0,
            clientX: rect.left + rect.width * 0.25,
        }));
        durations.push(performance.now() - started);
        return durations;
    });
    expect(feedbackDurations.every((duration) => duration <= 100))
        .toBe(true);

    const progressSamples = await page.evaluate(async () => {
        const samples: number[] = [];
        for (let index = 0; index < 20; index += 1) {
            const api = (
                window as typeof window & {
                    __AUDIO_NOT_SURF_YET_M6__: Bridge;
                }
            ).__AUDIO_NOT_SURF_YET_M6__;
            samples.push(api.getState().progress);
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__: Bridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__.cancel();
        return samples;
    });
    expect(progressSamples).toEqual(
        [...progressSamples].sort((a, b) => a - b),
    );
    await page.waitForFunction(() => (
        window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__?: Bridge;
        }
    ).__AUDIO_NOT_SURF_YET_M6__?.getState().state === 'cancelled');
    const longTasks = await page.evaluate(() =>
        (
            window as typeof window & { __m6LongTasks?: number[] }
        ).__m6LongTasks ?? []);
    expect(longTasks.filter((duration) => duration > 50)).toEqual([]);
    console.log(JSON.stringify({
        metric: 'm6-capacity',
        sampleRate: 48_000,
        durationSeconds: 900,
        feedbackDurationsMs: feedbackDurations,
        maxFeedbackDurationMs: Math.max(...feedbackDurations),
        progressSamples,
        longTaskDurationsMs: longTasks,
        attributableLongTasksOver50Ms:
            longTasks.filter((duration) => duration > 50).length,
        cancelled: true,
    }));
    expect(issues).toEqual([]);
});
