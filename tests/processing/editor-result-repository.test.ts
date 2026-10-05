import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import 'fake-indexeddb/auto';
import { EditorStemRepository,nativePcmHash,type EditorStemRecord } from '../../src/processing/editorResultRepository';
import { databaseGet,databasePut } from '../../src/processing/storage';
import { FT_CONFIG,FT_CONFIG_HASH,FT_MODELS,ORT_VERSION } from '../../src/processing/modelManifest';
import { hashBytes } from '../../src/processing/sha256';
import runtimeManifest from '../../src/processing/runtime-manifest.json';
import { wavHeader,interleave } from '../../src/processing/dsp';
import type { SeparationResult } from '../../src/processing/kernel';
import { syntheticPort } from './fixture';
const directory='editor-00000000-0000-0000-0000-000000000000',signal=()=>new AbortController().signal;
let directories:Map<string,Map<string,Blob>>;
beforeEach(async()=>{
    await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('processing-p1');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});
    directories=new Map([[directory,new Map()],['p1-keep',new Map()]]);
    vi.stubGlobal('navigator',{storage:{estimate:async()=>({usage:123,quota:10*1024**3}),getDirectory:async()=>({getDirectoryHandle:async()=>({
        keys:async function*(){yield*directories.keys();},removeEntry:async(name:string)=>{directories.delete(name);},
        getDirectoryHandle:async(name:string)=>({getFileHandle:async(file:string)=>{const blob=directories.get(name)?.get(file);if(!blob)throw new DOMException('missing','NotFoundError');return {getFile:async()=>blob};}}),
    })})}});
});
afterEach(()=>vi.unstubAllGlobals());
async function fixture(){
    const port=syntheticPort(200),descriptor=port.getDecodedAudioDescriptor()!;
    const result:SeparationResult={source:{directory,descriptor,hash:await nativePcmHash(port,signal())},config:FT_CONFIG,adapter:null,timeline:[],
        provenance:{configHash:FT_CONFIG_HASH,runtimeVersion:ORT_VERSION,runtimeManifestHash:hashBytes(new TextEncoder().encode(JSON.stringify(runtimeManifest))),backend:'webgpu',models:FT_MODELS.map(({role,row,revision,sha256})=>({role,row,revision,sha256}))},
        stems:FT_MODELS.map(model=>({role:model.role,frames:200,sampleRate:44100,wav:`${model.role}.wav`,left:`${model.role}-left.f32`,right:`${model.role}-right.f32`,energy:new Uint16Array([123]),waveformMin:new Float32Array([-.1]),waveformMax:new Float32Array([.1]),energyScale:80/65535,energyOffset:-80}))};
    const files=directories.get(directory)!;
    for(let channel=0;channel<2;channel++)files.set(`source-${channel}.f32`,new Blob([port.copyDecodedChannelRange({revision:descriptor.revision,channel,start:0,length:200})! as Float32Array<ArrayBuffer>]));
    const samples=new Float32Array(200).fill(.1);
    for(const stem of result.stems){files.set(stem.left,new Blob([samples]));files.set(stem.right,new Blob([samples]));files.set(stem.wav,new Blob([wavHeader(200),interleave(samples,samples)]));}
    return {port,result,repository:new EditorStemRepository()};
}
it('publishes complete checksummed artifacts and restores only the same native PCM and provenance',async()=>{
    const s=await fixture();await s.repository.publish(s.result,signal(),()=>{});
    const restored=await s.repository.restore(s.port,signal());expect(restored?.source.hash).toBe(s.result.source.hash);expect(restored?.stems[0]!.energy).toEqual(s.result.stems[0]!.energy);
    expect(await s.repository.summary()).toMatchObject({resultCount:1,orphanCount:0});
    const altered={...s.port,copyDecodedChannelRange:(input:Parameters<typeof s.port.copyDecodedChannelRange>[0])=>{const data=s.port.copyDecodedChannelRange(input);if(data)data[0]=.7;return data;}};
    expect(await s.repository.restore(altered,signal())).toBeNull();
});
it.each(['missing','file-bytes','compact-series','config','model-revision'])('rejects cached %s damage instead of presenting a successful hit',async damage=>{
    const s=await fixture();await s.repository.publish(s.result,signal(),()=>{});
    if(damage==='missing')directories.get(directory)!.delete('drums.wav');
    else if(damage==='file-bytes'){const blob=directories.get(directory)!.get('drums.wav')!,bytes=new Uint8Array(await blob.arrayBuffer());bytes[50]=bytes[50]!^1;directories.get(directory)!.set('drums.wav',new Blob([bytes]));}
    else{const record=(await databaseGet<EditorStemRecord>('editor-results',directory))!;
        if(damage==='compact-series')record.result.stems[0]!.energy[0]=999;
        else if(damage==='config')record.result.provenance.configHash='bad';else record.result.provenance.models[0]!.revision='bad';
        await databasePut('editor-results',directory,record,signal());}
    await expect(s.repository.restore(s.port,signal())).rejects.toMatchObject({code:'result-invalid'});
});
it('explicit result cleanup removes Editor orphans while preserving other jobs and model blobs',async()=>{
    const s=await fixture();await s.repository.publish(s.result,signal(),()=>{});
    directories.set('editor-11111111-1111-1111-1111-111111111111',new Map());await databasePut('models','keep',new Blob(['model']),signal());
    expect((await s.repository.summary()).orphanCount).toBe(1);await s.repository.clearResults();
    expect([...directories.keys()]).toEqual(['p1-keep']);expect(await databaseGet('editor-results',directory)).toBeUndefined();expect(await(await databaseGet<Blob>('models','keep'))!.text()).toBe('model');
});
it('adds the Editor store without deleting existing version-one model/result data',async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('processing-p1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('models');r.result.createObjectStore('results');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('results','readwrite');tx.objectStore('results').put({keep:true},'old');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
    await new EditorStemRepository().summary();expect(await databaseGet('results','old')).toEqual({keep:true});
});
