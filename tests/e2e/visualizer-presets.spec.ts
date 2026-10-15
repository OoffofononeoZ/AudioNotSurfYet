import {expect,test,type Page} from '@playwright/test';
import path from 'node:path';
import {chooseFiles,installFilePickerStub,savedPickerEntries,queuePickerData} from '../support/file-picker';
import type {VisualizerProjectV3} from '../../src/visualizer/compositionTypes';
const audio=path.resolve(import.meta.dirname,'../fixtures/audio/visualizer-v5-avsync-v1.wav');
async function open(page:Page){await page.setViewportSize({width:1920,height:1080});await installFilePickerStub(page);await page.goto('/');await chooseFiles(page,[audio]);await page.getByTestId('header-visualizer-link').click();await expect(page.getByTestId('visualizer-ready')).toBeVisible();if(await page.locator('#music-bar-container').getAttribute('data-playback-state')==='playing')await page.getByTestId('toggle-playback').click();}
async function exported(page:Page):Promise<VisualizerProjectV3>{const count=(await savedPickerEntries(page)).length;await page.getByTestId('export-visualizer-project').click();await expect.poll(async()=>(await savedPickerEntries(page)).length).toBe(count+1);return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64,'base64').toString('utf8'));}
async function importProject(page:Page,p:VisualizerProjectV3){await queuePickerData(page,[{name:'preset.json',mimeType:'application/json',text:JSON.stringify(p)}]);await page.getByTestId('import-visualizer-project').click();await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status','ready');}
async function preset(page:Page,id:string){await page.getByTestId('add-visualizer-element').click();await page.getByRole('button',{name:'预设',exact:true}).click();await page.locator('[data-preset-id="'+id+'"]').click();}

test('market applies the geometric preset, edits it, restores it and renders silent/active GPU frames',async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await open(page);await preset(page,'geometric-0.6');await expect(page.locator('.viz-element-row')).toHaveCount(11);
    const p=await exported(page);expect(p.elements.filter(e=>e.type==='radial-spectrum')).toHaveLength(2);
    const canvas=page.getByTestId('visualizer-preview-canvas');const host=await canvas.getAttribute('data-renderer-host-id');
    p.seed=314159;for(const e of p.elements)for(const b of e.bindings)if(b.parameterId==='spectrum')b.source={kind:'constant',value:[]};
    await importProject(page,p);await page.waitForTimeout(150);await canvas.screenshot({path:`test-results/geometric-idle-${info.project.name}.png`});
    const idle=await canvas.screenshot();
    for(const e of p.elements)for(const b of e.bindings)if(b.parameterId==='spectrum')b.source={kind:'constant',value:Array.from({length:512},(_,i)=>i%41<2?50:Math.max(0,Math.sin(i*.06))*4)};
    await importProject(page,p);await page.waitForTimeout(150);const active=await canvas.screenshot({path:`test-results/geometric-active-${info.project.name}.png`});expect(active.equals(idle)).toBe(false);
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(host);
    await page.getByRole('link',{name:'首页',exact:true}).click();await page.getByTestId('header-visualizer-link').click();await expect(page.getByTestId('visualizer-ready')).toBeVisible();await expect(page.locator('.viz-element-row')).toHaveCount(11);
    await page.getByTestId('add-visualizer-element').click();await page.getByRole('button',{name:'预设',exact:true}).click();await page.getByLabel('搜索元素').fill('没有的预设');await expect(page.getByText('没有匹配的预设')).toBeVisible();await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
});

test('PV preset renders four distinct chapters, seeks deterministically and reuses the fullscreen canvas',async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await open(page);await preset(page,'prismatic-voyage');await expect(page.locator('.viz-element-row')).toHaveCount(12);
    const p=await exported(page);p.seed=314159;
    for(const e of p.elements)for(const b of e.bindings)if(b.parameterId==='spectrum')b.source={kind:'constant',value:Array.from({length:512},(_,i)=>Math.max(0,Math.sin(i*.08))*6)};
    await importProject(page,p);
    const canvas=page.getByTestId('visualizer-preview-canvas'),host=await canvas.getAttribute('data-renderer-host-id');
    await page.getByTestId('visualizer-preview-frame').hover();await page.getByTestId('visualizer-fullscreen-toggle').click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
    const seek=page.getByTestId('visualizer-seek');const pictures:Buffer[]=[];
    for(const [name,portion] of [['intro',.08],['drive',.3],['climax',.65],['outro',.9]] as const){await seek.fill(String(Number((p.track.durationSeconds*portion).toFixed(3))));await seek.dispatchEvent('input');await page.waitForTimeout(150);pictures.push(await canvas.screenshot({path:`test-results/pv-${name}-${info.project.name}.png`}));}
    expect(new Set(pictures.map(p=>p.toString('base64'))).size).toBe(4);
    await seek.fill(String(Number((p.track.durationSeconds*.65).toFixed(3))));await seek.dispatchEvent('input');await page.waitForTimeout(150);expect((await canvas.screenshot()).equals(pictures[2]!)).toBe(true);
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(host);await page.keyboard.press('Escape');expect(errors).toEqual([]);
});
