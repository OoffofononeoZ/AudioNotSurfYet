import type * as Ort from 'onnxruntime-web';
import manifest from './runtime-manifest.json';
import { checkCancelled, ProcessingError } from './modelManifest';
import { verifyBlob } from './modelCache';

export type OrtModule = typeof Ort;
// The same locked ORT package's JSEP build can place internal FP64 kernels in
// WASM while running neural kernels on WebGPU. No whole-model CPU retry.
export const FT_SESSION_OPTIONS={graphOptimizationLevel:'disabled',logSeverityLevel:0,logVerbosityLevel:1} as const;
interface AdapterInfo { vendor:string;architecture:string;device:string;description:string;isFallbackAdapter:boolean }
export async function initializeRuntime(signal:AbortSignal,reference=false):Promise<{ort:OrtModule;adapter:AdapterInfo|null}> {
    let adapter:GPUAdapter|null=null;
    if(!reference){
        const gpu=navigator.gpu;
        if(!gpu)throw new ProcessingError('webgpu-unavailable','WebGPU is unavailable. Continue with manual editing.');
        adapter=await gpu.requestAdapter({powerPreference:'high-performance',forceFallbackAdapter:false});
        if(!adapter||adapter.info.isFallbackAdapter)throw new ProcessingError('webgpu-unavailable','A hardware WebGPU adapter is required.');
    }
    const files=manifest.assets.filter(asset=>reference ? asset.file==='ort.wasm.min.mjs'||asset.file==='ort-wasm-simd-threaded.mjs'||asset.file==='ort-wasm-simd-threaded.wasm' : asset.file==='ort.all.min.mjs'||asset.file.includes('jsep'));
    for(const asset of files){
        checkCancelled(signal);const response=await fetch(`/processing-runtime/${asset.file}`,{signal});
        if(!response.ok)throw new ProcessingError('runtime-asset-mismatch','Runtime asset missing. Run processing:assets.');
        try{await verifyBlob(await response.blob(),asset.bytes,asset.sha256,signal);}catch(error){checkCancelled(signal);throw new ProcessingError('runtime-asset-mismatch',error instanceof Error?error.message:'Runtime asset mismatch.');}
    }
    const url=new URL(`/processing-runtime/ort.${reference?'wasm':'all'}.min.mjs`,location.origin).href;
    const ort=await import(/* @vite-ignore */ url) as OrtModule;
    ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
    ort.env.wasm.wasmPaths='/processing-runtime/';
    ort.env.logLevel='verbose';
    if(adapter)ort.env.webgpu.adapter=adapter;
    return {ort,adapter:adapter?{vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description,isFallbackAdapter:adapter.info.isFallbackAdapter}:null};
}
