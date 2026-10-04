import { AudioEngine } from '../../src/audio/audioEngine';
import { SeparationController } from '../../src/processing/controller';
import { jobDirectory,removeJob,openPcm,openDatabase,databaseGet,databasePut } from '../../src/processing/storage';
import { syntheticPort,preparedSyntheticPort } from './fixture';
import type { SeparationResult } from '../../src/processing/kernel';
import { ProcessingError } from '../../src/processing/modelManifest';
import { databaseDelete } from '../../src/processing/storage';
import { inspectArtifacts } from './artifactOracle';
import { loadModel } from '../../src/processing/modelCache';
import { FT_MODELS,FT_CONFIG } from '../../src/processing/modelManifest';
import type { WorkerEvent } from '../../src/processing/workerProtocol';
import { Sha256 } from '../../src/processing/sha256';
const status=document.querySelector<HTMLPreElement>('#status')!;
const controller=location.search.includes('gpu=unavailable')
    ?new SeparationController(()=>new Worker(new URL('./unavailable.worker.ts',import.meta.url),{type:'module'}))
    :new SeparationController();
const engine=new AudioEngine();
let result:SeparationResult|null=null;
let originalDrums:Blob|null=null;
let retainedPcm:Parameters<typeof controller.start>[0]|null=null;
let compatibility:{worker:Worker;reject:(error:Error)=>void}|null=null,separating=false;
const urls:string[]=[];
let metrics:{elapsedMs:number;downloadElapsedMs:number;processingElapsedMs:number;feedbackMs:number;maxHeartbeatGapMs:number;phases:string[];terminalCount:number;cancelMs:number|null}|null=null;
async function run(port:Parameters<typeof controller.start>[0],cancelAt?:string){
    if(compatibility||separating)throw new ProcessingError('invalid-request','A processing task is already running.');
    separating=true;retainedPcm=port;const started=performance.now();let last=started,cancelledAt:number|null=null;
    metrics={elapsedMs:0,downloadElapsedMs:0,processingElapsedMs:0,feedbackMs:Infinity,maxHeartbeatGapMs:0,phases:[],terminalCount:0,cancelMs:null};
    try{
        result=await controller.start(port,(e:WorkerEvent)=>{
            const now=performance.now();
            if(e.type==='progress'){
                metrics!.feedbackMs=Math.min(metrics!.feedbackMs,now-started);
                metrics!.maxHeartbeatGapMs=Math.max(metrics!.maxHeartbeatGapMs,now-last);last=now;
                metrics!.downloadElapsedMs=e.downloadElapsedMs;
                if(!metrics!.phases.includes(e.phase))metrics!.phases.push(e.phase);
                if(cancelAt===e.phase&&cancelledAt===null){cancelledAt=now;controller.cancel();}
            }else {metrics!.terminalCount++;if(cancelledAt!==null)metrics!.cancelMs=now-cancelledAt;}
            status.textContent=JSON.stringify(e.type==='result'?{type:e.type}:e);
        },'/p1-models');
        return result;
    }finally{metrics!.elapsedMs=performance.now()-started;metrics!.processingElapsedMs=metrics!.elapsedMs-metrics!.downloadElapsedMs;separating=false;}
}
async function showExports(value:SeparationResult){
    const directory=await jobDirectory(value.source.directory),exports=document.querySelector('#exports')!;
    urls.forEach(URL.revokeObjectURL);urls.length=0;exports.replaceChildren();
    for(const stem of value.stems){const wav=await(await directory.getFileHandle(stem.wav)).getFile();const url=URL.createObjectURL(wav);urls.push(url);
        const link=document.createElement('a');link.href=url;link.download=`${stem.role}.wav`;link.textContent=`保存 ${stem.role} WAV `;link.dataset.role=stem.role;exports.append(link);}
}
const api={
    async prime(){for(const model of FT_MODELS)await loadModel(model,new AbortController().signal,()=>{},`/p1-models/${model.file}`);},
    async damageDrums(){
        if(separating)throw Error('Task running');originalDrums=await databaseGet<Blob>('models',FT_MODELS[0]!.sha256)??null;if(!originalDrums)throw Error('Prime model first');
        const first=new Uint8Array(await originalDrums.slice(0,1).arrayBuffer());first[0]=first[0]!^1;
        await databasePut('models',FT_MODELS[0]!.sha256,new Blob([first,originalDrums.slice(1)]),new AbortController().signal);
    },
    async restoreDrums(){if(originalDrums){await databasePut('models',FT_MODELS[0]!.sha256,originalDrums,new AbortController().signal);originalDrums=null;}},
    async cleanupReport(){
        const db=await openDatabase();let modelKeys:IDBValidKey[]=[],resultKeys:IDBValidKey[]=[];
        try{[modelKeys,resultKeys]=await Promise.all(['models','results'].map(store=>new Promise<IDBValidKey[]>((resolve,reject)=>{const request=db.transaction(store).objectStore(store).getAllKeys();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);}))) as [IDBValidKey[],IDBValidKey[]];}finally{db.close();}
        const directories:string[]=[];try{const root=await navigator.storage.getDirectory(),directory=await root.getDirectoryHandle('processing-p1');for await(const key of (directory as FileSystemDirectoryHandle&{keys():AsyncIterableIterator<string>}).keys())directories.push(key);}catch(e){if(!(e instanceof DOMException&&e.name==='NotFoundError'))throw e;}
        return {modelKeys:modelKeys.sort(),resultKeys:resultKeys.sort(),directories:directories.sort(),residuals:controller.residualArtifactIds};
    },
    async probe(mode:string,row:number){
        if(compatibility||separating)throw new ProcessingError('invalid-request','A processing task is already running.');
        return new Promise<Record<string,unknown>>((resolve,reject)=>{
            const worker=new Worker(new URL('./runtime-probe.worker.ts',import.meta.url),{type:'module'});
            compatibility={worker,reject};
            worker.onmessage=event=>{if(event.data.type==='progress'){status.textContent=JSON.stringify(event.data);return;}worker.terminate();compatibility=null;resolve(event.data);};
            worker.onerror=()=>{worker.terminate();compatibility=null;reject(new Error('Probe Worker failed.'));};
            worker.postMessage({mode,row});
        });
    },
    async compat(row:number,variant?:string){
        if(compatibility||separating)throw new ProcessingError('invalid-request','A processing task is already running.');
        return new Promise<Record<string,unknown>>((resolve,reject)=>{
            const worker=new Worker(new URL('./compat.worker.ts',import.meta.url),{type:'module'});
            compatibility={worker,reject};
            worker.onmessage=event=>{
                if(event.data.type==='progress'){status.textContent=JSON.stringify(event.data);return;}
                worker.terminate();compatibility=null;resolve(event.data);
            };
            worker.onerror=()=>{worker.terminate();compatibility=null;reject(new Error('Compatibility Worker failed.'));};
            worker.postMessage({row,variant});
        });
    },
    synthetic(frames:number,rate=44100,channels=2,cancelAt?:string,prepared=false){if(compatibility||separating)throw Error('Task running');return run(prepared?preparedSyntheticPort(frames,rate,channels):syntheticPort(frames,rate,channels),cancelAt);},
    async inspect(){
        if(!result||!retainedPcm)throw Error('No result');await openPcm(result.source,new AbortController().signal);
        const descriptor=retainedPcm.getDecodedAudioDescriptor();if(JSON.stringify(descriptor)!==JSON.stringify(result.source.descriptor))throw Error('Original PCM descriptor changed');
        const hash=new Sha256().update(new TextEncoder().encode(JSON.stringify({version:FT_CONFIG.sourceHash,...descriptor})));
        for(let start=0;start<descriptor!.length;start+=16384){for(let channel=0;channel<descriptor!.channelCount;channel++){const pcm=retainedPcm.copyDecodedChannelRange({revision:descriptor!.revision,channel,start,length:Math.min(16384,descriptor!.length-start)});if(!pcm)throw Error('Original PCM missing');hash.update(new Uint8Array(pcm.buffer,pcm.byteOffset,pcm.byteLength));}await new Promise<void>(resolve=>setTimeout(resolve,0));}
        if(hash.hex()!==result.source.hash)throw Error('Original PCM changed');
        return {artifacts:await inspectArtifacts(result),timeline:result.timeline,descriptor:result.source.descriptor,originalPcmUnchanged:true,metrics,provenance:result.provenance,residuals:controller.residualArtifactIds};
    },
    report(){return {metrics,residuals:controller.residualArtifactIds,separating};},
    async local(){
        const file=document.querySelector<HTMLInputElement>('#audio')!.files?.[0];if(!file)throw Error('请选择音频文件。');
        if(compatibility||separating)throw new ProcessingError('invalid-request','A processing task is already running.');
        separating=true;try{await engine.load({trackId:crypto.randomUUID(),encodedAudio:await file.arrayBuffer()});}finally{separating=false;}
        await run(engine);await showExports(result!);return engine.getDecodedAudioDescriptor();
    },
    cancel(){controller.cancel();if(compatibility){const current=compatibility;compatibility=null;current.worker.terminate();current.reject(new ProcessingError('job-cancelled','Compatibility check cancelled.'));}},
    async clear(){if(result){await removeJob(result.source.directory);await databaseDelete('results',result.source.directory);}result=null;retainedPcm=null;},
    async dispose(){api.cancel();await engine.dispose();urls.forEach(URL.revokeObjectURL);},
};
export type P1Api=typeof api;
(window as unknown as {__P1:typeof api}).__P1=api;
document.querySelector('#compat')!.addEventListener('click',()=>{void(async()=>{for(let row=0;row<4;row++){const answer=await api.compat(row);status.textContent=JSON.stringify(answer,null,2);if(answer.type==='error'||!(answer.result as {parityPassed:boolean}).parityPassed)break;}})().catch(error=>{status.textContent=String(error);});});
document.querySelector('#cancel')!.addEventListener('click',()=>api.cancel());
document.querySelector('#separate')!.addEventListener('click',()=>{void(async()=>{
    await api.local();
    status.textContent='四轨已完成。请试听角色、串音、断裂和伪影。';
})().catch(error=>{status.textContent=String(error);});});
