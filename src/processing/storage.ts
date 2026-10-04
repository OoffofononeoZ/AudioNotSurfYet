import type { DecodedAudioCopyPort } from '../analysis/pcm';
import type { DecodedAudioDescriptor } from '../types/audio';
import { assertFinite } from './dsp';
import type { PcmReader } from './dsp';
import { checkCancelled, FT_CONFIG, ProcessingError } from './modelManifest';
import { Sha256 } from './sha256';

export const yieldTask = () => new Promise<void>(resolve=>setTimeout(resolve,0));
export const PCM_CHUNK = 16_384;
export async function checkCapacity(additionalBytes:number,cacheLimit=10*1024**3):Promise<void> {
    if(!Number.isFinite(additionalBytes)||additionalBytes<0||!Number.isFinite(cacheLimit)||cacheLimit<=0)throw new ProcessingError('invalid-request','Invalid storage budget.');
    const estimate=await navigator.storage.estimate();
    if(estimate.usage===undefined||estimate.quota===undefined)throw new ProcessingError('storage-unavailable','Browser storage quota is unavailable.');
    if(estimate.usage+additionalBytes>cacheLimit)throw new ProcessingError('cache-full','Processing storage limit reached. Explicitly clear artifacts before retrying.');
    if(estimate.usage+additionalBytes>estimate.quota)throw new ProcessingError('quota-exceeded','Browser quota is insufficient. Explicitly clear artifacts before retrying.');
}
export interface StagedPcm {
    directory: string; descriptor: DecodedAudioDescriptor; hash: string;
}
export async function jobDirectory(name:string): Promise<FileSystemDirectoryHandle> {
    if(!/^[a-zA-Z0-9-]{1,100}$/.test(name)) throw new ProcessingError('invalid-request','Invalid artifact identity.');
    if(!navigator.storage?.getDirectory) throw new ProcessingError('storage-unavailable','OPFS is unavailable.');
    const root=await navigator.storage.getDirectory();
    const processing=await root.getDirectoryHandle('processing-p1',{create:true});
    return processing.getDirectoryHandle(name,{create:true});
}
export async function removeJob(name:string): Promise<string[]> {
    if(!/^[a-zA-Z0-9-]{1,100}$/.test(name)) return [name];
    try {
        const root=await navigator.storage.getDirectory();
        const processing=await root.getDirectoryHandle('processing-p1');
        await processing.removeEntry(name,{recursive:true}); return [];
    } catch(error) { if(error instanceof DOMException && error.name==='NotFoundError')return [];return [name]; }
}
function descriptorMatches(a:DecodedAudioDescriptor|null,b:DecodedAudioDescriptor):boolean {
    return !!a && a.trackId===b.trackId && a.revision===b.revision && a.length===b.length
        && a.channelCount===b.channelCount && a.sampleRate===b.sampleRate && a.durationSeconds===b.durationSeconds;
}
export function validateDescriptor(d:DecodedAudioDescriptor|null): asserts d is DecodedAudioDescriptor {
    if(!d || !Number.isSafeInteger(d.length) || d.length<=0 || !Number.isSafeInteger(d.revision)
        || ![1,2].includes(d.channelCount) || !Number.isFinite(d.sampleRate) || d.sampleRate<8000 || d.sampleRate>192000
        || !Number.isFinite(d.durationSeconds) || Math.abs(Math.round(d.durationSeconds*44100)-Math.round(d.length*44100/d.sampleRate))>1) {
        throw new ProcessingError('invalid-request','FT requires valid mono or stereo decoded PCM.');
    }
}
export async function stagePcm(port:DecodedAudioCopyPort,name:string,signal:AbortSignal,
    progress:(done:number,total:number)=>void=()=>{}):Promise<StagedPcm> {
    const descriptor=port.getDecodedAudioDescriptor();validateDescriptor(descriptor);
    checkCancelled(signal);
    // P1 conservative budget: native PCM plus four planar/WAV outputs and all
    // public model blobs. P2 replaces this with exact cache accounting.
    await checkCapacity(descriptor.length*descriptor.channelCount*4+Math.round(descriptor.durationSeconds*44100)*64+662450544);
    const directory=await jobDirectory(name),writers:FileSystemWritableFileStream[]=[];
    const hash=new Sha256().update(new TextEncoder().encode(JSON.stringify({version:FT_CONFIG.sourceHash,...descriptor})));
    try {
        for(let channel=0;channel<descriptor.channelCount;channel++) writers.push(await (await directory.getFileHandle(`source-${channel}.f32`,{create:true})).createWritable());
        for(let start=0;start<descriptor.length;start+=PCM_CHUNK){
            checkCancelled(signal);
            if(!descriptorMatches(port.getDecodedAudioDescriptor(),descriptor)) throw new ProcessingError('source-identity-mismatch','Decoded audio changed.');
            const length=Math.min(PCM_CHUNK,descriptor.length-start);
            for(let channel=0;channel<descriptor.channelCount;channel++){
                const samples=port.copyDecodedChannelRange({revision:descriptor.revision,channel,start,length});
                if(!samples || samples.length!==length) throw new ProcessingError('pcm-incomplete','Decoded PCM range is missing.');
                assertFinite(samples);
                const bytes=new Uint8Array(samples.buffer,samples.byteOffset,samples.byteLength);
                hash.update(bytes);await writers[channel]!.write(new Uint8Array(bytes));
            }
            progress(start+length,descriptor.length);await yieldTask();
        }
        checkCancelled(signal);
        if(!descriptorMatches(port.getDecodedAudioDescriptor(),descriptor)) throw new ProcessingError('source-identity-mismatch','Decoded audio changed.');
        for(const writer of writers)await writer.close();
        return {directory:name,descriptor,hash:hash.hex()};
    } catch(error){await Promise.allSettled(writers.map(w=>w.abort()));await removeJob(name);throw error;}
}
export async function openPcm(ref:StagedPcm,signal:AbortSignal):Promise<PcmReader> {
    validateDescriptor(ref.descriptor);
    const directory=await jobDirectory(ref.directory),files:File[]=[];
    for(let channel=0;channel<ref.descriptor.channelCount;channel++){
        const file=await (await directory.getFileHandle(`source-${channel}.f32`)).getFile();
        if(file.size!==ref.descriptor.length*4)throw new ProcessingError('pcm-incomplete','Staged PCM length mismatch.');
        files.push(file);
    }
    const hash=new Sha256().update(new TextEncoder().encode(JSON.stringify({version:FT_CONFIG.sourceHash,...ref.descriptor})));
    for(let start=0;start<ref.descriptor.length;start+=PCM_CHUNK){
        checkCancelled(signal);
        for(const file of files)hash.update(new Uint8Array(await file.slice(start*4,Math.min(start+PCM_CHUNK,ref.descriptor.length)*4).arrayBuffer()));
        await yieldTask();
    }
    if(hash.hex()!==ref.hash)throw new ProcessingError('pcm-hash-mismatch','Staged PCM hash mismatch.');
    return {frames:ref.descriptor.length,sampleRate:ref.descriptor.sampleRate,channels:files.length,
        async read(channel,start,length){checkCancelled(signal);return new Float32Array(await files[channel]!.slice(start*4,(start+length)*4).arrayBuffer());}};
}
export async function openDatabase():Promise<IDBDatabase> {
    return new Promise((resolve,reject)=>{
        const request=indexedDB.open('processing-p1',1);
        request.onupgradeneeded=()=>{request.result.createObjectStore('models');request.result.createObjectStore('results');};
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
}
export async function databaseGet<T>(store:string,key:string):Promise<T|undefined> {
    const db=await openDatabase();
    try{return await new Promise((resolve,reject)=>{const request=db.transaction(store).objectStore(store).get(key);request.onsuccess=()=>resolve(request.result as T|undefined);request.onerror=()=>reject(request.error);});}
    finally{db.close();}
}
export async function databasePut(store:string,key:string,value:unknown,signal:AbortSignal):Promise<void> {
    checkCancelled(signal);const db=await openDatabase();
    try{await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction(store,'readwrite'),cancel=()=>tx.abort();
        signal.addEventListener('abort',cancel,{once:true});
        tx.oncomplete=()=>{signal.removeEventListener('abort',cancel);resolve();};
        tx.onabort=tx.onerror=()=>{signal.removeEventListener('abort',cancel);reject(tx.error ?? new ProcessingError('job-cancelled','Transaction cancelled.'));};
        tx.objectStore(store).put(value,key);if(signal.aborted)cancel();
    });}finally{db.close();}
}
export async function databaseDelete(store:string,key:string):Promise<void> {
    const db=await openDatabase();
    try{await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction(store,'readwrite');tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);
        tx.objectStore(store).delete(key);
    });}finally{db.close();}
}
