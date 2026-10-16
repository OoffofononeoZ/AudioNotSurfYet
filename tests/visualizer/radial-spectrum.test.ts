import {expect,test} from 'vitest';
import { createRadialSpectrumSampler } from '../../src/visualizer/radialSpectrum';
import { geometricSpectrum,GeometricBatch } from '../../src/visualizer/geometricBatch';
import { buildGeometricElement } from '../../src/visualizer/geometricElements';
import { createPresetElements } from '../../src/visualizer/compositionPresets';
import { parameterKey } from '../../src/visualizer/compositionEffects';
import type { VisualizerResolvedParameterMap } from '../../src/visualizer/rendererTypes';

test('silent and constant spectra remain exact, including circular closure',()=>{
    for(const value of [0,.2,.6]) {
        const sample=createRadialSpectrumSampler(new Float32Array(128).fill(value));
        for(let i=-2;i<=258;i++)expect(sample(i)).toBeCloseTo(value,7);
        expect(sample(128)).toBe(sample(0));expect(sample(-1)).toBe(sample(127));
    }
});

for(const native of [false,true])test((native?'native stereo':'Analyzer')+' zero tails do not become a flat arc or an abrupt bass seam',()=>{
    const channel=Array.from({length:64},(_,i)=>i<40?128*Math.exp(-i/10):0);
    const input=native?[...channel,...channel.map(v=>v*.65)]:channel.flatMap(v=>Array(8).fill(v));
    const levels=geometricSpectrum(input,.6,new Float32Array(128),native),original=levels.slice(),sample=createRadialSpectrumSampler(levels);
    const contour=Array.from({length:128},(_,i)=>sample(i));
    expect(levels).toEqual(original);
    expect(contour.filter(v=>v===0).length).toBeGreaterThan(0);
    expect(contour.filter(v=>v===0).length).toBeLessThan([...levels].filter(v=>v===0).length/2);
    const oldJump=Math.abs(levels[63]!-levels[64]!);
    for(const boundary of [0,64,128])expect(Math.abs(sample(boundary)-sample(boundary-1))).toBeLessThan(oldJump/3);
    expect(Math.max(...contour)).toBeLessThanOrEqual(Math.max(...levels));
    expect(new Set(contour.map(v=>v.toFixed(5))).size).toBeGreaterThan(16);
});

test('short quiet tails keep every original band, and long tails retain frequency order and some silence',()=>{
    for(const length of [1,4,8]) {
        const input=Float32Array.from({length:128},(_,i)=>i%64>=64-length?0:(64-i%64)/128),sample=createRadialSpectrumSampler(input);
        for(let i=0;i<128;i++)expect(sample(i)).toBe(input[i]);
    }
    const input=Float32Array.from({length:128},(_,i)=>i%64<40? (64-i%64)/128:.00001),sample=createRadialSpectrumSampler(input);
    const channel=Array.from({length:64},(_,i)=>sample(i));
    for(let i=3;i<62;i++)expect(channel[i]).toBeLessThanOrEqual(channel[i-1]!);
    expect(channel.filter(v=>v<.0001).length).toBeGreaterThan(0);expect(channel.filter(v=>v<.0001).length).toBeLessThan(12);
});

test('interior silent ranges survive and separate channels are not replaced with invented energy',()=>{
    const levels=Float32Array.from({length:128},(_,i)=>i<64&&(i<20||i>=45)? .4:0),sample=createRadialSpectrumSampler(levels);
    for(let i=0;i<128;i++)expect(sample(i)).toBe(levels[i]);
    expect(sample(24)).toBe(0);expect(sample(40)).toBe(0);expect(sample(96)).toBe(0);
    expect(sample(2)).toBeGreaterThan(0);
});

test('both preset rings close smoothly without changing their global expansion or determinism',()=>{
    for(const e of createPresetElements('geometric-0.6',10).filter(e=>e.type==='radial-spectrum')) {
        e.bindings.find(b=>b.parameterId==='spectrum')!.source={kind:'constant',value:Array.from({length:512},(_,i)=>i<320?128*Math.exp(-i/80):0)};
        const values:VisualizerResolvedParameterMap=new Map(e.bindings.map(b=>[parameterKey(e.id,b.parameterId),{parameterId:b.parameterId,state:'ready',value:b.source.kind==='constant'?b.source.value:[]}]));
        const batch=new GeometricBatch(),levels=new Float32Array(128);
        const draw=()=>{buildGeometricElement(batch,e,values,1,123,16/9,levels);return batch.positions.slice(0,batch.count*3);};
        const first=draw();expect([...first].every(Number.isFinite)).toBe(true);expect(draw()).toEqual(first);
        const a=[(first[0]!+first[15]!)/2,(first[1]!+first[16]!)/2];
        const last=batch.count*3-18,b=[(first[last+3]!+first[last+6]!)/2,(first[last+4]!+first[last+7]!)/2];
        expect(b[0]).toBeCloseTo(a[0]!,7);expect(b[1]).toBeCloseTo(a[1]!,7);
        expect(Math.max(...levels)).toBeCloseTo(.6);
    }
});
