import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
    queuePickerFiles,
} from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURE = path.join(
    ROOT,
    'artifacts/fixtures/editor-e3-points-v1.wav',
);
const RANGE_PROJECT = path.join(
    ROOT,
    'artifacts/fixtures/editor-e3-range-compat-v1.audiosurf-editor.json',
);

const issuesFor = (page: Page): string[] => {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => issues.push(`pageerror: ${error.stack ?? error.message}`));
    return issues;
};

const openE3 = async (page: Page) => {
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
    await expect(page.getByTestId('editor-point-workspace')).toBeVisible();
    await expect(page.getByTestId('editor-buffer-state')).toHaveText('波形已就绪', {
        timeout: 30_000,
    });
    await expect.poll(async () => Number(
        await page.getByTestId('tempo-bpm-0').inputValue(),
    ), { timeout: 30_000 }).toBeGreaterThan(99);
};

const addLane = async (page: Page) => {
    await page.getByTestId('add-point-lane').click();
    const lane = page.locator('[data-testid^="point-lane-"]').first();
    await expect(lane).toBeVisible();
    return lane;
};

test('creates unique point markers with mouse, keyboard and right-click deletion', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = issuesFor(page);
    await openE3(page);
    const lane = await addLane(page);
    const surface = lane.locator('[data-testid^="marker-surface-"]').first();
    await surface.scrollIntoViewIfNeeded();
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();

    await page.evaluate(() => {
        const workspace = document.querySelector('[data-testid="editor-point-workspace"]');
        const state = { startedAt: performance.now(), value: null as number | null };
        (window as typeof window & { __e3Feedback?: typeof state }).__e3Feedback = state;
        const observer = new MutationObserver(() => {
            if (state.value !== null) return;
            state.value = performance.now() - state.startedAt;
            observer.disconnect();
        });
        if (workspace) observer.observe(workspace, { childList: true, subtree: true });
    });
    await surface.click({ position: { x: bounds!.width * 0.5, y: bounds!.height / 2 } });
    await expect(lane.locator('.point-marker')).toHaveCount(1);
    const feedbackMs = await page.evaluate(() =>
        (window as typeof window & { __e3Feedback?: { value: number | null } })
            .__e3Feedback?.value ?? Number.POSITIVE_INFINITY);
    expect(feedbackMs).toBeLessThanOrEqual(100);
    console.log(JSON.stringify({ metric: 'e3-input-feedback-ms', value: feedbackMs }));

    await surface.click({ position: { x: bounds!.width * 0.5, y: bounds!.height / 2 } });
    await expect(lane.locator('.point-marker')).toHaveCount(1);
    await expect(page.getByTestId('point-workspace-status')).toContainText('已有标记');

    await surface.focus();
    await surface.press('Home');
    await surface.press('Space');
    await surface.focus();
    await surface.press('End');
    await surface.press('Enter');
    await expect(lane.locator('.point-marker')).toHaveCount(3);

    const endMarker = lane.locator('.point-marker').last();
    await endMarker.press('Delete');
    await expect(lane.locator('.point-marker')).toHaveCount(2);
    await lane.locator('.point-marker').first().click({ button: 'right' });
    await expect(lane.locator('.point-marker')).toHaveCount(1);

    await surface.focus();
    await surface.press('ArrowRight');
    await surface.press('Space');
    await expect(lane.locator('.point-marker')).toHaveCount(2);
    expect(issues).toEqual([]);
});

test('renames classes and requires migration, deletion or cancellation', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = issuesFor(page);
    await openE3(page);
    const lane = await addLane(page);
    const laneName = lane.locator('[data-testid^="point-lane-name-"]');
    await laneName.fill('Notes');
    await laneName.press('Enter');
    await expect(laneName).toHaveValue('Notes');

    const firstSurface = lane.locator('[data-testid^="marker-surface-"]').first();
    const firstBounds = await firstSurface.boundingBox();
    expect(firstBounds).toBeTruthy();
    await firstSurface.click({ position: { x: firstBounds!.width * 0.25, y: 30 } });
    await lane.locator('[data-testid^="add-inner-class-"]').click();
    await expect(lane.locator('.inner-class-cell')).toHaveCount(2);
    const classInputs = lane.locator('[data-testid^="inner-class-name-"]');
    await classInputs.nth(1).fill('Accent');
    await classInputs.nth(1).press('Enter');
    const secondSurface = lane.locator('[data-testid^="marker-surface-"]').nth(1);
    const secondBounds = await secondSurface.boundingBox();
    expect(secondBounds).toBeTruthy();
    await secondSurface.click({ position: { x: secondBounds!.width * 0.75, y: 30 } });

    await lane.locator('[data-testid^="delete-inner-class-"]').first().click();
    await expect(page.getByRole('dialog', { name: '处理分类中的标记' })).toBeVisible();
    await page.getByTestId('confirm-inner-class-migration').click();
    await expect(lane.locator('.inner-class-cell')).toHaveCount(1);
    await expect(lane.locator('.point-marker')).toHaveCount(2);

    await lane.locator('[data-testid^="add-inner-class-"]').click();
    const newSurface = lane.locator('[data-testid^="marker-surface-"]').nth(1);
    const newBounds = await newSurface.boundingBox();
    expect(newBounds).toBeTruthy();
    await newSurface.click({ position: { x: newBounds!.width * 0.6, y: 30 } });
    await lane.locator('[data-testid^="delete-inner-class-"]').nth(1).click();
    await page.getByTestId('cancel-inner-class-removal').click();
    await expect(lane.locator('.inner-class-cell')).toHaveCount(2);
    await lane.locator('[data-testid^="delete-inner-class-"]').nth(1).click();
    await page.getByTestId('confirm-inner-class-event-deletion').click();
    await expect(lane.locator('.inner-class-cell')).toHaveCount(1);
    await expect(lane.locator('.point-marker')).toHaveCount(2);

    await page.reload();
    await expect(page.getByTestId('editor-point-workspace')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.lane-card[data-testid^="point-lane-"]')).toHaveCount(1);
    await expect(page.locator('[data-testid^="point-lane-name-"]')).toHaveValue('Notes');
    await expect(page.locator('.point-marker')).toHaveCount(2);
    expect(issues).toEqual([]);
});

