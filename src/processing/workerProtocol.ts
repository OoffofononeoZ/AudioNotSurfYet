import type { SeparationResult } from './kernel';
import type { StagedPcm } from './storage';
export interface ProcessingJob {jobId:string;trackId:string;generation:number;sourceHash:string;directory:string}
export type WorkerCommand = {type:'start';job:ProcessingJob;pcm:StagedPcm;modelBase?:string}|{type:'cancel';job:ProcessingJob};
export type WorkerEvent =
    |{type:'progress';job:ProcessingJob;phase:string;completedUnits:number;totalUnits:number|null;elapsedMs:number;downloadElapsedMs:number;processingElapsedMs:number}
    |{type:'result';job:ProcessingJob;result:SeparationResult}
    |{type:'cancel';job:ProcessingJob;residualArtifactIds:string[]}
    |{type:'error';job:ProcessingJob;code:string;message:string;residualArtifactIds?:string[]};
export function sameJob(a:ProcessingJob,b:ProcessingJob):boolean {
    return a.jobId===b.jobId&&a.trackId===b.trackId&&a.generation===b.generation&&a.sourceHash===b.sourceHash&&a.directory===b.directory;
}
