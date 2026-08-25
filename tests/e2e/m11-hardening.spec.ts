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
const AUDIO_FIXTURES = path.join(REPOSITORY_ROOT, 'tests/fixtures/audio');
const FORMAT_FIXTURES = ['wav', 'mp3', 'flac'].map((extension) =>
    path.join(AUDIO_FIXTURES, `format-master.${extension}`));

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

async function browserIdentity(page: Page) {
    return page.evaluate(() => ({
        userAgent: navigator.userAgent,
        vendor: navigator.vendor,
    }));
}

test('loads, analyzes, switches and restores the same MP3/WAV/FLAC queue', async ({ page }) => {
    test.setTimeout(150_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/analyzer');
    await chooseFiles(page, FORMAT_FIXTURES);

    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    const observedFormats: string[] = [];
    for (let index = 0; index < FORMAT_FIXTURES.length; index += 1) {
        const extension = path.extname(FORMAT_FIXTURES[index]!).slice(1);
        await expect(page.locator('#music-info-container')).toContainText(
            `format-master.${extension}`,
        );
        await expect(page.locator('[data-feature-id="rms"] .plot-message'))
            .toHaveCount(0, { timeout: 45_000 });
        await expect(page.locator('[data-feature-id="rms"] .facts'))
            .toContainText('精确值');
        observedFormats.push(extension);
        if (index < FORMAT_FIXTURES.length - 1) {
            await page.getByTestId('next-track').click();
            await expect(musicBar).toHaveAttribute(
                'data-playback-state',
                'playing',
                { timeout: 20_000 },
            );
        }
    }

    const restoredTrackId = await musicBar.getAttribute(
        'data-current-track-id',
    );
    await page.reload();
    await expect(musicBar).toHaveAttribute(
        'data-current-track-id',
        restoredTrackId ?? '',
        { timeout: 20_000 },
    );
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');
    await expect(musicBar).toHaveAttribute('data-current-time', '0');
    await page.getByTestId('toggle-queue').focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('queue-count')).toHaveText('3');

    console.log(JSON.stringify({
        metric: 'm11-format-browser-matrix',
        browser: await browserIdentity(page),
        observedFormats,
        queueRestored: true,
        analysisRestored: true,
    }));
    expect(issues).toEqual([]);
});

