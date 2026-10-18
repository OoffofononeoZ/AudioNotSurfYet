import { expect, test } from '@playwright/test';
import { addMarkerLane, clickMarkerTime, markerSurface, prepareMarkerEditor, seekMarkerEditor } from '../support/editor-marking';

test('deleting internal tempo boundaries extends the previous segment without retiming markers',async({page})=>{
    await prepareMarkerEditor(page); await addMarkerLane(page,'point'); await clickMarkerTime(markerSurface(page,'point'),3);
    for(const time of [2,4]) { await seekMarkerEditor(page,time); await page.getByTestId('add-tempo-boundary').click(); }
    await expect(page.locator('.tempo-segment')).toHaveCount(3);
    await page.locator('button[data-testid^="tempo-boundary-"]').last().click({button:'right'});
    await expect(page.locator('.tempo-segment')).toHaveCount(2);
    const first=page.locator('button[data-testid^="tempo-boundary-"]').first(); await first.focus(); await page.keyboard.press('Delete');
    await expect(page.locator('.tempo-segment')).toHaveCount(1); await expect(page.locator('.marker-point')).toHaveAttribute('data-time-seconds','3');
    await expect(page.getByTestId('tempo-boundary-start')).toHaveAttribute('data-time-seconds','0'); await expect(page.getByTestId('tempo-boundary-end')).toHaveAttribute('data-time-seconds','12');
});

for(const dpr of [1,2]) test(`waveform, tempo strip, guide and boundary geometry align at DPR ${dpr}`,async({browser})=>{
    const context=await browser.newContext({deviceScaleFactor:dpr,viewport:{width:1280,height:900}}),page=await context.newPage();
    try {
        await prepareMarkerEditor(page); await seekMarkerEditor(page,2); await page.getByTestId('add-tempo-boundary').click();
        for(const width of [390,1024,1280,1920]) {
            await page.setViewportSize({width,height:900});
            await expect.poll(()=>page.evaluate(()=>{
                const wave=document.querySelector('[data-testid="editor-timeline"]')!.getBoundingClientRect(),tempo=document.querySelector('.tempo-lane-stage')!.getBoundingClientRect();
                const boundary=document.querySelector<HTMLElement>('button[data-testid^="tempo-boundary-"]')!,b=boundary.getBoundingClientRect(),guide=document.querySelector<HTMLElement>('.tempo-boundary-guide[data-time-seconds="2"]')!.getBoundingClientRect();
                const canvas=document.querySelector<HTMLCanvasElement>('.timeline-canvas')!;
                return Math.max(Math.abs(wave.x-tempo.x),Math.abs(wave.width-tempo.width),Math.abs(b.x+b.width/2-tempo.x-2/12*tempo.width),Math.abs(guide.x-b.x-b.width/2),Math.abs(canvas.width-wave.width*devicePixelRatio));
            })).toBeLessThanOrEqual(1);
            await expect(page.getByTestId('editor-timeline')).toHaveCSS('height',width<900?'72px':'88px'); await expect(page.getByTestId('editor-tempo-lane')).toHaveCSS('height','28px');
        }
    } finally { await context.close(); }
});
