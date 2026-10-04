import { it,expect,vi,beforeEach,afterEach } from 'vitest';
import { SeparationController } from '../../src/processing/controller';
import type { WorkerCommand,WorkerEvent } from '../../src/processing/workerProtocol';
import { sameJob } from '../../src/processing/workerProtocol';
import { syntheticPort } from './fixture';
const persistence=vi.hoisted(()=>({put:vi.fn(async()=>{}),remove:vi.fn(async()=>[])}));
vi.mock('../../src/processing/storage',()=>({
    stagePcm:async(port:ReturnType<typeof syntheticPort>,directory:string)=>({directory,descriptor:port.getDecodedAudioDescriptor(),hash:'hash'}),
    databasePut:persistence.put,databaseDelete:vi.fn(async()=>{}),removeJob:persistence.remove,
}));
class FakeWorker {
    onmessage:((event:MessageEvent<WorkerEvent>)=>void)|null=null;
    onerror:((event:ErrorEvent)=>void)|null=null;
    commands:WorkerCommand[]=[];terminate=vi.fn();
    postMessage(command:WorkerCommand){this.commands.push(command);}
    send(event:WorkerEvent){this.onmessage?.({data:event} as MessageEvent<WorkerEvent>);}
}
beforeEach(()=>{persistence.put.mockClear();persistence.remove.mockClear();});
afterEach(()=>vi.useRealTimers());
const tick=()=>new Promise<void>(r=>setTimeout(r,0));
it('checks all job identities and ignores late/unrelated terminals',async()=>{
    const worker=new FakeWorker(),controller=new SeparationController(()=>worker),events:WorkerEvent[]=[];
    const promise=controller.start(syntheticPort(10),e=>events.push(e));await tick();
    const command=worker.commands[0]!;if(command.type!=='start')throw Error('Expected start');
    for(const field of ['jobId','trackId','generation','sourceHash','directory'] as const){const wrong={...command.job,[field]:field==='generation'?999:'wrong'};expect(sameJob(command.job,wrong)).toBe(false);worker.send({type:'error',job:wrong,code:'inference-failed',message:'late'});}
    expect(events.filter(e=>e.type!=='progress')).toHaveLength(0);expect(persistence.put).not.toHaveBeenCalled();
    worker.send({type:'error',job:command.job,code:'model-incompatible',message:'Graph unsupported'});
    await expect(promise).rejects.toMatchObject({code:'model-incompatible'});expect(worker.terminate).toHaveBeenCalled();expect(persistence.remove).toHaveBeenCalledWith(command.pcm.directory);
});
it('cancellation is idempotent and late result cannot publish metadata',async()=>{
    const worker=new FakeWorker(),controller=new SeparationController(()=>worker);
    const promise=controller.start(syntheticPort(10));await tick();
    const command=worker.commands[0]!;if(command.type!=='start')throw Error('Expected start');
    controller.cancel();controller.cancel();expect(worker.commands.filter(c=>c.type==='cancel')).toHaveLength(1);
    worker.send({type:'result',job:command.job,result:{source:command.pcm,stems:[],config:{} as never,adapter:null,timeline:[],provenance:{} as never}});
    await expect(promise).rejects.toMatchObject({code:'job-cancelled'});expect(persistence.put).not.toHaveBeenCalled();
});
it('hung Worker is terminated after five seconds and records cleanup',async()=>{
    vi.useFakeTimers();const worker=new FakeWorker(),controller=new SeparationController(()=>worker);
    const promise=controller.start(syntheticPort(10));const caught=promise.catch(e=>e);await vi.advanceTimersByTimeAsync(0);
    controller.cancel();await vi.advanceTimersByTimeAsync(5000);
    expect(await caught).toMatchObject({code:'job-cancelled'});expect(worker.terminate).toHaveBeenCalled();
});
it('reports immediate feedback and elapsed pulses without claiming blocked Worker progress',async()=>{
    vi.useFakeTimers();const worker=new FakeWorker(),controller=new SeparationController(()=>worker),events:WorkerEvent[]=[];
    const caught=controller.start(syntheticPort(10),e=>events.push(e)).catch(e=>e);
    expect(events[0]).toMatchObject({type:'progress',phase:'pcm-staging',completedUnits:0,heartbeatSource:'controller'});
    await vi.advanceTimersByTimeAsync(0);const command=worker.commands[0]!;if(command.type!=='start')throw Error('Expected start');
    worker.send({type:'progress',job:command.job,phase:'model-load',completedUnits:1,totalUnits:4,elapsedMs:100,downloadElapsedMs:20,processingElapsedMs:80});
    await vi.advanceTimersByTimeAsync(2000);
    const pulse=events.at(-1);expect(pulse).toMatchObject({type:'progress',phase:'model-load',completedUnits:1,totalUnits:4,heartbeatSource:'controller',downloadElapsedMs:20});
    if(pulse?.type!=='progress')throw Error('Expected progress');expect(pulse.processingElapsedMs).toBeGreaterThan(80);
    controller.cancel();await vi.advanceTimersByTimeAsync(4500);expect(await caught).toMatchObject({code:'job-cancelled'});
    expect(events.filter(e=>e.type==='cancel')).toHaveLength(1);const count=events.length;await vi.advanceTimersByTimeAsync(3000);expect(events).toHaveLength(count);
});
it('Worker crash releases its own temporary artifacts',async()=>{
    const worker=new FakeWorker(),controller=new SeparationController(()=>worker);
    const promise=controller.start(syntheticPort(10));await tick();worker.onerror?.({} as ErrorEvent);
    await expect(promise).rejects.toMatchObject({code:'inference-failed'});expect(persistence.remove).toHaveBeenCalledOnce();
});
