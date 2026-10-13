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
import { encodeMonoWav } from '../support/m7-learning-fixture';
import { createM10StructurePcm } from '../support/m10-structure-fixture';
import { expectAnalyzerMasonry } from '../support/analyzer-masonry';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const M10_WAV_FIXTURE = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/m10-structures-v1.wav',
);

test.beforeAll(async () => {
    await mkdir(path.dirname(M10_WAV_FIXTURE), { recursive: true });
    await writeFile(M10_WAV_FIXTURE, encodeMonoWav(createM10StructurePcm()));
});

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

interface AnalysisBridge {
    setActiveFeatures(ids: string[]): Promise<void>;
    cancel(): void;
    getState(): { state: string; progress: number };
}

const waitForBridge = (page: Page) => page.waitForFunction(() => Boolean((
    window as typeof window & {
        __AUDIO_NOT_SURF_YET_M6__?: AnalysisBridge;
    }
).__AUDIO_NOT_SURF_YET_M6__));

test('renders Loudness and full Complex Spectrum as persistent expanded cards', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/analyzer');

    const expectedFeatures = [
        'amplitudeSpectrum',
        'chroma',
        'loudness',
        'complexSpectrum',
    ];
    for (const featureId of expectedFeatures) {
        await page.locator(`[data-feature-id="${featureId}"]`)
            .getByRole('button', { name: '展开分析' })
            .click();
    }
    await expect(page.locator('[data-feature-id]')).toHaveCount(21);
    await expect(page.locator('.analysis-card [aria-expanded="true"]'))
        .toHaveCount(4);
    await expect(page.locator('[data-feature-id] select')).toHaveCount(0);

    await chooseFiles(page, [M10_WAV_FIXTURE]);
    for (const featureId of expectedFeatures) {
        await expect(page.locator(
            `[data-feature-id="${featureId}"] .plot-message`,
        )).toHaveCount(0, { timeout: 45_000 });
    }

    const loudnessCard = page.locator('[data-feature-id="loudness"]');
    const complexCard = page.locator('[data-feature-id="complexSpectrum"]');
    await expect(loudnessCard.locator('.axis-summary')).toContainText('B0 – B23');
    await expect(loudnessCard.locator('.facts')).toContainText('总响度');
    await expect(loudnessCard.locator('.facts')).toContainText('最强 Bark band');
    const loudnessDetails = loudnessCard.locator('details');
    await expect(loudnessDetails.locator('summary')).toContainText('24');
    await loudnessDetails.locator('summary').click();
    await expect(loudnessDetails.locator('tbody tr')).toHaveCount(24);

    await expect(complexCard.locator('.axis-summary')).toContainText('bins 0–1023');
    await expect(complexCard.locator('.axis-summary')).toContainText('+Hz / −Hz');
    const complexDetails = complexCard.locator('details');
    await expect(complexDetails.locator('summary')).toContainText('1024');
    await complexDetails.locator('summary').click();
    await expect(complexDetails.locator('tbody tr')).toHaveCount(1024);
    await expect(complexDetails.locator('thead')).toContainText('Signed Hz');
    await expect(complexDetails.locator('thead')).toContainText('Real');
    await expect(complexDetails.locator('thead')).toContainText('Imag');
    await expect(complexDetails.locator('thead')).toContainText('Phase');
    await expect(complexDetails.locator('tbody tr').nth(1023))
        .toContainText('−46.9 Hz');

    await expect(page.locator('[data-feature-id] .plot canvas')).toHaveCount(8);
    await expect(loudnessCard.locator('.plot')).toHaveCSS('height', '320px');
    await expect(complexCard.locator('.plot')).toHaveCSS('height', '320px');

    await page.getByTestId('toggle-playback').click();
    const complexPlot = complexCard.locator('.plot');
    await complexPlot.click({ position: { x: 180, y: 120 } });
    const afterClick = Number(await page.locator('#music-bar-container')
        .getAttribute('data-current-time'));
    await complexPlot.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(
        await page.locator('#music-bar-container')
            .getAttribute('data-current-time'),
    )).toBeGreaterThan(afterClick);

    await page.getByRole('button', { name: '放大时间轴' }).click();
    await page.getByRole('button', { name: '向后平移四分之一视口' }).click();
    await expect(page.locator('.timeline-toolbar')).toContainText('2.0×');
    await page.reload();
    await expect(page.locator('[data-feature-id]')).toHaveCount(21);
    await expect(page.locator('[data-feature-id="loudness"] [aria-expanded="true"]'))
        .toHaveCount(1);
    await expect(page.locator('[data-feature-id="complexSpectrum"] [aria-expanded="true"]'))
        .toHaveCount(1);
    await expect(page.locator('.timeline-toolbar')).toContainText('2.0×');

    const geometries: Record<number, number> = {};
    for (const width of [390, 1_024, 1_280, 1_920]) {
        geometries[width] = (await expectAnalyzerMasonry(page, width)).columns;
    }
    expect(geometries).toEqual({ 390: 1, 1024: 1, 1280: 1, 1920: 2 });

    console.log(JSON.stringify({
        metric: 'm10-structured-learning',
        activeCards: 4,
        availableFeatures: 21,
        exactDimensions: { loudnessBands: 24, complexBins: 1024 },
        viewportRestored: '2.0x',
        geometries,
    }));
    expect(issues).toEqual([]);
});

