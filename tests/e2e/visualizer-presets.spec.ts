import {expect,test,type Page} from '@playwright/test';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {chooseFiles,installFilePickerStub,savedPickerEntries,queuePickerData} from '../support/file-picker';
import {installV6ResourceProbe,readV6ResourceProbe} from '../support/v6-resource-probe';
import type {VisualizerProjectV3} from '../../src/visualizer/compositionTypes';
const audio=path.resolve(import.meta.dirname,'../fixtures/audio/visualizer-v5-avsync-v1.wav');
async function open(page:Page){await page.setViewportSize({width:1920,height:1080});await installFilePickerStub(page);await page.goto('/');await chooseFiles(page,[audio]);await page.getByTestId('header-visualizer-link').click();await expect(page.getByTestId('visualizer-ready')).toBeVisible();if(await page.locator('#music-bar-container').getAttribute('data-playback-state')==='playing')await page.getByTestId('toggle-playback').click();}
async function exported(page:Page):Promise<VisualizerProjectV3>{const count=(await savedPickerEntries(page)).length;await page.getByTestId('export-visualizer-project').click();await expect.poll(async()=>(await savedPickerEntries(page)).length).toBe(count+1);return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64,'base64').toString('utf8'));}
async function importProject(page:Page,p:VisualizerProjectV3){await queuePickerData(page,[{name:'preset.json',mimeType:'application/json',text:JSON.stringify(p)}]);await page.getByTestId('import-visualizer-project').click();await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status','ready');}
async function preset(page:Page,id:string){await page.getByTestId('add-visualizer-element').click();await page.getByRole('button',{name:'预设',exact:true}).click();await page.locator('[data-preset-id="'+id+'"]').click();}

test('native input lists available Web Audio features, persists changes and seeks to the same frame',async({page})=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await preset(page,'geometric-0.6');
    await page.getByRole('button',{name:'外环 · 双重复频谱',exact:true}).click();
    const source=page.getByRole('combobox',{name:'频谱输入数据来源',exact:true}),feature=page.getByRole('combobox',{name:'频谱输入原生特征',exact:true});
    await expect(source).toHaveValue('analysis');await expect(page.getByRole('combobox',{name:'频谱输入分析特征',exact:true})).toHaveValue('wallpaperEngineSpectrum');await source.selectOption('native');await expect(feature.locator('option')).toHaveText(['频谱（立体声）','时域波形']);
    await feature.selectOption('waveform');await expect(page.getByTestId('visualizer-preview-canvas')).toHaveAttribute('data-native-input-state','ready');
    expect((await exported(page)).elements.find(e=>e.type==='radial-spectrum')!.bindings.find(b=>b.parameterId==='spectrum')!.source).toEqual({kind:'native',featureId:'waveform'});
    await source.selectOption('analysis');await expect(page.getByRole('combobox',{name:'频谱输入分析特征',exact:true})).toHaveValue('amplitudeSpectrum');await expect(feature).toHaveCount(0);
    await source.selectOption('native');await expect(feature).toHaveValue('frequency');await expect(page.getByText('已保存',{exact:true})).toBeVisible();await page.reload();await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByRole('button',{name:'外环 · 双重复频谱',exact:true}).click();await expect(source).toHaveValue('native');
    await page.getByTestId('add-visualizer-element').click();await page.getByRole('button',{name:'全部',exact:true}).click();await page.locator('[data-element-type="spectral-strings"]').click();
    await source.selectOption('native');await expect(feature).toHaveValue('frequency');
    await page.getByTestId('visualizer-preview-frame').hover();await page.getByTestId('visualizer-fullscreen-toggle').click();
    const seek=page.getByTestId('visualizer-seek'),canvas=page.getByTestId('visualizer-preview-canvas');
    const at=async(time:string)=>{await seek.fill(time);await seek.dispatchEvent('input');await expect(canvas).toHaveAttribute('data-native-input-state','ready');await expect(canvas).toHaveAttribute('data-frame-time',Number(time).toFixed(6));await page.waitForTimeout(100);return canvas.screenshot();};
    const first=await at('1.2');await at('2');expect((await at('1.2')).equals(first)).toBe(true);expect(errors).toEqual([]);
});

