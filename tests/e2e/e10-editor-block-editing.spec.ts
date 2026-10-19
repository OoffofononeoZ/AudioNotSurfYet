import { expect, test } from '@playwright/test';
import {
    addMarkerLane,
    clickMarkerTime,
    dragMarkerTimes,
    markerSurface,
    prepareMarkerEditor,
    seekMarkerEditor,
} from '../support/editor-marking';

test('left-drag block selection copies only one lane and class, supports expansion and preserves IDs on movement', async ({
    page,
}) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await page.locator('[data-testid^="add-inner-class-"]').click();
    const surface = markerSurface(page, 'point');
    await clickMarkerTime(surface, 0.5);
    await clickMarkerTime(surface, 2.5);
    await clickMarkerTime(markerSurface(page, 'point', 1), 0.5);
    await page.getByTestId('toggle-block-mode').click();
    await dragMarkerTimes(page, surface, 0.4, 2.5);
    await surface.focus();
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(surface.locator('.marker-point')).toHaveCount(4);
    await expect(markerSurface(page, 'point', 1).locator('.marker-point')).toHaveCount(1);
    const ids = await surface
        .locator('.marker-point')
        .evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.eventId).sort());
    await page.keyboard.press('Alt+ArrowRight');
    expect(
        await surface
            .locator('.marker-point')
            .evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.eventId).sort()),
    ).toEqual(ids);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('toggle-block-mode')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('toggle-block-mode')).toHaveAttribute('aria-pressed', 'false');
});

test('crossing ranges join from the future while offscreen history is excluded from new blocks', async ({ page }) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'range');
    const surface = markerSurface(page, 'range');
    await clickMarkerTime(surface, 0, 'left', 8);
    await clickMarkerTime(surface, 1, 'left', 8);
    await clickMarkerTime(surface, 1, 'left', 8);
    await clickMarkerTime(surface, 5, 'left', 8);
    await seekMarkerEditor(page, 4);
    await page.getByTestId('toggle-block-mode').click();
    await dragMarkerTimes(page, surface, 4.1, 5.8);
    await surface.focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.locator('.marker-range')).toHaveAttribute('data-start-seconds', '1.125');
    await expect(page.locator('.marker-range')).toHaveAttribute('data-end-seconds', '5.125');
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(page.locator('.marker-range')).toHaveAttribute('data-end-seconds', '5');
    await seekMarkerEditor(page, 0);
    await expect(page.locator('.marker-range')).toHaveCount(2);
});

test('native leave dialog retains Stay, Escape and explicit suppression', async ({ page }) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await clickMarkerTime(markerSurface(page, 'point'), 1);
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    const dialog = page.getByTestId('editor-leave-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('editor-leave-stay')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/editor/);
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    await page.getByTestId('editor-leave-suppress').check();
    await page.getByTestId('editor-leave-stay').click();
    await expect(page).toHaveURL(/editor/);
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    await page.getByTestId('editor-leave-suppress').check();
    await page.getByTestId('editor-leave-confirm').click();
    await expect(page).toHaveURL(/analyzer$/);
});
