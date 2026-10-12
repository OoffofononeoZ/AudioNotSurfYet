import { sameJob } from '../processing/workerProtocol';
import { ProcessingError,checkCancelled } from '../processing/modelManifest';
import { removeJob } from '../processing/storage';
import { TRANSCRIPTION_CONFIG_HASH,TRANSCRIPTION_MODEL_HASH } from './modelManifest';
import { runTranscription } from './pipeline';
import type { TranscriptionCommand,TranscriptionEvent } from './workerProtocol';

let active:{job:TranscriptionCommand['job'];abort:AbortController}|null = null;
const send = (event:TranscriptionEvent) => postMessage(event);
self.onmessage = (event:MessageEvent<TranscriptionCommand>) => { void (async() => {
    const command = event.data;
    if (command.type === 'cancel') { if (active && sameJob(active.job,command.job)) active.abort.abort(); return; }
    if (active) { send({type:'error',job:command.job,code:'invalid-request',message:'An analysis job is already active.',residualArtifactIds:[]}); return; }
    const {job,ft,identity} = command,abort = new AbortController(); active = {job,abort};
    const started = performance.now();
    let phase = 'prepare',role:string|null = null,done = 0,total:number|null = null;
    const report = () => send({type:'progress',job,phase,role,completedUnits:done,totalUnits:total,elapsedMs:performance.now() - started,heartbeatSource:'worker'});
    const heartbeat = setInterval(report,500);
    try {
        if (job.trackId !== ft.source.descriptor.trackId || job.sourceHash !== ft.source.hash || identity.trackId !== job.trackId
            || identity.pcmHash !== job.sourceHash || identity.ftResultId !== ft.source.directory || identity.configHash !== TRANSCRIPTION_CONFIG_HASH
            || identity.modelManifestHash !== TRANSCRIPTION_MODEL_HASH || job.jobId !== job.directory) throw new ProcessingError('source-identity-mismatch','Transcription source identity mismatch.');
        report();
        const bundle = await runTranscription(job,ft,identity,abort.signal,(next,nextRole,completed,units) => {
            phase = next; role = nextRole; done = completed; total = units; report();
        },command.cacheLimit,command.modelBase);
        checkCancelled(abort.signal); send({type:'result',job,bundle});
    } catch (error) {
        const residualArtifactIds = await removeJob(job.directory);
        send(abort.signal.aborted ? {type:'cancel',job,residualArtifactIds} : {type:'error',job,
            code:error instanceof ProcessingError ? error.code : 'inference-failed',message:error instanceof Error ? error.message : String(error),residualArtifactIds});
    } finally { clearInterval(heartbeat); active = null; }
})(); };