test('browser native FFT keeps stereo frequencies separate',async({page})=>{
    await page.goto('/');
    const result=await page.evaluate(async()=>{
        const modulePath='/src/visualizer/nativeAudioAnalysis.ts';
        const {renderNativeAudioChunk,NATIVE_FFT_SIZE,NATIVE_CHUNK_FRAMES}=await import(/* @vite-ignore */modulePath);
        const rate=48000,length=NATIVE_FFT_SIZE+rate*4;
        const pcm=[250,4000].map(f=>Float32Array.from({length},(_,i)=>i<NATIVE_FFT_SIZE?0:.3*Math.sin(2*Math.PI*f*(i-NATIVE_FFT_SIZE)/rate)));
        const frames=await renderNativeAudioChunk(pcm,rate,()=>false),frequency=frames[30].frequency as number[];
        const left=frequency.slice(0,1024),right=frequency.slice(1024);
        const surround=Array.from({length:6},()=>new Float32Array(length));surround[2]=pcm[0]!;
        const center=(await renderNativeAudioChunk(surround,rate,()=>false))[30].frequency as number[];
        const mono=(await renderNativeAudioChunk([pcm[0]!],rate,()=>false))[30].frequency as number[];
        return {count:frames.length,expected:NATIVE_CHUNK_FRAMES,left:left.indexOf(Math.max(...left)),right:right.indexOf(Math.max(...right)),max:Math.max(...frequency),waveMax:Math.max(...frames[30].waveform),silentMax:Math.max(...frames[0].frequency),center:[Math.max(...center.slice(0,1024)),Math.max(...center.slice(1024))],mono:mono.slice(0,1024).every((v,i)=>v===mono[i+1024])};
    });
    expect(result.count).toBe(result.expected);expect(result.left).toBeLessThan(result.right);expect(result.max).toBeGreaterThan(0);expect(result.waveMax).toBeGreaterThan(0);expect(result.silentMax).toBe(0);
    expect(result.center.every(v=>v>0)).toBe(true);expect(result.mono).toBe(true);
});

test('native input reports an unavailable browser analyser and retries without falling back',async({page})=>{
    await open(page);
    await page.evaluate(()=>{const root=window as unknown as {OfflineAudioContext:unknown;nativeOriginal?:unknown};root.nativeOriginal=root.OfflineAudioContext;root.OfflineAudioContext=class{constructor(){throw Error('native analyser test failure');}};});
    await preset(page,'geometric-0.6');await page.getByRole('button',{name:'外环 · 双重复频谱',exact:true}).click();await page.getByRole('combobox',{name:'频谱输入数据来源',exact:true}).selectOption('native');await expect(page.getByTestId('visualizer-preview-canvas')).toHaveAttribute('data-native-input-state','error');await expect(page.getByRole('alert')).toContainText('native analyser test failure');
    await page.evaluate(()=>{const root=window as unknown as {OfflineAudioContext:unknown;nativeOriginal?:unknown};root.OfflineAudioContext=root.nativeOriginal;delete root.nativeOriginal;});
    await page.getByRole('button',{name:'重试原生输入',exact:true}).click();await expect(page.getByTestId('visualizer-preview-canvas')).toHaveAttribute('data-native-input-state','ready');
});

