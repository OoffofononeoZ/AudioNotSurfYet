import { AudioEngine } from '../../src/audio/audioEngine';
import { SeparationController } from '../../src/processing/controller';
import { jobDirectory,removeJob,openPcm } from '../../src/processing/storage';
import { syntheticPort } from './fixture';
import type { SeparationResult } from '../../src/processing/kernel';
import { ProcessingError } from '../../src/processing/modelManifest';
import { databaseDelete } from '../../src/processing/storage';
import { inspectArtifacts } from './artifactOracle';
import { loadModel } from '../../src/processing/modelCache';
import { FT_MODELS } from '../../src/processing/modelManifest';
import type { WorkerEvent } from '../../src/processing/workerProtocol';
const status=document.querySelector<HTMLPreElement>('#status')!;
const controller=location.search.includes('gpu=unavailable')
    ?new SeparationController(()=>new Worker(new URL('./unavailable.worker.ts',import.meta.url),{type:'module'}))
    :new SeparationController();
const engine=new AudioEngine();
let result:SeparationResult|null=null;
let compatibility:{worker:Worker;reject:(error:Error)=>void}|null=null,separating=false;
const urls:string[]=[];
let metrics:{elapsedMs:number;downloadElapsedMs:number;processingElapsedMs:number;feedbackMs:number;maxHeartbeatGapMs:number;phases:string[];terminalCount:number;cancelMs:number|null}|null=null;
async function run(port:Parameters<typeof controller.start>[0],cancelAt?:string){
    if(compatibility||separating)throw new ProcessingError('invalid-request','A processing task is already running.');
    separating=true;const started=performance.now();let last=started,cancelledAt:number|null=null;
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
    synthetic(frames:number,rate=44100,channels=2,cancelAt?:string){return run(syntheticPort(frames,rate,channels),cancelAt);},
    async inspect(){if(!result)throw Error('No result');await openPcm(result.source,new AbortController().signal);return {artifacts:await inspectArtifacts(result),timeline:result.timeline,descriptor:result.source.descriptor,metrics,provenance:result.provenance,residuals:controller.residualArtifactIds};},
    report(){return {metrics,residuals:controller.residualArtifactIds,separating};},
    async local(){
        const file=document.querySelector<HTMLInputElement>('#audio')!.files?.[0];if(!file)throw Error('请选择音频文件。');
        if(compatibility||separating)throw new ProcessingError('invalid-request','A processing task is already running.');
        separating=true;try{await engine.load({trackId:crypto.randomUUID(),encodedAudio:await file.arrayBuffer()});}finally{separating=false;}
        await run(engine);await showExports(result!);return engine.getDecodedAudioDescriptor();
    },
    cancel(){controller.cancel();if(compatibility){const current=compatibility;compatibility=null;current.worker.terminate();current.reject(new ProcessingError('job-cancelled','Compatibility check cancelled.'));}},
    async clear(){if(result){await removeJob(result.source.directory);await databaseDelete('results',result.source.directory);}result=null;},
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
