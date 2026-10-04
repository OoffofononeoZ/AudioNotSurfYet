import { describe,it,expect } from 'vitest';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { Sha256,hashBytes } from '../../src/processing/sha256';
import { FT_FRAMES,FT_RATE,FT_MODELS,FT_STRIDE,FT_CONFIG,FT_CONFIG_HASH } from '../../src/processing/modelManifest';
import fixtureManifest from './fixture-manifest.json';
import { shortMix,FIXTURE_VERSION } from './fixture';
import { interleave,RollingOverlapAdd,selectStem,SincResampler,StemSummary,wavHeader } from '../../src/processing/dsp';
import type { PcmReader } from '../../src/processing/dsp';

describe('P1 identity and independent numeric oracles',()=>{
    it('pins the synthetic PCM identity/license and complete configuration hash',()=>{
        const mix=shortMix();expect(createHash('sha256').update(new Uint8Array(mix.buffer)).digest('hex')).toBe(fixtureManifest.sha256);
        expect(FIXTURE_VERSION).toBe(fixtureManifest.version);expect(fs.existsSync(fixtureManifest.license.noticePath)).toBe(true);
        expect(FT_CONFIG_HASH).toBe(createHash('sha256').update(JSON.stringify(FT_CONFIG)).digest('hex'));
    });
    it('matches SHA-256 standard vectors and Node for incremental boundary blocks',()=>{
        for(const length of [0,3,55,56,63,64,65,16384,1_000_000]){
            const bytes=Uint8Array.from({length},(_,i)=>i%251),hash=new Sha256();
            for(let at=0;at<length;at+=17)hash.update(bytes.subarray(at,at+17));
            expect(hash.hex()).toBe(createHash('sha256').update(bytes).digest('hex'));
            expect(()=>hash.update(bytes)).toThrow();
        }
        expect(hashBytes(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    });
    it('matches each artifact in the approved architecture table',()=>{
        const contract=fs.readFileSync('docs/architecture/processing/model-artifacts.md','utf8');
        expect(FT_MODELS).toHaveLength(4);
        for(const model of FT_MODELS){const row=contract.split('\n').find(line=>line.startsWith(`| ${model.role} / ${model.row} |`))!;
            for(const value of [model.repository,model.revision,model.file,String(model.bytes),model.sha256])expect(row).toContain(value);
            expect(model.url).toContain(`/resolve/${model.revision}/`);
        }
    });
    it('selects only the specialist row and rejects shape/type/nonfinite values',()=>{
        const data=new Float32Array(8*FT_FRAMES);
        for(let row=0;row<4;row++){data.fill(row+1,row*2*FT_FRAMES,(row*2+1)*FT_FRAMES);data.fill(-(row+1),(row*2+1)*FT_FRAMES,(row+1)*2*FT_FRAMES);}
        for(let row=0;row<4;row++){const [l,r]=selectStem(data,[1,4,2,FT_FRAMES],row);expect(l[0]).toBe(row+1);expect(r.at(-1)).toBe(-row-1);}
        expect(()=>selectStem(data,[1,2,4,FT_FRAMES],0)).toThrow();
        expect(()=>selectStem(new Float64Array(data),[1,4,2,FT_FRAMES],0)).toThrow();
        data[4]=NaN;expect(()=>selectStem(data,[1,4,2,FT_FRAMES],3)).toThrow();
    });
    it.each([1,FT_FRAMES,FT_FRAMES+1,2*FT_STRIDE+17])('overlap-add preserves identity including endpoints and tail (%i frames)',frames=>{
        const source=Float32Array.from({length:frames},(_,i)=>i%1597===0?0.7:Math.sin(i*0.001)*0.13);
        const ola=new RollingOverlapAdd(frames),result=new Float32Array(frames);let position=0;
        for(let start=0;start<frames;start+=FT_STRIDE){const chunk=new Float32Array(FT_FRAMES);chunk.set(source.subarray(start,start+FT_FRAMES));const [left,right]=ola.add(start,[chunk,chunk]);result.set(left,position);position+=left.length;expect(right).toEqual(left);}
        expect(position).toBe(frames);let error=0;for(let i=0;i<frames;i++)error=Math.max(error,Math.abs(result[i]!-source[i]!));expect(error).toBeLessThan(1e-7);
        expect(()=>ola.add(0,[new Float32Array(FT_FRAMES),new Float32Array(FT_FRAMES)])).toThrow();
    });
    it.each([44100,48000])('resampler maintains absolute impulse positions, silent boundaries and segment independence (%i)',async rate=>{
        const input=new Float32Array(rate);input[Math.floor(rate*0.25)]=1;input[Math.floor(rate*0.75)]=-1;
        const reader:PcmReader={frames:input.length,sampleRate:rate,channels:1,read:async(_,start,length)=>input.slice(start,start+length)};
        const resampler=new SincResampler(rate),[left,right]=await resampler.segment(reader,0,FT_RATE);
        expect(right).toEqual(left);let positive=0,negative=0;
        for(let i=0;i<left.length;i++){if(left[i]!>left[positive]!)positive=i;if(left[i]!<left[negative]!)negative=i;}
        expect(Math.abs(positive-FT_RATE*0.25)).toBeLessThanOrEqual(1);expect(Math.abs(negative-FT_RATE*0.75)).toBeLessThanOrEqual(1);
        expect(left[0]).toBe(0);expect(left.at(-1)).toBe(0);
        const [part]=await resampler.segment(reader,10000,17000);expect(part).toEqual(left.slice(10000,27000));
    });
    it('resampler agrees with an analytic tone and attenuates frequencies above destination Nyquist',async()=>{
        const rate=48000,frames=48000;
        async function measure(frequency:number){
            const reader:PcmReader={frames,sampleRate:rate,channels:2,read:async(_,start,length)=>Float32Array.from({length},(_,i)=>Math.sin(2*Math.PI*frequency*(start+i)/rate))};
            const [data]=await new SincResampler(rate).segment(reader,0,FT_RATE);
            let squared=0,error=0;
            for(let i=64;i<FT_RATE-64;i++){squared+=data[i]!**2;error=Math.max(error,Math.abs(data[i]!-Math.sin(2*Math.PI*frequency*i/FT_RATE)));}
            return {rms:Math.sqrt(squared/(FT_RATE-128)),error};
        }
        expect((await measure(440)).error).toBeLessThan(1e-4);
        expect((await measure(23500)).rms).toBeLessThan(0.03);
    });
    it('energy uses channel mean square rather than cancelling opposite stereo, and includes a partial last window',()=>{
        const frames=FT_RATE+17,left=new Float32Array(frames).fill(0.5),right=new Float32Array(frames).fill(-0.5),summary=new StemSummary(frames);
        summary.append(left.slice(0,12000),right.slice(0,12000));summary.append(left.slice(12000),right.slice(12000));
        const output=summary.finish(),expected=Math.round((20*Math.log10(0.5)+80)/80*65535);
        expect(output.energy.length).toBe(Math.ceil(frames*30/FT_RATE));expect([...output.energy].every(v=>v===expected)).toBe(true);
        expect([...output.waveformMin].every(v=>v===-0.5)).toBe(true);expect([...output.waveformMax].every(v=>v===0.5)).toBe(true);
        const zero=new StemSummary(1);zero.append(new Float32Array(1),new Float32Array(1));expect(zero.finish().energy[0]).toBe(0);
        expect(()=>new StemSummary(10).finish()).toThrow();
    });
    it('WAV is independently parsed IEEE float32 stereo with exact bytes and no gain change',()=>{
        const left=new Float32Array([0,0.5,-1.2]),right=new Float32Array([0,-0.25,1.7]);
        const header=wavHeader(3),pcm=interleave(left,right),view=new DataView(header.buffer);
        expect(new TextDecoder().decode(header.slice(0,4))).toBe('RIFF');expect(view.getUint32(4,true)).toBe(60);
        expect(view.getUint16(20,true)).toBe(3);expect(view.getUint16(22,true)).toBe(2);expect(view.getUint32(24,true)).toBe(44100);
        expect(view.getUint16(34,true)).toBe(32);expect(view.getUint32(40,true)).toBe(24);
        const samples=new DataView(pcm.buffer);for(let i=0;i<3;i++){expect(samples.getFloat32(i*8,true)).toBe(left[i]);expect(samples.getFloat32(i*8+4,true)).toBe(right[i]);}
        expect(()=>wavHeader(0xffffffff)).toThrow();expect(()=>interleave(left,new Float32Array(1))).toThrow();
    });
});
