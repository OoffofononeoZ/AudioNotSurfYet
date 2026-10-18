import { expect, test } from '@playwright/test';
import path from 'node:path';
import { addMarkerLane, clickMarkerTime, markerSurface, prepareMarkerEditor } from '../support/editor-marking';

for (const dpr of [1,2]) test(`separate waveform and marker geometry across viewport, sidebar and MusicBar matrix at DPR ${dpr}`, async ({ browser }, info) => {
    test.setTimeout(180000);
    const context = await browser.newContext({deviceScaleFactor:dpr,viewport:{width:1280,height:900}});
    const page = await context.newPage(), errors:string[] = []; page.on('pageerror',error=>errors.push(error.message));
    try {
        await prepareMarkerEditor(page); await addMarkerLane(page,'point'); await addMarkerLane(page,'range');
        await clickMarkerTime(markerSurface(page,'point'),2);
        await clickMarkerTime(markerSurface(page,'range'),2); await clickMarkerTime(markerSurface(page,'range'),3);
        await page.getByTestId('editor-overlay-menu-toggle').click();
        await page.getByTestId('editor-overlay-feature-menu').locator('[data-feature-id="rms"]').click();
        await expect(page.getByTestId('editor-analysis-overlay-panel')).toHaveAttribute('data-analysis-state','ready');
        await page.getByTestId('toggle-editor-timing').click();
        for (const width of [390,1024,1280,1920]) {
            await page.setViewportSize({width,height:900});
            for (const collapsed of [false,true]) {
                if (width>=768) await page.evaluate(async value=>{ const url='/src/stores/configStore.ts'; const {useConfigstore}=await import(url); useConfigstore().sidebarCollapsed=value; },collapsed);
                for (let style=0;style<3;style++) {
                    const change = page.getByTestId('change-musicbar-style'); await expect(change).toBeEnabled(); await change.click(); await expect(change).toBeEnabled();
                    await expect.poll(()=>page.evaluate(()=>{
                        const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();
                        const editor=rect('[data-testid="editor-page"]'), player=rect('#music-bar-container');
                        const wave=rect('[data-testid="editor-timeline"]'), tempo=rect('.tempo-lane-stage');
                        const ruler=rect('.marker-ruler-time'), overlay=rect('[data-testid="editor-analysis-overlay-panel"]');
                        let markerError=Math.max(Math.abs(ruler.x-overlay.x),Math.abs(ruler.width-overlay.width));
                        for(const surface of document.querySelectorAll('.marker-surface')) { const bounds=surface.getBoundingClientRect(); markerError=Math.max(markerError,Math.abs(bounds.x-ruler.x),Math.abs(bounds.width-ruler.width),Math.abs(Number.parseFloat(getComputedStyle(surface,'::after').left)-bounds.width*.15)); }
                        const marker=document.querySelector<HTMLElement>('.marker-point')!, markerBounds=marker.getBoundingClientRect();
                        const row=marker.closest<HTMLElement>('.marker-surface')!, rowBounds=row.getBoundingClientRect();
                        const start=Number(row.dataset.viewStart),end=Number(row.dataset.viewEnd);
                        markerError=Math.max(markerError,Math.abs(markerBounds.x+markerBounds.width/2-rowBounds.x-(2-start)/(end-start)*rowBounds.width));
                        return Math.max(markerError,Math.abs(wave.x-tempo.x),Math.abs(wave.width-tempo.width),Math.abs(editor.bottom-player.top));
                    })).toBeLessThanOrEqual(1);
                    await expect.poll(()=>page.locator('.marker-grid-canvas,.timeline-canvas').evaluateAll(elements=>Math.max(...elements.map(element=>Math.abs((element as HTMLCanvasElement).width-element.getBoundingClientRect().width*devicePixelRatio))))).toBeLessThanOrEqual(1);
                    const metrics=await page.evaluate(()=>{
                        const panel=document.querySelector('#editor-marking-panel')!.getBoundingClientRect(), timing=document.querySelector('[data-testid="editor-timing-panel"]')!.getBoundingClientRect();
                        const canvasErrors=[...document.querySelectorAll<HTMLCanvasElement>('.marker-grid-canvas,.timeline-canvas')].map(canvas=>Math.abs(canvas.width-canvas.getBoundingClientRect().width*devicePixelRatio));
                        return {height:timing.height,limit:Math.min(280,panel.height*.35),overflow:document.documentElement.scrollWidth-innerWidth,canvasError:Math.max(...canvasErrors),management:document.querySelector('.marker-category-management')!.getBoundingClientRect().width,row:document.querySelector('.marker-surface')!.getBoundingClientRect().height,group:document.querySelector('.marker-lane-heading')!.getBoundingClientRect().height};
                    });
                    expect(metrics.height).toBeLessThanOrEqual(metrics.limit+1); expect(metrics.overflow).toBeLessThanOrEqual(1); expect(metrics.canvasError).toBeLessThanOrEqual(1);
                    expect([160,224]).toContain(metrics.management); expect(metrics.row).toBe(48); expect(metrics.group).toBe(36);
                }
            }
            if(width===390) {
                await page.locator('.editor-timeline-panel').evaluate(element=>element.scrollLeft=100);
                expect(await page.locator('.marker-scroll').evaluate(element=>element.scrollLeft)).toBe(0);
            }
            await page.getByTestId('editor-overlay-toggle').click();
            await page.screenshot({path:path.resolve(`artifacts/editor-marking/${info.project.name}-${width}-dpr${dpr}.png`)});
            await page.getByTestId('editor-overlay-toggle').click();
        }
        await page.getByTestId('toggle-editor-timing').click();
        await markerSurface(page,'point').click({button:'right',position:{x:250,y:8}});
        const menu=page.getByTestId('editor-point-menu'); await expect(menu).toBeVisible();
        await expect(menu.getByRole('menuitem',{name:'将此处居中'})).toHaveCount(0);
        const bounds=(await menu.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(8); expect(bounds.y+bounds.height).toBeLessThanOrEqual(892);
        await page.keyboard.press('Escape'); expect(errors).toEqual([]);
    } finally { await context.close(); }
});
