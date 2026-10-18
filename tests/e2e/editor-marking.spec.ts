import { expect, test } from '@playwright/test';
import { addMarkerLane, clickMarkerTime, markerSurface, prepareMarkerEditor, seekMarkerEditor } from '../support/editor-marking';

test('point movement preserves identity, rejects duplicates and cancels on playback, blur or seek', async ({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'point'); const surface=markerSurface(page,'point');
    await clickMarkerTime(surface,.5); await clickMarkerTime(surface,.75);
    const first=page.locator('[data-testid^="point-marker-"][data-time-seconds="0.5"]');
    await first.focus(); await page.keyboard.press('Alt+ArrowRight'); await expect(first).toHaveCount(0);
    const moved=page.locator('[data-testid^="point-marker-"][data-time-seconds="0.625"]');
    await moved.focus(); await page.keyboard.press('Alt+ArrowRight'); await expect(moved).toHaveCount(1);
    await expect(page.getByTestId('point-workspace-status')).toContainText('目标已有');
    const id=await moved.getAttribute('data-event-id');
    for(const cancel of ['blur','seek','play']) {
        const bounds=(await moved.boundingBox())!,row=(await surface.boundingBox())!;
        await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2); await page.mouse.down(); await page.mouse.move(bounds.x+row.width/10,bounds.y+bounds.height/2,{steps:3});
        if(cancel==='blur') await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
        else if(cancel==='seek') await seekMarkerEditor(page,1);
        else { await page.getByTestId('toggle-playback').press('Space'); await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state','playing'); await page.getByTestId('toggle-playback').press('Space'); }
        await page.mouse.up();
        await seekMarkerEditor(page,0); await expect(page.locator(`[data-event-id="${id}"]`)).toHaveAttribute('data-time-seconds','0.625');
    }
});

test('range endpoint edits preserve order, reject overlaps and allow a different category', async ({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'range'); const surface=markerSurface(page,'range');
    await clickMarkerTime(surface,1); await clickMarkerTime(surface,2); await clickMarkerTime(surface,2.5); await clickMarkerTime(surface,3);
    const first=page.locator('[data-testid^="range-marker-"]').first(); const id=await first.getAttribute('data-event-id');
    const end=page.getByTestId(`range-end-handle-${id}`); await end.focus(); await page.keyboard.press('ArrowRight'); await expect(first).toHaveAttribute('data-end-seconds','2.125');
    for(let i=0;i<8;i++) await page.keyboard.press('ArrowRight');
    await expect(first).toHaveAttribute('data-end-seconds','2.5'); await expect(page.getByTestId('point-workspace-status')).toContainText('重叠');
    await page.locator('[data-testid^="add-range-inner-class-"]').click(); const second=markerSurface(page,'range',1);
    await clickMarkerTime(second,1); await clickMarkerTime(second,2); await expect(page.locator('[data-testid^="range-marker-"]')).toHaveCount(3);
    await second.focus(); await page.keyboard.press('ArrowUp'); await expect(surface).toBeFocused();
});

test('subdivision preferences survive zoom and refresh, track span remains separate from V1 viewport', async ({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'point');
    await page.getByLabel('细分预设',{exact:true}).selectOption('custom');
    const custom=page.getByRole('spinbutton',{name:'自定义细分',exact:true}); await custom.fill('12'); await custom.press('Enter');
    await page.getByRole('button',{name:'减小节拍细分',exact:true}).click();
    await expect(page.getByTestId('editor-beat-divisor')).toHaveAttribute('data-divisor','6');
    const surface=markerSurface(page,'point'); await surface.hover(); for(let i=0;i<30;i++) await page.mouse.wheel(0,-100);
    await expect(page.getByTestId('marker-span')).toHaveText('1.00 秒');
    await surface.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await expect(surface).toHaveAttribute('data-candidate-seconds','0.083333');
    await page.reload(); await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.getByTestId('marker-span')).toHaveText('1.00 秒'); await expect(page.getByTestId('editor-beat-divisor')).toHaveAttribute('data-divisor','6'); await expect(custom).toHaveValue('12');
    for(const selector of ['.marker-surface','.marker-category-management']) {
        const allowed=await page.locator(selector).first().evaluate(element=>element.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:100,ctrlKey:true})));
        expect(allowed).toBe(true);
    }
    expect(await page.locator('.marker-category-management').first().evaluate(element=>element.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:100})))).toBe(true);
    await surface.hover(); for(let i=0;i<30;i++) await page.mouse.wheel(0,100); await expect(page.getByTestId('marker-span')).toHaveText('10.00 秒');
});

test('pending range clears on cancel, category deletion, workspace change and route exit', async ({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'range');
    await clickMarkerTime(markerSurface(page,'range'),1); await page.getByTestId('cancel-pending-range').click(); await expect(page.getByTestId('marker-pending')).toHaveCount(0);
    await page.locator('[data-testid^="add-range-inner-class-"]').click();
    await clickMarkerTime(markerSurface(page,'range',1),1); await page.locator('[data-testid^="delete-range-inner-class-"]').nth(1).click(); await expect(page.getByTestId('marker-pending')).toHaveCount(0);
    await clickMarkerTime(markerSurface(page,'range'),1); await page.getByTestId('editor-separation-tab').click(); await page.getByTestId('editor-marking-tab').click(); await expect(page.getByTestId('marker-pending')).toHaveCount(0);
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state','saved');
    await clickMarkerTime(markerSurface(page,'range'),1); await page.getByRole('link',{name:'Analyzer',exact:true}).click();
    if(await page.getByTestId('editor-leave-dialog').isVisible()) await page.getByTestId('editor-leave-confirm').click();
    await expect(page).toHaveURL(/analyzer$/);
    await page.getByTestId('header-editor-link').click(); await expect(page.getByTestId('editor-ready')).toBeVisible(); await expect(page.getByTestId('marker-pending')).toHaveCount(0);
});

test('right-click menus keep focus and fit the window; track right dragging never pans', async ({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'point'); await addMarkerLane(page,'range');
    for(const kind of ['point','range'] as const) {
        const surface=markerSurface(page,kind); await clickMarkerTime(surface,3,'right',8);
        const menu=page.getByTestId(`editor-${kind}-menu`); await expect(menu).toBeVisible(); await expect(menu.getByRole('menuitem').first()).toBeFocused();
        const rect=(await menu.boundingBox())!; expect(rect.y).toBeGreaterThanOrEqual(8); expect(rect.x+rect.width).toBeLessThanOrEqual(page.viewportSize()!.width-8);
        await page.keyboard.press('End'); await expect(menu.getByRole('menuitem').last()).toBeFocused(); await page.keyboard.press('Escape'); await expect(surface).toBeFocused();
        const start=await surface.getAttribute('data-view-start'),wave=await page.getByTestId('editor-viewport-state').textContent(),bounds=(await surface.boundingBox())!;
        await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+8); await page.mouse.down({button:'right'}); await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+8,{steps:5}); await page.mouse.up({button:'right'});
        await expect(surface).toHaveAttribute('data-view-start',start!); await expect(page.getByTestId('editor-viewport-state')).toHaveText(wave!); await page.keyboard.press('Escape');
    }
});