test('isolates a Complex Spectrum renderer failure to its own card', async ({ page }) => {
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
                && this.closest('[data-feature-id="complexSpectrum"]')
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
    await page.locator('[data-feature-id="complexSpectrum"]')
        .getByRole('button', { name: '展开分析' })
        .click();

    await expect(page.locator(
        '[data-feature-id="complexSpectrum"] .plot-error',
    )).toBeVisible();
    for (const featureId of ['rms', 'amplitudeSpectrum', 'chroma']) {
        await expect(page.locator(
            `[data-feature-id="${featureId}"] .plot-error`,
        )).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: '重试此卡' }))
        .toBeVisible();
    await expect(page.locator('#music-bar-container')).toBeVisible();
    expect(issues).toEqual([]);
});

test('keeps a 15-minute four-heavy-card analysis responsive and cancellable', async ({ page }) => {
    test.setTimeout(180_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/analyzer');
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
            `m10-capacity-${crypto.randomUUID()}`,
            { create: true },
        );
        const handle = await directory.getFileHandle(
            'm10-heavy-15-minute.wav',
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
        const target = window as typeof window & { __m10LongTasks?: number[] };
        target.__m10LongTasks = [];
        const observer = new PerformanceObserver((list) => {
            target.__m10LongTasks?.push(
                ...list.getEntries().map((entry) => entry.duration),
            );
        });
        observer.observe({ entryTypes: ['longtask'] });
        void (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__: AnalysisBridge;
            }
        ).__AUDIO_NOT_SURF_YET_M6__.setActiveFeatures([
            'loudness',
            'complexSpectrum',
            'powerSpectrum',
            'buffer',
        ]);
    });
    await page.waitForFunction(() => {
        const state = (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__?: AnalysisBridge;
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
        const zoom = document.querySelector<HTMLButtonElement>(
            '[aria-label="放大时间轴"]',
        )!;
        const started = performance.now();
        zoom.click();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        durations.push(performance.now() - started);
        return durations;
    });
    expect(feedbackDurations.every((duration) => duration <= 100)).toBe(true);

    const progressSamples = await page.evaluate(async () => {
        const bridge = (
            window as typeof window & {
                __AUDIO_NOT_SURF_YET_M6__: AnalysisBridge;
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
    await page.waitForFunction(() => (
        window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__?: AnalysisBridge;
        }
    ).__AUDIO_NOT_SURF_YET_M6__?.getState().state === 'cancelled');

    const longTasks = await page.evaluate(() => (
        window as typeof window & { __m10LongTasks?: number[] }
    ).__m10LongTasks ?? []);
    expect(longTasks.filter((duration) => duration > 50)).toEqual([]);
    console.log(JSON.stringify({
        metric: 'm10-heavy-capacity',
        sampleRate: 48_000,
        durationSeconds: 900,
        activeFeatures: [
            'loudness',
            'complexSpectrum',
            'powerSpectrum',
            'buffer',
        ],
        feedbackDurationsMs: feedbackDurations,
        maxFeedbackDurationMs: Math.max(...feedbackDurations),
        progressSamples,
        attributableLongTasksOver50Ms:
            longTasks.filter((duration) => duration > 50).length,
        cancelled: true,
    }));
    expect(issues).toEqual([]);
});
