import { beforeEach,afterEach,expect,it,vi } from 'vitest';
import 'fake-indexeddb/auto';
import { TranscriptionRepository } from '../../src/transcription/resultRepository';
import type { TranscriptionRecord } from '../../src/transcription/resultRepository';
import type { TranscriptionBundle } from '../../src/transcription/workerProtocol';
import { TRANSCRIPTION_CONFIG_HASH,TRANSCRIPTION_MODEL_HASH,transcriptionModel } from '../../src/transcription/modelManifest';
import { ORT_VERSION } from '../../src/processing/modelManifest';
import runtimeManifest from '../../src/processing/runtime-manifest.json';
import { hashBytes } from '../../src/processing/sha256';
import { wavHeader,interleave } from '../../src/processing/dsp';
const id = 'transcription-00000000-0000-0000-0000-000000000000',signal = () => new AbortController().signal;
let directories:Map<string,Map<string,Blob>>;
beforeEach(async() => {
    await new Promise<void>((resolve,reject) => { const request = indexedDB.deleteDatabase('editor-transcriptions');request.onsuccess = () => resolve();request.onerror = () => reject(request.error); });
    directories = new Map([[id,new Map()],['editor-keep',new Map()],['p1-keep',new Map()]]);
    vi.stubGlobal('navigator',{storage:{estimate:async() => ({usage:0,quota:10*1024**3}),getDirectory:async() => ({getDirectoryHandle:async() => ({keys:async function*() { yield*directories.keys(); },removeEntry:async(name:string) => { directories.delete(name); },getDirectoryHandle:async(name:string) => ({getFileHandle:async(file:string) => { const blob = directories.get(name)?.get(file);if (!blob) throw new DOMException('missing','NotFoundError');return {getFile:async() => blob}; }})})})}});
});
afterEach(() => vi.unstubAllGlobals());
function fixture():TranscriptionBundle {
    const runtimeHash = hashBytes(new TextEncoder().encode(JSON.stringify(runtimeManifest))),frames = 44100;
    const identity = {trackId:'song',contentHash:'a'.repeat(64),pcmHash:'b'.repeat(64),ftResultId:'editor-source',durationSeconds:1,configHash:TRANSCRIPTION_CONFIG_HASH,modelManifestHash:TRANSCRIPTION_MODEL_HASH,runtimeManifestHash:runtimeHash,selectedRoles:['guitar','piano'] as const};
    const stems = (['guitar','piano'] as const).map(role => ({role,frames,sampleRate:44100,left:`${role}-left.f32`,right:`${role}-right.f32`,wav:`${role}.wav`,energy:new Uint16Array(30),waveformMin:new Float32Array(30).fill(-.1),waveformMax:new Float32Array(30).fill(.1),energyScale:80/65535,energyOffset:-80}));
    for (const stem of stems) { const samples = new Float32Array(frames).fill(.1);directories.get(id)!.set(stem.left,new Blob([samples]));directories.get(id)!.set(stem.right,new Blob([samples]));directories.get(id)!.set(stem.wav,new Blob([wavHeader(frames),interleave(samples,samples)])); }
    return {result:{version:1,id,createdAt:new Date().toISOString(),identity:{...identity,selectedRoles:[...identity.selectedRoles]},completedRoles:['guitar','piano'],failures:[],truncatedDrumSegments:[],candidates:[{id:'note',kind:'note',instrument:'piano',pitch:60,startSeconds:.2,endSeconds:.8,strength:.8,deleted:false,source:{resultId:id,inputRole:'piano',artifactId:id,model:'basic-pitch'}}],auxiliaryDirectory:id,timings:{totalMs:100}},auxiliary:{directory:id,source:{directory:'editor-source',hash:identity.pcmHash,descriptor:{trackId:'song',revision:1,sampleRate:44100,length:frames,channelCount:2,durationSeconds:1}},stems,provenance:{configHash:identity.configHash,modelManifestHash:identity.modelManifestHash,runtimeManifestHash:runtimeHash,runtimeVersion:ORT_VERSION,backend:'webgpu',model:transcriptionModel('htdemucs-6s')},timings:{sourceMs:1,runtimeMs:1,modelMs:1,inputMs:1,inferenceMs:1,persistMs:1,totalMs:6}}};
}
async function mutate(fn:(record:TranscriptionRecord) => void):Promise<void> {
    const db = await new Promise<IDBDatabase>((resolve,reject) => { const request = indexedDB.open('editor-transcriptions',1);request.onsuccess = () => resolve(request.result);request.onerror = () => reject(request.error); });
    try { await new Promise<void>((resolve,reject) => { const tx = db.transaction('results','readwrite'),store = tx.objectStore('results'),request = store.get(id);request.onsuccess = () => { const record = request.result as TranscriptionRecord;fn(record);store.put(record,id); };tx.oncomplete = () => resolve();tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
}
it('restores checksummed auxiliary files and edits with the same source despite a changed role selection',async() => {
    const bundle = fixture(),repository = new TranscriptionRepository();await repository.publish(bundle,{piano:300},signal(),1e9);const record = await repository.restore({...bundle.result.identity,selectedRoles:['bass']},signal());expect(record?.files).toHaveLength(6);expect(record?.bundle.result.candidates).toEqual(bundle.result.candidates);
    bundle.result.candidates[0]!.deleted = true;await repository.saveEdits(bundle,{piano:500},signal());const restored = await repository.restore(bundle.result.identity,signal());expect(restored?.thresholds).toEqual({piano:500});expect(restored?.bundle.result.candidates[0]?.deleted).toBe(true);
    expect(await repository.restore({...bundle.result.identity,pcmHash:'f'.repeat(64)},signal())).toBeNull();
});
it.each(['missing','bytes','candidate','model','threshold'])('rejects %s damage with no successful cache hit',async damage => {
    const bundle = fixture(),repository = new TranscriptionRepository();await repository.publish(bundle,{},signal(),1e9);
    if (damage === 'missing') directories.get(id)!.delete('piano.wav');
    else if (damage === 'bytes') { const file = directories.get(id)!.get('piano.wav')!,bytes = new Uint8Array(await file.arrayBuffer());bytes[50] = bytes[50]!^1;directories.get(id)!.set('piano.wav',new Blob([bytes])); }
    else await mutate(record => { if (damage === 'candidate') record.bundle.result.candidates[0]!.startSeconds = .3;else if (damage === 'model') record.bundle.auxiliary!.provenance.model.sha256 = 'f'.repeat(64);else record.thresholds.piano = -1; });
    await expect(repository.restore(bundle.result.identity,signal())).rejects.toMatchObject({code:'result-invalid'});
});
it('rejects cancelled publication and explicitly cleans only owned auxiliary results and orphans',async() => {
    const bundle = fixture(),repository = new TranscriptionRepository(),abort = new AbortController();abort.abort();await expect(repository.publish(bundle,{},abort.signal,1e9)).rejects.toMatchObject({code:'job-cancelled'});
    await repository.publish(bundle,{},signal(),1e9);directories.set('transcription-11111111-1111-1111-1111-111111111111',new Map());await repository.clearAll();expect([...directories.keys()]).toEqual(['editor-keep','p1-keep']);expect(await repository.restore(bundle.result.identity,signal())).toBeNull();
});
