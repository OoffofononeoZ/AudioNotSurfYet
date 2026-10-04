import type { DecodedAudioCopyPort } from '../analysis/pcm';
import { ProcessingError } from './modelManifest';
import { databaseDelete, databasePut, removeJob, stagePcm } from './storage';
import type { SeparationResult } from './kernel';
import { sameJob } from './workerProtocol';
import type { ProcessingJob,WorkerCommand,WorkerEvent } from './workerProtocol';

interface WorkerPort {
    onmessage:((event:MessageEvent<WorkerEvent>)=>void)|null;
    onerror:((event:ErrorEvent)=>void)|null;
    postMessage(command:WorkerCommand):void;terminate():void;
}
export class SeparationController {
    private generation=0;
    private active:{abort:AbortController;worker:WorkerPort|null;job:ProcessingJob|null;directory:string;finish:(error?:Error,result?:SeparationResult)=>void;cancelTimer:ReturnType<typeof setTimeout>|null}|null=null;
    private residuals=new Set<string>();
    get residualArtifactIds():string[]{return Array.from(this.residuals);}
    private recordCleanup(directory:string,ids:string[]):void {
        this.residuals.delete(directory);
        for(const id of ids)this.residuals.add(id);
    }
    private factory:()=>WorkerPort;
    constructor(factory:()=>WorkerPort=()=>new Worker(new URL('./separation.worker.ts',import.meta.url),{type:'module'})) {this.factory=factory;}
    async start(port:DecodedAudioCopyPort,onEvent:(event:WorkerEvent)=>void=()=>{},modelBase?:string):Promise<SeparationResult> {
        if(this.active)throw new ProcessingError('invalid-request','A separation job is already running.');
        const generation=++this.generation,directory=crypto.randomUUID(),abort=new AbortController();
        const started=performance.now();
        return new Promise<SeparationResult>((resolve,reject)=>{
            let settled=false,terminalSeen=false,failed=false;
            const finish=(error?:Error,result?:SeparationResult)=>{
                if(settled)return;settled=true;
                const current=this.active;
                if(current?.directory===directory){if(current.cancelTimer)clearTimeout(current.cancelTimer);current.worker?.terminate();this.active=null;}
                if(error)reject(error);else if(result)resolve(result);
            };
            const current={abort,worker:null as WorkerPort|null,job:null as ProcessingJob|null,directory,finish,cancelTimer:null as ReturnType<typeof setTimeout>|null};this.active=current;
            const fail=async(error:Error)=>{
                if(failed||settled)return;failed=true;
                current.worker?.terminate();current.worker=null;
                this.recordCleanup(directory,await removeJob(directory));
                try{await databaseDelete('results',directory);}catch{this.residuals.add(directory);}
                if(current.job)onEvent(error instanceof ProcessingError&&error.code==='job-cancelled'?{type:'cancel',job:current.job,residualArtifactIds:this.residualArtifactIds}:{type:'error',job:current.job,code:error instanceof ProcessingError?error.code:'inference-failed',message:error instanceof ProcessingError?error.message:'Processing failed.',residualArtifactIds:this.residualArtifactIds});
                finish(error);
            };
            void (async()=>{
                try{
                    const ref=await stagePcm(port,directory,abort.signal,(done,total)=>{
                        onEvent({type:'progress',job:{jobId:directory,trackId:port.getDecodedAudioDescriptor()?.trackId??'',generation,sourceHash:'staging',directory},phase:'pcm-staging',completedUnits:done,totalUnits:total,elapsedMs:performance.now()-started,downloadElapsedMs:0,processingElapsedMs:performance.now()-started});
                    });
                    if(abort.signal.aborted||this.active!==current)throw new ProcessingError('job-cancelled','Cancelled.');
                    const job:ProcessingJob={jobId:directory,trackId:ref.descriptor.trackId,generation,sourceHash:ref.hash,directory};current.job=job;
                    const stagingElapsed=performance.now()-started;
                    const worker=this.factory();current.worker=worker;
                    worker.onerror=()=>{void fail(new ProcessingError('inference-failed','Separation Worker failed.'));};
                    worker.onmessage=event=>{
                        const message=event.data;
                        if(this.active!==current||!sameJob(message.job,job))return;
                        if(abort.signal.aborted){if(message.type!=='progress')void fail(new ProcessingError('job-cancelled','Cancelled.'));return;}
                        if(terminalSeen)return;
                        if(message.type==='progress'){onEvent({...message,elapsedMs:message.elapsedMs+stagingElapsed,processingElapsedMs:message.processingElapsedMs+stagingElapsed});return;}
                        terminalSeen=true;
                        if(message.type==='result'){
                            void (async()=>{
                                try{if(message.result.source.hash!==job.sourceHash||message.result.source.directory!==directory
                                    || message.result.source.descriptor.trackId!==job.trackId
                                    || message.result.stems.map(s=>s.role).join(',')!=='drums,bass,other,vocals')throw new ProcessingError('source-identity-mismatch','Result identity mismatch.');
                                    await databasePut('results',directory,message.result,abort.signal);
                                    if(this.active!==current||abort.signal.aborted)return;
                                    onEvent(message);finish(undefined,message.result);
                                }catch(error){await fail(error instanceof Error?error:new Error('Result persistence failed.'));}
                            })();
                        }else{void fail(new ProcessingError(message.type==='cancel'?'job-cancelled':message.code,message.type==='cancel'?'Cancelled.':message.message));}
                    };
                    worker.postMessage({type:'start',job,pcm:ref,...(modelBase?{modelBase}:{})});
                }catch(error){await fail(error instanceof Error?error:new Error('Staging failed.'));}
            })();
        });
    }
    cancel():void {
        const current=this.active;if(!current||current.abort.signal.aborted)return;
        current.abort.abort();++this.generation;
        if(current.worker&&current.job)current.worker.postMessage({type:'cancel',job:current.job});
        current.cancelTimer=setTimeout(()=>{
            current.worker?.terminate();current.worker=null;
            this.residuals.add(current.directory);
            void removeJob(current.directory).then(ids=>{this.recordCleanup(current.directory,ids);});
            void databaseDelete('results',current.directory).catch(()=>{this.residuals.add(current.directory);});
            current.finish(new ProcessingError('job-cancelled','Cancelled; residual cleanup registered.'));
        },5000);
    }
}
