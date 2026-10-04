import type { OrtModule } from '../../src/processing/runtime';
import { initializeRuntime } from '../../src/processing/runtime';
import { FT_MODELS,FT_FRAMES } from '../../src/processing/modelManifest';
import { loadModel } from '../../src/processing/modelCache';
import { selectStem } from '../../src/processing/dsp';
import { shortMix } from './fixture';
type Mode='jsep'|'jsep-disabled'|'native-disabled'|'native-window-f32'|'wasm'|'wasm-disabled';
self.onmessage=async(event:MessageEvent<{row:number;mode:Mode}>)=>{
    const {row,mode}=event.data,abort=new AbortController(),model=FT_MODELS[row]!;
    let session:Awaited<ReturnType<OrtModule['InferenceSession']['create']>>|undefined;
    const started=performance.now(),steps:unknown[]=[];
    let answer:unknown;
    try{
        const bytes=await loadModel(model,abort.signal,()=>{},`/p1-models/${model.file}`);
        let ort:OrtModule;
        if(mode.startsWith('jsep')){
            const url=new URL('/processing-probe/ort.all.min.mjs',location.origin).href;
            ort=await import(/* @vite-ignore */ url) as OrtModule;
            ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths='/processing-probe/';
            const adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance',forceFallbackAdapter:false});
            if(!adapter||adapter.info.isFallbackAdapter)throw Error('Hardware GPU unavailable');
            ort.env.webgpu.adapter=adapter;
        }else if(mode.startsWith('native')){
            const url=new URL('/processing-probe/ort.webgpu.min.mjs',location.origin).href;
            ort=await import(/* @vite-ignore */ url) as OrtModule;
            ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths='/processing-probe/';
            const adapter=await navigator.gpu?.requestAdapter({powerPreference:'high-performance',forceFallbackAdapter:false});
            if(!adapter||adapter.info.isFallbackAdapter)throw Error('Hardware GPU unavailable');ort.env.webgpu.adapter=adapter;
        }else ort=(await initializeRuntime(abort.signal,true)).ort;
        ort.env.logLevel='verbose';
        steps.push({phase:'session-create',at:performance.now()-started});
        postMessage({type:'progress',mode,steps});
        const inputBytes=mode==='native-window-f32'?new Uint8Array(await(await fetch('/processing-probe/drums-window-f32.onnx')).arrayBuffer()):bytes.bytes;
        session=await ort.InferenceSession.create(inputBytes,{executionProviders:[mode.startsWith('wasm')?'wasm':'webgpu'],graphOptimizationLevel:mode.endsWith('disabled')||mode==='native-window-f32'?'disabled':'all',logSeverityLevel:0,logVerbosityLevel:1});
        steps.push({phase:'run',at:performance.now()-started});postMessage({type:'progress',mode,steps});
        const input=new ort.Tensor('float32',shortMix(),[1,2,FT_FRAMES]);
        let outputs:Awaited<ReturnType<typeof session.run>>|undefined;
        try{
            outputs=await session.run({mix:input});
            const output=outputs.stems!;const selected=selectStem(output.data,output.dims,row);
            let peak=0,sum=0;for(const channel of selected)for(const value of channel){peak=Math.max(peak,Math.abs(value));sum+=value*value;}
            steps.push({phase:'complete',at:performance.now()-started,dims:output.dims,peak,rms:Math.sqrt(sum/(2*FT_FRAMES))});
            answer={type:'result',mode,steps};
        }finally{input.dispose();if(outputs)Object.values(outputs).forEach(t=>t.dispose());}
    }catch(error){answer={type:'error',mode,steps,error:error instanceof Error?error.message:String(error)};}
    finally{await session?.release();}
    postMessage(answer);
};
