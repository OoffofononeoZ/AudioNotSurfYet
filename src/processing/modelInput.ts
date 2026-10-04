import { SincResampler } from './dsp';
import type { PcmReader } from './dsp';
import { checkCancelled,FT_RATE,ProcessingError } from './modelManifest';
import { yieldTask } from './storage';

// The native PCM stays authoritative. Cache this exact deterministic transform
// once so four specialist models do not repeat resampling in their overlaps.
export async function prepareModelInput(source:PcmReader,frames:number,directory:FileSystemDirectoryHandle,signal:AbortSignal,
    progress:(phase:string,done:number,total:number)=>void):Promise<{reader:PcmReader;cleanup:()=>Promise<void>}> {
    if(source.sampleRate===FT_RATE)return {reader:source,cleanup:async()=>{}};
    checkCancelled(signal);
    const names=['model-input-left.f32','model-input-right.f32'],writers:FileSystemWritableFileStream[]=[];
    const cleanup=async()=>{for(const name of names){try{await directory.removeEntry(name);}catch(e){if(!(e instanceof DOMException&&e.name==='NotFoundError'))throw e;}}};
    try{
        for(const name of names)writers.push(await(await directory.getFileHandle(name,{create:true})).createWritable());
        const resampler=new SincResampler(source.sampleRate);progress('model-resample',0,frames);
        for(let start=0;start<frames;start+=65536){
            checkCancelled(signal);const length=Math.min(65536,frames-start),channels=await resampler.segment(source,start,length);
            for(let channel=0;channel<2;channel++)await writers[channel]!.write(new Float32Array(channels[channel]!));
            progress('model-resample',start+length,frames);await yieldTask();
        }
        checkCancelled(signal);for(const writer of writers)await writer.close();
        const files=await Promise.all(names.map(async name=>(await directory.getFileHandle(name)).getFile()));
        if(files.some(f=>f.size!==frames*4))throw new ProcessingError('pcm-incomplete','Model PCM length mismatch.');
        return {reader:{frames,sampleRate:FT_RATE,channels:2,async read(channel,start,length){
            checkCancelled(signal);if(![0,1].includes(channel)||start<0||length<0||start+length>frames)throw new ProcessingError('invalid-request','Invalid model PCM range.');
            return new Float32Array(await files[channel]!.slice(start*4,(start+length)*4).arrayBuffer());
        }},cleanup};
    }catch(error){
        await Promise.allSettled(writers.map(w=>w.abort()));await Promise.allSettled(names.map(name=>directory.removeEntry(name)));
        if(error instanceof DOMException&&error.name==='QuotaExceededError')throw new ProcessingError('quota-exceeded','Browser storage quota is exhausted. Explicitly clear processing artifacts before retrying.');
        throw error;
    }
}
