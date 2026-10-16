import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

const fixture = path.resolve(import.meta.dirname, '../fixtures/audio/format-master.wav');
const id = 'wallpaperEngineSpectrum';
type Bridge = { getState(): { state: string; cacheState: string; readyFeatureIds: string[] }; getCursorValue(id: string, time: number): Promise<{value: number[]; frameStartSeconds: number}> };
const ready = async (page: Page) => expect.poll(() => page.evaluate(() =>
    { const state=(window as unknown as {__AUDIO_NOT_SURF_YET_M6__: Bridge}).__AUDIO_NOT_SURF_YET_M6__.getState();
        return state.state==='ready' && state.readyFeatureIds.includes('wallpaperEngineSpectrum'); })).toBe(true);

test('first feature exposes stereo charts, sources and exact cached 30Hz cursor values', async ({page}, info) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({width:1280,height:900}); await installFilePickerStub(page); await page.goto('/analyzer');
    const card = page.locator('[data-feature-id="'+id+'"]');
    await expect(page.locator('.original-list .analysis-card').first()).toHaveAttribute('data-feature-id',id);
    await expect(page.locator('.analysis-card')).toHaveCount(22);
    await card.getByRole('button',{name:/展开 .* 特征说明/}).click();
    await expect(card.getByRole('link')).toHaveCount(3);
    await expect(card.getByRole('link',{name:'开发者历史说明（2017）'})).toHaveAttribute('href',/837435817/);
    await chooseFiles(page,[fixture]);
    await page.getByTestId('toggle-playback').click();
    await card.getByRole('button',{name:'展开分析',exact:true}).click();
    await ready(page);
    await page.locator('[data-feature-id="rms"]').getByRole('button',{name:'展开分析',exact:true}).click();
    await ready(page);
    await expect.poll(()=>page.evaluate(() => {
        const state=(window as unknown as {__AUDIO_NOT_SURF_YET_M6__: Bridge}).__AUDIO_NOT_SURF_YET_M6__.getState();
        return state.state === 'ready' && state.cacheState === 'persisted' && state.readyFeatureIds.includes('rms');
    })).toBe(true);
    await expect(card.locator('canvas')).toHaveCount(2);
    await card.getByText('查看 128 项完整精度频谱值', {exact:false}).click();
    await expect(card.locator('tbody tr')).toHaveCount(128);
    await expect(card.locator('tbody tr').nth(64)).toContainText('右 R / 0');
    const sample = async (time: number) => page.evaluate(async time => {
        const api = (window as unknown as {__AUDIO_NOT_SURF_YET_M6__: Bridge}).__AUDIO_NOT_SURF_YET_M6__;
        const result = await api.getCursorValue('wallpaperEngineSpectrum',time);
        return {value:result.value, frameStartSeconds:result.frameStartSeconds};
    },time);
    const first = await sample(1.21); expect(first.value).toHaveLength(128); expect(Math.max(...first.value)).toBeGreaterThan(0);
    expect(first.frameStartSeconds).toBeCloseTo(1.2,10); await sample(2.8); expect(await sample(1.21)).toEqual(first);
    await card.locator('.plot').click({position:{x:250,y:65}});
    await card.screenshot({path:`test-results/wallpaper-spectrum-${info.project.name}.png`});
    await page.reload(); await ready(page);
    expect(await sample(1.21)).toEqual(first);
    await expect.poll(()=>page.evaluate(() => (window as unknown as {__AUDIO_NOT_SURF_YET_M6__: Bridge}).__AUDIO_NOT_SURF_YET_M6__.getState().cacheState)).toBe('hit');
    expect(errors).toEqual([]);
});

test('old Analyzer workspace is cleared and rewritten without losing queue or the current Blob', async ({page}) => {
    await installFilePickerStub(page); await page.goto('/'); await chooseFiles(page,[fixture]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-persistence-state','ready');
    await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('audionotsurfyet-session',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
        await new Promise<void>((resolve,reject)=>{
            const tx=db.transaction(['session','current-analysis-cache'],'readwrite'),store=tx.objectStore('session'),read=store.get('latest');
            read.onsuccess=()=>{const s=read.result;delete s.analyzerWorkspaceVersion;s.featureOrder='obsolete';s.activeCards=[{slot:0,featureId:'rms'}];s.viewport={startSeconds:1,endSeconds:3,zoom:2};s.currentAnalysisCache={obsolete:true};store.put(s,'latest');tx.objectStore('current-analysis-cache').put({obsolete:true},'current');};
            tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
        });db.close();
    });
    await page.reload(); await page.getByRole('link',{name:'Analyzer',exact:true}).click();
    await expect(page.locator('.analysis-card canvas')).toHaveCount(0);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state','paused');
    const saved = await page.evaluate(async()=>{
        const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('audionotsurfyet-session',1);r.onsuccess=()=>resolve(r.result);});
        const s=await new Promise<Record<string,unknown>>(resolve=>{const r=db.transaction('session').objectStore('session').get('latest');r.onsuccess=()=>resolve(r.result);});db.close();return s;
    });
    expect(saved.analyzerWorkspaceVersion).toBe(2);expect(saved.activeCards).toEqual([]);expect(saved).not.toHaveProperty('featureOrder');expect(saved.currentAnalysisCache).toBeUndefined();
    expect(saved.queue).toHaveLength(1);expect(saved.currentBlob).toBeTruthy();expect(saved.handles).toHaveLength(1);
});
