import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURE = path.join(ROOT, 'artifacts/fixtures/editor-e5-ranges-v1.wav');

const issuesFor = (page: Page): string[] => {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) =>
        issues.push(`pageerror: ${error.stack ?? error.message}`));
    return issues;
};

const openE5 = async (page: Page) => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [FIXTURE]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('editor-buffer-state')).toHaveText('波形已就绪', {
        timeout: 30_000,
    });
    await expect.poll(async () => Number(
        await page.getByTestId('tempo-bpm-0').inputValue(),
    ), { timeout: 30_000 }).toBeGreaterThan(99);
};

const addRangeLane = async (page: Page) => {
    await page.getByTestId('add-range-lane').click();
    const lane = page.locator('[data-testid^="range-lane-"]').first();
    await expect(lane).toBeVisible();
    return lane;
};

const createRangeByRatio = async (
    surface: ReturnType<Page['locator']>,
    startRatio: number,
    endRatio: number,
) => {
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    await surface.click({ position: { x: bounds!.width * startRatio, y: bounds!.height / 2 } });
    await expect(surface.locator('.range-preview')).toBeVisible();
    await surface.click({ position: { x: bounds!.width * endRatio, y: bounds!.height / 2 } });
};

test('creates, previews, cancels and deletes ranges with mouse and keyboard', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = issuesFor(page);
    await openE5(page);
    const lane = await addRangeLane(page);
    const surface = lane.locator('.range-surface').first();
    await surface.scrollIntoViewIfNeeded();

    await page.evaluate(() => {
        const workspace = document.querySelector('[data-testid="editor-point-workspace"]');
        const state = { startedAt: performance.now(), value: null as number | null };
        (window as typeof window & { __e5Feedback?: typeof state }).__e5Feedback = state;
        const observer = new MutationObserver(() => {
            if (state.value !== null) return;
            state.value = performance.now() - state.startedAt;
            observer.disconnect();
        });
        if (workspace) observer.observe(workspace, { childList: true, subtree: true });
    });
    await createRangeByRatio(surface, 0.2, 0.4);
    await expect(lane.locator('.range-marker')).toHaveCount(1);
    const feedbackMs = await page.evaluate(() =>
        (window as typeof window & { __e5Feedback?: { value: number | null } })
            .__e5Feedback?.value ?? Number.POSITIVE_INFINITY);
    expect(feedbackMs).toBeLessThanOrEqual(100);
    console.log(JSON.stringify({ metric: 'e5-input-feedback-ms', value: feedbackMs }));

    await surface.focus();
    await surface.press('Home');
    await surface.press('Space');
    await expect(surface.locator('.range-preview')).toBeVisible();
    await surface.press('Escape');
    await expect(surface.locator('.range-preview')).toHaveCount(0);
    await expect(lane.locator('.range-marker')).toHaveCount(1);

    await surface.focus();
    await surface.press('Home');
    await surface.press('Space');
    await surface.press('ArrowRight');
    await surface.press('Space');
    await expect(lane.locator('.range-marker')).toHaveCount(2);
    await lane.locator('.range-marker').last().press('Delete');
    await expect(lane.locator('.range-marker')).toHaveCount(1);
    await lane.locator('.range-marker').first().click({ button: 'right' });
    await expect(lane.locator('.range-marker')).toHaveCount(0);
    expect(issues).toEqual([]);
});

test('adjusts endpoints, rejects overlap and allows cross-class ranges', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = issuesFor(page);
    await openE5(page);
    const lane = await addRangeLane(page);
    const surface = lane.locator('.range-surface').first();
    await createRangeByRatio(surface, 0.15, 0.35);
    const marker = lane.locator('.range-marker').first();
    const original = await marker.getAttribute('style');
    await lane.locator('[data-testid^="range-end-handle-"]').press('ArrowRight');
    await expect(marker).not.toHaveAttribute('style', original ?? '');

    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    await surface.click({ position: { x: bounds!.width * 0.05, y: bounds!.height / 2 } });
    await expect(surface.locator('.range-preview')).toBeVisible();
    for (let index = 0; index < 12; index += 1) await surface.press('ArrowRight');
    await surface.press('Space');
    await expect(lane.locator('.range-marker')).toHaveCount(1);
    await expect(page.getByTestId('point-workspace-status')).toContainText('重叠');
    await surface.press('Escape');

    await lane.locator('[data-testid^="add-range-inner-class-"]').click();
    await expect(lane.locator('.range-inner-class-cell')).toHaveCount(2);
    const secondSurface = lane.locator('.range-surface').nth(1);
    await createRangeByRatio(secondSurface, 0.25, 0.45);
    await expect(lane.locator('.range-marker')).toHaveCount(2);

    await lane.locator('[data-testid^="delete-range-inner-class-"]').first().click();
    await expect(page.getByRole('dialog', { name: '处理分类中的范围' })).toBeVisible();
    await page.getByTestId('confirm-range-migration').click();
    await expect(page.getByRole('alert')).toContainText('重叠');
    await page.getByTestId('cancel-range-removal').click();
    expect(issues).toEqual([]);
});

