import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test,expect,type Page } from '@playwright/test';
import { chooseFiles,installFilePickerStub } from '../support/file-picker';
import { FT_MODELS } from '../../src/processing/modelManifest';
const TRANSCRIPTION_MODELS = (JSON.parse(readFileSync('src/transcription/model-artifacts.json','utf8')) as {models:Array<{file:string}>}).models;
import type { TranscriptionRecord } from '../../src/transcription/resultRepository';
import type { EditorProjectV1 } from '../../src/editor/types';
import { startSystemSampler } from '../processing/systemSampler';

async function records(page:Page):Promise<TranscriptionRecord[]> {
    return page.evaluate(async() => {
        const db = await new Promise<IDBDatabase>((resolve,reject) => { const request = indexedDB.open('editor-transcriptions',1);request.onsuccess = () => resolve(request.result);request.onerror = () => reject(request.error); });
        try { return await new Promise<TranscriptionRecord[]>((resolve,reject) => { const request = db.transaction('results').objectStore('results').getAll();request.onsuccess = () => resolve(request.result);request.onerror = () => reject(request.error); }); } finally { db.close(); }
    });
}
async function project(page:Page):Promise<EditorProjectV1> {
    return page.evaluate(async() => { const url = '/src/editor/editorDraftRepository.ts';const {EditorDraftRepository} = await import(url);const repository = new EditorDraftRepository();try { return (await repository.restore()).project; } finally { repository.close(); } });
}
async function playback(page:Page) {
    return page.evaluate(async() => { const url = '/src/stores/audioSessionStore.ts';const {useAudioSessionStore} = await import(url);return {...useAudioSessionStore().playback}; });
}

