import { AudioEngine } from '../../src/audio/audioEngine';
import { SeparationController } from '../../src/processing/controller';
import { jobDirectory,removeJob } from '../../src/processing/storage';
import { syntheticPort } from './fixture';
import type { SeparationResult } from '../../src/processing/kernel';
import { ProcessingError } from '../../src/processing/modelManifest';
import { databaseDelete } from '../../src/processing/storage';
const status=document.querySelector<HTMLPreElement>('#status')!;
const controller=location.search.includes('gpu=unavailable')
    ?new SeparationController(()=>new Worker(new URL('./unavailable.worker.ts',import.meta.url),{type:'module'}))
    :new SeparationController();
const engine=new AudioEngine();
let result:SeparationResult|null=null;
let compatibility:{worker:Worker;reject:(error:Error)=>void}|null=null,separating=false;
const urls:string[]=[];
const api={
    async compat(row:number){
        if(compatibility||separating)throw new ProcessingError('invalid-request','A processing task is already running.');
        return new Promise<Record<string,unknown>>((resolve,reject)=>{
            const worker=new Worker(new URL('./compat.worker.ts',import.meta.url),{type:'module'});
            compatibility={worker,reject};
            worker.onmessage=event=>{
                if(event.data.type==='progress'){status.textContent=JSON.stringify(event.data);return;}
                worker.terminate();compatibility=null;resolve(event.data);
            };
            worker.onerror=()=>{worker.terminate();compatibility=null;reject(new Error('Compatibility Worker failed.'));};
            worker.postMessage({row});
        });
    },
    async synthetic(frames:number,rate=44100){
        if(compatibility||separating)throw new ProcessingError('invalid-request','A processing task is already running.');
        separating=true;try{result=await controller.start(syntheticPort(frames,rate),e=>{status.textContent=JSON.stringify(e.type==='result'?{type:e.type}:e);},'/p1-models');return result;}finally{separating=false;}
    },
    cancel(){controller.cancel();if(compatibility){const current=compatibility;compatibility=null;current.worker.terminate();current.reject(new ProcessingError('job-cancelled','Compatibility check cancelled.'));}},
    async clear(){if(result){await removeJob(result.source.directory);await databaseDelete('results',result.source.directory);}result=null;},
    async dispose(){api.cancel();await engine.dispose();urls.forEach(URL.revokeObjectURL);},
};
(window as unknown as {__P1:typeof api}).__P1=api;
document.querySelector('#compat')!.addEventListener('click',()=>{void(async()=>{for(let row=0;row<4;row++){const answer=await api.compat(row);status.textContent=JSON.stringify(answer,null,2);if(answer.type==='error'||!(answer.result as {parityPassed:boolean}).parityPassed)break;}})().catch(error=>{status.textContent=String(error);});});
document.querySelector('#cancel')!.addEventListener('click',()=>api.cancel());
document.querySelector('#separate')!.addEventListener('click',()=>{void(async()=>{
    const file=document.querySelector<HTMLInputElement>('#audio')!.files?.[0];if(!file)throw Error('请选择音频文件。');
    if(compatibility||separating)throw new ProcessingError('invalid-request','A processing task is already running.');
    separating=true;
    try {
    await engine.load({trackId:crypto.randomUUID(),encodedAudio:await file.arrayBuffer()});
    result=await controller.start(engine,e=>{status.textContent=JSON.stringify(e.type==='result'?{type:e.type}:e);},'/p1-models');
    const directory=await jobDirectory(result.source.directory),exports=document.querySelector('#exports')!;
    urls.forEach(URL.revokeObjectURL);urls.length=0;exports.replaceChildren();
    for(const stem of result.stems){const wav=await(await directory.getFileHandle(stem.wav)).getFile();const url=URL.createObjectURL(wav);urls.push(url);
        const link=document.createElement('a');link.href=url;link.download=`${stem.role}.wav`;link.textContent=`保存 ${stem.role} WAV `;exports.append(link);}
    status.textContent='四轨已完成。请试听角色、串音、断裂和伪影。';
    } finally {separating=false;}
})().catch(error=>{status.textContent=String(error);});});
