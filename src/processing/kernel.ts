import { interleave, RollingOverlapAdd, selectStem, SincResampler, StemSummary, wavHeader } from './dsp';
import { checkCancelled, FT_CONFIG, FT_CONFIG_HASH, FT_FRAMES, FT_MODELS, FT_RATE, FT_STRIDE, ORT_VERSION, ProcessingError } from './modelManifest';
import runtimeManifest from './runtime-manifest.json';
import { hashBytes } from './sha256';
import type { StemRole } from './modelManifest';
import { loadModel } from './modelCache';
import { initializeRuntime,FT_SESSION_OPTIONS } from './runtime';
import { jobDirectory, openPcm, yieldTask } from './storage';
import type { StagedPcm } from './storage';
export interface StemArtifact {
    role:StemRole; frames:number; sampleRate:number; wav:string; left:string; right:string;
    energy:Uint16Array; waveformMin:Float32Array; waveformMax:Float32Array;
    energyScale:number;energyOffset:number;
}
export interface SeparationResult {
    source:StagedPcm;config:typeof FT_CONFIG;stems:StemArtifact[];adapter:unknown;
    timeline:Array<{role:string;event:string;at:number}>;
    provenance:{configHash:string;runtimeVersion:string;runtimeManifestHash:string;backend:'webgpu';models:Array<{role:StemRole;row:number;revision:string;sha256:string}>};
}
export async function separate(ref:StagedPcm,signal:AbortSignal,
    progress:(phase:string,done:number,total:number|null)=>void,
    modelBase?:string):Promise<SeparationResult> {
    progress('pcm-staging',0,ref.descriptor.length);
    const source=await openPcm(ref,signal),directory=await jobDirectory(ref.directory);
    const resampler=new SincResampler(source.sampleRate),frames=Math.round(ref.descriptor.durationSeconds*FT_RATE);
    const runtime=await initializeRuntime(signal),stems:StemArtifact[]=[],timeline:SeparationResult['timeline']=[];
    for(const model of FT_MODELS){
        checkCancelled(signal);const artifact=await loadModel(model,signal,progress,modelBase?`${modelBase}/${model.file}`:undefined);
        progress('model-load',model.row,4);timeline.push({role:model.role,event:'load',at:performance.now()});
        let session:Awaited<ReturnType<typeof runtime.ort.InferenceSession.create>>|undefined;
        const writers:FileSystemWritableFileStream[]=[];
        try{
            try{session=await runtime.ort.InferenceSession.create(artifact.bytes,{...FT_SESSION_OPTIONS,executionProviders:['webgpu']});}
            catch{throw new ProcessingError('model-incompatible',`${model.role}: FT graph cannot initialize on WebGPU.`);}
            if(session.inputNames.join(',')!=='mix'||session.outputNames.join(',')!=='stems')throw new ProcessingError('model-incompatible','FT tensor names mismatch.');
            const leftName=`${model.role}-left.f32`,rightName=`${model.role}-right.f32`,wavName=`${model.role}.wav`;
            for(const file of [leftName,rightName,wavName])writers.push(await (await directory.getFileHandle(file,{create:true})).createWritable());
            await writers[2]!.write(wavHeader(frames));
            const ola=new RollingOverlapAdd(frames),summary=new StemSummary(frames);
            for(let start=0;start<frames;start+=FT_STRIDE){
                checkCancelled(signal);progress('inference',start,frames);
                const channels=await resampler.segment(source,start,FT_FRAMES);
                const mix=new Float32Array(2*FT_FRAMES);mix.set(channels[0]);mix.set(channels[1],FT_FRAMES);
                const input=new runtime.ort.Tensor('float32',mix,[1,2,FT_FRAMES]);
                let outputs:Awaited<ReturnType<typeof session.run>>|undefined;
                try{
                    outputs=await session.run({mix:input});checkCancelled(signal);
                    const output=outputs.stems;
                    if(!output)throw new ProcessingError('model-incompatible','FT output missing.');
                    const selected=selectStem(output.data,output.dims,model.row);
                    progress('stitch',start,frames);const chunk=ola.add(start,selected);
                    progress('derive',start,frames);summary.append(chunk[0],chunk[1]);
                    progress('persist',start,frames);
                    await writers[0]!.write(chunk[0]);await writers[1]!.write(chunk[1]);await writers[2]!.write(interleave(chunk[0],chunk[1]));
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
        finally{if(session)await session.release();timeline.push({role:model.role,event:'release',at:performance.now()});}
    }
    checkCancelled(signal);return {source:ref,config:FT_CONFIG,stems,adapter:runtime.adapter,timeline,
        provenance:{configHash:FT_CONFIG_HASH,runtimeVersion:ORT_VERSION,runtimeManifestHash:hashBytes(new TextEncoder().encode(JSON.stringify(runtimeManifest))),backend:'webgpu',
            models:FT_MODELS.map(({role,row,revision,sha256})=>({role,row,revision,sha256}))}};
}
