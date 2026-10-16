import { expect,test,type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles,installFilePickerStub } from '../support/file-picker';
const audio=path.resolve(import.meta.dirname,'../fixtures/audio/format-master.wav');
async function open(page:Page){await installFilePickerStub(page);await page.goto('/');await chooseFiles(page,[audio]);await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state','playing');await page.getByTestId('header-visualizer-link').click();await expect(page.getByTestId('visualizer-ready')).toBeVisible();await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status','ready');}
function issues(page:Page){const result:string[]=[];page.on('pageerror',e=>result.push(e.message));page.on('console',m=>{if(m.type()==='error')result.push(m.text());});return result;}
test('keeps video, bottom panel and MusicBar inside the supported viewport',async({page})=>{
    const errors=issues(page);await page.setViewportSize({width:1280,height:720});await open(page);
    for(const viewport of [{width:1024,height:720},{width:1280,height:900},{width:1920,height:1080}]){
        await page.setViewportSize(viewport);await page.waitForTimeout(220);
        const g=await page.evaluate(()=>{const rect=(selector:string)=>document.querySelector(selector)!.getBoundingClientRect();const video=rect('.viz-preview-frame'),stage=rect('.viz-preview-stage'),bar=rect('#music-bar-container'),bottom=rect('.viz-bottom');return{height:innerHeight,document:document.documentElement.scrollHeight,body:document.body.scrollHeight,scrollY,video:{width:video.width,height:video.height,top:video.top,left:video.left},stage:{top:stage.top,left:stage.left,width:stage.width,height:stage.height},bottom:bottom.bottom,barTop:bar.top,canvasCount:document.querySelectorAll('[data-testid=visualizer-preview-canvas]').length,hosts:window.__VISUALIZER_DIAGNOSTICS__?.activeHosts,renderers:window.__VISUALIZER_DIAGNOSTICS__?.activeRenderers};});
        expect(g.document).toBeLessThanOrEqual(g.height);expect(g.body).toBeLessThanOrEqual(g.height);expect(g.scrollY).toBe(0);expect(g.video.width/g.video.height).toBeCloseTo(16/9,2);
        expect(g.video.top+g.video.height/2).toBeCloseTo(g.stage.top+g.stage.height/2,1);expect(g.video.left+g.video.width/2).toBeCloseTo(g.stage.left+g.stage.width/2,1);
        expect(g.stage.top).toBeCloseTo(64,1);expect(g.bottom).toBeLessThanOrEqual(g.barTop+1);expect(g.canvasCount).toBe(1);expect(g.hosts).toBe(1);expect(g.renderers).toBe(1);
        await expect(page.getByTestId('playback-mode')).toBeDisabled();
    }
    expect(errors).toEqual([]);
});
test('isolates sidebar scrolling and uses the shared scrollbar',async({page})=>{
    await page.setViewportSize({width:1920,height:900});await open(page);
    await page.getByTestId('add-visualizer-element').click();await page.locator('[data-element-type=spectral-strings]').click();
    const left=page.locator('.viz-element-items'),right=page.locator('.viz-inspector-fields');
    await page.evaluate(()=>{for(const selector of ['.viz-element-items','.viz-inspector-fields']){const spacer=document.createElement('div');spacer.style.height='1600px';document.querySelector(selector)!.append(spacer);}});
    const styles=await page.evaluate(()=>['.viz-element-items','.viz-inspector-fields'].map(selector=>{const e=document.querySelector(selector)!;const s=getComputedStyle(e);return{class:e.className,width:s.scrollbarWidth,color:s.scrollbarColor,gutter:s.scrollbarGutter};}));expect(styles[0]!.class).toContain('app-scrollbar');expect(styles[1]!.class).toContain('app-scrollbar');expect(styles[0]!.color).toBe(styles[1]!.color);expect(styles[0]!.width).toBe('thin');
    await right.hover();await page.mouse.wheel(0,600);await expect.poll(()=>right.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);expect(await left.evaluate(e=>e.scrollTop)).toBe(0);
    const previous=await right.evaluate(e=>e.scrollTop);await left.hover();await page.mouse.wheel(0,600);await expect.poll(()=>left.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);expect(await right.evaluate(e=>e.scrollTop)).toBe(previous);expect(await page.evaluate(()=>scrollY)).toBe(0);
});
test('navigation resizing changes drawers without replacing Canvas or renderer',async({page})=>{
    await page.setViewportSize({width:1440,height:900});await page.emulateMedia({reducedMotion:'reduce'});await open(page);
    const button=page.getByRole('button',{name:'元素属性',exact:true});await expect(button).toBeVisible();
    const handle=await page.getByTestId('visualizer-preview-canvas').elementHandle();const host=await page.getByTestId('visualizer-preview-canvas').getAttribute('data-renderer-host-id');
    for(const collapsed of [true,false,true]){await page.getByTestId('sidebar-toggle').click();await expect(page.locator('#app-sidebar')).toHaveAttribute('data-collapsed',String(collapsed));if(collapsed){await expect(button).not.toBeVisible();await expect(page.getByTestId('visualizer-elements-panel')).toBeVisible();}else await expect(button).toBeVisible();expect(await page.getByTestId('visualizer-preview-canvas').evaluate((e,original)=>e===original,handle)).toBe(true);expect(await page.getByTestId('visualizer-preview-canvas').getAttribute('data-renderer-host-id')).toBe(host);}
});
