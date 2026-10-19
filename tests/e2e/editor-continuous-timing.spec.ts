import { expect, test } from '@playwright/test';
import { prepareMarkerEditor, addMarkerLane, markerSurface, clickMarkerTime } from '../support/editor-marking';

test('BPM boundaries use continuous song time for creation, dragging, keyboard changes and restore', async ({
    page,
}) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await clickMarkerTime(markerSurface(page, 'point'), 1);
    const wave = page.getByTestId('editor-timeline');
    const bounds = (await wave.boundingBox())!;
    await wave.click({ position: { x: (bounds.width * 2.037) / 12, y: 20 } });
    const cursor = Number(await page.locator('#music-bar-container').getAttribute('data-current-time'));
    await page.getByTestId('add-tempo-boundary').click();
    const boundary = page.locator('button[data-testid^="tempo-boundary-"]').first();
    const time = async () => Number(await boundary.getAttribute('data-time-seconds'));
    expect(await time()).toBeCloseTo(cursor, 5);
    expect(Math.abs(cursor * 8 - Math.round(cursor * 8))).toBeGreaterThan(0.01);
    await boundary.focus();
    await boundary.press('ArrowRight');
    expect(await time()).toBeCloseTo(cursor + 0.001, 5);
    await boundary.press('Shift+ArrowLeft');
    expect(await time()).toBeCloseTo(cursor - 0.009, 5);
    const initial = await time(),
        rect = (await boundary.boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 + 13, rect.y + rect.height / 2);
    const first = await time();
    await page.mouse.move(rect.x + rect.width / 2 + 14, rect.y + rect.height / 2);
    await expect.poll(time).toBeGreaterThan(first);
    expect((await time()) - first).toBeCloseTo(12 / bounds.width, 4);
    await page.keyboard.press('Escape');
    await expect.poll(time).toBeCloseTo(initial, 5);
    await page.mouse.up();
    expect(await time()).toBeCloseTo(initial, 5);
    await page.getByRole('button', { name: '增大节拍细分', exact: true }).click();
    await boundary.focus();
    await boundary.press('ArrowRight');
    expect(await time()).toBeCloseTo(initial + 0.001, 5);
    await expect(page.locator('.marker-point')).toHaveAttribute('data-time-seconds', '1');
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    expect(await time()).toBeCloseTo(initial + 0.001, 5);
});
