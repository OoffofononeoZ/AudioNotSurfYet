import { addMarkerLane } from '../support/editor-marking';
import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { FEATURE_IDS } from '../../src/analysis/types';
import {
    chooseFiles,
    installFilePickerStub,
} from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURE = path.join(
    ROOT,
    'artifacts/fixtures/editor-e4-overlay-v1.wav',
);

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

const openE4 = async (page: Page) => {
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
    await page.getByTestId('toggle-playback').click(); await page.getByTestId('editor-timeline').press('Home');
    await addMarkerLane(page,'point');
    await expect(page.locator('article[data-testid^="point-lane-"]')).toHaveCount(1);
};

const selectOverlay = async (page: Page, featureId: string) => {
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await page.getByTestId('editor-overlay-feature-menu')
        .locator(`[data-feature-id="${featureId}"]`)
        .click();
    const panel = page.getByTestId('editor-analysis-overlay-panel');
    await expect(panel).toHaveAttribute('data-feature-id', featureId);
    await expect(panel).toHaveAttribute('data-analysis-state', 'ready', {
        timeout: 30_000,
    });
    await expect(panel).toHaveAttribute('data-renderer-error', 'false');
    await expect(page.getByTestId('editor-overlay-exact-summary'))
        .not.toHaveText('等待精确值', { timeout: 10_000 });
};

test('offers every registered feature and renders every shared renderer family', async ({ page }) => {
    test.setTimeout(180_000);
    const issues = issuesFor(page);
    await openE4(page);
    await page.getByTestId('editor-overlay-menu-toggle').click();
    const options = page.getByTestId('editor-overlay-feature-menu')
        .locator('[role="menuitemradio"]');
    await expect(options).toHaveCount(FEATURE_IDS.length);
    expect(await options.evaluateAll((entries) => entries.map(
        (entry) => entry.getAttribute('data-feature-id'),
    ))).toEqual([...FEATURE_IDS]);
    await page.keyboard.press('Escape');

    for (const featureId of [
        'rms',
        'amplitudeSpectrum',
        'chroma',
        'mfcc',
        'buffer',
        'loudness',
        'complexSpectrum',
    ]) {
        await selectOverlay(page, featureId);
    }
    expect(issues).toEqual([]);
});

test('keeps overlay geometry aligned and passes pointer input to point cells', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = issuesFor(page);
    await openE4(page);
    await selectOverlay(page, 'rms');
    const surface = page.locator('[data-testid^="marker-surface-"]').first();
    await surface.scrollIntoViewIfNeeded();
    const [surfaceBounds, panelBounds] = await Promise.all([
        surface.boundingBox(),
        page.getByTestId('editor-analysis-overlay-panel').boundingBox(),
    ]);
    expect(surfaceBounds).toBeTruthy();
    expect(panelBounds).toBeTruthy();
    const geometryError = Math.max(
        Math.abs(surfaceBounds!.x - panelBounds!.x),
        Math.abs(surfaceBounds!.width - panelBounds!.width),
    );
    expect(geometryError).toBeLessThanOrEqual(1);
    console.log(JSON.stringify({ metric: 'e4-geometry-error-css-px', value: geometryError }));

    await page.evaluate(() => {
        const workspace = document.querySelector('[data-testid="editor-point-workspace"]');
        const state = { startedAt: performance.now(), value: null as number | null };
        (window as typeof window & { __e4Feedback?: typeof state }).__e4Feedback = state;
        const observer = new MutationObserver(() => {
            if (state.value !== null) return;
            state.value = performance.now() - state.startedAt;
            observer.disconnect();
        });
        if (workspace) observer.observe(workspace, { childList: true, subtree: true });
    });
    await page.mouse.click(
        surfaceBounds!.x + surfaceBounds!.width * 0.65,
        surfaceBounds!.y + surfaceBounds!.height * 0.62,
    );
    await expect(page.locator('.marker-point')).toHaveCount(1);
    const feedbackMs = await page.evaluate(() =>
        (window as typeof window & { __e4Feedback?: { value: number | null } })
            .__e4Feedback?.value ?? Number.POSITIVE_INFINITY);
    expect(feedbackMs).toBeLessThanOrEqual(100);
    console.log(JSON.stringify({ metric: 'e4-input-feedback-ms', value: feedbackMs }));
    expect(issues).toEqual([]);
});