test('shares geometry, viewport pan/menu and visible marker DOM', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = issuesFor(page);
    await openE3(page);
    const lane = await addLane(page);
    const surface = lane.locator('[data-testid^="marker-surface-"]').first();
    const timeline = page.getByTestId('editor-timeline');
    await surface.scrollIntoViewIfNeeded();
    const [surfaceBounds, timelineBounds] = await Promise.all([
        surface.boundingBox(),
        timeline.boundingBox(),
    ]);
    expect(surfaceBounds).toBeTruthy();
    expect(timelineBounds).toBeTruthy();
    const geometryError = Math.max(
        Math.abs(surfaceBounds!.x - timelineBounds!.x),
        Math.abs(surfaceBounds!.width - timelineBounds!.width),
    );
    expect(geometryError).toBeLessThanOrEqual(1);
    console.log(JSON.stringify({ metric: 'e3-geometry-error-css-px', value: geometryError }));

    await surface.focus();
    await surface.press('Home');
    await surface.press('Space');
    await surface.focus();
    await surface.press('End');
    await surface.press('Space');
    await surface.click({ position: { x: surfaceBounds!.width / 2, y: 30 } });
    await expect(lane.locator('.point-marker')).toHaveCount(3);

    await page.getByTestId('editor-zoom-in').click();
    await expect(lane.locator('.point-marker')).toHaveCount(1);
    const beforePan = await page.getByTestId('editor-viewport-state').textContent();
    await surface.scrollIntoViewIfNeeded();
    const zoomedBounds = await surface.boundingBox();
    expect(zoomedBounds).toBeTruthy();
    await page.mouse.move(zoomedBounds!.x + zoomedBounds!.width * .7, zoomedBounds!.y + 30);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(zoomedBounds!.x + zoomedBounds!.width * .5, zoomedBounds!.y + 30, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await expect(page.getByTestId('editor-viewport-state')).not.toHaveText(beforePan ?? '');

    const afterPanBounds = await surface.boundingBox();
    expect(afterPanBounds).toBeTruthy();
    await surface.click({ position: { x: 180, y: 30 }, button: 'right' });
    await expect(page.getByTestId('editor-point-menu')).toBeVisible();
    await page.getByRole('menuitem', { name: '将此处居中' }).last().click();
    await surface.focus();
    await surface.press('Shift+F10');
    await expect(page.getByTestId('editor-point-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('editor-point-menu')).toHaveCount(0);
    expect(issues).toEqual([]);
});

test('preserves imported range lane identities after E5 editing opens', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = issuesFor(page);
    await openE3(page);
    await queuePickerFiles(page, [RANGE_PROJECT]);
    await page.getByTestId('import-editor-project').click();
    await expect(page.getByTestId('range-lane-e3-compat-range-lane')).toBeVisible();
    await expect(page.getByTestId('range-marker-e3-compat-range-event')).toBeVisible();
    await expect(page.getByTestId('range-start-handle-e3-compat-range-event')).toBeVisible();
    await expect(page.getByTestId('add-point-lane')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('range-lane-e3-compat-range-lane')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('range-marker-e3-compat-range-event')).toBeVisible();
    expect(issues).toEqual([]);
});

for (const width of [1_024, 1_280, 1_920]) {
    test(`keeps point and waveform geometry aligned at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await openE3(page);
        const lane = await addLane(page);
        const surface = lane.locator('[data-testid^="marker-surface-"]').first();
        await surface.scrollIntoViewIfNeeded();
        const [surfaceBounds, timelineBounds] = await Promise.all([
            surface.boundingBox(),
            page.getByTestId('editor-timeline').boundingBox(),
        ]);
        expect(surfaceBounds).toBeTruthy();
        expect(timelineBounds).toBeTruthy();
        expect(Math.abs(surfaceBounds!.x - timelineBounds!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(surfaceBounds!.width - timelineBounds!.width)).toBeLessThanOrEqual(1);
        await surface.hover({ position: { x: surfaceBounds!.width / 2, y: 30 } });
        await expect(lane.locator('.point-candidate')).toBeVisible();
        const transitionSeconds = await lane.locator('.point-candidate').evaluate((element) =>
            Number.parseFloat(getComputedStyle(element).transitionDuration));
        expect(transitionSeconds).toBeLessThanOrEqual(0.001);
    });
}
