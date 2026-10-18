import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

async function openEditor(page: Page, fixture = 'tests/fixtures/audio/format-master.wav') {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [path.resolve(fixture)]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('toggle-editor-timing').click();
    const bpm = page.getByRole('spinbutton', { name: '辅助 BPM', exact: true });
    await bpm.fill('120'); await bpm.press('Enter');
}

async function openTracks(page: Page) {
    await openEditor(page, 'artifacts/fixtures/editor-e2-tempo-100-v1.wav');
    await page.getByTestId('toggle-editor-timing').click();
    await page.getByTestId('editor-timeline').focus(); await page.keyboard.press('Home');
    await expect(page.getByTestId('marker-ruler-time')).toHaveAttribute('data-cursor-seconds', '0');
}
async function addLane(page: Page, kind: 'point' | 'range') {
    await page.getByTestId('add-marker-lane').click(); await page.getByTestId(`add-${kind}-lane`).click();
}
async function clickTime(page: Page, kind: 'marker' | 'range', time: number, button: 'left' | 'right' = 'left') {
    const surface = page.locator(`[data-testid^="${kind}-surface-"]`).first();
    const bounds = await surface.boundingBox(), start = Number(await surface.getAttribute('data-view-start')), end = Number(await surface.getAttribute('data-view-end'));
    await surface.click({ button, position: { x:(time - start) / (end - start) * bounds!.width, y:bounds!.height / 2 } });
}
async function seek(page: Page, time: number) {
    const waveform = page.getByTestId('editor-timeline'); await waveform.focus(); await page.keyboard.press('Home');
    for (let i = 0; i < time; i++) await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('marker-ruler-time')).toHaveAttribute('data-cursor-seconds', String(time));
}

test('fixed playhead, separate zoom, paused boundary and playback without draft writes', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await openTracks(page); await addLane(page,'point');
    await clickTime(page,'marker',.5); await clickTime(page,'marker',1.5);
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(2);
    const ruler = page.getByTestId('marker-ruler-time'), start = await ruler.getAttribute('data-view-start');
    const waveform = page.getByTestId('editor-timeline'); await waveform.hover(); await page.mouse.wheel(0,-500);
    await expect(ruler).toHaveAttribute('data-view-start',start!);
    const state = await page.getByTestId('editor-viewport-state').textContent();
    const surface = page.locator('[data-testid^="marker-surface-"]').first(); await surface.hover(); await page.mouse.wheel(0,-100);
    await expect(page.getByTestId('marker-span')).not.toHaveText('10.00 秒');
    await expect(page.getByTestId('editor-viewport-state')).toHaveText(state!);
    await seek(page,1);
    await clickTime(page,'marker',.5,'right');
    const history = page.locator('[data-testid^="point-marker-"][data-time-seconds="0.5"]');
    await history.focus(); await page.keyboard.press('Delete'); await expect(history).toHaveCount(1);
    await clickTime(page,'marker',.6); await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(2);
    await expect(page.getByTestId('editor-save-state')).toHaveText(/已保存/);
    const draftStamp = () => page.evaluate(() => new Promise<string>((resolve,reject) => {
        const request = indexedDB.open('audionotsurfyet-editor'); request.onerror = () => reject(request.error);
        request.onsuccess = () => { const db = request.result, get = db.transaction('draft').objectStore('draft').get('latest'); get.onsuccess = () => { resolve(get.result.envelope.savedAt); db.close(); }; };
    }));
    const saved = await draftStamp();
    await page.getByTestId('toggle-playback').click(); await expect(page.getByTestId('marker-playback-status')).toHaveText('暂停后编辑');
    await expect(page.getByTestId('add-marker-lane')).toBeDisabled();
    await expect(page.locator('[data-testid^="point-lane-name-"]').first()).toBeDisabled();
    await surface.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    expect(await draftStamp()).toBe(saved);
    await page.getByTestId('toggle-playback').click(); await expect(page.getByTestId('add-marker-lane')).toBeEnabled();
    expect(errors).toEqual([]);
});

