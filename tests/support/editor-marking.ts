import { expect, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from './file-picker';

export async function prepareMarkerEditor(page: Page, fixture = 'artifacts/fixtures/editor-e2-tempo-100-v1.wav') {
    await installFilePickerStub(page); await page.goto('/'); await chooseFiles(page,[path.resolve(fixture)]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state','playing');
    await page.getByTestId('header-editor-link').click(); await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('editor-timeline').focus(); await page.keyboard.press('Home');
    await page.getByTestId('toggle-editor-timing').click();
    const bpm = page.getByRole('spinbutton',{name:'辅助 BPM',exact:true}); await bpm.fill('120'); await bpm.press('Enter');
    await page.getByTestId('toggle-editor-timing').click();
}
export async function addMarkerLane(page: Page, kind: 'point' | 'range') {
    await page.getByTestId('add-marker-lane').click(); await page.getByTestId(`add-${kind}-lane`).click();
}
export const markerSurface = (page: Page, kind: 'point' | 'range', index = 0) => page.locator(`[data-testid^="${kind === 'point' ? 'marker' : 'range'}-surface-"]`).nth(index);
export async function clickMarkerTime(surface: Locator, time: number, button: 'left' | 'right' = 'left', y = 24) {
    await surface.scrollIntoViewIfNeeded(); const bounds = (await surface.boundingBox())!;
    const start = Number(await surface.getAttribute('data-view-start')), end = Number(await surface.getAttribute('data-view-end'));
    await surface.click({button,position:{x:(time-start)/(end-start)*bounds.width,y}});
}
export async function dragMarkerTimes(page: Page, surface: Locator, from: number, to: number, y = 8) {
    await surface.scrollIntoViewIfNeeded(); const bounds = (await surface.boundingBox())!, start = Number(await surface.getAttribute('data-view-start')), end = Number(await surface.getAttribute('data-view-end'));
    const x = (time: number) => bounds.x + (time-start)/(end-start)*bounds.width;
    await page.mouse.move(x(from),bounds.y+y); await page.mouse.down(); await page.mouse.move(x(to),bounds.y+y,{steps:6}); await page.mouse.up();
}
export async function seekMarkerEditor(page: Page, time: number) {
    await page.getByTestId('editor-timeline').focus(); await page.keyboard.press('Home');
    for (let i=0;i<time;i++) await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('marker-ruler-time')).toHaveAttribute('data-cursor-seconds',String(time));
}
