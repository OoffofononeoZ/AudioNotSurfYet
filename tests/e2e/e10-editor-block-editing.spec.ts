import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/audio/visualizer-v4-cube-swarm-v1.wav');

const captureIssues = (page: Page): string[] => {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
    return issues;
};

const openEditor = async (page: Page) => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [FIXTURE]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 30_000 },
    );
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('editor-buffer-state')).toHaveText('波形已就绪', {
        timeout: 30_000,
    });
    await page.getByTestId('editor-playback-toggle').click();
    await page.getByTestId('tempo-bpm-0').fill('240');
    await page.getByTestId('tempo-bpm-0').press('Enter');
    await page.getByTestId('add-point-lane').click();
};

const drag = async (
    page: Page,
    surface: Locator,
    startRatio: number,
    endRatio: number,
    button: 'left' | 'right',
) => {
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    const y = bounds!.y + bounds!.height / 2;
    await page.mouse.move(bounds!.x + bounds!.width * startRatio, y);
    await page.mouse.down({ button });
    await page.mouse.move(bounds!.x + bounds!.width * endRatio, y, { steps: 8 });
    await page.mouse.up({ button });
};

const createPoint = async (surface: Locator, ratio: number) => {
    const bounds = await surface.boundingBox();
    expect(bounds).toBeTruthy();
    await surface.click({ position: { x: bounds!.width * ratio, y: bounds!.height / 2 } });
};

test('keeps every denominator visible and preserves ordinary editing while block mode is off', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureIssues(page);
    await openEditor(page);
    const denominator = page.locator('.tempo-meter-denominator').first();
    for (const width of [390, 1_024, 1_280, 1_920]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        for (const value of ['1', '2', '4', '8', '16', '32']) {
            await denominator.selectOption(value);
            await expect(denominator).toHaveValue(value);
            const metric = await denominator.evaluate((element) => {
                const select = element as HTMLSelectElement;
                const style = getComputedStyle(select);
                const shell = select.parentElement!.getBoundingClientRect();
                return {
                    width: shell.width,
                    height: shell.height,
                    appearance: style.appearance,
                    paddingRight: Number.parseFloat(style.paddingRight),
                    fontSize: style.fontSize,
                    overflow: select.scrollWidth > select.clientWidth,
                };
            });
            expect(metric).toMatchObject({
                width: 42,
                height: 18,
                appearance: 'none',
                fontSize: '11px',
                overflow: false,
            });
            expect(metric.paddingRight).toBeGreaterThanOrEqual(15);
        }
    }

    const toggle = page.getByTestId('toggle-block-mode');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const surface = page.locator('[data-testid^="marker-surface-"]').first();
    await createPoint(surface, 0.08);
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(1);
    const bounds = await surface.boundingBox();
    await surface.click({
        button: 'right',
        position: { x: bounds!.width * 0.5, y: bounds!.height / 2 },
    });
    await expect(page.getByTestId('editor-point-menu')).toBeVisible();
    expect(issues).toEqual([]);
});

test('selects one lane by measures, copies repeatedly and moves as one atomic block', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 1_280, height: 900 });
    await openEditor(page);
    const surface = page.locator('[data-testid^="marker-surface-"]').first();
    await createPoint(surface, 0.04);
    await createPoint(surface, 0.12);
    const sourceIds = await page.locator('[data-testid^="point-marker-"]')
        .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-point-id')));

    const toggle = page.getByTestId('toggle-block-mode');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await drag(page, surface, 0.01, 0.14, 'right');
    await expect(surface.locator('.marker-block-selection')).toBeVisible();
    await expect(page.getByTestId('point-workspace-status')).toContainText('已选择 2 个标记');

    await surface.focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c');
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(4);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c');
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(6);
    const idsBeforeMove = await page.locator('[data-testid^="point-marker-"]')
        .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-point-id')).sort());

    await page.keyboard.press('Escape');
    await expect(surface.locator('.marker-block-selection')).toHaveCount(0);
    await drag(page, surface, 0.34, 0.48, 'right');
    await drag(page, surface, 0.36, 0.53, 'left');
    const movedIds = await page.locator('[data-testid^="point-marker-"]')
        .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-point-id')).sort());
    expect(movedIds).toEqual(idsBeforeMove);
    expect(movedIds).toEqual(expect.arrayContaining(sourceIds));
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(issues).toEqual([]);
});

test('keeps range selection inside its starting lane and class', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 1_280, height: 900 });
    await openEditor(page);
    const pointSurface = page.locator('[data-testid^="marker-surface-"]').first();
    await createPoint(pointSurface, 0.08);
    await page.getByTestId('add-range-lane').click();
    const rangeSurface = page.locator('[data-testid^="range-surface-"]').first();
    await createPoint(rangeSurface, 0.04);
    await createPoint(rangeSurface, 0.12);
    await expect(page.locator('[data-testid^="range-marker-"]')).toHaveCount(1);
    const pointCount = await page.locator('[data-testid^="point-marker-"]').count();

    await page.getByTestId('toggle-block-mode').click();
    await drag(page, rangeSurface, 0.01, 0.14, 'right');
    await expect(rangeSurface.locator('.marker-block-selection')).toBeVisible();
    await rangeSurface.focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+c' : 'Control+c');
    await expect(page.locator('[data-testid^="range-marker-"]')).toHaveCount(2);
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(pointCount);
    expect(issues).toEqual([]);
});

test('uses the themed native leave dialog and keeps Stay as the safe action', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 1_280, height: 900 });
    await openEditor(page);
    const surface = page.locator('[data-testid^="marker-surface-"]').first();
    await createPoint(surface, 0.12);
    await page.getByRole('link', { name: 'Analyzer' }).click();
    const dialog = page.getByTestId('editor-leave-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('editor-leave-stay')).toBeFocused();
    const style = await dialog.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
            background: computed.backgroundColor,
            radius: computed.borderRadius,
            border: computed.borderTopColor,
        };
    });
    expect(style).toMatchObject({
        background: 'rgb(4, 16, 9)',
        radius: '8px',
        border: 'rgba(101, 255, 169, 0.52)',
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/editor\//);

    await page.getByRole('link', { name: 'Analyzer' }).click();
    await page.getByTestId('editor-leave-suppress').check();
    await page.getByTestId('editor-leave-stay').click();
    await expect(page).toHaveURL(/\/editor\//);
    await page.getByRole('link', { name: 'Analyzer' }).click();
    await page.getByTestId('editor-leave-suppress').check();
    await page.getByTestId('editor-leave-confirm').click();
    await expect(page).toHaveURL(/\/analyzer$/);
    expect(issues).toEqual([]);
});