test('long range survives song navigation and playback; crossing range remains operable from its right side', async ({ page }) => {
    await openTracks(page); await addLane(page,'range');
    await clickTime(page,'range',1); await expect(page.getByTestId('marker-pending')).toContainText('1.000');
    await seek(page,8); await page.getByTestId('toggle-playback').click(); await page.getByTestId('toggle-playback').click();
    await expect(page.getByTestId('marker-pending')).toContainText('1.000');
    await seek(page,8); await clickTime(page,'range',8.5);
    const range = page.locator('[data-testid^="range-marker-"]').first();
    await expect(range).toHaveAttribute('data-start-seconds','1'); await expect(range).toHaveAttribute('data-end-seconds','8.5');
    await expect(page.getByTestId('marker-pending')).toHaveCount(0);
    await range.focus(); await page.keyboard.press('Alt+ArrowRight');
    await expect(range).toHaveAttribute('data-start-seconds','1.125'); await expect(range).toHaveAttribute('data-end-seconds','8.625');
    await expect(page.locator('[data-testid^="range-start-handle-"]').first()).toBeHidden();
    await clickTime(page,'range',8.25,'right'); await expect(range).toHaveCount(0);
    await clickTime(page,'range',9); await seek(page,1); await expect(page.getByTestId('marker-pending')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.getByTestId('marker-pending')).toHaveCount(0);
});

test('switching songs clears pending creation and isolates marker span preferences by song hash',async({page})=>{
    await installFilePickerStub(page); await page.goto('/');
    await chooseFiles(page,['artifacts/fixtures/editor-e2-tempo-100-v1.wav','tests/fixtures/audio/format-master.mp3'].map(value=>path.resolve(value)));
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state','playing');
    await page.getByTestId('header-editor-link').click(); await expect(page.getByTestId('editor-ready')).toBeVisible(); await page.getByTestId('toggle-playback').click();
    await page.getByTestId('tempo-bpm-0').fill('120'); await page.getByTestId('tempo-bpm-0').press('Enter'); await seek(page,0); await addLane(page,'range');
    await clickTime(page,'range',1); await expect(page.getByTestId('marker-pending')).toBeVisible();
    await page.locator('[data-testid^="range-surface-"]').first().hover(); for(let i=0;i<30;i++) await page.mouse.wheel(0,-100);
    await expect(page.getByTestId('marker-span')).toHaveText('1.00 秒');
    await page.getByTestId('toggle-queue').click(); await page.getByTestId('queue-item').nth(1).click();
    await page.getByTestId('editor-track-change-confirm').click(); await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.getByTestId('marker-pending')).toHaveCount(0); await expect(page.getByTestId('marker-span')).toHaveText('10.00 秒');
});

test('left drag selects bars, copies and moves atomically; dragging freezes zoom and Escape cancels', async ({ page }) => {
    await openTracks(page); await addLane(page,'point');
    await clickTime(page,'marker',.5); await clickTime(page,'marker',1);
    await page.getByTestId('toggle-block-mode').click();
    const surface = page.locator('[data-testid^="marker-surface-"]').first(), bounds = (await surface.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * .16,bounds.y + 6); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .32,bounds.y + 6,{ steps:4 }); await page.mouse.up();
    await expect(surface.locator('.marker-block-selection')).toHaveCount(1);
    await surface.focus(); await page.keyboard.press('Control+c');
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(4);
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.locator('[data-testid^="point-marker-"][data-time-seconds="2.625"]')).toHaveCount(1);
    await page.getByTestId('toggle-block-mode').click();
    const marker = page.locator('[data-testid^="point-marker-"][data-time-seconds="0.5"]');
    const before = await page.getByTestId('marker-span').textContent(), rect = (await marker.boundingBox())!;
    await page.mouse.move(rect.x + rect.width/2,rect.y + rect.height/2); await page.mouse.down();
    await page.mouse.move(rect.x + rect.width/2 + bounds.width/10,rect.y + rect.height/2,{steps:3});
    await page.mouse.wheel(0,-100); await expect(page.getByTestId('marker-span')).toHaveText(before!);
    await page.keyboard.press('Escape'); await page.mouse.up(); await expect(marker).toHaveAttribute('data-time-seconds','0.5');
});

