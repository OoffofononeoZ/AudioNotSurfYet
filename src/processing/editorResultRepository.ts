import type { DecodedAudioCopyPort } from '../analysis/pcm';
import type { DecodedAudioDescriptor } from '../types/audio';
import type { SeparationResult } from './kernel';
import { assertFinite,wavHeader } from './dsp';
import { checkCancelled,FT_CONFIG,FT_CONFIG_HASH,FT_MODELS,FT_RATE,ORT_VERSION,ProcessingError } from './modelManifest';
import runtimeManifest from './runtime-manifest.json';
import { hashBytes,Sha256 } from './sha256';
import { databaseDelete,databaseGet,databasePut,jobDirectory,openDatabase,removeJob,validateDescriptor,yieldTask,PCM_CHUNK } from './storage';

const runtimeHash=hashBytes(new TextEncoder().encode(JSON.stringify(runtimeManifest)));
export interface EditorStemRecord {
    version:1;createdAt:number;result:SeparationResult;metadataHash:string;
    files:Array<{name:string;bytes:number;sha256:string}>;
}
export interface ProcessingStorageSummary {
    usage:number;quota:number;modelCount:number;missingModelBytes:number;resultCount:number;orphanCount:number;
}
export interface EditorStemRepositoryPort {
    summary():Promise<ProcessingStorageSummary>;
    restore(port:DecodedAudioCopyPort,signal:AbortSignal):Promise<SeparationResult|null>;
    publish(result:SeparationResult,signal:AbortSignal,progress:(done:number,total:number)=>void):Promise<void>;
    wav(result:SeparationResult,role:string):Promise<Blob>;
    discard(directory:string):Promise<void>;
    clearResults():Promise<void>;
    clearModels():Promise<void>;
}
async function listRecords():Promise<EditorStemRecord[]> {
    const db=await openDatabase();
    try{return await new Promise((resolve,reject)=>{const request=db.transaction('editor-results').objectStore('editor-results').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
    finally{db.close();}
}
function equalDescriptor(a:DecodedAudioDescriptor,b:DecodedAudioDescriptor):boolean {return JSON.stringify(a)===JSON.stringify(b);}
function equalAudioIdentity(a:DecodedAudioDescriptor,b:DecodedAudioDescriptor):boolean {
    return a.trackId===b.trackId&&a.sampleRate===b.sampleRate&&a.length===b.length
        &&a.channelCount===b.channelCount&&a.durationSeconds===b.durationSeconds;
}
export async function nativePcmHash(port:DecodedAudioCopyPort,signal:AbortSignal,hashDescriptor?:DecodedAudioDescriptor):Promise<string> {
    const descriptor=port.getDecodedAudioDescriptor();validateDescriptor(descriptor);
    const identity=hashDescriptor??descriptor;validateDescriptor(identity);
    if(!equalAudioIdentity(descriptor,identity))throw new ProcessingError('source-identity-mismatch','保存结果不属于当前音频。');
    // Revision is a live copy guard, not a persistent song identity. Recompute
    // the original digest header with current PCM; never copy using an old epoch.
    const hash=new Sha256().update(new TextEncoder().encode(JSON.stringify({version:FT_CONFIG.sourceHash,...identity})));
    for(let start=0;start<descriptor.length;start+=PCM_CHUNK){
        checkCancelled(signal);const current=port.getDecodedAudioDescriptor();
        if(!current||!equalDescriptor(descriptor,current))throw new ProcessingError('source-identity-mismatch','当前歌曲已经改变。');
        for(let channel=0;channel<descriptor.channelCount;channel++){
            const data=port.copyDecodedChannelRange({revision:descriptor.revision,channel,start,length:Math.min(PCM_CHUNK,descriptor.length-start)});
            if(!data||data.length!==Math.min(PCM_CHUNK,descriptor.length-start))throw new ProcessingError('pcm-incomplete','当前歌曲的音频数据不完整。');
            assertFinite(data);hash.update(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));
        }
        await yieldTask();
    }
    checkCancelled(signal);
    const current=port.getDecodedAudioDescriptor();
    if(!current||!equalDescriptor(descriptor,current))throw new ProcessingError('source-identity-mismatch','当前歌曲已经改变。');
    return hash.hex();
}
export async function blobHash(blob:Blob,signal:AbortSignal):Promise<string> {
    const hash=new Sha256();
    for(let at=0;at<blob.size;at+=1024*1024){checkCancelled(signal);hash.update(new Uint8Array(await blob.slice(at,at+1024*1024).arrayBuffer()));await yieldTask();}
    checkCancelled(signal);return hash.hex();
}
async function metadataHash(result:SeparationResult,signal:AbortSignal):Promise<string> {
    const hash=new Sha256().update(new TextEncoder().encode(JSON.stringify({source:result.source,config:result.config,provenance:result.provenance,
        stems:result.stems.map(({energy,waveformMin,waveformMax,...rest})=>rest)})));
    for(const stem of result.stems)for(const data of [stem.energy,stem.waveformMin,stem.waveformMax]){
        const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
        for(let at=0;at<bytes.length;at+=65536){checkCancelled(signal);hash.update(bytes.subarray(at,at+65536));await yieldTask();}
    }
    return hash.hex();
}
function validateResult(result:SeparationResult):void {
    try{
        validateDescriptor(result.source.descriptor);
        if(!/^editor-[a-f0-9-]{36}$/.test(result.source.directory)||!/^[a-f0-9]{64}$/.test(result.source.hash)
            ||JSON.stringify(result.config)!==JSON.stringify(FT_CONFIG)||result.provenance.configHash!==FT_CONFIG_HASH
            ||result.provenance.runtimeVersion!==ORT_VERSION||result.provenance.runtimeManifestHash!==runtimeHash
            ||result.provenance.backend!=='webgpu'
            ||JSON.stringify(result.provenance.models)!==JSON.stringify(FT_MODELS.map(({role,row,revision,sha256})=>({role,row,revision,sha256})))
            ||result.stems.map(s=>s.role).join(',')!=='drums,bass,other,vocals')throw Error('Identity mismatch');
        const frames=Math.round(result.source.descriptor.durationSeconds*FT_RATE),count=Math.ceil(frames/1470);
        for(const stem of result.stems){
            if(stem.frames!==frames||stem.sampleRate!==FT_RATE||stem.wav!==`${stem.role}.wav`||stem.left!==`${stem.role}-left.f32`||stem.right!==`${stem.role}-right.f32`
                ||!(stem.energy instanceof Uint16Array)||!(stem.waveformMin instanceof Float32Array)||!(stem.waveformMax instanceof Float32Array)
                ||[stem.energy.length,stem.waveformMin.length,stem.waveformMax.length].some(n=>n!==count)
                ||stem.energyScale!==80/65535||stem.energyOffset!==-80)throw Error('Artifact metadata mismatch');
            assertFinite(stem.waveformMin);assertFinite(stem.waveformMax);
            for(let i=0;i<count;i++)if(stem.waveformMin[i]!>stem.waveformMax[i]!)throw Error('Invalid waveform');
        }
    }catch{throw new ProcessingError('result-invalid','保存的分离结果与当前模型或音频契约不符，请重新分离或清理结果。');}
}
function fileManifest(result:SeparationResult):Array<{name:string;bytes:number}> {
    return [...Array.from({length:result.source.descriptor.channelCount},(_,channel)=>({name:`source-${channel}.f32`,bytes:result.source.descriptor.length*4})),
        ...result.stems.flatMap(stem=>[{name:stem.left,bytes:stem.frames*4},{name:stem.right,bytes:stem.frames*4},{name:stem.wav,bytes:44+stem.frames*8}])];
}
async function editorDirectories():Promise<string[]> {
    try{const root=await navigator.storage.getDirectory(),directory=await root.getDirectoryHandle('processing-p1');const names:string[]=[];
        for await(const name of (directory as FileSystemDirectoryHandle&{keys():AsyncIterableIterator<string>}).keys())if(/^editor-[a-f0-9-]{36}$/.test(name))names.push(name);return names;
    }catch(error){if(error instanceof DOMException&&error.name==='NotFoundError')return [];throw error;}
}
export class EditorStemRepository implements EditorStemRepositoryPort {
    async summary():Promise<ProcessingStorageSummary> {
        const estimate=await navigator.storage.estimate();if(estimate.usage===undefined||estimate.quota===undefined)throw new ProcessingError('storage-unavailable','浏览器无法报告可用存储空间。');
        const models=await Promise.all(FT_MODELS.map(async model=>{const blob=await databaseGet<Blob>('models',model.sha256);return blob instanceof Blob&&blob.size===model.bytes;}));
        const [records,directories]=await Promise.all([listRecords(),editorDirectories()]);
        const complete=new Set(records.flatMap(r=>typeof r.result?.source?.directory==='string'?[r.result.source.directory]:[]));
        return {usage:estimate.usage,quota:estimate.quota,modelCount:models.filter(Boolean).length,
            missingModelBytes:FT_MODELS.reduce((sum,model,i)=>sum+(models[i]?0:model.bytes),0),resultCount:records.length,orphanCount:directories.filter(name=>!complete.has(name)).length};
    }
    async publish(result:SeparationResult,signal:AbortSignal,progress:(done:number,total:number)=>void):Promise<void> {
        validateResult(result);const directory=await jobDirectory(result.source.directory),expected=fileManifest(result),files:EditorStemRecord['files']=[];
        for(const [index,item]of expected.entries()){
            checkCancelled(signal);progress(index,expected.length);const file=await(await directory.getFileHandle(item.name)).getFile();
            if(file.size!==item.bytes)throw new ProcessingError('result-invalid','分离文件长度不完整。');
            if(item.name.endsWith('.wav')){const header=new Uint8Array(await file.slice(0,44).arrayBuffer()),expectedHeader=wavHeader(result.stems[0]!.frames);if(header.some((value,i)=>value!==expectedHeader[i]))throw new ProcessingError('result-invalid','WAV格式不正确。');}
            files.push({...item,sha256:await blobHash(file,signal)});
        }
        const record:EditorStemRecord={version:1,createdAt:Date.now(),result,files,metadataHash:await metadataHash(result,signal)};
        await databasePut('editor-results',result.source.directory,record,signal);progress(expected.length,expected.length);
    }
    async restore(port:DecodedAudioCopyPort,signal:AbortSignal):Promise<SeparationResult|null> {
        const descriptor=port.getDecodedAudioDescriptor();validateDescriptor(descriptor);
        const records=(await listRecords()).filter(r=>r.result?.source?.descriptor&&equalAudioIdentity(r.result.source.descriptor,descriptor)).sort((a,b)=>b.createdAt-a.createdAt);
        if(!records.length)return null;
        let match:EditorStemRecord|undefined;
        const digests=new Map<number,string>();
        for(const record of records){
            const epoch=record.result.source.descriptor.revision;
            let digest=digests.get(epoch);
            if(!digest){digest=await nativePcmHash(port,signal,record.result.source.descriptor);digests.set(epoch,digest);}
            if(record.result.source.hash===digest){match=record;break;}
        }
        if(!match)return null;
        validateResult(match.result);
        if(match.version!==1||match.metadataHash!==await metadataHash(match.result,signal))throw new ProcessingError('result-invalid','分离结果数据损坏，请重新分离或清理。');
        const expected=fileManifest(match.result);
        if(match.files?.length!==expected.length||expected.some((file,i)=>file.name!==match.files[i]?.name||file.bytes!==match.files[i]?.bytes||!/^[a-f0-9]{64}$/.test(match.files[i]?.sha256??'')))throw new ProcessingError('result-invalid','分离文件校验清单不完整。');
        const directory=await jobDirectory(match.result.source.directory);
        try{for(const item of match.files){const file=await(await directory.getFileHandle(item.name)).getFile();if(file.size!==item.bytes||await blobHash(file,signal)!==item.sha256)throw Error('Corrupt artifact');}}
        catch(error){checkCancelled(signal);throw new ProcessingError('result-invalid','分离文件缺失或损坏，请重新分离或清理。');}
        checkCancelled(signal);
        const current=port.getDecodedAudioDescriptor();
        if(!current||!equalDescriptor(descriptor,current))throw new ProcessingError('source-identity-mismatch','校验期间歌曲已经改变。');
        return match.result;
    }
    async wav(result:SeparationResult,role:string):Promise<Blob> {
        validateResult(result);const stem=result.stems.find(s=>s.role===role);if(!stem)throw new ProcessingError('invalid-request','未知音轨。');
        return (await(await jobDirectory(result.source.directory)).getFileHandle(stem.wav)).getFile();
    }
    async discard(directory:string):Promise<void> {
        if(!/^editor-[a-f0-9-]{36}$/.test(directory))throw new ProcessingError('invalid-request','不是Editor分离结果。');
        if((await removeJob(directory)).length)throw new ProcessingError('cleanup-failed','无法清理部分分离文件，请关闭使用中的导出并重试。');
        await databaseDelete('editor-results',directory);await databaseDelete('results',directory);
    }
    async clearResults():Promise<void> {
        const directories=new Set([...await editorDirectories(),...(await listRecords()).map(r=>r.result?.source?.directory).filter((name):name is string=>typeof name==='string'&&/^editor-[a-f0-9-]{36}$/.test(name))]);
        for(const name of directories)await this.discard(name);
    }
    async clearModels():Promise<void> {for(const model of FT_MODELS)await databaseDelete('models',model.sha256);}
}
