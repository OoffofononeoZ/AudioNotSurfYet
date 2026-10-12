import { afterEach,expect,it,vi } from 'vitest';
import { TranscriptionController } from '../../src/transcription/controller';
import type { TranscriptionWorkerPort } from '../../src/transcription/controller';
import type { TranscriptionBundle,TranscriptionCommand,TranscriptionEvent } from '../../src/transcription/workerProtocol';
import type { TranscriptionIdentity } from '../../src/transcription/candidateTypes';
import type { SeparationResult } from '../../src/processing/kernel';
const identity:TranscriptionIdentity = {trackId:'song',contentHash:'a'.repeat(64),pcmHash:'b'.repeat(64),ftResultId:'editor-source',durationSeconds:10,
    modelManifestHash:'c'.repeat(64),runtimeManifestHash:'d'.repeat(64),configHash:'e'.repeat(64),selectedRoles:['drums']};
const ft = {source:{hash:identity.pcmHash}} as SeparationResult;
class FakeWorker implements TranscriptionWorkerPort {
    onmessage:TranscriptionWorkerPort['onmessage'] = null;onerror:TranscriptionWorkerPort['onerror'] = null;
    messages:TranscriptionCommand[] = [];terminate = vi.fn();postMessage(message:TranscriptionCommand):void { this.messages.push(message); }
    emit(event:TranscriptionEvent):void { this.onmessage?.({data:event} as MessageEvent<TranscriptionEvent>); }
    result():TranscriptionBundle { const job = this.messages[0]!.job;return {auxiliary:null,result:{version:1,id:job.jobId,createdAt:new Date().toISOString(),identity,completedRoles:['drums'],failures:[],truncatedDrumSegments:[],candidates:[],auxiliaryDirectory:null,timings:{totalMs:1}}}; }
}
afterEach(() => vi.useRealTimers());
it('ignores a stale identity and settles once for an actual matching result',async() => {
    const worker = new FakeWorker(),cleanup = vi.fn(async() => [] as string[]),controller = new TranscriptionController({factory:() => worker,cleanup});
    const pending = controller.start(ft,identity,1e9),job = worker.messages[0]!.job;
    worker.emit({type:'result',job:{...job,generation:job.generation+1},bundle:worker.result()});expect(worker.terminate).not.toHaveBeenCalled();
    const bundle = worker.result();worker.emit({type:'result',job,bundle});expect(await pending).toBe(bundle);expect(worker.terminate).toHaveBeenCalledTimes(1);expect(cleanup).not.toHaveBeenCalled();
});
it('rejects a source mismatch and keeps the slot until owned files finish cleanup',async() => {
    const worker = new FakeWorker();let release!:() => void;const cleanup = vi.fn(() => new Promise<string[]>(resolve => { release = () => resolve([]); }));
    const controller = new TranscriptionController({factory:() => worker,cleanup}),pending = controller.start(ft,identity,1e9),rejected = expect(pending).rejects.toMatchObject({code:'source-identity-mismatch'}),bundle = worker.result();
    bundle.result.identity = {...identity,pcmHash:'f'.repeat(64)};worker.emit({type:'result',job:worker.messages[0]!.job,bundle});
    expect(worker.terminate).toHaveBeenCalledTimes(1);expect(() => controller.start(ft,identity,1e9)).toThrow(/正在处理/);release();await rejected;expect(cleanup).toHaveBeenCalledTimes(1);
});
it('cancels a late successful result, cleans once and does not run the deadline cleanup again',async() => {
    vi.useFakeTimers();const worker = new FakeWorker();let release!:() => void;const cleanup = vi.fn(() => new Promise<string[]>(resolve => { release = () => resolve(['leftover']); }));
    const controller = new TranscriptionController({factory:() => worker,cleanup}),pending = controller.start(ft,identity,1e9),rejected = expect(pending).rejects.toMatchObject({code:'job-cancelled'});
    controller.cancel();worker.emit({type:'result',job:worker.messages[0]!.job,bundle:worker.result()});await vi.advanceTimersByTimeAsync(10000);expect(cleanup).toHaveBeenCalledTimes(1);expect(worker.terminate).toHaveBeenCalledTimes(1);
    release();await rejected;expect(controller.residualArtifactIds).toEqual(['leftover']);
});
it('terminates an unresponsive worker at the cancellation deadline and releases only after cleanup',async() => {
    vi.useFakeTimers();const worker = new FakeWorker(),cleanup = vi.fn(async() => [] as string[]),controller = new TranscriptionController({factory:() => worker,cleanup});
    const pending = controller.start(ft,identity,1e9),rejected = expect(pending).rejects.toMatchObject({code:'job-cancelled'});controller.cancel();await vi.advanceTimersByTimeAsync(4499);expect(worker.terminate).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);await rejected;expect(worker.terminate).toHaveBeenCalledTimes(1);expect(cleanup).toHaveBeenCalledTimes(1);
});
