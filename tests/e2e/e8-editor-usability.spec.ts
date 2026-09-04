import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
    queuePickerFiles,
} from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_DIRECTORY = path.join(ROOT, 'tests/fixtures/audio');
const WAV_FILE = path.join(AUDIO_DIRECTORY, 'format-master.wav');
const MP3_FILE = path.join(AUDIO_DIRECTORY, 'format-master.mp3');

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

const openEditor = async (page: Page, files = [WAV_FILE]) => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, files);
    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 30_000,
    });
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({
        timeout: 30_000,
    });
    await expect(page.getByTestId('editor-buffer-state')).toHaveText(
        '波形已就绪',
        { timeout: 30_000 },
    );
};

const removeStoredHandle = async (page: Page, trackId: string) => {
    await page.evaluate(async (id) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('audionotsurfyet-session', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction('handles', 'readwrite');
        transaction.objectStore('handles').delete(id);
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        database.close();
    }, trackId);
};

test('uses the compact waveform height and centers point marker geometry', async ({ page }) => {
    test.setTimeout(150_000);
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditor(page);
    await page.getByTestId('tempo-bpm-0').fill('100');
    await page.getByTestId('tempo-bpm-0').press('Enter');
    await page.getByTestId('add-point-lane').click();
    const surface = page.locator('.marker-surface').first();
    await surface.scrollIntoViewIfNeeded();
    const surfaceBounds = await surface.boundingBox();
    expect(surfaceBounds).toBeTruthy();
    await surface.click({
        position: {
            x: surfaceBounds!.width / 2,
            y: surfaceBounds!.height / 2,
        },
    });
    await expect(page.locator('.point-marker')).toHaveCount(1);
    await expect(page.locator('.point-candidate')).toBeVisible();

    for (const viewport of [
        { width: 390, height: 844 },
        { width: 1024, height: 900 },
        { width: 1280, height: 900 },
        { width: 1920, height: 1080 },
    ]) {
        await page.setViewportSize(viewport);
        await page.getByTestId('editor-timeline').scrollIntoViewIfNeeded();
        const metrics = await page.evaluate((readPixels) => {
            const stage = document.querySelector<HTMLElement>(
                '[data-testid="editor-timeline"]',
            );
            const waveform = stage?.querySelector<HTMLCanvasElement>(
                'canvas.timeline-canvas:not(.grid-canvas):not(.cursor-canvas)',
            );
            const boundaryButton = stage?.querySelector<HTMLElement>(
                '[data-testid="add-tempo-boundary"]',
            );
            const tempoStrip = document.querySelector<HTMLElement>(
                '[data-testid="editor-tempo-lane"]',
            );
            if (!stage || !waveform || !boundaryButton || !tempoStrip) {
                throw new Error('Editor timeline geometry is incomplete.');
            }
            const stageBounds = stage.getBoundingClientRect();
            const tempoStripBounds = tempoStrip.getBoundingClientRect();
            const boundaryBounds = boundaryButton.getBoundingClientRect();
            let firstDrawnRow: number | null = null;
            let lastDrawnRow: number | null = null;
            if (readPixels) {
                const context = waveform.getContext('2d');
                if (!context) throw new Error('Waveform context is unavailable.');
                const data = context.getImageData(
                    0,
                    0,
                    waveform.width,
                    waveform.height,
                ).data;
                firstDrawnRow = waveform.height;
                lastDrawnRow = -1;
                for (let index = 3; index < data.length; index += 4) {
                    if (data[index] === 0) continue;
                    const row = Math.floor((index - 3) / 4 / waveform.width);
                    firstDrawnRow = Math.min(firstDrawnRow, row);
                    lastDrawnRow = Math.max(lastDrawnRow, row);
                }
            }
            return {
                height: stageBounds.height,
                tempoStripHeight: tempoStripBounds.height,
                tempoStripGap: Math.abs(tempoStripBounds.top - stageBounds.bottom),
                dpr: window.devicePixelRatio,
                canvasWidth: waveform.width,
                canvasHeight: waveform.height,
                cssWidth: stageBounds.width,
                firstDrawnRow,
                lastDrawnRow,
                boundaryBottom: boundaryBounds.bottom - stageBounds.top,
                horizontalOverflow:
                    document.documentElement.scrollWidth
                    - document.documentElement.clientWidth,
            };
        }, viewport.width === 1280);
        const expectedHeight = viewport.width < 900 ? 72 : 88;
        expect(metrics.height).toBe(expectedHeight);
        expect(metrics.tempoStripHeight).toBe(28);
        expect(metrics.tempoStripGap).toBeLessThanOrEqual(1);
        expect(metrics.canvasWidth).toBe(Math.round(metrics.cssWidth * metrics.dpr));
        expect(metrics.canvasHeight).toBe(Math.round(expectedHeight * metrics.dpr));
        if (
            metrics.firstDrawnRow !== null
            && metrics.lastDrawnRow !== null
        ) {
            expect(metrics.firstDrawnRow).toBeGreaterThanOrEqual(
                Math.floor(5 * metrics.dpr),
            );
            expect(metrics.lastDrawnRow).toBeLessThanOrEqual(
                Math.ceil((expectedHeight - 5) * metrics.dpr),
            );
        }
        expect(metrics.boundaryBottom).toBeLessThanOrEqual(expectedHeight);
        expect(metrics.horizontalOverflow).toBeLessThanOrEqual(1);

        await surface.scrollIntoViewIfNeeded();
        await page.locator('.point-marker').click();
        await expect(page.locator('.point-candidate')).toBeVisible();
        const markerGeometry = await page.evaluate(() => {
            const marker = document.querySelector<HTMLElement>('.point-marker');
            const diamond = marker?.querySelector<HTMLElement>(':scope > span');
            const markerSurface = marker?.parentElement;
            const candidate = markerSurface?.querySelector<HTMLElement>(
                '.point-candidate',
            );
            if (
                !marker
                || !diamond
                || !markerSurface
                || !candidate
            ) {
                throw new Error('Point marker geometry is incomplete.');
            }
            const markerBounds = marker.getBoundingClientRect();
            const diamondBounds = diamond.getBoundingClientRect();
            const surfaceBounds = markerSurface.getBoundingClientRect();
            const candidateBounds = candidate.getBoundingClientRect();
            const markerCenterX = markerBounds.left + markerBounds.width / 2;
            const markerCenterY = markerBounds.top + markerBounds.height / 2;
            const diamondCenterX = diamondBounds.left + diamondBounds.width / 2;
            const diamondCenterY = diamondBounds.top + diamondBounds.height / 2;
            const expectedX = surfaceBounds.left
                + Number.parseFloat(marker.style.left) / 100 * surfaceBounds.width;
            const markerXError = Math.abs(markerCenterX - expectedX);
            const diamondXError = Math.abs(diamondCenterX - expectedX);
            const candidateXError = Math.abs(
                candidateBounds.left + candidateBounds.width / 2 - expectedX,
            );
            return {
                markerXError,
                diamondXError,
                candidateXError,
                xError: Math.max(
                    markerXError,
                    diamondXError,
                    candidateXError,
                ),
                markerYError: Math.abs(
                    markerCenterY
                    - (surfaceBounds.top + surfaceBounds.height / 2),
                ),
                diamondYError: Math.abs(diamondCenterY - markerCenterY),
            };
        });
        console.log(JSON.stringify({
            metric: 'e8-point-center-error-css-px',
            viewport: `${viewport.width}x${viewport.height}`,
            ...markerGeometry,
        }));
        expect(markerGeometry.xError).toBeLessThanOrEqual(1);
        expect(markerGeometry.markerYError).toBeLessThanOrEqual(1);
        expect(markerGeometry.diamondYError).toBeLessThanOrEqual(1);
    }

    await page.getByTestId('editor-zoom-in').click();
    await page.getByTestId('editor-pan-forward').click();
    await expect(page.locator('.point-marker')).toHaveCount(1);
    const transformedXError = await page.evaluate(() => {
        const marker = document.querySelector<HTMLElement>('.point-marker');
        const diamond = marker?.querySelector<HTMLElement>(':scope > span');
        if (!marker || !diamond) return Number.POSITIVE_INFINITY;
        const markerBounds = marker.getBoundingClientRect();
        const diamondBounds = diamond.getBoundingClientRect();
        return Math.abs(
            markerBounds.left + markerBounds.width / 2
            - diamondBounds.left - diamondBounds.width / 2,
        );
    });
    expect(transformedXError).toBeLessThanOrEqual(1);
    expect(issues).toEqual([]);
});