test('keeps right-click pan/menu priority and rolls back cancelled handle drags', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = issuesFor(page);
    await openE5(page);
    const lane = await addRangeLane(page);
    const surface = lane.locator('.range-surface').first();
    await createRangeByRatio(surface, 0.2, 0.35);

    await page.getByTestId('editor-zoom-in').click();
    await surface.scrollIntoViewIfNeeded();
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    const beforePan = await page.getByTestId('editor-viewport-state').textContent();
    await page.mouse.move(bounds!.x + bounds!.width * 0.7, bounds!.y + 30);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(bounds!.x + bounds!.width * 0.9, bounds!.y + 30, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await expect(page.getByTestId('editor-viewport-state')).not.toHaveText(beforePan ?? '');

    await surface.click({
        position: { x: bounds!.width * 0.9, y: 30 },
        button: 'right',
    });
    await expect(page.getByTestId('editor-range-menu')).toBeVisible();
    await page.keyboard.press('Escape');

    const marker = lane.locator('.range-marker').first();
    const original = await marker.getAttribute('style');
    const handle = lane.locator('[data-testid^="range-start-handle-"]').first();
    const handleBounds = await handle.boundingBox();
    expect(handleBounds).toBeTruthy();
    await page.mouse.move(handleBounds!.x + 2, handleBounds!.y + 2);
    await page.mouse.down();
    await page.mouse.move(handleBounds!.x + 80, handleBounds!.y + 2, { steps: 3 });
    await handle.dispatchEvent('pointercancel', { pointerId: 1 });
    await page.mouse.up();
    await expect(marker).toHaveAttribute('style', original ?? '');
    expect(issues).toEqual([]);
});

test('keeps overlay pointer-through and restores range state after refresh', async ({ page }) => {
    test.setTimeout(150_000);
    const issues = issuesFor(page);
    await openE5(page);
    const lane = await addRangeLane(page);
    const laneName = lane.locator('[data-testid^="range-lane-name-"]');
    await laneName.fill('Effects');
    await laneName.press('Enter');
    await page.getByTestId('editor-overlay-feature').selectOption('rms');
    await expect(page.getByTestId('editor-analysis-overlay-panel'))
        .toHaveAttribute('data-analysis-state', 'ready', { timeout: 30_000 });
    const surface = lane.locator('.range-surface').first();
    await createRangeByRatio(surface, 0.55, 0.75);
    await expect(lane.locator('.range-marker')).toHaveCount(1);

    await page.reload();
    await expect(page.getByTestId('editor-range-workspace')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid^="range-lane-name-"]')).toHaveValue('Effects');
    await page.locator('.range-surface').first().scrollIntoViewIfNeeded();
    await expect(page.locator('.range-marker')).toHaveCount(1);
    await expect(page.getByTestId('editor-overlay-feature')).toHaveValue('rms');
    expect(issues).toEqual([]);
});

for (const width of [1_024, 1_280, 1_920]) {
    test(`aligns range, timeline and overlay columns at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openE5(page);
        const lane = await addRangeLane(page);
        const surface = lane.locator('.range-surface').first();
        await surface.scrollIntoViewIfNeeded();
        await page.getByTestId('editor-overlay-feature').selectOption('rms');
        await expect(page.getByTestId('editor-analysis-overlay-panel'))
            .toHaveAttribute('data-analysis-state', 'ready', { timeout: 30_000 });
        const [surfaceBounds, timelineBounds, overlayBounds] = await Promise.all([
            surface.boundingBox(),
            page.getByTestId('editor-timeline').boundingBox(),
            page.getByTestId('editor-analysis-overlay-host').boundingBox(),
        ]);
        expect(surfaceBounds).toBeTruthy();
        expect(timelineBounds).toBeTruthy();
        expect(overlayBounds).toBeTruthy();
        const geometryError = Math.max(
            Math.abs(surfaceBounds!.x - timelineBounds!.x),
            Math.abs(surfaceBounds!.width - timelineBounds!.width),
            Math.abs(surfaceBounds!.x - overlayBounds!.x),
            Math.abs(surfaceBounds!.width - overlayBounds!.width),
        );
        expect(geometryError).toBeLessThanOrEqual(1);
        console.log(JSON.stringify({
            metric: 'e5-geometry-error-css-px',
            viewportWidth: width,
            value: geometryError,
        }));
    });
}
