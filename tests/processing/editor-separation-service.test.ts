import { it,expect,vi } from 'vitest';
import type { DecodedAudioCopyPort } from '../../src/analysis/pcm';
import type { SeparationResult } from '../../src/processing/kernel';
import { EditorSeparationService } from '../../src/processing/editorSeparationService';
import { ProcessingError } from '../../src/processing/modelManifest';
import type { EditorStemRepositoryPort } from '../../src/processing/editorResultRepository';
import { syntheticPort } from './fixture';

function setup(gpuAvailable=true){
    let port:DecodedAudioCopyPort=syntheticPort(40);
    const source={directory:'editor-00000000-0000-0000-0000-000000000000',descriptor:port.getDecodedAudioDescriptor()!,hash:'a'.repeat(64)};
    const result={source,stems:['drums','bass','other','vocals'].map(role=>({role})),config:{},timeline:[],provenance:{}} as unknown as SeparationResult;
    const repository:EditorStemRepositoryPort={summary:vi.fn(async()=>({usage:0,quota:100000,modelCount:4,missingModelBytes:0,resultCount:0,orphanCount:0})),restore:vi.fn(async()=>null),publish:vi.fn(async()=>{}),wav:vi.fn(async()=>new Blob()),discard:vi.fn(async()=>{}),clearResults:vi.fn(async()=>{}),clearModels:vi.fn(async()=>{})};
    let resolve!:(result:SeparationResult)=>void,reject!:(error:Error)=>void;
    const controller={start:vi.fn((_port:DecodedAudioCopyPort)=>new Promise<SeparationResult>((yes,no)=>{resolve=yes;reject=no;})),cancel:vi.fn()};
    const urls:string[]=[],revoked:string[]=[];
    const transport={setAuditionSource:vi.fn(async()=>{}),setAuditionMuted:vi.fn(),subscribePlayback:vi.fn(()=>()=>{}),play:vi.fn(async()=>{}),pause:vi.fn()};
    const service=new EditorSeparationService({getDecodedAudioDescriptor:()=>port.getDecodedAudioDescriptor(),copyDecodedChannelRange:input=>port.copyDecodedChannelRange(input)},
        transport,{controller,repository,isGpuAvailable:()=>gpuAvailable,createUrl:()=>{const url=`blob:${urls.length}`;urls.push(url);return url;},revokeUrl:url=>revoked.push(url)});
    return {service,repository,controller,result,urls,revoked,transport,finish:()=>resolve(result),fail:(code:string)=>reject(new ProcessingError(code,'failed')),setPort:(next:DecodedAudioCopyPort)=>{port=next;}};
}
it('uses the shared PCM port and only publishes verified artifacts, with balanced result URLs',async()=>{
    const s=setup();await s.service.bind(s.result.source.descriptor.trackId);const job=s.service.start();
    expect(s.controller.start).toHaveBeenCalledTimes(1);expect(s.controller.start.mock.calls[0]![0].getDecodedAudioDescriptor()).toEqual(s.result.source.descriptor);
    s.finish();await job;expect(s.repository.publish).toHaveBeenCalledWith(s.result,expect.any(AbortSignal),expect.any(Function));
    expect(s.service.getSnapshot().status).toBe('ready');expect(s.urls).toHaveLength(4);
    await s.service.bind(null);expect(s.revoked).toEqual(s.urls);await s.service.dispose();
});
it('never overlaps an old cancellation with a new track job and ignores the old result',async()=>{
    const s=setup();await s.service.bind(s.result.source.descriptor.trackId);const old=s.service.start();
    s.setPort({...syntheticPort(20),getDecodedAudioDescriptor:()=>({...syntheticPort(20).getDecodedAudioDescriptor()!,trackId:'next'})});
    const bind=s.service.bind('next');await s.service.start();expect(s.controller.start).toHaveBeenCalledTimes(1);
    s.finish();await old;await bind;expect(s.repository.publish).not.toHaveBeenCalled();expect(s.service.getSnapshot()).toMatchObject({trackId:'next',status:'idle',result:null});await s.service.dispose();
});
it('cancel and failed reruns preserve the old complete result and do not auto-evict',async()=>{
    const s=setup();await s.service.bind(s.result.source.descriptor.trackId);let job=s.service.start();s.finish();await job;
    job=s.service.start();s.service.cancel();s.fail('job-cancelled');await job;
    expect(s.service.getSnapshot()).toMatchObject({status:'cancelled',result:s.result});expect(s.repository.clearResults).not.toHaveBeenCalled();expect(s.revoked).toHaveLength(0);
    job=s.service.start();s.fail('quota-exceeded');await job;expect(s.service.getSnapshot()).toMatchObject({status:'error',result:s.result,errorCode:'quota-exceeded'});await s.service.dispose();
});
it('cleans a new unpublished result when indexing fails and leaves the previous result available',async()=>{
    const s=setup();await s.service.bind(s.result.source.descriptor.trackId);vi.mocked(s.repository.publish).mockRejectedValueOnce(new Error('IDB failure'));
    const job=s.service.start();s.finish();await job;expect(s.repository.discard).toHaveBeenCalledWith(s.result.source.directory);expect(s.service.getSnapshot().result).toBeNull();await s.service.dispose();
});
it('restores verified cache, rejects clearing during a job, and clears only after an explicit command',async()=>{
    const s=setup();vi.mocked(s.repository.restore).mockResolvedValueOnce(s.result);await s.service.bind(s.result.source.descriptor.trackId);
    expect(s.service.getSnapshot()).toMatchObject({status:'ready',restored:true});const job=s.service.start();await s.service.clear('results');expect(s.repository.clearResults).not.toHaveBeenCalled();s.fail('job-cancelled');await job;
    await s.service.clear('models');expect(s.repository.clearModels).toHaveBeenCalledTimes(1);expect(s.service.getSnapshot().result).toBe(s.result);
    await s.service.clear('results');expect(s.repository.clearResults).toHaveBeenCalledTimes(1);expect(s.service.getSnapshot().result).toBeNull();expect(s.revoked).toEqual(s.urls);await s.service.dispose();
});
it('does not publish when native PCM revision changes before a result completes',async()=>{
    const s=setup();await s.service.bind(s.result.source.descriptor.trackId);const job=s.service.start();s.setPort(syntheticPort(50));s.finish();await job;
    expect(s.repository.publish).not.toHaveBeenCalled();expect(s.service.getSnapshot()).toMatchObject({status:'error',errorCode:'source-identity-mismatch'});await s.service.dispose();
});
it('fails without WebGPU before staging or downloading anything',async()=>{
    const s=setup(false);await s.service.bind(s.result.source.descriptor.trackId);await s.service.start();
    expect(s.controller.start).not.toHaveBeenCalled();expect(s.repository.publish).not.toHaveBeenCalled();
    expect(s.service.getSnapshot()).toMatchObject({status:'error',errorCode:'webgpu-unavailable',result:null});await s.service.dispose();
});
it('revokes partially created URLs and retains the complete result when a rerun cannot open its WAVs',async()=>{
    const s=setup();await s.service.bind(s.result.source.descriptor.trackId);let job=s.service.start();s.finish();await job;
    vi.mocked(s.repository.wav).mockResolvedValueOnce(new Blob()).mockRejectedValueOnce(new Error('OPFS file unavailable'));
    job=s.service.start();s.finish();await job;
    expect(s.service.getSnapshot()).toMatchObject({status:'error',result:s.result});
    expect(s.revoked).toEqual([s.urls[4]]);await s.service.dispose();expect(new Set(s.revoked)).toEqual(new Set(s.urls));
});
