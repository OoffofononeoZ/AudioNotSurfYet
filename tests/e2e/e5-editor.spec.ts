import { expect, test } from '@playwright/test';
import { addMarkerLane, clickMarkerTime, markerSurface, prepareMarkerEditor, seekMarkerEditor } from '../support/editor-marking';

test('pending range keeps its category and only commits after a valid second click',async({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'range'); await page.locator('[data-testid^="add-range-inner-class-"]').click();
    await clickMarkerTime(markerSurface(page,'range'),1);
    await clickMarkerTime(markerSurface(page,'range',1),2); await expect(page.getByTestId('marker-pending')).toContainText('1.000');
    await expect(page.getByTestId('point-workspace-status')).toContainText('原分类');
    await clickMarkerTime(markerSurface(page,'range'),.5); await expect(page.locator('.marker-range')).toHaveCount(0);
    await clickMarkerTime(markerSurface(page,'range'),2); await expect(page.locator('.marker-range')).toHaveCount(1);
    await clickMarkerTime(markerSurface(page,'range'),3); await page.keyboard.press('Escape'); await expect(page.getByTestId('marker-pending')).toHaveCount(0);
});

test('range drag previews roll back on capture loss while keyboard endpoints persist',async({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'range'); const surface=markerSurface(page,'range');
    await clickMarkerTime(surface,1); await clickMarkerTime(surface,2);
    const range=page.locator('.marker-range'),id=await range.getAttribute('data-event-id'),handle=page.getByTestId(`range-end-handle-${id}`),bounds=(await handle.boundingBox())!;
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2); await page.mouse.down(); await page.mouse.move(bounds.x+100,bounds.y+bounds.height/2,{steps:4});
    await surface.dispatchEvent('pointercancel'); await page.mouse.up(); await expect(range).toHaveAttribute('data-end-seconds','2');
    await handle.focus(); await page.keyboard.press('ArrowRight'); await expect(range).toHaveAttribute('data-end-seconds','2.125');
    await page.reload(); await expect(page.getByTestId('editor-ready')).toBeVisible(); await expect(range).toHaveAttribute('data-end-seconds','2.125');
});

test('range crossing the playhead can be deleted from the future and history cannot receive pointer operations',async({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'range'); const surface=markerSurface(page,'range');
    await clickMarkerTime(surface,1); await clickMarkerTime(surface,6); await seekMarkerEditor(page,4);
    await clickMarkerTime(surface,3,'right'); await expect(page.locator('.marker-range')).toHaveCount(1);
    await clickMarkerTime(surface,5,'right'); await expect(page.locator('.marker-range')).toHaveCount(0);
});

test('endpoint keyboard coarse steps and Home/End stay within the editable window',async({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'range'); const surface=markerSurface(page,'range');
    await clickMarkerTime(surface,1); await clickMarkerTime(surface,2);
    const range=page.locator('.marker-range'), id=await range.getAttribute('data-event-id'), end=page.getByTestId(`range-end-handle-${id}`), start=page.getByTestId(`range-start-handle-${id}`);
    await end.focus(); await page.keyboard.press('Shift+ArrowRight'); await expect(range).toHaveAttribute('data-end-seconds','2.5');
    await page.keyboard.press('Shift+ArrowLeft'); await expect(range).toHaveAttribute('data-end-seconds','2');
    await start.press('Home'); await expect(range).toHaveAttribute('data-start-seconds','0');
    await end.press('End'); await expect(range).toHaveAttribute('data-end-seconds','8.5');
});