test('market applies the geometric preset, edits it, restores it and renders silent/active GPU frames',async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await open(page);await preset(page,'geometric-0.6');await expect(page.locator('.viz-element-row')).toHaveCount(11);
    const p=await exported(page);expect(p.elements.filter(e=>e.type==='radial-spectrum')).toHaveLength(2);
    const spectra=p.elements.flatMap(e=>e.bindings.filter(b=>b.parameterId==='spectrum').map(b=>({name:e.name,source:b.source})));
    for(const b of spectra)expect(b.source).toEqual({kind:'analysis',featureId:b.name==='十二频段方块'?'amplitudeSpectrum':'wallpaperEngineSpectrum',projection:{kind:'full'}});
    await importProject(page,p);expect((await exported(page)).elements).toEqual(p.elements);
    await preset(page,'geometric-0.6');await expect(page.locator('.viz-element-row')).toHaveCount(22);
    const added=(await exported(page)).elements.slice(11);
    expect(added.map(e=>e.bindings)).toEqual(p.elements.map(e=>e.bindings));
    const canvas=page.getByTestId('visualizer-preview-canvas');const host=await canvas.getAttribute('data-renderer-host-id');
    p.seed=314159;for(const e of p.elements)for(const b of e.bindings)if(b.parameterId==='spectrum')b.source={kind:'constant',value:[]};
    await importProject(page,p);await page.waitForTimeout(150);await canvas.screenshot({path:`test-results/geometric-idle-${info.project.name}.png`});
    const idle=await canvas.screenshot();
    for(const e of p.elements)for(const b of e.bindings)if(b.parameterId==='spectrum')b.source={kind:'constant',value:Array.from({length:512},(_,i)=>i>=320?0:i%41<2?50:Math.max(0,Math.sin(i*.06))*4)};
    await importProject(page,p);await page.waitForTimeout(150);const active=await canvas.screenshot({path:`test-results/geometric-active-${info.project.name}.png`});expect(active.equals(idle)).toBe(false);
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(host);
    await page.reload();await expect(page.getByTestId('visualizer-ready')).toBeVisible();await expect(page.locator('.viz-element-row')).toHaveCount(11);
    await page.getByTestId('add-visualizer-element').click();await page.getByRole('button',{name:'预设',exact:true}).click();await page.getByLabel('搜索元素').fill('没有的预设');await expect(page.getByText('没有匹配的预设')).toBeVisible();await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
});

