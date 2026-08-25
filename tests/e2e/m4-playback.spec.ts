import {
    expect,
    test,
    type Page,
    type TestInfo,
} from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
} from '../support/file-picker';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_FIXTURES = path.join(
    REPOSITORY_ROOT,
    'tests/fixtures/audio',
);

interface RuntimeStats {
    contextsCreated: number;
    contextsClosed: number;
    objectUrlsCreated: number;
    objectUrlsRevoked: number;
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

async function installResourceInstrumentation(page: Page) {
    await page.addInitScript(() => {
        const NativeAudioContext = window.AudioContext;
        let contextsCreated = 0;
        let contextsClosed = 0;
        let objectUrlsCreated = 0;
        let objectUrlsRevoked = 0;

        class TrackedAudioContext extends NativeAudioContext {
            constructor(options?: AudioContextOptions) {
                super(options);
                contextsCreated += 1;
            }

            override async close() {
                await super.close();
                contextsClosed += 1;
            }
        }

        Object.defineProperty(window, 'AudioContext', {
            configurable: true,
            value: TrackedAudioContext,
        });

        const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
        const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
        URL.createObjectURL = (object: Blob | MediaSource) => {
            objectUrlsCreated += 1;
            return nativeCreateObjectURL(object);
        };
        URL.revokeObjectURL = (url: string) => {
            objectUrlsRevoked += 1;
            nativeRevokeObjectURL(url);
        };

        Object.defineProperty(window, '__m4RuntimeStats', {
            value: () => ({
                contextsCreated,
                contextsClosed,
                objectUrlsCreated,
                objectUrlsRevoked,
            }),
        });
    });
}

async function runtimeStats(page: Page): Promise<RuntimeStats> {
    return page.evaluate(() => (
        window as unknown as {
            __m4RuntimeStats: () => RuntimeStats;
        }
    ).__m4RuntimeStats());
}

function writePcm16Wave(
    outputPath: string,
    durationSeconds: number,
): Promise<void> {
    const sampleRate = 48_000;
    const channels = 1;
    const bytesPerSample = 2;
    const sampleCount = sampleRate * durationSeconds;
    const dataSize = sampleCount * bytesPerSample;
    const wave = Buffer.alloc(44 + dataSize);
    wave.write('RIFF', 0);
    wave.writeUInt32LE(36 + dataSize, 4);
    wave.write('WAVE', 8);
    wave.write('fmt ', 12);
    wave.writeUInt32LE(16, 16);
    wave.writeUInt16LE(1, 20);
    wave.writeUInt16LE(channels, 22);
    wave.writeUInt32LE(sampleRate, 24);
    wave.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
    wave.writeUInt16LE(channels * bytesPerSample, 32);
    wave.writeUInt16LE(bytesPerSample * 8, 34);
    wave.write('data', 36);
    wave.writeUInt32LE(dataSize, 40);

    for (let sample = 0; sample < sampleCount; sample += 1) {
        const value = Math.sin(2 * Math.PI * 440 * sample / sampleRate);
        wave.writeInt16LE(Math.round(value * 0.25 * 32_767), 44 + sample * 2);
    }
    return writeFile(outputPath, wave);
}

test('preserves queue controls, append semantics, energy, and resource ownership', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await installResourceInstrumentation(page);
    await installFilePickerStub(page);
    await page.goto('/');

    const musicBar = page.locator('#music-bar-container');
    await chooseFiles(page, [
        path.join(AUDIO_FIXTURES, 'format-master.wav'),
    ]);
    await expect(musicBar).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    const firstTrackId =
        await musicBar.getAttribute('data-current-track-id');
    expect(firstTrackId).toBeTruthy();
    await expect.poll(async () =>
        Number(await musicBar.getAttribute('data-energy')),
    ).toBeGreaterThan(0);

    await page.getByTestId('toggle-playback').click();
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');
    await expect(musicBar).toHaveAttribute('data-energy', '0');
    const pausedTime = Number(
        await musicBar.getAttribute('data-current-time'),
    );
    await page.waitForTimeout(150);
    expect(Number(
        await musicBar.getAttribute('data-current-time'),
    )).toBeCloseTo(pausedTime, 3);
    await page.getByTestId('toggle-playback').click();
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('volume-control').hover();
    const volumeSlider = page.getByRole('slider', {
        name: 'slider between 0 and 100',
    });
    await expect(volumeSlider).toBeVisible();
    await volumeSlider.press('Home');
    await expect(musicBar).toHaveAttribute('data-volume', '0');
    await volumeSlider.press('End');
    await expect(musicBar).toHaveAttribute('data-volume', '1');

    const timeBeforeAppend = Number(
        await musicBar.getAttribute('data-current-time'),
    );
    await chooseFiles(page, [
        path.join(AUDIO_FIXTURES, 'format-master.mp3'),
        path.join(AUDIO_FIXTURES, 'format-master.flac'),
    ]);
    await expect(musicBar).toHaveAttribute(
        'data-current-track-id',
        firstTrackId ?? '',
    );
    expect(Number(
        await musicBar.getAttribute('data-current-time'),
    )).toBeGreaterThanOrEqual(timeBeforeAppend);

    await page.getByTestId('next-track').click();
    await expect.poll(
        () => musicBar.getAttribute('data-current-track-id'),
    ).not.toBe(firstTrackId);
    await page.getByTestId('previous-track').click();
    await expect(musicBar).toHaveAttribute(
        'data-current-track-id',
        firstTrackId ?? '',
    );
    for (let iteration = 0; iteration < 20; iteration += 1) {
        await page.getByTestId('next-track').click();
        await expect(musicBar).toHaveAttribute(
            'data-playback-state',
            'playing',
        );
    }

    await page.getByRole('link', { name: 'Analyzer' }).click();
    await expect(page).toHaveURL(/\/analyzer$/);
    await page.getByRole('link', { name: 'AUDIOSURF' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect((await runtimeStats(page)).contextsCreated).toBe(1);

    await page.getByTestId('toggle-queue').click();
    await expect(page.getByTestId('queue-count')).toHaveText('3');
    const rows = page.getByTestId('queue-item');
    await rows.nth(0).click();
    await expect(musicBar).toHaveAttribute(
        'data-current-track-id',
        firstTrackId ?? '',
    );
    await rows.nth(2).hover();
    await rows.nth(2).getByTestId('delete-track').click();
    await expect(page.getByTestId('queue-count')).toHaveText('2');
    await expect(musicBar).toHaveAttribute(
        'data-current-track-id',
        firstTrackId ?? '',
    );

    await rows.nth(0).hover();
    await rows.nth(0).getByTestId('delete-track').click();
    await expect(page.getByTestId('queue-count')).toHaveText('1');
    await expect.poll(
        () => musicBar.getAttribute('data-current-track-id'),
    ).not.toBe(firstTrackId);

    await page.getByTestId('clear-queue').click();
    await expect(page.getByTestId('queue-count')).toHaveText('0');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'empty');
    await expect(musicBar).toHaveAttribute('data-energy', '0');

    const stats = await runtimeStats(page);
    expect(stats.contextsCreated).toBe(1);
    expect(stats.objectUrlsCreated).toBe(0);
    expect(stats.objectUrlsRevoked).toBe(0);
    expect(issues).toEqual([]);
});

test('keeps a corrupt track recoverable and plays the next valid track', async ({ page }, testInfo) => {
    const issues = captureBrowserIssues(page);
    const corruptPath = testInfo.outputPath('corrupt.wav');
    await writeFile(corruptPath, new Uint8Array([0, 1, 2, 3, 4]));
    await installFilePickerStub(page);
    await page.goto('/');

    const musicBar = page.locator('#music-bar-container');
    await chooseFiles(page, [corruptPath]);
    await expect(musicBar).toHaveAttribute(
        'data-playback-state',
        'error',
        { timeout: 20_000 },
    );
    await expect(page.locator('.el-message--error')).toBeVisible();

    await chooseFiles(page, [
        path.join(AUDIO_FIXTURES, 'format-master.wav'),
    ]);
    await expect(musicBar).toHaveAttribute('data-playback-state', 'error');
    await page.getByTestId('next-track').click();
    await expect(musicBar).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await expect(page.locator('#music-info-container')).toContainText(
        'format-master.wav',
    );
    expect(issues).toEqual([]);
});

test('keeps the AudioContext-based clock within 100ms for 60 seconds and repeated seeks', async ({ page }, testInfo: TestInfo) => {
    test.setTimeout(100_000);
    const issues = captureBrowserIssues(page);
    const longWavePath = testInfo.outputPath('controlled-65s.wav');
    await writePcm16Wave(longWavePath, 65);
    await installFilePickerStub(page);
    await page.goto('/');

    const musicBar = page.locator('#music-bar-container');
    await chooseFiles(page, [longWavePath]);
    await expect(musicBar).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );

    const start = await musicBar.evaluate((element) => ({
        wallSeconds: performance.now() / 1000,
        audioSeconds: Number(
            (element as HTMLElement).dataset.currentTime,
        ),
    }));
    await page.waitForTimeout(60_000);
    const end = await musicBar.evaluate((element) => ({
        wallSeconds: performance.now() / 1000,
        audioSeconds: Number(
            (element as HTMLElement).dataset.currentTime,
        ),
    }));
    const drift = Math.abs(
        (end.audioSeconds - start.audioSeconds)
        - (end.wallSeconds - start.wallSeconds),
    );
    expect(drift).toBeLessThanOrEqual(0.1);

    const progress = page.getByTestId('playback-progress');
    const box = await progress.boundingBox();
    expect(box).not.toBeNull();
    const duration = Number(await musicBar.getAttribute('data-duration'));
    const seekErrors: number[] = [];
    for (const fraction of [0.2, 0.45, 0.7]) {
        await page.mouse.click(
            (box?.x ?? 0) + (box?.width ?? 0) * fraction,
            (box?.y ?? 0) + (box?.height ?? 0) / 2,
        );
        await expect(musicBar).toHaveAttribute(
            'data-playback-state',
            'playing',
        );
        const seekError = Math.abs(
            Number(await musicBar.getAttribute('data-current-time'))
            - duration * fraction,
        );
        seekErrors.push(seekError);
        expect(seekError).toBeLessThanOrEqual(0.1);
    }
    console.log(JSON.stringify({
        measuredDriftSeconds: drift,
        seekErrorsSeconds: seekErrors,
    }));

    expect(issues).toEqual([]);
});
