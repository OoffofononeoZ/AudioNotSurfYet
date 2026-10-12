import {test,expect,chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startSystemSampler} from '../processing/systemSampler';
import type {createLongAuditionProbe} from '../transcription/auditionHarness';
type Probe=Awaited<ReturnType<typeof createLongAuditionProbe>>;
declare global{interface Window{__longAudition:Probe}}
test('real shared transport: long OPFS source, continuous blocks, stalled reads and release',async({},info)=>{
    test.setTimeout(300000);const directory=path.resolve('artifacts/evals/editor-transcription/long-audition',`${info.project.name}-${Date.now()}`);await fs.mkdir(directory,{recursive:true});
    const sourceFiles=['tests/transcription/auditionHarness.ts','src/audio/audioEngine.ts','src/audio/chunkedAudition.ts','src/processing/stemAuditionSource.ts'];
    const sourceHashes=await Promise.all(sourceFiles.map(async file=>({file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')})));
    const profile=path.join(directory,'profile'),context=await chromium.launchPersistentContext(profile,{channel:info.project.name==='edge'?'msedge':'chrome',headless:true,baseURL:info.project.use.baseURL,viewport:{width:1280,height:900}});
    const page=context.pages()[0]??await context.newPage();
    await page.goto('/tests/transcription/index.html');await fs.writeFile(path.join(directory,'quota-before.json'),JSON.stringify(await page.evaluate(()=>navigator.storage.estimate()),null,2));const stop=await startSystemSampler(),samples:unknown[]=[];
    try{
        await page.evaluate(async()=>{const url='/tests/transcription/auditionHarness.ts';const {createLongAuditionProbe}=await import(url);window.__longAudition=await createLongAuditionProbe();});
        await expect.poll(()=>page.evaluate(()=>window.__longAudition.snapshot().state)).toBe('playing');
        for(let i=0;i<12;i++){await page.waitForTimeout(10000);const snapshot=await page.evaluate(()=>window.__longAudition.snapshot());samples.push(snapshot);expect(snapshot.state).toBe('playing');expect(snapshot.currentTimeSeconds).toBeGreaterThan((i+1)*10-.25);expect(snapshot.maximumReadFrames).toBeLessThanOrEqual(176400);expect(snapshot.activeReads).toBeLessThanOrEqual(1);}
        await page.evaluate(()=>window.__longAudition.stallNext());await expect.poll(()=>page.evaluate(()=>window.__longAudition.snapshot().state),{timeout:18000}).toBe('buffering');
        const frozen=await page.evaluate(()=>window.__longAudition.snapshot());await page.waitForTimeout(700);expect((await page.evaluate(()=>window.__longAudition.snapshot())).currentTimeSeconds).toBeCloseTo(frozen.currentTimeSeconds,2);
        await page.evaluate(()=>window.__longAudition.releaseStall());await expect.poll(()=>page.evaluate(()=>window.__longAudition.snapshot().state)).toBe('playing');
        await page.evaluate(()=>window.__longAudition.pause());await page.evaluate(()=>window.__longAudition.seek(600));expect((await page.evaluate(()=>window.__longAudition.snapshot())).currentTimeSeconds).toBeCloseTo(600,2);await page.evaluate(()=>window.__longAudition.play());await page.waitForTimeout(1000);
        expect((await page.evaluate(()=>window.__longAudition.snapshot())).currentTimeSeconds).toBeGreaterThan(600.8);
        await page.evaluate(()=>window.__longAudition.pause());await page.evaluate(()=>window.__longAudition.seek(890));await page.evaluate(()=>window.__longAudition.failNext());await page.evaluate(()=>window.__longAudition.play());
        await expect.poll(()=>page.evaluate(()=>window.__longAudition.snapshot().error?.code)).toBe('audition-read');const failed=await page.evaluate(()=>window.__longAudition.snapshot());await page.waitForTimeout(300);expect((await page.evaluate(()=>window.__longAudition.snapshot())).currentTimeSeconds).toBeCloseTo(failed.currentTimeSeconds,2);
        await page.evaluate(()=>window.__longAudition.original());const original=await page.evaluate(()=>window.__longAudition.snapshot());expect(original.audition?.kind).toBe('original');expect(original.currentTimeSeconds).toBeCloseTo(failed.currentTimeSeconds,2);expect(original.closed).toBe(1);expect(original.activeReads).toBe(0);
        const residuals=await page.evaluate(()=>window.__longAudition.dispose());expect(residuals).toEqual([]);samples.push(frozen,failed,original);
        await fs.writeFile(path.join(directory,'result.json'),JSON.stringify({profile:'task-owned normal profile',sourceDurationSeconds:900,continuousPlaybackSeconds:120,full900SecondPlayback:false,samples,residuals,sourceHashes,userAgent:await page.evaluate(()=>navigator.userAgent),kind:'controlled-transport-working-tree-provisional'},null,2));
    }finally{
        await fs.writeFile(path.join(directory,'memory.json'),JSON.stringify(await stop(),null,2));await page.evaluate(async()=>{if(window.__longAudition)await window.__longAudition.dispose();}).catch(()=>{});
        await fs.writeFile(path.join(directory,'quota-after.json'),JSON.stringify(await page.evaluate(()=>navigator.storage.estimate()),null,2));await context.close();
        const resolved=path.resolve(profile),ownedRoot=path.resolve('artifacts/evals/editor-transcription/long-audition');
        if(!resolved.startsWith(ownedRoot+path.sep)||path.basename(resolved)!=='profile')throw Error('Unexpected temporary profile path');
        await fs.rm(resolved,{recursive:true,force:true});
    }
});
