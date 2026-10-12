import { test,expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import { assessEvents } from '../transcription/qualityMetrics';
import { startSystemSampler } from '../processing/systemSampler';
import type { AuxiliaryResult } from '../../src/transcription/auxiliarySeparation';
import type { KnownNote,KnownDrum } from '../transcription/qualityFixtures';
import type { PitchNote } from '../../src/transcription/pitchNotes';
import type { DrumHit } from '../../src/transcription/drumTokens';

test('controlled synthetic quality: simultaneous fast drums and separate/sparse instrument notes',async({page},info) => {
    test.setTimeout(600000);const directory = path.resolve('artifacts/evals/editor-transcription/controlled-quality',`${info.project.name}-${Date.now()}`);await fs.mkdir(directory,{recursive:true});
    const sourceFiles = ['tests/transcription/qualityFixtures.ts','tests/transcription/quality-probe.worker.ts','tests/transcription/qualityMetrics.ts','src/transcription/auxiliarySeparation.ts','src/transcription/pitchModel.ts','src/transcription/pitchNotes.ts','src/transcription/drumModel.ts','src/transcription/modelManifest.ts'];
    const sourceHashes = await Promise.all(sourceFiles.map(async file => ({file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')})));
    const issues:string[] = [];page.on('pageerror',error => issues.push(error.message));await page.goto('/tests/transcription/index.html');await page.waitForFunction(() => !!(window as unknown as {__Transcription:unknown}).__Transcription);
    const stop = await startSystemSampler();let answer:{type:string;result?:{knownNotes:KnownNote[];expectedDrums:KnownDrum[];notes:Record<'guitar'|'piano',{notes:PitchNote[]}>;hits:DrumHit[];segments:Array<{truncated:boolean}>;maximumReadFrames:number;auxiliary:AuxiliaryResult;totalMs:number}};
    try { answer = await page.evaluate(async() => (window as unknown as {__Transcription:{probe(mode:'quality'):Promise<never>}}).__Transcription.probe('quality')); }
    finally { await fs.writeFile(path.join(directory,'memory.json'),JSON.stringify(await stop(),null,2)); }
    await fs.writeFile(path.join(directory,'raw-result.json'),JSON.stringify(answer,null,2));expect(answer.type,JSON.stringify(answer)).toBe('result');const result = answer.result!;
    const observedNotes = (['piano','guitar'] as const).flatMap(role => result.notes[role].notes.map(note => ({category:role,...note})));
    const noteReport = assessEvents(result.knownNotes.map(note => ({category:note.instrument,...note})),observedNotes),drumReport = assessEvents(result.expectedDrums.map(hit => ({category:hit.drum,startSeconds:hit.startSeconds})),result.hits.map(hit => ({category:hit.drum,startSeconds:hit.startSeconds})));
    const report = {kind:'controlled-synthetic-CC0',qualityAccepted:false,noteReport,drumReport,noTargetNotes:observedNotes.filter(note => note.startSeconds >= 11.4),truncatedSegments:result.segments.filter(segment => segment.truncated).length,issues};
    await fs.writeFile(path.join(directory,'quality-report.json'),JSON.stringify(report,null,2));await info.attach('quality-report',{body:JSON.stringify(report,null,2),contentType:'application/json'});
    for (const stem of result.auxiliary.stems) {
        const data = await page.evaluate(async({directory,name}) => { const root = await navigator.storage.getDirectory(),job = await (await root.getDirectoryHandle('processing-p1')).getDirectoryHandle(directory),file = await (await job.getFileHandle(name)).getFile();const bytes = new Uint8Array(await file.arrayBuffer());let binary = '';for (let at=0;at<bytes.length;at+=32768) binary += String.fromCharCode(...bytes.subarray(at,at+32768));return btoa(binary); },{directory:result.auxiliary.directory,name:stem.wav});await fs.writeFile(path.join(directory,stem.wav),Buffer.from(data,'base64'));
    }
    const inputs = await page.evaluate(async() => {
        const fixtureUrl = '/tests/transcription/qualityFixtures.ts',dspUrl = '/src/processing/dsp.ts';const {instrumentClip,drumQualityClip} = await import(fixtureUrl),{wavHeader,interleave} = await import(dspUrl);
        return await Promise.all([{name:'input-instruments.wav',pcm:instrumentClip(),rate:44100},{name:'input-drums.wav',pcm:drumQualityClip().pcm,rate:24000}].map(async({name,pcm,rate}) => {
            const header = new Uint8Array(wavHeader(pcm.length));new DataView(header.buffer).setUint32(24,rate,true);new DataView(header.buffer).setUint32(28,rate*8,true);
            const bytes = new Uint8Array(await new Blob([header,interleave(pcm,pcm)]).arrayBuffer());let binary = '';for (let at=0;at<bytes.length;at+=32768) binary += String.fromCharCode(...bytes.subarray(at,at+32768));return {name,base64:btoa(binary)};
        }));
    });for (const input of inputs) await fs.writeFile(path.join(directory,input.name),Buffer.from(input.base64,'base64'));
    await fs.writeFile(path.join(directory,'identity.json'),JSON.stringify({recordedAt:new Date().toISOString(),project:info.project.name,userAgent:await page.evaluate(() => navigator.userAgent),sourceHashes,kind:'working-tree-provisional'},null,2));
    expect(result.maximumReadFrames).toBeLessThan(90000);expect(result.totalMs).toBeGreaterThan(0);expect(result.segments).toHaveLength(4);expect(issues).toEqual([]);
});