for(const id of ['geometric-0.6','prismatic-voyage'])test(id+' responds to actual audio, survives refresh and records the composition',async({page},info)=>{
    test.setTimeout(60000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await open(page);await preset(page,id);
    await expect.poll(()=>page.evaluate((id)=>{
        const w=window as unknown as {__AUDIO_NOT_SURF_YET_M6__?:{getState():{readyFeatureIds:string[]}}};
        return w.__AUDIO_NOT_SURF_YET_M6__?.getState().readyFeatureIds.includes(id==='geometric-0.6'?'wallpaperEngineSpectrum':'amplitudeSpectrum');
    },id)).toBe(true);
    const p=await exported(page),progress=page.getByRole('slider',{name:'播放进度',exact:true});const rect=await progress.boundingBox();expect(rect).not.toBeNull();await progress.click({position:{x:rect!.width*.4,y:rect!.height/2}});
    const canvas=page.getByTestId('visualizer-preview-canvas');await page.waitForTimeout(150);const actual=await canvas.screenshot({path:`test-results/${id}-real-audio-${info.project.name}.png`});
    const silent=structuredClone(p);for(const e of silent.elements)for(const b of e.bindings)if(b.parameterId==='spectrum')b.source={kind:'constant',value:[]};
    await importProject(page,silent);await page.waitForTimeout(150);expect((await canvas.screenshot()).equals(actual)).toBe(false);
    await importProject(page,p);await page.reload();await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByRole('tab',{name:'状态',exact:true}).click();await expect(page.locator('.viz-status-lines')).toContainText('已就绪');
    await page.getByTestId('visualizer-preview-frame').hover();await page.getByTestId('start-visualizer-export').click();
    await expect(page.getByTestId('add-visualizer-element')).toBeDisabled();await expect(page.locator('[data-export-status=ready]')).toBeVisible({timeout:30000});
    await page.getByTestId('save-visualizer-export').click();await expect.poll(async()=>(await savedPickerEntries(page)).some(e=>e.name.endsWith('.webm'))).toBe(true);
    const saved=(await savedPickerEntries(page)).find(e=>e.name.endsWith('.webm'))!;await mkdir('artifacts/visualizer-composition/presets',{recursive:true});await writeFile(`artifacts/visualizer-composition/presets/${id}-${info.project.name}.webm`,Buffer.from(saved.base64,'base64'));
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

test('geometric GPU resources recover from context loss and leave no extra host or RAF',async({page})=>{
    await installV6ResourceProbe(page);await open(page);await preset(page,'geometric-0.6');await preset(page,'prismatic-voyage');
    const canvas=page.getByTestId('visualizer-preview-canvas');
    await canvas.evaluate(canvas=>{const gl=(canvas as HTMLCanvasElement).getContext('webgl2')!,ext=gl.getExtension('WEBGL_lose_context')!;ext.loseContext();setTimeout(()=>ext.restoreContext(),300);});
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status','recovering');await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status','ready');
    for(let i=0;i<3;i++){
        await page.getByRole('link',{name:'首页',exact:true}).click();await expect.poll(async()=>(await readV6ResourceProbe(page)).visualizerHosts).toBe(0);
        const released=await readV6ResourceProbe(page);expect(released.visualizerRenderers).toBe(0);expect(released.visualizerRafs).toBe(0);expect(released.visualizerCanvases).toBe(0);
        await page.getByTestId('header-visualizer-link').click();await expect(page.getByTestId('visualizer-ready')).toBeVisible();expect((await readV6ResourceProbe(page)).visualizerRenderers).toBe(1);
    }
});

test('optional local music visual review captures both presets at two song sections',async({page},info)=>{
    test.skip(!process.env.VISUALIZER_MUSIC_FILE,'Set VISUALIZER_MUSIC_FILE to a local music file.');test.setTimeout(120000);
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1920,height:1080});await installFilePickerStub(page);await page.goto('/');await chooseFiles(page,[process.env.VISUALIZER_MUSIC_FILE!]);await page.getByTestId('header-visualizer-link').click();await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    if(await page.locator('#music-bar-container').getAttribute('data-playback-state')==='playing')await page.getByTestId('toggle-playback').click();
    const empty=await exported(page);
    for(const id of ['geometric-0.6','prismatic-voyage']) {
        await importProject(page,empty);await preset(page,id);await page.getByRole('tab',{name:'状态',exact:true}).click();await expect(page.locator('.viz-status-lines')).toContainText('已就绪',{timeout:60000});
        await page.getByTestId('visualizer-preview-frame').hover();await page.getByTestId('visualizer-fullscreen-toggle').click();const seek=page.getByTestId('visualizer-seek');
        for(const portion of [.2,.65]){await seek.fill(String(Number((empty.track.durationSeconds*portion).toFixed(3))));await seek.dispatchEvent('input');await page.waitForTimeout(150);await page.getByTestId('visualizer-preview-canvas').screenshot({path:`test-results/music-${id}-${portion}-${info.project.name}.png`});}
        await page.keyboard.press('Escape');
        if(id==='geometric-0.6') {
            if(empty.track.durationSeconds<=8) {
                await page.getByTestId('visualizer-preview-frame').hover();await page.getByTestId('start-visualizer-export').click();
                await expect(page.locator('[data-export-status=ready]')).toBeVisible({timeout:30000});
                await page.getByTestId('save-visualizer-export').click();
                await expect.poll(async()=>(await savedPickerEntries(page)).some(e=>e.name.endsWith('.webm'))).toBe(true);
                const saved=(await savedPickerEntries(page)).find(e=>e.name.endsWith('.webm'))!;
                await mkdir('artifacts/visualizer-composition/presets',{recursive:true});
                await writeFile(`artifacts/visualizer-composition/presets/local-music-${info.project.name}.webm`,Buffer.from(saved.base64,'base64'));
            }
            const analyzer=await exported(page);for(const e of analyzer.elements)for(const b of e.bindings)if(b.parameterId==='spectrum')b.source={kind:'analysis',featureId:'amplitudeSpectrum',projection:{kind:'full'}};
            await importProject(page,analyzer);await expect(page.locator('.viz-status-lines')).toContainText('已就绪',{timeout:60000});
            await page.getByTestId('visualizer-preview-frame').hover();await page.getByTestId('visualizer-fullscreen-toggle').click();
            for(const portion of [.2,.65]){await seek.fill(String(Number((empty.track.durationSeconds*portion).toFixed(3))));await seek.dispatchEvent('input');await page.waitForTimeout(150);await page.getByTestId('visualizer-preview-canvas').screenshot({path:`test-results/music-geometric-analyzer-${portion}-${info.project.name}.png`});}
            await page.keyboard.press('Escape');
        }
    }
    expect(errors).toEqual([]);
});
