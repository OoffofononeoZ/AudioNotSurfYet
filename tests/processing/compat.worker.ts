import { FT_MODELS, FT_FRAMES } from '../../src/processing/modelManifest';
import { loadModel } from '../../src/processing/modelCache';
import { selectStem } from '../../src/processing/dsp';
import { initializeRuntime } from '../../src/processing/runtime';
import { hashBytes } from '../../src/processing/sha256';
import { shortMix,FIXTURE_VERSION } from './fixture';
self.onmessage=async(event:MessageEvent<{row:number}>)=>{
    const model=FT_MODELS[event.data.row]!;
    const abort=new AbortController(),steps:Array<Record<string,unknown>>=[];
    const started=performance.now();
    let adapter:unknown=null,inputHash='';
    try{
        const bytes=await loadModel(model,abort.signal,(phase,done,total)=>postMessage({type:'progress',phase,done,total}),`/p1-models/${model.file}`);
        const mix=shortMix();inputHash=hashBytes(new Uint8Array(mix.buffer));
        let gpu:readonly Float32Array[]|undefined;
        let maxError=0,sumError=0;
        for(const reference of [false,true]){
            const runtime=await initializeRuntime(abort.signal,reference);if(!reference)adapter=runtime.adapter;
            const profiles:unknown[]=[];
            if(!reference)runtime.ort.env.webgpu.profiling={mode:'default',ondata:data=>profiles.push(data)};
            const loadStart=performance.now();
            postMessage({type:'progress',phase:reference?'wasm-load':'webgpu-load'});
            steps.push({backend:reference?'wasm-reference':'webgpu',phase:'session-create-start',at:performance.now()});
            const session=await runtime.ort.InferenceSession.create(bytes.bytes,{executionProviders:[reference?'wasm':'webgpu'],logSeverityLevel:0,logVerbosityLevel:1});
            const input=new runtime.ort.Tensor('float32',mix,[1,2,FT_FRAMES]);
            let outputs:Awaited<ReturnType<typeof session.run>>|undefined;
            try{
                postMessage({type:'progress',phase:reference?'wasm-inference':'webgpu-inference'});
                const runStart=performance.now();outputs=await session.run({mix:input});
                const output=outputs.stems;if(!output)throw Error('Missing stems output.');
                const selected=selectStem(output.data,output.dims,model.row);
                if(!reference)gpu=selected;
                else for(let channel=0;channel<2;channel++)for(let i=0;i<FT_FRAMES;i++){
                    const error=Math.abs(gpu![channel]![i]!-selected[channel]![i]!);maxError=Math.max(maxError,error);sumError+=error*error;
                }
                steps.push({backend:reference?'wasm-reference':'webgpu',sessionMs:runStart-loadStart,inferenceMs:performance.now()-runStart,inputNames:session.inputNames,outputNames:session.outputNames,dims:output.dims,profiles});
            }finally{input.dispose();if(outputs)Object.values(outputs).forEach(t=>t.dispose());await session.release();}
        }
        postMessage({type:'result',result:{role:model.role,model:{revision:model.revision,sha256:model.sha256,bytes:model.bytes},fixture:FIXTURE_VERSION,inputHash,adapter,steps,maxError,rmsError:Math.sqrt(sumError/(2*FT_FRAMES)),parityPassed:maxError<=1e-3,elapsedMs:performance.now()-started}});
    }catch(error){postMessage({type:'error',result:{role:model.role,model:{revision:model.revision,sha256:model.sha256,bytes:model.bytes},runtimeVersion:'1.30.0',fixture:FIXTURE_VERSION,inputHash,adapter,userAgent:navigator.userAgent,steps,elapsedMs:performance.now()-started,error:error instanceof Error?error.message:String(error)}});}
};