test('keeps keyboard, focus, reduced motion and responsive geometry usable', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const lightBackground = page.locator('[data-motion-mode]');
    await expect(lightBackground).toHaveAttribute(
        'data-motion-mode',
        'reduced',
    );
    await expect(lightBackground.locator('canvas')).toHaveCount(1);
    await chooseFiles(page, [FORMAT_FIXTURES[0]!]);

    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    const playbackButton = page.getByTestId('toggle-playback');
    await playbackButton.focus();
    await page.keyboard.press('Space');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');
    const focusStyle = await playbackButton.evaluate((element) => ({
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineWidth: getComputedStyle(element).outlineWidth,
    }));
    expect(focusStyle.outlineStyle).not.toBe('none');
    expect(focusStyle.outlineWidth).not.toBe('0px');

    const progress = page.getByTestId('playback-progress');
    await progress.focus();
    await page.keyboard.press('End');
    await expect.poll(async () => Number(
        await musicBar.getAttribute('data-current-time'),
    )).toBeGreaterThan(3.5);
    await page.keyboard.press('Home');
    await expect.poll(async () => Number(
        await musicBar.getAttribute('data-current-time'),
    )).toBeLessThanOrEqual(0.1);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(
        await musicBar.getAttribute('data-current-time'),
    )).toBeGreaterThan(3.5);
    await expect(progress).toHaveAttribute('role', 'slider');
    await expect(progress).toHaveAttribute('aria-valuetext', /\//);

    const volumeControl = page.getByTestId('volume-control');
    await volumeControl.focus();
    await page.keyboard.press('Home');
    await expect(musicBar).toHaveAttribute('data-volume', '0');
    await page.keyboard.press('End');
    await expect(musicBar).toHaveAttribute('data-volume', '1');
    await expect(volumeControl).toHaveAttribute('aria-valuetext', '100%');

    await page.getByRole('link', { name: 'Analyzer' }).click();
    await expect(page.locator('[data-feature-id="rms"] .plot-message'))
        .toHaveCount(0, { timeout: 45_000 });
    const rmsPlot = page.locator('[data-feature-id="rms"] .plot');
    await rmsPlot.focus();
    await page.keyboard.press('Home');
    await expect.poll(async () => Number(
        await musicBar.getAttribute('data-current-time'),
    )).toBeLessThanOrEqual(0.1);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(
        await musicBar.getAttribute('data-current-time'),
    )).toBeGreaterThan(0.1);
    await expect(page.locator('[data-feature-id="rms"] .axis-summary'))
        .not.toBeEmpty();
    await expect(page.locator('[data-feature-id="rms"] .facts'))
        .toContainText('精确值');

    const geometries: Record<number, {
        columns: number;
        documentOverflow: number;
        headerHeight: number;
        musicBarInsideViewport: boolean;
    }> = {};
    for (const width of [390, 1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        geometries[width] = await page.evaluate(() => {
            const header = document.querySelector<HTMLElement>(
                '#main-header',
            )!;
            const grid = document.querySelector<HTMLElement>('.card-grid')!;
            const music = document.querySelector<HTMLElement>(
                '#music-bar-container',
            )!;
            const musicRect = music.getBoundingClientRect();
            return {
                columns: getComputedStyle(grid).gridTemplateColumns
                    .split(' ').length,
                documentOverflow: Math.max(
                    0,
                    document.documentElement.scrollWidth - window.innerWidth,
                ),
                headerHeight: header.getBoundingClientRect().height,
                musicBarInsideViewport:
                    musicRect.left >= -1
                    && musicRect.right <= window.innerWidth + 1,
            };
        });
    }
    expect(geometries).toEqual({
        390: {
            columns: 1,
            documentOverflow: 0,
            headerHeight: 64,
            musicBarInsideViewport: true,
        },
        1024: {
            columns: 1,
            documentOverflow: 0,
            headerHeight: 64,
            musicBarInsideViewport: true,
        },
        1280: {
            columns: 2,
            documentOverflow: 0,
            headerHeight: 64,
            musicBarInsideViewport: true,
        },
        1920: {
            columns: 2,
            documentOverflow: 0,
            headerHeight: 64,
            musicBarInsideViewport: true,
        },
    });

    console.log(JSON.stringify({
        metric: 'm11-accessibility-geometry',
        browser: await browserIdentity(page),
        reducedMotion: true,
        focusStyle,
        geometries,
    }));
    expect(issues).toEqual([]);
});

test('recovers from persistence quota failure without losing playback', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.addInitScript(() => {
        const nativePut = IDBObjectStore.prototype.put;
        Object.defineProperty(window, '__m11FailCurrentPersistence', {
            configurable: true,
            value: false,
            writable: true,
        });
        IDBObjectStore.prototype.put = function put(
            this: IDBObjectStore,
            value: unknown,
            key?: IDBValidKey,
        ) {
            const shouldFail = (
                window as typeof window & {
                    __m11FailCurrentPersistence?: boolean;
                }
            ).__m11FailCurrentPersistence;
            if (shouldFail && this.name === 'current-blob') {
                throw new DOMException(
                    'M11 deterministic quota failure.',
                    'QuotaExceededError',
                );
            }
            return key === undefined
                ? nativePut.call(this, value)
                : nativePut.call(this, value, key);
        };
    });
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, FORMAT_FIXTURES.slice(0, 2));

    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute(
        'data-persistence-state',
        'ready',
        { timeout: 20_000 },
    );
    await page.evaluate(() => {
        (
            window as typeof window & {
                __m11FailCurrentPersistence: boolean;
            }
        ).__m11FailCurrentPersistence = true;
    });
    await page.getByTestId('next-track').click();
    await expect(musicBar).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await expect(musicBar).toHaveAttribute(
        'data-persistence-state',
        'not-persisted',
        { timeout: 20_000 },
    );
    await expect(page.locator('#music-info-container')).toContainText(
        'format-master.mp3',
    );
    await page.getByTestId('toggle-playback').focus();
    await page.keyboard.press('Space');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');
    await page.keyboard.press('Space');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing');

    console.log(JSON.stringify({
        metric: 'm11-quota-recovery',
        browser: await browserIdentity(page),
        persistenceState: 'not-persisted',
        playbackPreserved: true,
    }));
    expect(issues).toEqual([]);
});

