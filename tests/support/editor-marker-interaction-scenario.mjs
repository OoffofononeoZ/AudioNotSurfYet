import { expect } from '@playwright/test';
import { readTimelineProject } from './editor-timeline-scenario.mjs';

async function position(surface, time, y = 8) {
    await surface.scrollIntoViewIfNeeded();
    const rect = await surface.boundingBox();
    const start = Number(await surface.getAttribute('data-view-start'));
    const end = Number(await surface.getAttribute('data-view-end'));
    return { x: rect.x + ((time - start) / (end - start)) * rect.width, y: rect.y + y };
}
async function click(page, surface, time, button = 'left', y = 8) {
    const point = await position(surface, time, y);
    await page.mouse.click(point.x, point.y, { button });
}
async function beginDrag(page, surface, from, to, button = 'left', y = 8) {
    const start = await position(surface, from, y);
    const end = await position(surface, to, y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down({ button });
    await page.mouse.move(end.x, end.y, { steps: 5 });
}

export async function verifyMarkerInteractions(page, screenshot) {
    await page.getByTestId('editor-timeline').focus();
    await page.keyboard.press('Home');
    await page.getByTestId('add-marker-lane').click();
    await page.getByTestId('add-point-lane').click();
    const surface = page.locator('[data-testid^="marker-surface-"]').last();
    const example = page.getByTestId('marker-use-sound-example');
    for (const time of [0.5, 1, 2]) await click(page, surface, time);
    const first = surface.locator('.marker-point').first();
    const id = await first.getAttribute('data-event-id');
    const moving = page.getByTestId(`point-marker-${id}`);
    await click(page, surface, 0.5, 'left', 24);
    await expect(example).toBeVisible();
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
    await beginDrag(page, surface, 0.5, 1, 'left', 24);
    await expect(moving).toHaveAttribute('data-time-seconds', '1');
    await expect(surface.locator('.marker-move-hint')).toBeVisible();
    const durable = await readTimelineProject(page);
    expect(durable.lanes.flatMap(lane => lane.events).find(event => event.id === id).atSeconds).toBe(0.5);
    if (screenshot) await screenshot('point-conflict-preview');
    await page.mouse.up();
    await expect(moving).toHaveAttribute('data-time-seconds', '0.5');
    await beginDrag(page, surface, 0.5, 1, 'left', 24);
    const legal = await position(surface, 1.5, 24);
    await page.mouse.move(legal.x, legal.y, { steps: 3 });
    await expect(surface.locator('.marker-move-hint')).toHaveCount(0);
    await page.mouse.up();
    await expect(moving).toHaveAttribute('data-time-seconds', '1.5');

    // Right-button focus must never create a normal selection, even before release.
    const point = await position(surface, 1.5, 24);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down({ button: 'right' });
    await expect(example).toHaveCount(0);
    await expect(moving).toBeVisible();
    await page.mouse.up({ button: 'right' });
    await expect(moving).toHaveCount(0);
    await click(page, surface, 0.5);

    for (const blockMode of [false, true]) {
        if (blockMode) await page.getByTestId('toggle-block-mode').click();
        await beginDrag(page, surface, 0.4, 1, 'right');
        await expect(surface.locator('.is-deletion')).toBeVisible();
        await expect(example).toHaveCount(0);
        await page.mouse.up({ button: 'right' });
        await expect(surface.locator('.is-deletion')).toBeVisible();
        await expect(surface.locator('.marker-point')).toHaveCount(3);
        await expect(example).toHaveCount(0);
        if (screenshot) await screenshot(`red-selection-${blockMode ? 'block' : 'normal'}`);
        await click(page, surface, 0.75, 'right');
        await expect(surface.locator('.marker-point')).toHaveCount(1);
        await expect(surface.locator('.marker-point')).toHaveAttribute('data-time-seconds', '2');
        if (blockMode) await page.getByTestId('toggle-block-mode').click();
        for (const time of [0.5, 1]) await click(page, surface, time);
    }
    await page.getByTestId('toggle-block-mode').click();
    await beginDrag(page, surface, 0.4, 1);
    await page.mouse.up();
    await expect(example).toBeVisible();
    const blue = surface.locator('.marker-block-selection');
    const blueStyle = await blue.getAttribute('style');
    await beginDrag(page, surface, 0.5, 1.5);
    await expect(surface.locator('.marker-move-hint')).toBeVisible();
    await expect(surface.locator('[data-time-seconds="1.5"]')).toHaveCount(1);
    await page.mouse.up();
    await expect(blue).toHaveAttribute('style', blueStyle);
    await click(page, surface, 0.75, 'right');
    await expect(blue).toHaveCount(0);
    await expect(example).toHaveCount(0);
    await expect(surface.locator('.marker-point')).toHaveCount(3);
    await expect(page.getByTestId('toggle-block-mode')).toHaveAttribute('aria-pressed', 'true');
    await beginDrag(page, surface, 3, 3.5);
    await page.mouse.up();
    await expect(example).toHaveCount(0);
    await page.getByTestId('toggle-block-mode').click();
    await click(page, surface, 3, 'right');
    await expect(page.getByTestId('editor-point-menu')).toHaveCount(0);
    await surface.press('Shift+F10');
    await expect(page.getByTestId('editor-point-menu')).toHaveCount(0);

    await page.getByTestId('add-marker-lane').click();
    await page.getByTestId('add-range-lane').click();
    const ranges = page.locator('[data-testid^="range-surface-"]').last();
    for (const time of [0.5, 1, 1.5, 2]) await click(page, ranges, time);
    const range = ranges.locator('.marker-range').first();
    const rangeId = await range.getAttribute('data-event-id');
    await click(page, ranges, 0.75, 'left', 24);
    await expect(example).toBeVisible();
    await beginDrag(page, ranges, 0.75, 1.75, 'left', 24);
    await expect(range).toHaveAttribute('data-start-seconds', '1.5');
    await expect(ranges.locator('.marker-move-hint')).toBeVisible();
    await page.mouse.up();
    await expect(range).toHaveAttribute('data-start-seconds', '0.5');
    await beginDrag(page, ranges, 1, 1.75, 'left', 24);
    await expect(page.getByTestId(`range-marker-${rangeId}`)).toHaveAttribute('data-end-seconds', '1.75');
    await expect(ranges.locator('.marker-move-hint')).toBeVisible();
    if (screenshot) await screenshot('range-endpoint-conflict-preview');
    await page.mouse.up();
    await expect(range).toHaveAttribute('data-end-seconds', '1');
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
}