test('automatically recovers the exact route after the same file is reselected', async ({ page }) => {
    test.setTimeout(150_000);
    const issues = captureIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [WAV_FILE, MP3_FILE]);
    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 30_000,
    });
    await expect(musicBar).toHaveAttribute('data-persistence-state', 'ready', {
        timeout: 30_000,
    });
    await page.getByTestId('toggle-playback').click();
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');
    await page.getByTestId('toggle-queue').click();
    const items = page.getByTestId('queue-item');
    await expect(items).toHaveCount(2);
    const targetTrackId = await items.nth(1).getAttribute('data-track-id');
    expect(targetTrackId).toBeTruthy();
    await removeStoredHandle(page, targetTrackId!);

    await page.reload();
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused', {
        timeout: 30_000,
    });
    await page.goto(`/editor/${targetTrackId}`);
    await expect(page.getByTestId('editor-unavailable')).toBeVisible({
        timeout: 30_000,
    });
    await page.getByTestId('toggle-queue').click();
    const targetItem = page.locator(`[data-track-id="${targetTrackId}"]`);
    await expect(targetItem.getByTestId('track-restore-state'))
        .toHaveAttribute('data-restore-state', 'file-missing');

    await queuePickerFiles(page, [WAV_FILE]);
    await targetItem.getByTestId('reselect-track').click();
    await expect(targetItem.getByTestId('track-restore-state'))
        .toHaveAttribute('data-restore-state', 'content-changed');
    await expect(page.getByTestId('editor-unavailable')).toBeVisible();

    await queuePickerFiles(page, [MP3_FILE]);
    await targetItem.getByTestId('reselect-track').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({
        timeout: 30_000,
    });
    await expect(page).toHaveURL(new RegExp(`/editor/${targetTrackId}$`));
    await expect(page.getByTestId('editor-playback-toggle')).toHaveText('播放');
    await expect(page.locator('#music-bar-container')).toHaveCount(0);
    expect(issues).toEqual([]);
});

test('offers but never silently switches to a different paused song', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [WAV_FILE]);
    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 30_000,
    });
    const currentTrackId = await musicBar.getAttribute('data-current-track-id');
    expect(currentTrackId).toBeTruthy();
    await page.getByTestId('toggle-playback').click();
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');

    await page.goto('/editor/missing-track');
    await expect(page.getByTestId('editor-unavailable')).toBeVisible();
    await expect(page).toHaveURL(/\/editor\/missing-track$/);
    const editCurrent = page.getByTestId('editor-edit-current-track');
    await expect(editCurrent).toBeVisible();
    await expect(editCurrent).toHaveAccessibleName(/编辑当前歌曲：/);
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');

    await editCurrent.click();
    await expect(page).toHaveURL(new RegExp(`/editor/${currentTrackId}$`));
    await expect(page.getByTestId('editor-ready')).toBeVisible({
        timeout: 30_000,
    });
    await expect(page.getByTestId('editor-playback-toggle')).toHaveText('播放');
    await expect(page.locator('#music-bar-container')).toHaveCount(0);
    expect(issues).toEqual([]);
});