test('adjusts all handles with keyboard and pointer and restores persisted bounds', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = issuesFor(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openE4(page);
    await selectOverlay(page, 'chroma');
    const panel = page.getByTestId('editor-analysis-overlay-panel');
    const readBounds = () => panel.evaluate((element) => ({
        top: Number.parseFloat((element as HTMLElement).style.top) / 100,
        height: Number.parseFloat((element as HTMLElement).style.height) / 100,
        transition: getComputedStyle(element).transitionDuration,
    }));
    const initial = await readBounds();
    expect(initial.top).toBeCloseTo(0.1);
    expect(initial.height).toBeCloseTo(0.35);
    expect(Number.parseFloat(initial.transition)).toBeLessThanOrEqual(0.001);

    await page.getByTestId('editor-overlay-handle-top').press('ArrowDown');
    const fine = await readBounds();
    expect(fine.top - initial.top).toBeCloseTo(0.01);
    expect(initial.height - fine.height).toBeCloseTo(0.01);
    await page.getByTestId('editor-overlay-handle-move').press('Shift+ArrowDown');
    const coarse = await readBounds();
    expect(coarse.top - fine.top).toBeCloseTo(0.05);
    await page.getByTestId('editor-overlay-handle-bottom').press('ArrowUp');
    const keyboard = await readBounds();
    expect(coarse.height - keyboard.height).toBeCloseTo(0.01);

    const handle = page.getByTestId('editor-overlay-handle-bottom');
    const handleBounds = await handle.boundingBox();
    expect(handleBounds).toBeTruthy();
    await page.mouse.move(
        handleBounds!.x + handleBounds!.width / 2,
        handleBounds!.y + handleBounds!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        handleBounds!.x + handleBounds!.width / 2,
        handleBounds!.y + handleBounds!.height / 2 + 24,
        { steps: 4 },
    );
    await page.mouse.up();
    const pointer = await readBounds();
    expect(pointer.height).toBeGreaterThan(keyboard.height);

    await page.reload();
    await expect(page.getByTestId('editor-analysis-overlay-panel'))
        .toHaveAttribute('data-feature-id', 'chroma', { timeout: 20_000 });
    await expect(page.getByTestId('editor-overlay-toggle'))
        .toHaveAttribute('aria-pressed', 'true');
    const restored = await readBounds();
    expect(restored.top).toBeCloseTo(pointer.top, 3);
    expect(restored.height).toBeCloseTo(pointer.height, 3);
    expect(issues).toEqual([]);
});

test('isolates an overlay Canvas failure from Buffer and point editing', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = issuesFor(page);
    await openE4(page);
    await selectOverlay(page, 'rms');
    await page.evaluate(() => {
        const prototype = HTMLCanvasElement.prototype;
        const original = prototype.getContext;
        (window as typeof window & { __restoreE4Canvas?: () => void })
            .__restoreE4Canvas = () => { prototype.getContext = original; };
        prototype.getContext = function (
            this: HTMLCanvasElement,
            ...args: Parameters<typeof original>
        ) {
            if (this.classList.contains('overlay-canvas')) return null;
            return original.apply(this, args) as ReturnType<typeof original>;
        } as typeof original;
    });
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await page.getByTestId('editor-overlay-feature-menu')
        .locator('[data-feature-id="mfcc"]')
        .click();
    await expect(page.getByTestId('editor-overlay-retry')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('editor-buffer-state')).toHaveText('波形已就绪');
    const surface = page.locator('[data-testid^="marker-surface-"]').first();
    const surfaceBounds = await surface.boundingBox();
    expect(surfaceBounds).toBeTruthy();
    await page.mouse.click(
        surfaceBounds!.x + surfaceBounds!.width * 0.75,
        surfaceBounds!.y + surfaceBounds!.height * 0.8,
    );
    await expect(page.locator('.marker-point')).toHaveCount(1);
    await page.evaluate(() => {
        (window as typeof window & { __restoreE4Canvas?: () => void })
            .__restoreE4Canvas?.();
        document.querySelector<HTMLButtonElement>(
            '[data-testid="editor-overlay-retry"]',
        )?.click();
    });
    await expect(page.getByTestId('editor-analysis-overlay-panel'))
        .toHaveAttribute('data-renderer-error', 'false');
    expect(issues).toEqual([]);
});

for (const width of [1_024, 1_280, 1_920]) {
    test(`keeps overlay inside the marker column at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openE4(page);
        await selectOverlay(page, 'rms');
        const surface = page.locator('[data-testid^="marker-surface-"]').first();
        await surface.scrollIntoViewIfNeeded();
        const [surfaceBounds, panelBounds] = await Promise.all([
            surface.boundingBox(),
            page.getByTestId('editor-analysis-overlay-panel').boundingBox(),
        ]);
        expect(surfaceBounds).toBeTruthy();
        expect(panelBounds).toBeTruthy();
        expect(Math.abs(surfaceBounds!.x - panelBounds!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(surfaceBounds!.width - panelBounds!.width)).toBeLessThanOrEqual(1);
    });
}
