import type { SeparationResult } from '../processing/kernel';
import { ProcessingError } from '../processing/modelManifest';
import { removeJob } from '../processing/storage';
import { sameJob } from '../processing/workerProtocol';
import type { ProcessingJob } from '../processing/workerProtocol';
import { validateCandidates } from './candidates';
import type { TranscriptionIdentity } from './candidateTypes';
import type { TranscriptionBundle,TranscriptionCommand,TranscriptionEvent } from './workerProtocol';

export interface TranscriptionWorkerPort {
    onmessage:((event:MessageEvent<TranscriptionEvent>) => void)|null;
    onerror:((event:ErrorEvent) => void)|null;
    postMessage(message:TranscriptionCommand):void;
    terminate():void;
}
export class TranscriptionController {
    private generation = 0;
    private active:{job:ProcessingJob;worker:TranscriptionWorkerPort;cancelled:boolean;fail:(error:Error) => Promise<void>;timer:ReturnType<typeof setTimeout>|null}|null = null;
    private readonly factory:() => TranscriptionWorkerPort;
    private readonly cleanup:(directory:string) => Promise<string[]>;
    private residuals = new Set<string>();
    constructor(options:{factory?:() => TranscriptionWorkerPort;cleanup?:(directory:string) => Promise<string[]>} = {}) {
        this.factory = options.factory ?? (() => new Worker(new URL('./transcription.worker.ts',import.meta.url),{type:'module'}));
        this.cleanup = options.cleanup ?? removeJob;
    }
    get residualArtifactIds():string[] { return [...this.residuals]; }
    start(ft:SeparationResult,identity:TranscriptionIdentity,cacheLimit:number,onEvent:(event:TranscriptionEvent) => void = () => {},modelBase?:string):Promise<TranscriptionBundle> {
        if (this.active) throw new ProcessingError('processing-busy','已有自动标记任务正在处理或释放。');
        const directory = `transcription-${crypto.randomUUID()}`;
        const job:ProcessingJob = {jobId:directory,directory,generation:++this.generation,trackId:identity.trackId,sourceHash:identity.pcmHash};
        let worker:TranscriptionWorkerPort;
        try { worker = this.factory(); } catch (error) { return Promise.reject(new ProcessingError('worker-unavailable',String(error))); }
        const started = performance.now();
        return new Promise((resolve,reject) => {
            let terminal = false,settled = false,terminated = false;
            const stopWorker = () => { if (!terminated) { terminated = true;worker.onmessage = null;worker.onerror = null;worker.terminate(); } };
            let last:Extract<TranscriptionEvent,{type:'progress'}>|null = null;
            const heartbeat = setInterval(() => {
                if (!last || settled || terminal || this.active?.cancelled) return;
                onEvent({...last,elapsedMs:performance.now() - started,heartbeatSource:'controller'});
            },500);
            const finish = (error?:Error,bundle?:TranscriptionBundle) => {
                if (settled) return; settled = true; clearInterval(heartbeat);
                stopWorker();
                if (this.active?.job.jobId === job.jobId) { if (this.active.timer) clearTimeout(this.active.timer); this.active = null; }
                if (error) reject(error); else if (bundle) resolve(bundle);
            };
            const fail = async(error:Error) => {
                if (terminal || settled) return; terminal = true;
                if (current.timer) { clearTimeout(current.timer);current.timer = null; }
                stopWorker();
                const residuals = await this.cleanup(directory).catch(() => [directory]);
                for (const value of residuals) this.residuals.add(value);
                if (error instanceof ProcessingError && error.code === 'job-cancelled') onEvent({type:'cancel',job,residualArtifactIds:residuals});
                else onEvent({type:'error',job,code:error instanceof ProcessingError ? error.code : 'inference-failed',message:error.message,residualArtifactIds:residuals});
                finish(error);
            };
            const current = {job,worker,cancelled:false,fail,timer:null as ReturnType<typeof setTimeout>|null}; this.active = current;
            worker.onmessage = event => {
                const message = event.data;
                if (settled || terminal || this.active !== current || !message?.job || !sameJob(message.job,job)) return;
                if (current.cancelled) { if (message.type !== 'progress') void fail(new ProcessingError('job-cancelled','已取消自动标记。')); return; }
                if (message.type === 'progress') { last = message; onEvent(message); return; }
                if (message.type === 'result') {
                    try {
                        validateCandidates(message.bundle.result);
                        if (message.bundle.result.id !== job.jobId || JSON.stringify(message.bundle.result.identity) !== JSON.stringify(identity)
                            || (message.bundle.auxiliary && (message.bundle.auxiliary.directory !== directory || message.bundle.result.auxiliaryDirectory !== directory
                                || message.bundle.auxiliary.source.hash !== ft.source.hash))) throw new ProcessingError('source-identity-mismatch','自动标记结果来源身份不符。');
                        terminal = true; onEvent(message); finish(undefined,message.bundle);
                    } catch (error) { void fail(error instanceof Error ? error : new ProcessingError('result-invalid','自动标记结果无效。')); }
                } else void fail(new ProcessingError(message.type === 'cancel' ? 'job-cancelled' : message.code,message.type === 'cancel' ? '已取消自动标记。' : message.message));
            };
            worker.onerror = () => { void fail(new ProcessingError('inference-failed','自动标记 Worker 无法继续。')); };
            const initial:Extract<TranscriptionEvent,{type:'progress'}> = {type:'progress',job,phase:'prepare',role:null,completedUnits:0,totalUnits:null,elapsedMs:0,heartbeatSource:'controller'};
            last = initial; onEvent(initial);
            try { worker.postMessage({type:'start',job,ft,identity,cacheLimit,...(modelBase ? {modelBase} : {})}); }
            catch (error) { void fail(error instanceof Error ? error : Error(String(error))); }
        });
    }
    cancel():void {
        const current = this.active;
        if (!current || current.cancelled) return; current.cancelled = true;
        try { current.worker.postMessage({type:'cancel',job:current.job}); } catch { /* Force termination still owns cleanup. */ }
        // Match the existing processing cancellation deadline. Terminate first,
        // await cleanup, and only then let the next task acquire its Worker slot.
        current.timer = setTimeout(() => { void current.fail(new ProcessingError('job-cancelled','已取消自动标记，残留文件已登记。')); },4500);
    }
}
