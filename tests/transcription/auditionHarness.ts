import { AudioEngine } from '../../src/audio/audioEngine';
import { createStemAuditionSource } from '../../src/processing/stemAuditionSource';
import { jobDirectory,removeJob } from '../../src/processing/storage';
import type { AuditionSource } from '../../src/audio/auditionTypes';

export async function createLongAuditionProbe() {
    const sampleRate=44100,frames=sampleRate*900,directoryId=`audition-test-${crypto.randomUUID()}`,directory=await jobDirectory(directoryId);
    const roles=['drums','bass','other','vocals'],stems=roles.map(role=>({role,frames,sampleRate,left:`${role}-left.f32`,right:`${role}-right.f32`}));
    const writers:FileSystemWritableFileStream[]=[];
    for(const stem of stems)for(const name of [stem.left,stem.right])writers.push(await(await directory.getFileHandle(name,{create:true})).createWritable());
    for(let start=0;start<frames;start+=sampleRate*4){
        const data=Float32Array.from({length:Math.min(sampleRate*4,frames-start)},(_,i)=>Math.sin(2*Math.PI*220*(start+i)/sampleRate)*.06);
        for(const writer of writers)await writer.write(data);
    }
    for(const writer of writers)await writer.close();
    // Real browser decoding of a 15-minute mono PCM16 WAV (silence is sufficient
    // for the original transport; the four OPFS audition files contain signal).
    const originalRate=8000,originalFrames=originalRate*900,encoded=new ArrayBuffer(44+originalFrames*2),view=new DataView(encoded),bytes=new Uint8Array(encoded);
    bytes.set(new TextEncoder().encode('RIFF'));view.setUint32(4,encoded.byteLength-8,true);bytes.set(new TextEncoder().encode('WAVEfmt '),8);view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,originalRate,true);view.setUint32(28,originalRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);bytes.set(new TextEncoder().encode('data'),36);view.setUint32(40,originalFrames*2,true);
    const engine=new AudioEngine();await engine.load({trackId:'long-audition',encodedAudio:encoded});
    const lease=await createStemAuditionSource({kind:'ft',directory:directoryId,resultId:directoryId,trackId:'long-audition',label:'受控 15 分钟 PCM 试听',stems,mutedRoles:[]},new AbortController().signal);
    let reads=0,maximumReadFrames=0,activeReads=0,maximumActiveReads=0,closed=0,stall=false,fail=false,resolveStall:(()=>void)|null=null;
    const wrapper:AuditionSource={...lease,read:async(role,channel,start,length,signal)=>{
        reads++;maximumReadFrames=Math.max(maximumReadFrames,length);activeReads++;maximumActiveReads=Math.max(maximumActiveReads,activeReads);
        try{
            if(fail)throw Error('Injected OPFS read failure');
            if(stall){stall=false;await new Promise<void>(resolve=>{resolveStall=resolve;});}
            return await lease.read(role,channel,start,length,signal);
        }finally{activeReads--;}
    },close:async()=>{await lease.close();closed++;}};
    await engine.setAuditionSource(wrapper,{play:true});
    return {snapshot:()=>({...engine.getSnapshot(),reads,maximumReadFrames,activeReads,maximumActiveReads,closed}),pause:()=>engine.pause(),play:()=>engine.play(),seek:(seconds:number)=>engine.seek(seconds),
        stallNext:()=>{stall=true;},releaseStall:()=>{resolveStall?.();resolveStall=null;},failNext:()=>{fail=true;},original:()=>engine.setAuditionSource(null),dispose:async()=>{resolveStall?.();await engine.dispose();return removeJob(directoryId);}};
}