test('Editor real FT → five-role candidates → auxiliary audition → atomic apply → restored cache',async({page},info) => {
    test.setTimeout(900000);
    const directory = path.resolve('artifacts/evals/editor-transcription/full-chain',`${info.project.name}-${Date.now()}`);await fs.mkdir(directory,{recursive:true});
    const sourceFiles = ['src/transcription/pipeline.ts','src/transcription/modelManifest.ts','src/transcription/auxiliarySeparation.ts','src/transcription/editorTranscriptionService.ts','src/transcription/resultRepository.ts','src/components/EditorTranscriptionWorkspace.vue'];
    const sourceHashes = await Promise.all(sourceFiles.map(async file => ({file,sha256:createHash('sha256').update(await fs.readFile(file)).digest('hex')})));
    const logs:string[] = [],issues:string[] = [];page.on('pageerror',error => issues.push(error.message));page.on('console',message => { if (['warning','error'].includes(message.type())) logs.push(message.text()); });
    const models = [...FT_MODELS,...TRANSCRIPTION_MODELS];
    for (const pattern of ['https://huggingface.co/**','https://raw.githubusercontent.com/spotify/basic-pitch/**']) await page.route(pattern,route => {
        const file = route.request().url().split('/').at(-1)!,model = models.find(model => model.file === file);
        if (!model) throw Error(`Unexpected model ${file}`);
        const prefix = TRANSCRIPTION_MODELS.some(model => model.file === file) ? 'transcription-models' : 'p1-models';
        return route.fulfill({status:307,headers:{location:`http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 4173}/${prefix}/${file}`,'access-control-allow-origin':'*'}});
    });
    await installFilePickerStub(page);await page.goto('/');await chooseFiles(page,[path.resolve('tests/fixtures/audio/visualizer-v4-cube-swarm-v1.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state','playing',{timeout:30000});
    await page.getByTestId('header-editor-link').click();await expect(page.getByTestId('editor-ready')).toBeVisible({timeout:30000});await page.getByTestId('toggle-playback').click();
    await page.getByTestId('tempo-bpm-0').fill('120');await page.getByTestId('tempo-bpm-0').press('Enter');await page.getByTestId('add-point-lane').click();
    const surface = page.locator('[data-testid^="marker-surface-"]').first(),bounds = await surface.boundingBox();await surface.click({position:{x:bounds!.width*.2,y:bounds!.height/2}});
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(1);await expect.poll(async() => (await project(page)).lanes[0]?.events.length).toBe(1);
    const before = await project(page);
    await page.getByTestId('editor-separation-tab').click();await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state','idle',{timeout:30000});
    const stopSampler = await startSystemSampler(),started = Date.now();let memory:Awaited<ReturnType<typeof stopSampler>>;
    try {
        await page.getByTestId('editor-separate-start').click();
        await expect.poll(() => page.getByTestId('editor-separation').getAttribute('data-state'),{timeout:500000}).toMatch(/^(ready|error|cancelled)$/);
        expect(await page.getByTestId('editor-separation').getAttribute('data-state'),(await page.getByTestId('editor-separation-message').allTextContents()).join(' ')).toBe('ready');
        await page.getByTestId('editor-transcription-tab').click();await expect(page.getByTestId('transcription-start')).toBeEnabled({timeout:30000});await page.getByTestId('transcription-start').click();
        await expect.poll(() => page.getByTestId('editor-transcription').getAttribute('data-state'),{timeout:500000}).toMatch(/^(ready|partial|error|cancelled)$/);
    } finally { memory = await stopSampler();await fs.writeFile(path.join(directory,'memory.json'),JSON.stringify(memory,null,2));await fs.writeFile(path.join(directory,'console.json'),JSON.stringify({logs,issues},null,2)); }
    const status = await page.getByTestId('editor-transcription').getAttribute('data-state');
    await fs.writeFile(path.join(directory,'terminal-records.json'),JSON.stringify(await records(page),null,2));
    expect(status,(await page.getByTestId('transcription-message').allTextContents()).join(' ')).toBe('ready');
    const record = (await records(page))[0]!;expect(record).toBeTruthy();expect(record.bundle.result.completedRoles.sort()).toEqual(['bass','drums','guitar','piano','vocals']);expect(record.bundle.result.failures).toEqual([]);expect(record.bundle.result.candidates.length).toBeGreaterThan(0);
    expect(record.bundle.auxiliary?.stems.map(stem => stem.role)).toEqual(['guitar','piano']);
    for (const stem of record.bundle.auxiliary!.stems) {
        const base64 = await page.evaluate(async({directory,name}) => { const root = await navigator.storage.getDirectory(),job = await (await root.getDirectoryHandle('processing-p1')).getDirectoryHandle(directory),file = await (await job.getFileHandle(name)).getFile();const bytes = new Uint8Array(await file.arrayBuffer());let binary = '';for (let offset=0;offset<bytes.length;offset+=32768) binary += String.fromCharCode(...bytes.subarray(offset,offset+32768));return btoa(binary); },{directory:record.bundle.auxiliary!.directory,name:stem.wav});
        const bytes = Buffer.from(base64,'base64');expect(bytes.length).toBe(44+stem.frames*8);expect(createHash('sha256').update(bytes).digest('hex')).toBe(record.files.find(file => file.name === stem.wav)?.sha256);await fs.writeFile(path.join(directory,stem.wav),bytes);
    }
    await fs.writeFile(path.join(directory,'raw-candidates.json'),JSON.stringify(record,null,2));
    await expect(page.locator('.task-actions')).toContainText('待下载模型 0.0 MiB');
    const defaultPreview = await page.evaluate(async({project,result}) => { const url = '/src/transcription/applyCandidates.ts';const {applyCandidateResult} = await import(url);try { return {project:applyCandidateResult(project,result,{})}; } catch (error) { return {error:String(error)}; } },{project:before,result:record.bundle.result});
    await fs.writeFile(path.join(directory,'default-300ms-preview.json'),JSON.stringify(defaultPreview,null,2));
    await page.getByTestId('transcription-listen-piano').click();await expect.poll(async() => (await playback(page)).audition?.kind).toBe('auxiliary');await expect.poll(async() => (await playback(page)).state).toBe('playing');
    await page.getByTestId('toggle-playback').click();await expect.poll(async() => (await playback(page)).state).toBe('paused');const position = (await playback(page)).currentTimeSeconds;
    await page.getByRole('button',{name:'返回原曲',exact:true}).filter({visible:true}).click();await expect.poll(async() => (await playback(page)).audition?.kind).toBe('original');expect((await playback(page)).currentTimeSeconds).toBeCloseTo(position,3);
    for (const instrument of ['低音','人声','钢琴','吉他','未知乐器']) { const input = page.getByRole('spinbutton',{name:`${instrument}长短分界毫秒`});await input.fill('10000');await input.blur(); }
    const correction = page.getByRole('combobox',{name:'修正候选乐器'}).first();if (await correction.count()) { await correction.selectOption('unknown'); }
    const remove = page.getByRole('button',{name:'删除候选',exact:true}).first();await remove.click();await page.getByRole('checkbox',{name:'显示已删除'}).check();await page.getByRole('button',{name:'恢复候选',exact:true}).first().click();
    await page.getByTestId('transcription-apply').click();await expect(page.getByTestId('transcription-apply'),(await page.getByTestId('transcription-message').allTextContents()).join(' ')).toHaveText('本结果已应用');await expect(page.getByTestId('transcription-apply')).toBeDisabled();
    await expect.poll(async() => (await project(page)).lanes.length).toBeGreaterThan(before.lanes.length);const after = await project(page);expect(after.tempoMap).toEqual(before.tempoMap);expect(after.lanes[0]).toEqual(before.lanes[0]);await fs.writeFile(path.join(directory,'applied-project-v1.json'),JSON.stringify(after,null,2));
    for (const width of [390,1280]) { await page.setViewportSize({width,height:900});await page.screenshot({path:path.join(directory,`review-${width}.png`),fullPage:true});expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true); }
    await page.reload();await expect(page.getByTestId('editor-ready')).toBeVisible({timeout:30000});await page.getByTestId('editor-transcription-tab').click();await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state','ready',{timeout:30000});await expect(page.getByTestId('transcription-apply')).toBeDisabled();expect((await project(page)).lanes).toEqual(after.lanes);
    await page.getByTestId('transcription-start').click();await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state','running');await page.getByTestId('transcription-cancel').click();await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state','cancelled',{timeout:15000});await expect(page.getByTestId('transcription-apply')).toBeDisabled();expect((await records(page))[0]!.bundle.result.id).toBe(record.bundle.result.id);
    for (const instrument of ['低音','人声','钢琴','吉他']) await page.getByRole('checkbox',{name:new RegExp(`^${instrument} Basic Pitch`)}).uncheck();
    const encoderHash = '71f89f6aba1dd74bf2792a9b19f89b4a8ec438362e6429d9578ffd9ea2e5320f';
    await page.evaluate(async hash => { const url = '/src/processing/storage.ts';const {databasePut} = await import(url);await databasePut('models',hash,new Blob(['damaged']),new AbortController().signal); },encoderHash);
    await page.getByTestId('transcription-start').click();await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state','error',{timeout:30000});await expect(page.getByTestId('transcription-message')).toContainText('Model size mismatch');await expect(page.getByTestId('transcription-apply')).toBeDisabled();expect((await records(page))[0]!.bundle.result.id).toBe(record.bundle.result.id);
    await page.getByTestId('transcription-listen-guitar').click();await expect.poll(async() => (await playback(page)).audition?.kind).toBe('auxiliary');
    await page.getByRole('button',{name:'清理辅助音频与候选缓存',exact:true}).click();await page.getByTestId('transcription-confirm-clear').click();await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state','idle',{timeout:30000});expect(await records(page)).toEqual([]);await expect.poll(async() => (await playback(page)).audition?.kind).toBe('original');expect((await project(page)).lanes).toEqual(after.lanes);
    await fs.writeFile(path.join(directory,'identity.json'),JSON.stringify({recordedAt:new Date().toISOString(),project:info.project.name,userAgent:await page.evaluate(() => navigator.userAgent),totalWallMs:Date.now()-started,sourceHashes,kind:'working-tree-provisional',status,qualityAccepted:false},null,2));
    await info.attach('full-chain-record',{body:JSON.stringify({directory,result:record.bundle.result,issues,logs},null,2),contentType:'application/json'});expect(issues).toEqual([]);
});
