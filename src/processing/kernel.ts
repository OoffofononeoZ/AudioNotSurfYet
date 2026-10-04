import { interleave, RollingOverlapAdd, selectStem, SincResampler, StemSummary, wavHeader } from './dsp';
import { checkCancelled, FT_CONFIG, FT_CONFIG_HASH, FT_FRAMES, FT_MODELS, FT_RATE, FT_STRIDE, ORT_VERSION, ProcessingError } from './modelManifest';
import runtimeManifest from './runtime-manifest.json';
import { hashBytes } from './sha256';
import type { StemRole } from './modelManifest';
import { loadModel } from './modelCache';
import { initializeRuntime,FT_SESSION_OPTIONS } from './runtime';
import { jobDirectory, openPcm, yieldTask } from './storage';
import type { StagedPcm } from './storage';
import { prepareModelInput } from './modelInput';
export interface StemArtifact {
    role:StemRole; frames:number; sampleRate:number; wav:string; left:string; right:string;
    energy:Uint16Array; waveformMin:Float32Array; waveformMax:Float32Array;
    energyScale:number;energyOffset:number;
}
export interface SeparationResult {
    source:StagedPcm;config:typeof FT_CONFIG;stems:StemArtifact[];adapter:unknown;
    timeline:Array<{role:string;event:string;at:number}>;
    timings?:{sourceVerifyMs:number;runtimeMs:number;modelInputMs:number;models:Array<{
        role:StemRole;segments:number;cacheMs:number;sessionMs:number;inputMs:number;inferenceMs:number;
        firstInferenceMs:number;maxInferenceMs:number;selectMs:number;stitchMs:number;deriveMs:number;writeMs:number;releaseMs:number;
    }>};
    provenance:{configHash:string;runtimeVersion:string;runtimeManifestHash:string;backend:'webgpu';models:Array<{role:StemRole;row:number;revision:string;sha256:string}>};
}
export async function separate(ref:StagedPcm,signal:AbortSignal,
    progress:(phase:string,done:number,total:number|null)=>void,
    modelBase?:string):Promise<SeparationResult> {
    progress('pcm-staging',0,ref.descriptor.length);
    let at=performance.now();
    const source=await openPcm(ref,signal),directory=await jobDirectory(ref.directory);
    const timings:NonNullable<SeparationResult['timings']>={sourceVerifyMs:performance.now()-at,runtimeMs:0,modelInputMs:0,models:[]};
    const frames=Math.round(ref.descriptor.durationSeconds*FT_RATE);
    at=performance.now();
    const runtime=await initializeRuntime(signal),stems:StemArtifact[]=[],timeline:SeparationResult['timeline']=[];
    timings.runtimeMs=performance.now()-at;at=performance.now();
    const prepared=await prepareModelInput(source,frames,directory,signal,progress),resampler=new SincResampler(prepared.reader.sampleRate);
    timings.modelInputMs=performance.now()-at;
    try{
    for(const model of FT_MODELS){
        const timing={role:model.role,segments:0,cacheMs:0,sessionMs:0,inputMs:0,inferenceMs:0,firstInferenceMs:0,maxInferenceMs:0,selectMs:0,stitchMs:0,deriveMs:0,writeMs:0,releaseMs:0};
        timings.models.push(timing);at=performance.now();
        checkCancelled(signal);const artifact=await loadModel(model,signal,progress,modelBase?`${modelBase}/${model.file}`:undefined);
        timing.cacheMs=performance.now()-at;
        progress('model-load',model.row,4);timeline.push({role:model.role,event:'load',at:performance.now()});
        let session:Awaited<ReturnType<typeof runtime.ort.InferenceSession.create>>|undefined;
        const writers:FileSystemWritableFileStream[]=[];
        try{
            at=performance.now();
            try{session=await runtime.ort.InferenceSession.create(artifact.bytes,{...FT_SESSION_OPTIONS,executionProviders:['webgpu']});}
            catch{throw new ProcessingError('model-incompatible',`${model.role}: FT graph cannot initialize on WebGPU.`);}
            timing.sessionMs=performance.now()-at;
            if(session.inputNames.join(',')!=='mix'||session.outputNames.join(',')!=='stems')throw new ProcessingError('model-incompatible','FT tensor names mismatch.');
            const leftName=`${model.role}-left.f32`,rightName=`${model.role}-right.f32`,wavName=`${model.role}.wav`;
            for(const file of [leftName,rightName,wavName])writers.push(await (await directory.getFileHandle(file,{create:true})).createWritable());
            await writers[2]!.write(wavHeader(frames));
            const ola=new RollingOverlapAdd(frames),summary=new StemSummary(frames);
            for(let start=0;start<frames;start+=FT_STRIDE){
                checkCancelled(signal);progress('inference',start,frames);
                at=performance.now();
                const channels=await resampler.segment(prepared.reader,start,FT_FRAMES);
                const mix=new Float32Array(2*FT_FRAMES);mix.set(channels[0]);mix.set(channels[1],FT_FRAMES);
                const input=new runtime.ort.Tensor('float32',mix,[1,2,FT_FRAMES]);
                timing.inputMs+=performance.now()-at;
                let outputs:Awaited<ReturnType<typeof session.run>>|undefined;
                try{
                    at=performance.now();outputs=await session.run({mix:input});
                    const runMs=performance.now()-at;timing.inferenceMs+=runMs;timing.maxInferenceMs=Math.max(timing.maxInferenceMs,runMs);
                    if(timing.segments++===0)timing.firstInferenceMs=runMs;checkCancelled(signal);
                    const output=outputs.stems;
                    if(!output)throw new ProcessingError('model-incompatible','FT output missing.');
                    at=performance.now();const selected=selectStem(output.data,output.dims,model.row);timing.selectMs+=performance.now()-at;
                    progress('stitch',start,frames);at=performance.now();const chunk=ola.add(start,selected);timing.stitchMs+=performance.now()-at;
                    progress('derive',start,frames);at=performance.now();summary.append(chunk[0],chunk[1]);timing.deriveMs+=performance.now()-at;
                    progress('persist',start,frames);
                    at=performance.now();
                    await writers[0]!.write(chunk[0]);await writers[1]!.write(chunk[1]);await writers[2]!.write(interleave(chunk[0],chunk[1]));
                    timing.writeMs+=performance.now()-at;
                }finally{input.dispose();if(outputs)Object.values(outputs).forEach(t=>t.dispose());}
                await yieldTask();
            }
            checkCancelled(signal);for(const writer of writers)await writer.close();
            const wav=await (await directory.getFileHandle(wavName)).getFile();
            if(wav.size!==44+frames*8)throw new ProcessingError('artifact-export-failed','WAV byte count mismatch.');
            stems.push({role:model.role,frames,sampleRate:FT_RATE,wav:wavName,left:leftName,right:rightName,...summary.finish()});
        }catch(error){
            await Promise.allSettled(writers.map(w=>w.abort()));
            if(error instanceof DOMException&&error.name==='QuotaExceededError')throw new ProcessingError('quota-exceeded','Browser storage quota is exhausted. Explicitly clear processing artifacts before retrying.');
            throw error;
        }
        finally{at=performance.now();if(session)await session.release();timing.releaseMs=performance.now()-at;timeline.push({role:model.role,event:'release',at:performance.now()});}
    }
    checkCancelled(signal);return {source:ref,config:FT_CONFIG,stems,adapter:runtime.adapter,timeline,timings,
        provenance:{configHash:FT_CONFIG_HASH,runtimeVersion:ORT_VERSION,runtimeManifestHash:hashBytes(new TextEncoder().encode(JSON.stringify(runtimeManifest))),backend:'webgpu',
            models:FT_MODELS.map(({role,row,revision,sha256})=>({role,row,revision,sha256}))}};
    }finally{await prepared.cleanup();}
}
