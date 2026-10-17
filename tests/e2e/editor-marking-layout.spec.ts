import { expect, test } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

for (const dpr of [1,2]) test(`marking geometry, timing sidebar and menus across viewport matrix at DPR ${dpr}`, async ({ browser }, info) => {
    test.setTimeout(120000);
    const context = await browser.newContext({ deviceScaleFactor:dpr, viewport:{width:1280,height:900} });
    const page = await context.newPage(), errors:string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await installFilePickerStub(page); await page.goto('/');
        await chooseFiles(page,[path.resolve('tests/fixtures/audio/format-master.wav')]);
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state','playing');
        await page.getByTestId('header-editor-link').click(); await expect(page.getByTestId('editor-ready')).toBeVisible();
        await page.getByTestId('toggle-playback').click();
        await page.getByTestId('tempo-bpm-0').fill('120'); await page.getByTestId('tempo-bpm-0').press('Enter');
        await page.getByTestId('add-point-lane').click(); await page.getByTestId('add-range-lane').click();
        const pointSurface=page.locator('[data-testid^="marker-surface-"]').first();
        await pointSurface.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
        const rangeSurface=page.locator('[data-testid^="range-surface-"]').first();
        await rangeSurface.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
        await page.screenshot({path:path.resolve(`artifacts/editor-marking/${info.project.name}-default-dpr${dpr}.png`)});
        await page.getByTestId('toggle-editor-timing').click();
        for (const width of [390,1024,1280,1920]) {
            await page.setViewportSize({width,height:900});
            for (const collapsed of [false,true]) {
                if (width >= 768) await page.evaluate(async value => {
                    const url='/src/stores/configStore.ts'; const {useConfigstore}=await import(url); useConfigstore().sidebarCollapsed=value;
                },collapsed);
                await expect.poll(() => page.evaluate(() => {
                    const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
                    const wave=rect('[data-testid="editor-timeline"]'),point=rect('.marker-surface'),range=rect('.range-surface');
                    return Math.max(Math.abs(wave.x-point.x),Math.abs(wave.width-point.width),Math.abs(wave.x-range.x),Math.abs(wave.width-range.width));
                })).toBeLessThanOrEqual(1);
                await expect.poll(()=>page.getByTestId('editor-timeline').evaluate(element => {
                    const canvas=element.querySelector('canvas')!;return canvas.width/(element as HTMLElement).clientWidth;
                })).toBeCloseTo(dpr,1);
                const metrics=await page.evaluate(() => {
                    const wave=document.querySelector<HTMLElement>('[data-testid="editor-timeline"]')!,canvas=wave.querySelector('canvas')!;
                    const editor=document.querySelector<HTMLElement>('[data-testid="editor-page"]')!.getBoundingClientRect(),player=document.querySelector('#music-bar-container')!.getBoundingClientRect();
                    return { height:wave.getBoundingClientRect().height,dpr:canvas.width/wave.clientWidth,inset:Math.abs(editor.bottom-player.top),overflow:document.documentElement.scrollWidth-innerWidth };
                });
                expect(metrics.height).toBe(width <= 900 ? 72 : 88); expect(metrics.dpr).toBeCloseTo(dpr,1);
                expect(metrics.inset).toBeLessThanOrEqual(1); expect(metrics.overflow).toBeLessThanOrEqual(1);
            }
            if (width===390) {
                await page.getByTestId('editor-point-workspace').evaluate(element=>element.scrollLeft=100);
                await expect.poll(()=>page.locator('[aria-label="Editor 时间轴"]').evaluate(element=>element.scrollLeft)).toBe(100);
            }
            await page.screenshot({path:path.resolve(`artifacts/editor-marking/${info.project.name}-${width}-dpr${dpr}.png`)});
        }
        await page.getByTestId('toggle-editor-timing').click();
        await page.getByTestId('editor-overlay-toggle').click();
        await page.getByTestId('editor-overlay-feature-menu').locator('[data-feature-id="buffer"]').click();
        await expect(page.getByTestId('editor-analysis-overlay-panel')).toHaveAttribute('data-analysis-state','ready');
        const surface=page.locator('[data-testid^="marker-surface-"]').first();
        await surface.click({button:'right',position:{x:30,y:20}});
        const menu=page.getByTestId('editor-point-menu'); await expect(menu).toBeVisible();
        await menu.getByRole('menuitem',{name:'将此处居中'}).click(); await expect(menu).toHaveCount(0);
        expect(errors).toEqual([]);
    } finally { await context.close(); }
});
