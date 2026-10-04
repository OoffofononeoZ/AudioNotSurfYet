import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { createHash } from 'node:crypto';
import { stagePcm,openPcm,databaseGet,databasePut,removeJob,checkCapacity } from '../../src/processing/storage';
import { verifyBlob,loadModel } from '../../src/processing/modelCache';
import { FT_CONFIG,FT_MODELS } from '../../src/processing/modelManifest';
import { syntheticPort,samples } from './fixture';

class MemoryDirectory {
    files=new Map<string,Blob>();dirs=new Map<string,MemoryDirectory>();
    async getDirectoryHandle(name:string,options?:{create?:boolean}){if(!this.dirs.has(name)){if(!options?.create)throw new DOMException('Not found','NotFoundError');this.dirs.set(name,new MemoryDirectory());}return this.dirs.get(name)!;}
    async removeEntry(name:string){if(!this.dirs.delete(name))throw new DOMException('Not found','NotFoundError');}
    async getFileHandle(name:string,options?:{create?:boolean}){
        if(!this.files.has(name)){if(!options?.create)throw new DOMException('Not found','NotFoundError');this.files.set(name,new Blob());}
        return {getFile:async()=>this.files.get(name),createWritable:async()=>{
            const chunks:Uint8Array<ArrayBuffer>[]=[];
            return {write:async(data:Uint8Array)=>{chunks.push(new Uint8Array(data));},close:async()=>{this.files.set(name,new Blob(chunks));},abort:async()=>{chunks.length=0;}};
        }};
    }
}
let root:MemoryDirectory;
beforeEach(()=>{root=new MemoryDirectory();vi.stubGlobal('navigator',{storage:{getDirectory:async()=>root,estimate:async()=>({usage:0,quota:10*1024**3})}});vi.stubGlobal('indexedDB',fakeIndexedDB);});
afterEach(()=>vi.unstubAllGlobals());
it('stages bounded native stereo PCM and verifies a separately computed identity',async()=>{
    const port=syntheticPort(20000,48000),copy=vi.spyOn(port,'copyDecodedChannelRange');
    const ref=await stagePcm(port,'stage-a',new AbortController().signal);
    expect(copy.mock.calls.every(([range])=>range.length<=16384)).toBe(true);
    const hash=createHash('sha256').update(JSON.stringify({version:FT_CONFIG.sourceHash,...ref.descriptor}));
    for(let start=0;start<20000;start+=16384)for(let ch=0;ch<2;ch++)hash.update(new Uint8Array(samples(ch,start,Math.min(16384,20000-start),48000).buffer));
    expect(ref.hash).toBe(hash.digest('hex'));
    const reader=await openPcm(ref,new AbortController().signal);expect(await reader.read(1,800,16)).toEqual(samples(1,800,16,48000));
    expect(await removeJob('stage-a')).toEqual([]);expect(root.dirs.get('processing-p1')!.dirs.size).toBe(0);
});
it('rejects changed revisions, missing/invalid samples and unsupported channels without publishing partial PCM',async()=>{
    for(const mode of ['stale','missing','nan','channels']){
        const port=syntheticPort(20);if(mode==='channels'){const original=port.getDecodedAudioDescriptor()!;port.getDecodedAudioDescriptor=()=>({...original,channelCount:3});}
        else {const copy=port.copyDecodedChannelRange;port.copyDecodedChannelRange=input=>{if(mode==='missing')return null;if(mode==='nan')return new Float32Array(input.length).fill(NaN);const output=copy(input);port.getDecodedAudioDescriptor=()=>({...syntheticPort(20).getDecodedAudioDescriptor()!,revision:2});return output;};}
        await expect(stagePcm(port,mode,new AbortController().signal)).rejects.toThrow();
        expect(root.dirs.get('processing-p1')?.dirs.size??0).toBe(0);
    }
});
it('rejects truncated and hash-tampered staged PCM before inference',async()=>{
    const ref=await stagePcm(syntheticPort(40),'tamper',new AbortController().signal);
    await expect(openPcm({...ref,hash:'bad'},new AbortController().signal)).rejects.toMatchObject({code:'pcm-hash-mismatch'});
    root.dirs.get('processing-p1')!.dirs.get('tamper')!.files.set('source-0.f32',new Blob([new Uint8Array(1)]));
    await expect(openPcm(ref,new AbortController().signal)).rejects.toMatchObject({code:'pcm-incomplete'});
});
it('cancelled staging and metadata cannot publish complete entries',async()=>{
    const abort=new AbortController();await expect(stagePcm(syntheticPort(20000),'cancel',abort.signal,()=>abort.abort())).rejects.toMatchObject({code:'job-cancelled'});
    expect(root.dirs.get('processing-p1')!.dirs.size).toBe(0);
    await expect(databasePut('results','cancelled',{complete:true},abort.signal)).rejects.toMatchObject({code:'job-cancelled'});
    expect(await databaseGet('results','cancelled')).toBeUndefined();
});
it('checks model bytes, rejects damage/cancellation and reuses only verified blobs',async()=>{
    const bytes=new Uint8Array([1,2,3]),sha=createHash('sha256').update(bytes).digest('hex'),abort=new AbortController();
    await verifyBlob(new Blob([bytes]),3,sha,abort.signal);
    await expect(verifyBlob(new Blob([bytes]),4,sha,abort.signal)).rejects.toMatchObject({code:'model-checksum-mismatch'});
    await expect(verifyBlob(new Blob([bytes]),3,'bad',abort.signal)).rejects.toMatchObject({code:'model-checksum-mismatch'});
    const model={...FT_MODELS[0]!,bytes:3,sha256:sha,url:'https://example.invalid/public-model'};
    const fetchMock=vi.fn(async()=>new Response(bytes));vi.stubGlobal('fetch',fetchMock);
    expect((await loadModel(model,abort.signal,()=>{})).cacheHit).toBe(false);
    expect((await loadModel(model,abort.signal,()=>{})).cacheHit).toBe(true);expect(fetchMock).toHaveBeenCalledTimes(1);
    abort.abort();await expect(verifyBlob(new Blob([bytes]),3,sha,abort.signal)).rejects.toMatchObject({code:'job-cancelled'});
});
it('quota and configured capacity failures never evict complete artifacts',async()=>{
    await stagePcm(syntheticPort(10),'complete',new AbortController().signal);
    vi.stubGlobal('navigator',{storage:{estimate:async()=>({usage:100,quota:200})}});
    await expect(checkCapacity(101)).rejects.toMatchObject({code:'quota-exceeded'});
    await expect(checkCapacity(51,150)).rejects.toMatchObject({code:'cache-full'});
    expect(root.dirs.get('processing-p1')!.dirs.has('complete')).toBe(true);
});
