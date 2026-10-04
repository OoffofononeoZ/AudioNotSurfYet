import { it,expect,vi,afterEach } from 'vitest';
import { initializeRuntime } from '../../src/processing/runtime';
afterEach(()=>vi.unstubAllGlobals());
it('missing WebGPU explicitly fails and never requests a model or CPU fallback',async()=>{
    vi.stubGlobal('navigator',{});const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    await expect(initializeRuntime(new AbortController().signal)).rejects.toMatchObject({code:'webgpu-unavailable'});expect(fetch).not.toHaveBeenCalled();
});
it('hardware adapter absence and software adapter are rejected',async()=>{
    for(const adapter of [null,{info:{isFallbackAdapter:true}}]){
        vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>adapter}});
        await expect(initializeRuntime(new AbortController().signal)).rejects.toMatchObject({code:'webgpu-unavailable'});
    }
});
it('runtime asset corruption fails before importing the backend',async()=>{
    vi.stubGlobal('navigator',{gpu:{requestAdapter:async()=>({info:{isFallbackAdapter:false}})}});
    vi.stubGlobal('fetch',async()=>new Response('wrong-runtime'));
    await expect(initializeRuntime(new AbortController().signal)).rejects.toMatchObject({code:'runtime-asset-mismatch'});
});
