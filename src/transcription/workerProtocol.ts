import type { ProcessingJob } from '../processing/workerProtocol';
import type { SeparationResult } from '../processing/kernel';
import type { AuxiliaryResult } from './auxiliarySeparation';
import type { TranscriptionIdentity,TranscriptionResult } from './candidateTypes';

export interface TranscriptionBundle { result:TranscriptionResult;auxiliary:AuxiliaryResult|null }
export type TranscriptionCommand = {type:'start';job:ProcessingJob;ft:SeparationResult;identity:TranscriptionIdentity;cacheLimit:number;modelBase?:string}
    | {type:'cancel';job:ProcessingJob};
export type TranscriptionEvent =
    | {type:'progress';job:ProcessingJob;phase:string;role:string|null;completedUnits:number;totalUnits:number|null;elapsedMs:number;heartbeatSource:'worker'|'controller'}
    | {type:'result';job:ProcessingJob;bundle:TranscriptionBundle}
    | {type:'error';job:ProcessingJob;code:string;message:string;residualArtifactIds:string[]}
    | {type:'cancel';job:ProcessingJob;residualArtifactIds:string[]};