test('releases WebGL contexts and bounds RAF ownership over 20 route cycles', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureBrowserIssues(page);
    await page.addInitScript(() => {
        const nativeGetContext = HTMLCanvasElement.prototype.getContext;
        const nativeRequestAnimationFrame = window.requestAnimationFrame
            .bind(window);
        const nativeCancelAnimationFrame = window.cancelAnimationFrame
            .bind(window);
        const activeRafs = new Set<number>();
        let webglCreated = 0;
        let webglLost = 0;

        HTMLCanvasElement.prototype.getContext = function getContext(
            this: HTMLCanvasElement,
            contextId: string,
            ...args: unknown[]
        ) {
            const context = nativeGetContext.call(
                this,
                contextId,
                ...args,
            ) as RenderingContext | null;
            if (
                context
                && ['webgl', 'webgl2', 'experimental-webgl']
                    .includes(contextId)
                && !(context as WebGLRenderingContext & {
                    __m11Instrumented?: boolean;
                }).__m11Instrumented
            ) {
                const webgl = context as WebGLRenderingContext & {
                    __m11Instrumented?: boolean;
                };
                webgl.__m11Instrumented = true;
                webglCreated += 1;
                const nativeGetExtension = webgl.getExtension.bind(webgl);
                webgl.getExtension = ((name: string) => {
                    const extension = nativeGetExtension(name);
                    if (name === 'WEBGL_lose_context' && extension) {
                        const loseContextExtension = extension as {
                            loseContext(): void;
                            __m11Instrumented?: boolean;
                        };
                        if (!loseContextExtension.__m11Instrumented) {
                            const nativeLose = loseContextExtension
                                .loseContext.bind(loseContextExtension);
                            loseContextExtension.loseContext = () => {
                                webglLost += 1;
                                nativeLose();
                            };
                            loseContextExtension.__m11Instrumented = true;
                        }
                    }
                    return extension;
                }) as typeof webgl.getExtension;
            }
            return context;
        } as typeof HTMLCanvasElement.prototype.getContext;

        window.requestAnimationFrame = (callback: FrameRequestCallback) => {
            let requestId = 0;
            requestId = nativeRequestAnimationFrame((time) => {
                activeRafs.delete(requestId);
                callback(time);
            });
            activeRafs.add(requestId);
            return requestId;
        };
        window.cancelAnimationFrame = (requestId: number) => {
            activeRafs.delete(requestId);
            nativeCancelAnimationFrame(requestId);
        };
        Object.defineProperty(window, '__m11ResourceStats', {
            value: () => ({
                rafLive: activeRafs.size,
                webglCreated,
                webglLost,
            }),
        });
    });
    await page.goto('/');

    for (let cycle = 0; cycle < 20; cycle += 1) {
        await expect(page.locator('[data-motion-mode] canvas')).toHaveCount(1);
        await page.getByRole('link', { name: 'Analyzer' }).click();
        await expect(page).toHaveURL(/\/analyzer$/);
        await expect(page.locator('[data-motion-mode] canvas')).toHaveCount(0);
        await page.getByRole('link', { name: 'AUDIOSURF' }).click();
        await expect(page).toHaveURL(/\/$/);
    }
    await expect(page.locator('[data-motion-mode] canvas')).toHaveCount(1);
    const resources = await page.evaluate(() => (
        window as typeof window & {
            __m11ResourceStats(): {
                rafLive: number;
                webglCreated: number;
                webglLost: number;
            };
        }
    ).__m11ResourceStats());
    expect(resources.webglCreated).toBe(21);
    expect(resources.webglLost).toBe(20);
    expect(resources.webglCreated - resources.webglLost).toBe(1);
    expect(resources.rafLive).toBeLessThanOrEqual(4);

    console.log(JSON.stringify({
        metric: 'm11-route-resources',
        browser: await browserIdentity(page),
        cycles: 20,
        ...resources,
    }));
    expect(issues).toEqual([]);
});
