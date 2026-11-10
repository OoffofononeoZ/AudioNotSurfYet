import { expect, test, type Locator, type Page } from '@playwright/test';
import {
    prepareMarkerEditor,
    addMarkerLane,
    markerSurface,
    clickMarkerTime,
    dragMarkerTimes,
    seekMarkerEditor,
} from '../support/editor-marking';
import { verifyMarkerInteractions } from '../support/editor-marker-interaction-scenario.mjs';

test('marker previews, right-button selection and sound-example ownership', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepareMarkerEditor(page);
    await verifyMarkerInteractions(page, name =>
        page.screenshot({ path: `artifacts/editor-marking/${info.project.name}-${name}.png` }),
    );
    expect(errors).toEqual([]);
});

test('completed red selections clear on cancellation and changing editor inputs without deleting', async ({ page }) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    const surface = markerSurface(page, 'point');
    for (const time of [0.5, 1]) await clickMarkerTime(surface, time);
    await page.getByTestId('toggle-block-mode').click();
    for (const action of ['escape', 'blur', 'hidden', 'seek', 'play', 'grid', 'project', 'workspace']) {
        await rightDrag(page, surface, 0.4, 1);
        await page.mouse.up({ button: 'right' });
        await expect(surface.locator('.is-deletion')).toBeVisible();
        if (action === 'escape') await page.keyboard.press('Escape');
        if (action === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        if (action === 'hidden')
            await page.evaluate(() => {
                Object.defineProperty(document, 'hidden', { configurable: true, value: true });
                document.dispatchEvent(new Event('visibilitychange'));
                delete (document as unknown as { hidden?: boolean }).hidden;
            });
        if (action === 'seek') await seekMarkerEditor(page, 1);
        if (action === 'play') {
            await page.getByTestId('toggle-playback').click();
            await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
            await page.getByTestId('toggle-playback').click();
        }
        if (action === 'grid') await page.getByRole('button', { name: '减小节拍细分', exact: true }).click();
        if (action === 'project') await page.locator('[data-testid^="add-inner-class-"]').click();
        if (action === 'workspace') {
            await page.getByTestId('editor-separation-tab').click();
            await page.getByTestId('editor-marking-tab').click();
        }
        await expect(surface.locator('.is-deletion')).toHaveCount(0);
        await seekMarkerEditor(page, 0);
        await expect(surface.locator('.marker-point')).toHaveCount(2);
    }
});

async function rightDrag(page: Page, surface: Locator, from: number, to: number) {
    const rect = (await surface.boundingBox())!,
        start = Number(await surface.getAttribute('data-view-start')),
        end = Number(await surface.getAttribute('data-view-end'));
    const x = (time: number) => rect.x + ((time - start) / (end - start)) * rect.width;
    await page.mouse.move(x(from), rect.y + 8);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(x(to), rect.y + 8, { steps: 5 });
}

test('right drag retains red after release and confirms one class deletion persistently', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await page.locator('[data-testid^="add-inner-class-"]').click();
    const surface = markerSurface(page, 'point'),
        other = markerSurface(page, 'point', 1);
    for (const time of [0.5, 1, 2]) await clickMarkerTime(surface, time);
    await clickMarkerTime(other, 1);
    await page.getByTestId('toggle-block-mode').click();
    await dragMarkerTimes(page, surface, 0.4, 1);
    const blue = await surface
        .locator('.marker-block-selection')
        .evaluate(element => getComputedStyle(element).backgroundColor);
    await rightDrag(page, surface, 1.1, 0.4);
    const red = surface.locator('.marker-block-selection.is-deletion');
    await expect(red).toBeVisible();
    expect(await red.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(blue);
    await expect(surface.locator('.marker-point')).toHaveCount(3);
    await page.screenshot({ path: 'artifacts/editor-marking/block-delete-preview.png' });
    await page.mouse.up({ button: 'right' });
    await expect(surface.locator('.marker-point')).toHaveCount(3);
    await expect(red).toBeVisible();
    await clickMarkerTime(surface, 0.75, 'right', 8);
    await expect(surface.locator('.marker-point')).toHaveCount(1);
    await expect(surface.locator('.marker-point')).toHaveAttribute('data-time-seconds', '2');
    await expect(other.locator('.marker-point')).toHaveCount(1);
    await expect(page.getByTestId('editor-point-menu')).toHaveCount(0);
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(markerSurface(page, 'point').locator('.marker-point')).toHaveCount(1);
    expect(errors).toEqual([]);
});

test('right click clears blue selection; cancelled dragging restores it and ranges delete whole', async ({ page }) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'range');
    const surface = markerSurface(page, 'range');
    for (const time of [0.5, 2, 3, 4]) await clickMarkerTime(surface, time, 'left', 8);
    await page.getByTestId('toggle-block-mode').click();
    await dragMarkerTimes(page, surface, 0.6, 1.2);
    const originalStyle = await surface.locator('.marker-block-selection').getAttribute('style');
    await clickMarkerTime(surface, 1, 'right', 8);
    await expect(surface.locator('.marker-range')).toHaveCount(2);
    await expect(surface.locator('.marker-block-selection')).toHaveCount(0);
    await dragMarkerTimes(page, surface, 0.6, 1.2);
    for (const action of ['escape', 'blur', 'pointercancel']) {
        await rightDrag(page, surface, 1, 3.5);
        await expect(surface.locator('.is-deletion')).toBeVisible();
        if (action === 'escape') await page.keyboard.press('Escape');
        else if (action === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        else await surface.dispatchEvent('pointercancel', { pointerId: 1 });
        await page.mouse.up({ button: 'right' });
        await expect(surface.locator('.is-deletion')).toHaveCount(0);
        await expect(surface.locator('.marker-range')).toHaveCount(2);
        await expect(surface.locator('.marker-block-selection')).toHaveAttribute('style', originalStyle!);
    }
    await rightDrag(page, surface, 1, 1.3);
    await page.mouse.up({ button: 'right' });
    await expect(surface.locator('.marker-range')).toHaveCount(2);
    await clickMarkerTime(surface, 1, 'right', 8);
    await expect(surface.locator('.marker-range')).toHaveCount(1);
    await expect(surface.locator('.marker-range')).toHaveAttribute('data-start-seconds', '3');
    await page.getByTestId('toggle-block-mode').click();
    await clickMarkerTime(surface, 3.5, 'right', 24);
    await expect(surface.locator('.marker-range')).toHaveCount(0);
});
