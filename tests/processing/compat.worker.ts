import { P1_PARITY_LIMIT } from './acceptance';
import { FT_MODELS, FT_FRAMES } from '../../src/processing/modelManifest';
import { loadModel,verifyBlob } from '../../src/processing/modelCache';
import { selectStem } from '../../src/processing/dsp';
import { initializeRuntime,FT_SESSION_OPTIONS } from '../../src/processing/runtime';
import { hashBytes } from '../../src/processing/sha256';
import { shortMix,FIXTURE_VERSION } from './fixture';
self.onmessage=async(event:MessageEvent<{row:number;variant?:string}>)=>{
    const model=FT_MODELS[event.data.row]!;
    const abort=new AbortController(),steps:Array<Record<string,unknown>>=[];
    const started=performance.now();
    let adapter:unknown=null,inputHash='',runtimePatch:unknown=null;
    try{
        const bytes=await loadModel(model,abort.signal,(phase,done,total)=>postMessage({type:'progress',phase,done,total}),`/p1-models/${model.file}`);
        let graphBytes=bytes.bytes;
        if(event.data.variant?.includes('intermediates')){
            const identity=await(await fetch('/processing-probe/observe.json')).json() as {sha256:string;bytes:number};runtimePatch=identity;
            const blob=await(await fetch('/processing-probe/drums-observe.onnx')).blob();await verifyBlob(blob,identity.bytes,identity.sha256,abort.signal);graphBytes=new Uint8Array(await blob.arrayBuffer());
        }
        if(event.data.variant==='mean-f64'){
            const identity=await(await fetch('/processing-probe/mean-f64.json')).json() as {sha256:string;bytes:number};runtimePatch=identity;
            const blob=await(await fetch('/processing-probe/drums-mean-f64.onnx')).blob();await verifyBlob(blob,identity.bytes,identity.sha256,abort.signal);graphBytes=new Uint8Array(await blob.arrayBuffer());
        }
        const mix=shortMix();inputHash=hashBytes(new Uint8Array(mix.buffer));
        let gpu:readonly Float32Array[]|undefined,preciseWasm:readonly Float32Array[]|undefined;
        const observedGpu=new Map<string,Float32Array>(),observations:unknown[]=[];
        let maxError=0,sumError=0,maxAt:unknown=null,overTolerance=0,originalDeltaMax=0,originalDeltaSum=0;
        const references=event.data.variant==='mean-f64'?[false,true,true]:[false,true];
        for(const [index,reference] of references.entries()){
            const originalReference=index===2;
            const runtime=await initializeRuntime(abort.signal,reference);if(!reference)adapter=runtime.adapter;
            const profiles:unknown[]=[];
            if(!reference)runtime.ort.env.webgpu.profiling={mode:'default',ondata:data=>profiles.push(data)};
            const loadStart=performance.now();
            postMessage({type:'progress',phase:reference?'wasm-load':'webgpu-load'});
            steps.push({backend:reference?'wasm-reference':'webgpu',phase:'session-create-start',at:performance.now()});
            const optimized=event.data.variant?.includes('no-fold');
            const bounded=event.data.variant?.startsWith('bounded-fold');
            const session=await runtime.ort.InferenceSession.create(originalReference?bytes.bytes:graphBytes,{...FT_SESSION_OPTIONS,
                ...(optimized?{graphOptimizationLevel:'all',extra:{optimization:{disable_specified_optimizers:'ConstantFolding'}}}:{}),
                ...(bounded?{graphOptimizationLevel:'all',extra:{optimization:{constant_folding_max_output_size_in_bytes:event.data.variant?.includes('2m')?'2097152':'1048576'}}}:{}),
                executionProviders:[reference?'wasm':{name:'webgpu',preferredLayout:event.data.variant?.includes('nhwc')?'NHWC':'NCHW'}]});
            const input=new runtime.ort.Tensor('float32',mix,[1,2,FT_FRAMES]);
            let outputs:Awaited<ReturnType<typeof session.run>>|undefined;
            try{
                postMessage({type:'progress',phase:reference?'wasm-inference':'webgpu-inference'});
                const runStart=performance.now();outputs=await session.run({mix:input});
                const output=outputs.stems;if(!output)throw Error('Missing stems output.');
                const selected=selectStem(output.data,output.dims,model.row);
                for(const [name,tensor] of Object.entries(outputs))if(name!=='stems'){
                    if(!(tensor.data instanceof Float32Array))throw Error('Expected float observation');
                    const observed=tensor.dims.length===4&&tensor.dims[1]===4&&tensor.dims[2]===2?tensor.data.subarray(rowOffset(model.row,tensor.dims[3]!),rowOffset(model.row+1,tensor.dims[3]!)):tensor.data;
                    if(!reference)observedGpu.set(name,new Float32Array(observed));
                    else{const values=observedGpu.get(name)!;let max=0,at=0,sum=0,peak=0;for(let i=0;i<values.length;i++){const error=Math.abs(values[i]!-observed[i]!);if(error>max){max=error;at=i;}sum+=error*error;peak=Math.max(peak,Math.abs(observed[i]!));}observations.push({name,dims:tensor.dims,max,at,rms:Math.sqrt(sum/values.length),referencePeak:peak});}
                }
                if(!reference)gpu=selected;
                else if(originalReference)for(let channel=0;channel<2;channel++)for(let i=0;i<FT_FRAMES;i++){
                    const error=Math.abs(preciseWasm![channel]![i]!-selected[channel]![i]!);originalDeltaMax=Math.max(originalDeltaMax,error);originalDeltaSum+=error*error;
                }
                else {preciseWasm=selected;for(let channel=0;channel<2;channel++)for(let i=0;i<FT_FRAMES;i++){
                    const error=Math.abs(gpu![channel]![i]!-selected[channel]![i]!);if(error>maxError){maxError=error;maxAt={channel,frame:i,gpu:gpu![channel]![i],reference:selected[channel]![i]};}if(error>P1_PARITY_LIMIT)overTolerance++;sumError+=error*error;
                }}
                const kernelCounts:Record<string,number>={};for(const p of profiles){const type=(p as {kernelType:string}).kernelType;kernelCounts[type]=(kernelCounts[type]??0)+1;}
                steps.push({backend:originalReference?'original-wasm':reference?'wasm-reference':'webgpu',sessionMs:runStart-loadStart,inferenceMs:performance.now()-runStart,inputNames:session.inputNames,outputNames:session.outputNames,dims:output.dims,profileCount:profiles.length,kernelCounts});
            }finally{input.dispose();if(outputs)Object.values(outputs).forEach(t=>t.dispose());await session.release();}
        }
        postMessage({type:'result',result:{role:model.role,variant:event.data.variant||'disabled',runtimePatch,model:{revision:model.revision,sha256:model.sha256,bytes:model.bytes},fixture:FIXTURE_VERSION,inputHash,adapter,steps,observations,maxError,maxAt,overTolerance,rmsError:Math.sqrt(sumError/(2*FT_FRAMES)),originalDeltaMax,originalDeltaRms:Math.sqrt(originalDeltaSum/(2*FT_FRAMES)),parityLimit:P1_PARITY_LIMIT,parityPassed:maxError<=P1_PARITY_LIMIT,elapsedMs:performance.now()-started}});
    }catch(error){postMessage({type:'error',result:{role:model.role,model:{revision:model.revision,sha256:model.sha256,bytes:model.bytes},runtimeVersion:'1.30.0',fixture:FIXTURE_VERSION,inputHash,adapter,userAgent:navigator.userAgent,steps,elapsedMs:performance.now()-started,error:error instanceof Error?error.message:String(error)}});}
};
function rowOffset(row:number,frames:number){return row*2*frames;}