test('ordered lane management, session collapse, class migration and confirmed deletion', async ({ page }) => {
    await openTracks(page); await addLane(page,'range'); await addLane(page,'point');
    expect(await page.locator('.marker-lane').evaluateAll(elements => elements.map(element => element.getAttribute('data-testid')?.split('-')[0]))).toEqual(['range','point']);
    const point = page.locator('[data-testid^="point-lane-name-"]'); await point.fill('鼓'); await point.press('Enter'); await expect(point).toHaveValue('鼓');
    await clickTime(page,'marker',.5);
    await page.locator('[data-testid^="add-inner-class-"]').click();
    const names = page.locator('[data-testid^="inner-class-name-"]'); await expect(names).toHaveCount(2);
    await page.locator('[data-testid^="delete-inner-class-"]').first().click();
    await expect(page.getByTestId('inner-class-migration-target')).toBeVisible();
    await page.getByTestId('confirm-inner-class-migration').click(); await expect(names).toHaveCount(1);
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(1);
    const collapse = page.getByRole('button',{name:'折叠轨道 鼓',exact:true}); await collapse.click();
    await expect(page.locator('[data-testid^="marker-surface-"]')).toHaveCount(0);
    await page.getByRole('button',{name:'展开轨道 鼓',exact:true}).click();
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(1);
    await page.getByRole('button',{name:'删除轨道 鼓',exact:true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();
    await expect(point).toHaveCount(1);
    await page.getByRole('button',{name:'删除轨道 鼓',exact:true}).click(); await page.getByRole('dialog').getByTestId('confirm-delete-lane').click();
    await expect(point).toHaveCount(0);
    await page.locator('[data-testid^="delete-lane-"]').click(); await expect(page.getByTestId('add-marker-lane')).toBeFocused();
    await page.reload(); await expect(page.getByTestId('editor-ready')).toBeVisible(); await expect(page.locator('.marker-lane')).toHaveCount(0);
});

test('overlay aligns to marker geometry, row grid and playhead stay within one CSS pixel', async ({ page }) => {
    await openTracks(page); await addLane(page,'point'); await addLane(page,'range');
    await page.getByTestId('editor-overlay-menu-toggle').click();
    await page.getByTestId('editor-overlay-feature-menu').locator('[data-feature-id="rms"]').click();
    const overlay = page.getByTestId('editor-analysis-overlay-panel'); await expect(overlay).toHaveAttribute('data-analysis-state','ready',{timeout:30000});
    await expect(overlay).toHaveAttribute('data-renderer-error','false');
    const error = await page.evaluate(() => {
        const ruler = document.querySelector('.marker-ruler-time')!.getBoundingClientRect(), overlay = document.querySelector('[data-testid="editor-analysis-overlay-panel"]')!.getBoundingClientRect();
        let error = Math.max(Math.abs(ruler.x-overlay.x),Math.abs(ruler.width-overlay.width));
        for (const surface of document.querySelectorAll('.marker-surface')) {
            const bounds = surface.getBoundingClientRect(), playhead = Number.parseFloat(getComputedStyle(surface,'::after').left);
            error = Math.max(error,Math.abs(bounds.x-ruler.x),Math.abs(bounds.width-ruler.width),Math.abs(playhead-bounds.width*.15));
        }
        return error;
    });
    expect(error).toBeLessThanOrEqual(1);
    const surface = page.locator('[data-testid^="marker-surface-"]').first(); await surface.hover(); await page.mouse.wheel(0,-100);
    await expect(overlay).toHaveAttribute('data-renderer-error','false');
});

test('beat rail, compact timing, explicit Tap and independent full-song waveform', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await openEditor(page);
    await expect(page.getByTestId('toggle-editor-timing')).toHaveAttribute('aria-expanded', 'true');
    const panel = page.getByTestId('editor-timing-panel');
    const geometry = await panel.evaluate(element => ({ height: element.getBoundingClientRect().height, parent: document.querySelector('#editor-marking-panel')!.getBoundingClientRect().height }));
    expect(geometry.height).toBeLessThanOrEqual(Math.min(280, geometry.parent * .35) + 1);
    for (const id of ['editor-reveal-playback', 'add-tempo-boundary']) {
        const bounds = await page.getByTestId(id).boundingBox();
        expect(bounds?.width).toBe(30); expect(bounds?.height).toBe(30);
    }
    await page.evaluate(() => {
        const original = performance.now.bind(performance); let time = 10000;
        performance.now = () => time;
        try { for (let i = 0; i < 8; i++) { time += 500; document.querySelector<HTMLButtonElement>('[data-testid="timing-tap"]')!.click(); } }
        finally { performance.now = original; }
    });
    await expect(page.getByTestId('timing-tap-preview')).toHaveText('120 BPM');
    await page.getByTestId('timing-apply-tap').click();
    await page.getByTestId('toggle-editor-timing').click();
    await expect(panel).toHaveCount(0);
    const state = page.getByTestId('editor-viewport-state'), full = await state.textContent();
    const waveform = page.getByTestId('editor-timeline');
    await waveform.hover(); await page.mouse.wheel(0, -500);
    await expect(state).not.toHaveText(full!);
    await waveform.click({ button: 'right', position: { x: 30, y: 40 } });
    await page.getByRole('menuitem', { name: '重置为全曲' }).click();
    await expect(state).toHaveText(full!);
    await page.reload(); await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(state).toHaveText(full!);
    await expect(page.getByTestId('toggle-editor-timing')).toHaveAttribute('aria-expanded', 'false');
    expect(errors).toEqual([]);
});
