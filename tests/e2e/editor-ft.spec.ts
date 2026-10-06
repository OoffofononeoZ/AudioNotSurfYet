import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test,expect,type Page } from '@playwright/test';
import { chooseFiles,installFilePickerStub } from '../support/file-picker';
import { FT_MODELS } from '../../src/processing/modelManifest';
import type { EditorStemRecord } from '../../src/processing/editorResultRepository';

const fixture=path.resolve('tests/fixtures/audio/visualizer-v4-cube-swarm-v1.wav');
const output=path.resolve(process.env.EDITOR_FT_ARTIFACT_DIR??'artifacts/evals/editor-ft');
async function openEditor(page:Page){
    await installFilePickerStub(page);await page.goto('/');await chooseFiles(page,[fixture]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state','playing',{timeout:30_000});
    await page.getByTestId('header-editor-link').click();await expect(page.getByTestId('editor-ready')).toBeVisible({timeout:30_000});
    await page.getByTestId('editor-playback-toggle').click();await page.getByTestId('editor-separation-tab').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','idle',{timeout:30_000});
}
async function localModels(page:Page){
    await page.route('https://huggingface.co/StemSplitio/**',route=>{
        const file=route.request().url().split('/').at(-1)!;
        if(!FT_MODELS.some(model=>model.file===file))throw Error('Unexpected model');
        return route.fulfill({status:307,headers:{location:`http://127.0.0.1:${process.env.PLAYWRIGHT_PORT??4173}/p1-models/${file}`,'access-control-allow-origin':'*'}});
    });
}
test('Editor FT layout and preserved manual editing at narrow, desktop and wide widths',async({page},info)=>{
    test.setTimeout(120_000);fs.mkdirSync(output,{recursive:true});const issues:string[]=[];page.on('pageerror',e=>issues.push(e.message));
    await openEditor(page);
    await info.attach('browser-identity',{body:JSON.stringify({channel:info.project.name,version:page.context().browser()?.version(),userAgent:await page.evaluate(()=>navigator.userAgent)}),contentType:'application/json'});
    for(const [width,height]of [[390,844],[1280,900],[1920,1080]]){
        await page.setViewportSize({width,height});await expect(page.getByTestId('editor-separate-start')).toBeVisible();
        const geometry=await page.getByTestId('editor-separation').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,window:innerWidth};});
        expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(geometry.window+1);
        await page.waitForTimeout(350);await page.screenshot({path:path.join(output,`${info.project.name}-idle-${width}.png`),fullPage:true});
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await page.locator('.stem-intro').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    await page.getByTestId('editor-separation-tab').focus();await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('editor-marking-tab')).toBeFocused();await expect(page.getByTestId('editor-timeline')).toBeVisible();
    await page.keyboard.press('End');await expect(page.getByTestId('editor-separation-tab')).toBeFocused();
    await page.getByTestId('editor-marking-tab').click();await expect(page.getByTestId('editor-timeline')).toBeVisible();
    await page.getByTestId('add-point-lane').click();await expect(page.locator('[data-testid^="marker-surface-"]').first()).toBeVisible();
    expect(issues).toEqual([]);
});
test('Editor runs four original FT models, exports exact WAVs, restores cache and explicitly clears it',async({page},info)=>{
    test.setTimeout(600_000);fs.mkdirSync(output,{recursive:true});await localModels(page);
    const issues:string[]=[],logs:string[]=[];page.on('pageerror',e=>issues.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))logs.push(m.text());});
    await page.addInitScript(()=>{
        const OriginalWorker=window.Worker,OriginalContext=window.AudioContext;let workers=0,maxWorkers=0,contexts=0,maxContexts=0;
        window.Worker=class extends OriginalWorker{private ended=false;constructor(url:string|URL,options?:WorkerOptions){super(url,options);workers++;maxWorkers=Math.max(maxWorkers,workers);}override terminate(){if(!this.ended){workers--;this.ended=true;}super.terminate();}};
        window.AudioContext=class extends OriginalContext{constructor(options?:AudioContextOptions){super(options);contexts++;maxContexts=Math.max(maxContexts,contexts);}override async close(){await super.close();contexts--;}};
        Object.defineProperty(window,'__editorFtResources',{get:()=>({workers,maxWorkers,contexts,maxContexts})});
    });
    await openEditor(page);await page.getByTestId('editor-separate-start').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','running');
    await page.getByTestId('editor-marking-tab').click();await page.getByTestId('tempo-bpm-0').fill('120');await page.getByTestId('tempo-bpm-0').press('Enter');await page.getByTestId('add-point-lane').click();
    const surface=page.locator('[data-testid^="marker-surface-"]').first(),bounds=await surface.boundingBox();
    await surface.click({position:{x:bounds!.width*.2,y:bounds!.height/2}});await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(1);
    await page.getByTestId('editor-separation-tab').click();
    await expect.poll(()=>page.getByTestId('editor-separation').getAttribute('data-state'),{timeout:500_000}).toMatch(/^(ready|error|cancelled)$/);
    expect(await page.getByTestId('editor-separation').getAttribute('data-state'),(await page.getByTestId('editor-separation-message').allTextContents()).join(' ')||'FT completion').toBe('ready');
    const records=await page.evaluate(async()=>{
        const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('processing-p1',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
        try{return await new Promise<EditorStemRecord[]>((resolve,reject)=>{const r=db.transaction('editor-results').objectStore('editor-results').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}
    });expect(records).toHaveLength(1);const frames=Math.round(records[0]!.result.source.descriptor.durationSeconds*44100);
    expect(records[0]!.result.provenance.backend).toBe('webgpu');
    expect(records[0]!.result.provenance.models).toEqual(FT_MODELS.map(({role,row,revision,sha256})=>({role,row,revision,sha256})));
    await info.attach('ft-result-identity',{body:JSON.stringify({adapter:records[0]!.result.adapter,provenance:records[0]!.result.provenance,frames,files:records[0]!.files,timings:records[0]!.result.timings}),contentType:'application/json'});
    for(const model of FT_MODELS){
        await expect(page.getByTestId(`editor-stem-${model.role}`)).toBeVisible();
        const downloadPromise=page.waitForEvent('download');await page.getByTestId(`editor-export-${model.role}`).click();const download=await downloadPromise;
        const file=path.join(output,`${info.project.name}-${model.role}.wav`);await download.saveAs(file);const bytes=fs.readFileSync(file);
        expect(bytes.subarray(0,4).toString()).toBe('RIFF');expect(bytes.readUInt16LE(20)).toBe(3);expect(bytes.readUInt32LE(24)).toBe(44100);expect(bytes.length).toBe(44+frames*8);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(records[0]!.files.find(f=>f.name===`${model.role}.wav`)!.sha256);
        let nonzero=0,firstNonFinite=-1;
        for(let at=44;at<bytes.length;at+=4){const value=bytes.readFloatLE(at);if(!Number.isFinite(value)){firstNonFinite=at;break;}if(value!==0)nonzero++;}
        expect(firstNonFinite).toBe(-1);expect(nonzero).toBeGreaterThan(0);
    }
    const slider=page.getByRole('slider',{name:'人声概览，跳转原曲'});await slider.focus();await slider.press('Home');await slider.press('ArrowRight');
    await expect(page.getByTestId('editor-current-time')).toContainText('0:01');
    await slider.blur();
    for(const width of [390,1280,1920]){await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,`${info.project.name}-result-${width}.png`),fullPage:true});}
    const resources=await page.evaluate(()=>(window as unknown as {__editorFtResources:unknown}).__editorFtResources);
    expect(resources).toMatchObject({maxContexts:1});expect((resources as {maxWorkers:number;workers:number}).maxWorkers).toBeLessThanOrEqual(2);
    expect((resources as {workers:number}).workers).toBeLessThanOrEqual(1);
    await page.reload();await expect(page.getByTestId('editor-ready')).toBeVisible({timeout:30_000});await page.getByTestId('editor-separation-tab').click();
    await expect(page.getByTestId('editor-separation-saved')).toHaveText('已恢复本地结果',{timeout:60_000});
    await page.getByTestId('editor-marking-tab').click();await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(1);await page.getByTestId('editor-separation-tab').click();
    await page.getByTestId('editor-separate-start').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','running');
    await page.getByRole('link',{name:'AUDIOSURF',exact:true}).click();await expect(page.getByRole('dialog',{name:'离开 Editor？'})).toBeVisible();
    await page.getByRole('button',{name:'留在此页',exact:true}).click();await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','running');
    await page.getByRole('link',{name:'AUDIOSURF',exact:true}).click();await page.getByRole('button',{name:'仍然离开',exact:true}).click();
    await expect(page).toHaveURL(/\/$/,{timeout:10_000});
    await page.getByTestId('header-editor-link').click();await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('editor-separation-tab').click();await expect(page.getByTestId('editor-separation-saved')).toHaveText('已恢复本地结果',{timeout:60_000});
    await page.getByTestId('editor-separation-storage-toggle').click();await page.getByTestId('editor-clear-stem-results').click();await page.getByTestId('editor-confirm-stem-clear').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','idle');await expect(page.getByTestId('editor-stem-results')).toHaveCount(0);
    await expect(page.getByTestId('editor-model-download-size')).toContainText('四个模型已缓存');
    await page.getByTestId('editor-clear-stem-models').click();await page.getByTestId('editor-confirm-stem-clear').click();await expect(page.getByTestId('editor-model-download-size')).toContainText('待下载模型');
    await info.attach('resources-and-console',{body:JSON.stringify({resources,issues,logs}),contentType:'application/json'});expect(issues).toEqual([]);expect(logs.filter(line=>!line.includes('[W:')&&!line.includes('onnxruntime'))).toEqual([]);
});
test('missing GPU fails explicitly and preserves Editor playback and marking',async({page})=>{
    test.setTimeout(90_000);await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));await openEditor(page);
    await page.getByTestId('editor-separate-start').click();await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','error',{timeout:30_000});
    await expect(page.getByTestId('editor-separation-message')).toContainText('WebGPU');await page.getByTestId('editor-marking-tab').click();
    await expect(page.getByTestId('editor-timeline')).toBeVisible();await page.getByTestId('editor-playback-toggle').click();await expect(page.getByTestId('editor-playback-toggle')).toHaveText('暂停');
});
test('download cancellation and retry failure leave no partial result and allow navigation',async({page})=>{
    test.setTimeout(90_000);await page.route('https://huggingface.co/StemSplitio/**',async route=>{await new Promise(resolve=>setTimeout(resolve,15_000));await route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'offline'}).catch(()=>{});});
    await openEditor(page);await page.getByTestId('editor-separate-start').click();await expect(page.locator('.processing-heading')).toContainText('下载模型',{timeout:30_000});
    await page.getByTestId('editor-separate-cancel').click();await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','cancelled',{timeout:6000});
    await expect(page.getByTestId('editor-stem-results')).toHaveCount(0);await page.getByTestId('editor-separate-start').click();await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','error',{timeout:30_000});
    await expect(page.getByTestId('editor-separation-message')).toContainText('模型下载失败');await page.getByTestId('editor-marking-tab').click();await expect(page.getByTestId('editor-timeline')).toBeVisible();
});
test('switching songs cancels the old Editor task and never presents its result for the new song',async({page})=>{
    test.setTimeout(90_000);await page.route('https://huggingface.co/StemSplitio/**',async route=>{await new Promise(resolve=>setTimeout(resolve,10_000));await route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'offline'}).catch(()=>{});});
    await openEditor(page);const original=page.url();await page.getByTestId('editor-separate-start').click();
    await expect(page.locator('.processing-heading')).toContainText('下载模型',{timeout:30_000});
    await page.getByRole('link',{name:'AUDIOSURF',exact:true}).click();await expect(page).toHaveURL(/\/$/);
    await chooseFiles(page,[path.resolve('tests/fixtures/audio/format-master.wav')]);
    // Appending a file keeps the current song; explicitly select the next song.
    await page.getByTestId('next-track').click();await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state','playing');
    await page.getByTestId('header-editor-link').click();await expect(page.getByTestId('overwrite-conflicting-draft')).toBeVisible();
    await page.getByTestId('overwrite-conflicting-draft').click();await expect(page.getByTestId('editor-ready')).toBeVisible();
    expect(page.url()).not.toBe(original);await page.getByTestId('editor-separation-tab').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','idle');await expect(page.getByTestId('editor-stem-results')).toHaveCount(0);
    await page.waitForTimeout(1000);await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','idle');
});
test('a damaged model is rejected without publishing a partial result',async({page})=>{
    test.setTimeout(60_000);await page.route('https://huggingface.co/StemSplitio/**',route=>route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},body:'damaged-model'}));
    await openEditor(page);await page.getByTestId('editor-separate-start').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','error',{timeout:30_000});
    await expect(page.getByTestId('editor-separation-message')).toContainText('模型校验失败');await expect(page.getByTestId('editor-stem-results')).toHaveCount(0);
    await page.getByTestId('editor-marking-tab').click();await expect(page.getByTestId('editor-timeline')).toBeVisible();
});
test('insufficient browser quota fails before a model request and preserves manual editing',async({page})=>{
    await page.addInitScript(()=>Object.defineProperty(navigator.storage,'estimate',{value:async()=>({usage:1024,quota:2048})}));
    let modelRequests=0;await page.route('https://huggingface.co/StemSplitio/**',route=>{modelRequests++;return route.abort();});
    await openEditor(page);await page.getByTestId('editor-separate-start').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','error');
    await expect(page.getByTestId('editor-separation-message')).toContainText('浏览器存储空间不足');expect(modelRequests).toBe(0);
    await page.getByTestId('editor-marking-tab').click();await expect(page.getByTestId('editor-timeline')).toBeVisible();
});
test('the same restored song retains its native PCM identity',async({page},info)=>{
    await page.addInitScript(async()=>{
        const moduleUrl='/src/audio/audioEngine.ts';const {AudioEngine}=await import(moduleUrl);
        const original=AudioEngine.prototype.getDecodedAudioDescriptor;
        AudioEngine.prototype.getDecodedAudioDescriptor=function(){const descriptor=original.call(this);if(descriptor)(window as unknown as {__editorTestPcmPort:unknown}).__editorTestPcmPort=this;return descriptor;};
    });
    const identity=(header?:import('../../src/types/audio').DecodedAudioDescriptor|null)=>page.evaluate(async header=>{
        const moduleUrl='/src/processing/editorResultRepository.ts';const {nativePcmHash}=await import(moduleUrl);
        const port=(window as unknown as {__editorTestPcmPort:import('../../src/analysis/pcm').DecodedAudioCopyPort}).__editorTestPcmPort;
        return {descriptor:port.getDecodedAudioDescriptor(),hash:await nativePcmHash(port,new AbortController().signal,header??undefined)};
    },header);
    await openEditor(page);const initial=await identity();await page.reload();await expect(page.getByTestId('editor-ready')).toBeVisible({timeout:30_000});
    const restored=await identity(initial.descriptor);await info.attach('native-pcm-identity',{body:JSON.stringify({initial,restored}),contentType:'application/json'});
    expect(restored.hash).toBe(initial.hash);expect({...restored.descriptor,revision:initial.descriptor!.revision}).toEqual(initial.descriptor);
});
