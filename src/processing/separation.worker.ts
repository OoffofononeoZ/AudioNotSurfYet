import { separate } from './kernel';
import { ProcessingError } from './modelManifest';
import { removeJob } from './storage';
import type { StagedPcm } from './storage';
import type { ProcessingJob, WorkerCommand, WorkerEvent } from './workerProtocol';
let active:{job:ProcessingJob;abort:AbortController}|null=null;
const send=(event:WorkerEvent)=>postMessage(event);
self.onmessage=async(event:MessageEvent<WorkerCommand>)=>{
    const command=event.data;
    if(command.type==='cancel'){
        if(active && command.job.jobId===active.job.jobId && command.job.generation===active.job.generation)active.abort.abort();return;
    }
    if(active){send({type:'error',job:command.job,code:'invalid-request',message:'Worker already has an active job.'});return;}
    const job=command.job,abort=new AbortController();active={job,abort};
    let phase='pcm-staging',done=0,total:number|null=null;
    const start=performance.now();
    let phaseStart=start,downloadElapsed=0;
    const report=()=>{
        const now=performance.now(),download=downloadElapsed+(phase==='model-download'?now-phaseStart:0);
        send({type:'progress',job,phase,completedUnits:done,totalUnits:total,elapsedMs:now-start,downloadElapsedMs:download,processingElapsedMs:now-start-download});
    };
    const heartbeat=setInterval(report,500);
    try{
        if(!matches(job,command.pcm))throw new ProcessingError('source-identity-mismatch','Job and PCM identity mismatch.');
        const result=await separate(command.pcm,abort.signal,(p,d,t)=>{
            if(p!==phase){const now=performance.now();if(phase==='model-download')downloadElapsed+=now-phaseStart;phaseStart=now;phase=p;}
            done=d;total=t;report();
        },command.modelBase);
        if(abort.signal.aborted)throw new ProcessingError('job-cancelled','Cancelled.');
        send({type:'result',job,result});
    }catch(error){
        const residual=await removeJob(command.pcm.directory);
        if(abort.signal.aborted)send({type:'cancel',job,residualArtifactIds:residual});
        else send({type:'error',job,code:error instanceof ProcessingError?error.code:'inference-failed',message:error instanceof ProcessingError?error.message:'FT processing failed.',residualArtifactIds:residual});
    }finally{clearInterval(heartbeat);active=null;}
};
function matches(job:ProcessingJob,pcm:StagedPcm){return job.trackId===pcm.descriptor.trackId&&job.sourceHash===pcm.hash&&job.directory===pcm.directory;}
