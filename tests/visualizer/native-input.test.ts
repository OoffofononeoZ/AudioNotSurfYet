import { expect,test,vi } from 'vitest';
import { NativeAudioSource } from '../../src/visualizer/nativeAudioSource';
import { NATIVE_CHUNK_FRAMES,type NativeAudioFrame } from '../../src/visualizer/nativeAudioAnalysis';
import { CompositionResolver } from '../../src/visualizer/compositionResolver';
import { createComposition,decodeComposition,encodeComposition,validateComposition } from '../../src/visualizer/compositionCodec';
import { createPresetElements } from '../../src/visualizer/compositionPresets';
import { geometricSpectrum } from '../../src/visualizer/geometricBatch';
import { SpectralStringsState } from '../../src/visualizer/spectralStringsState';

const track={contentHash:'a'.repeat(64),fileName:'native.wav',durationSeconds:32,sampleRate:48000};
const frames=(value:number):NativeAudioFrame[]=>Array.from({length:NATIVE_CHUNK_FRAMES},()=>({frequency:Array(128).fill(value),waveform:Array(2048).fill(value)}));
function harness(render=vi.fn(async()=>frames(12))) {
    let revision=1;const changed=vi.fn();
    const port={getDecodedAudioDescriptor:()=>({trackId:'song',revision,length:32*48000,sampleRate:48000,durationSeconds:32,channelCount:2}),
        copyDecodedChannelRange:vi.fn(({length}:{length:number})=>new Float32Array(length).fill(.1))};
    const source=new NativeAudioSource(port,changed,render);
    return {source,render,port,changed,bump:()=>revision++};
}
test('native byte FFT is converted only by the renderer, preserving stereo',()=>{
    const input=Array(2048).fill(0);input[10]=255;input[1024+170]=128;
    const stereo=geometricSpectrum(input,.6,new Float32Array(128),'byte-frequency');
    expect([...stereo.slice(0,64)]).not.toEqual([...stereo.slice(64)]);
    expect(Math.max(...stereo)).toBeCloseTo(.6);
});
test('native cache shares Web Audio jobs, stays bounded and invalidates decoded revisions',async()=>{
    const h=harness();expect(h.source.read('song',0,'frequency')).toBeNull();await h.source.prepare('song',0);
    const first=h.source.read('song',1,'frequency');expect(h.source.read('song',1,'frequency')).toBe(first);
    expect(h.render).toHaveBeenCalledTimes(1);expect(h.source.read('song',1,'waveform')).toHaveLength(2048);
    for(const time of [4,8,12,16])await h.source.prepare('song',time);
    await h.source.prepare('song',0);expect(h.render).toHaveBeenCalledTimes(6);
    h.bump();expect(h.source.read('song',0,'frequency')).toBeNull();await h.source.prepare('song',0);expect(h.render).toHaveBeenCalledTimes(7);
    expect(h.port.copyDecodedChannelRange.mock.calls.every(([r])=>r.length<=194048)).toBe(true);
});
test('reset rejects pending preparation and cannot publish old native frames',async()=>{
    let resolve!:(value:NativeAudioFrame[])=>void;
    const h=harness(vi.fn(()=>new Promise<NativeAudioFrame[]>(done=>{resolve=done;})));
    const preparing=h.source.prepare('song',0);const rejected=expect(preparing).rejects.toThrow('取消');
    h.source.reset();resolve(frames(99));await rejected;expect(h.changed).not.toHaveBeenCalled();
    expect(h.source.read('song',0,'frequency')).toBeNull();h.source.reset();resolve(frames(1));
});
test('integrated native strings prepare complete compact history and survive raw-frame eviction',async()=>{
    const h=harness();h.source.configureHistory(['frequency']);
    await h.source.prepareHistory('song',20,'frequency');expect(h.render).toHaveBeenCalledTimes(6);
    const count=h.render.mock.calls.length,source=(time:number)=>h.source.readHistory('song',time,'frequency')!;
    const state=new SpectralStringsState(),direct=[...state.resolve(20,'native',.6,source).position];
    state.resolve(.5,'native',.6,source);expect([...state.resolve(20,'native',.6,source).position]).toEqual(direct);
    expect(h.render).toHaveBeenCalledTimes(count);expect(source(0)).toHaveLength(64);
    h.source.configureHistory([]);expect(h.source.readHistory('song',0,'frequency')).toBeNull();h.source.reset();
});
test('native bindings round trip, resolve independently of Analyzer and reject unavailable features',()=>{
    const p=createComposition(track);p.elements=createPresetElements('geometric-0.6',32);
    for(const e of p.elements)for(const b of e.bindings)if(b.parameterId==='spectrum')b.source={kind:'native',featureId:'frequency'};
    expect(decodeComposition(encodeComposition(p).buffer as ArrayBuffer)).toEqual(p);
    const e=p.elements.find(e=>e.type==='radial-spectrum')!,resolver=new CompositionResolver();
    const pending=resolver.resolve(p,1,()=>null).get(e.id)?.get('spectrum');expect(pending?.state).toBe('loading');
    const ready=resolver.resolve(p,1,()=>{throw Error('Analyzer must not be called');},undefined,()=>Array(128).fill(3));
    expect(ready.get(e.id)?.get('spectrum')).toMatchObject({state:'ready',value:Array(128).fill(3)});
    e.bindings.find(b=>b.parameterId==='spectrum')!.source={kind:'native',featureId:'mfcc'} as never;
    expect(()=>validateComposition(p)).toThrow('原生输入');
    e.bindings.find(b=>b.parameterId==='spectrum')!.source={kind:'native',featureId:'frequency',projection:{kind:'full'}} as never;
    expect(()=>validateComposition(p)).toThrow();
});
