import { expect, test } from '@playwright/test';
import { addMarkerLane, clickMarkerTime, markerSurface, prepareMarkerEditor } from '../support/editor-marking';

test('creates unique points with keyboard and mouse and preserves delete semantics',async({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'point'); const surface=markerSurface(page,'point');
    await clickMarkerTime(surface,.5); await surface.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.marker-point')).toHaveCount(1); await expect(page.getByTestId('point-workspace-status')).toContainText('已经有标记');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await expect(page.locator('.marker-point')).toHaveCount(2);
    await clickMarkerTime(surface,.5,'right'); await expect(page.locator('.marker-point')).toHaveCount(1);
    await page.locator('.marker-point').focus(); await page.keyboard.press('Delete'); await expect(page.locator('.marker-point')).toHaveCount(0);
});

test('class migration conflicts are atomic and explicit deletion removes only the source class',async({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'point'); await clickMarkerTime(markerSurface(page,'point'),1);
    await page.locator('[data-testid^="add-inner-class-"]').click(); await clickMarkerTime(markerSurface(page,'point',1),1);
    const source=page.locator('[data-testid^="inner-class-name-"]').first(); await source.fill('鼓'); await source.press('Enter');
    await page.locator('[data-testid^="delete-inner-class-"]').first().click(); await page.getByTestId('confirm-inner-class-migration').click();
    await expect(page.getByRole('dialog')).toContainText('相同时间'); await expect(page.locator('.marker-point')).toHaveCount(2);
    await page.getByTestId('cancel-inner-class-removal').click(); await expect(source).toHaveValue('鼓');
    await page.locator('[data-testid^="delete-inner-class-"]').first().click(); await page.getByTestId('confirm-inner-class-event-deletion').click();
    await expect(page.locator('.marker-point')).toHaveCount(1); await expect(page.locator('[data-testid^="inner-class-name-"]')).toHaveCount(1);
});

test('only events in the marker time window are mounted and waveform changes do not change their time view',async({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'point'); const surface=markerSurface(page,'point');
    await clickMarkerTime(surface,.5); await clickMarkerTime(surface,5);
    const view=await surface.getAttribute('data-view-start'); await page.getByTestId('editor-timeline').press('+'); await page.getByTestId('editor-timeline').press(']');
    await expect(surface).toHaveAttribute('data-view-start',view!); await expect(page.locator('.marker-point')).toHaveCount(2);
    await page.locator('.marker-point[data-time-seconds="5"]').focus();
    await surface.hover(); for(let i=0;i<30;i++) await page.mouse.wheel(0,-100);
    await expect(page.locator('.marker-point')).toHaveCount(1); await expect(page.locator('.marker-point')).toHaveAttribute('data-time-seconds','0.5');
    await expect(surface).toBeFocused();
});
