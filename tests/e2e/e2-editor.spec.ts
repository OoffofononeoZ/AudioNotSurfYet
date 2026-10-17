import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURE = path.join(
    ROOT,
    'artifacts/fixtures/editor-e2-tempo-100-v1.wav',
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

const openE2 = async (page: Page) => {
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
    await expect(page.getByTestId('editor-timeline')).toBeVisible();
    await expect(page.getByTestId('editor-buffer-state')).toHaveText('波形已就绪', {
        timeout: 30_000,
    });
    // These historical seek/geometry cases intentionally exercise the full-song window.
    await page.getByLabel('标记显示范围', { exact:true }).selectOption('all');
};

test('supports waveform seek, zoom, context pan/menu and keyboard controls', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = issuesFor(page);
    await openE2(page);
    await page.getByTestId('toggle-playback').click();
    const timeline = page.getByTestId('editor-timeline');
    await timeline.scrollIntoViewIfNeeded();
    const bounds = await timeline.boundingBox();
    expect(bounds).toBeTruthy();
    await page.evaluate(() => {
        const output = document.querySelector('[data-testid="playback-progress"]');
        const state = { startedAt: performance.now(), value: null as number | null };
        (window as typeof window & { __e2Feedback?: typeof state }).__e2Feedback = state;
        const observer = new MutationObserver(() => {
            if (state.value !== null) return;
            state.value = performance.now() - state.startedAt;
            observer.disconnect();
        });
        if (output) observer.observe(output, { attributes: true, attributeFilter: ['aria-valuenow'] });
    });
    await page.mouse.click(bounds!.x + bounds!.width * 0.5, bounds!.y + bounds!.height / 2);
    await expect(page.getByTestId('playback-progress')).toHaveAttribute('aria-valuetext', /0:06/, {
        timeout: 1_000,
    });
    await expect.poll(() => page.evaluate(() =>
        (window as typeof window & { __e2Feedback?: { value: number | null } })
            .__e2Feedback?.value ?? null)).not.toBeNull();
    const feedbackMs = await page.evaluate(() =>
        (window as typeof window & { __e2Feedback?: { value: number | null } })
            .__e2Feedback?.value ?? Number.POSITIVE_INFINITY);
    expect(feedbackMs).toBeLessThanOrEqual(100);
    console.log(JSON.stringify({ metric: 'e2-input-feedback-ms', value: feedbackMs }));

    await page.mouse.move(bounds!.x + bounds!.width * 0.25, bounds!.y + bounds!.height / 2);
    await page.mouse.wheel(0, -120);
    await expect(page.getByTestId('editor-reset-viewport')).toBeEnabled();
    const viewportBeforeDrag = await page.getByTestId('editor-viewport-state').textContent();
    await page.mouse.move(bounds!.x + bounds!.width * 0.65, bounds!.y + bounds!.height / 2);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(bounds!.x + bounds!.width * 0.45, bounds!.y + bounds!.height / 2, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await expect(page.getByTestId('editor-viewport-state')).not.toHaveText(viewportBeforeDrag ?? '');
    await page.getByTestId('editor-pan-forward').click();
    await page.getByTestId('editor-pan-back').click();

    await page.mouse.click(bounds!.x + 220, bounds!.y + bounds!.height / 2, { button: 'right' });
    await expect(page.getByTestId('editor-timeline-menu')).toBeVisible();
    await page.getByRole('menuitem', { name: '将此处居中' }).click();

    await timeline.focus();
    await timeline.press('Home');
    await expect(page.getByTestId('playback-progress')).toHaveAttribute('aria-valuetext', /0:00/);
    await timeline.press('End');
    await expect(page.getByTestId('playback-progress')).toHaveAttribute('aria-valuetext', /0:12/);
    await timeline.press('Shift+F10');
    await expect(page.getByTestId('editor-timeline-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('editor-reset-viewport').click();
    expect(issues).toEqual([]);
});

test('estimates BPM, edits tempo segments and restores the project', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = issuesFor(page);
    await openE2(page);
    const firstBpm = page.getByTestId('tempo-bpm-0');
    await expect.poll(async () => Number(await firstBpm.inputValue()), {
        timeout: 30_000,
    }).toBeGreaterThan(99);
    expect(Number(await firstBpm.inputValue())).toBeLessThan(101);

    await page.getByTestId('editor-timeline').click({ position: { x: 500, y: 44 } });
    const addBoundary = page.getByTestId('add-tempo-boundary');
    await addBoundary.click();
    await expect(page.locator('.tempo-segment')).toHaveCount(2);
    const boundary = page.locator('.tempo-lane-boundary:not(.tempo-lane-boundary--fixed)').first();
    const geometryError = await boundary.evaluate((element) => {
        const boundaryBounds = element.getBoundingClientRect();
        const stage = element.parentElement?.getBoundingClientRect();
        const time = Number((element as HTMLElement).dataset.timeSeconds);
        if (!stage) return Number.POSITIVE_INFINITY;
        const actualX = boundaryBounds.left + boundaryBounds.width / 2 - stage.left;
        return Math.abs(actualX - time / 12 * stage.width);
    });
    expect(geometryError).toBeLessThanOrEqual(1);
    console.log(JSON.stringify({ metric: 'e2-geometry-error-css-px', value: geometryError }));
    const boundaryBeforeDrag = await boundary.getAttribute('data-time-seconds');
    const boundaryBounds = await boundary.boundingBox();
    expect(boundaryBounds).toBeTruthy();
    await page.mouse.move(
        boundaryBounds!.x + boundaryBounds!.width / 2,
        boundaryBounds!.y + boundaryBounds!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        boundaryBounds!.x + boundaryBounds!.width / 2 + 80,
        boundaryBounds!.y + boundaryBounds!.height / 2,
        { steps: 5 },
    );
    await page.mouse.up();
    await expect(boundary).not.toHaveAttribute('data-time-seconds', boundaryBeforeDrag ?? '');
    await page.getByTestId('tempo-bpm-0').fill('127.5');
    await page.getByTestId('tempo-bpm-0').blur();
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('127.5');

    await page.getByTestId('tempo-bpm-0').fill('19.999');
    await page.getByTestId('tempo-bpm-0').blur();
    await expect(page.getByText('单拍', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: '切回 4/4' }).first().click();
    await page.getByTestId('tempo-bpm-0').fill('301');
    await page.getByTestId('tempo-bpm-0').blur();
    await expect(page.getByTestId('tempo-live-message')).toHaveText('BPM 不得高于 300。');
    await page.getByTestId('tempo-bpm-0').fill('100');
    await page.getByTestId('tempo-bpm-0').blur();

    await page.reload();
    await expect(page.getByTestId('editor-timeline')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.tempo-segment')).toHaveCount(2);
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('100');
    expect(issues).toEqual([]);
});

for (const width of [1_024, 1_280, 1_920]) {
    test(`keeps timeline geometry inside the Editor shell at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openE2(page);
        const timeline = await page.getByTestId('editor-timeline').boundingBox();
        expect(timeline).toBeTruthy();
        expect(timeline!.x).toBeGreaterThanOrEqual(0);
        expect(timeline!.x + timeline!.width).toBeLessThanOrEqual(width);
        await expect(page.locator('canvas.timeline-canvas')).toHaveCount(3);
    });
}
