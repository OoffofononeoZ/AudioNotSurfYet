import { it,expect,vi,beforeEach } from 'vitest';
import { FT_FRAMES,FT_MODELS } from '../../src/processing/modelManifest';
import { separate } from '../../src/processing/kernel';
import { syntheticPort } from './fixture';
const fake=vi.hoisted(()=>({timeline:[] as string[],files:new Map<string,Uint8Array>(),corrupt:false,throwInference:false,disposed:0}));
vi.mock('../../src/processing/storage',()=>({
    yieldTask:async()=>{},
    openPcm:async()=>({frames:40,sampleRate:44100,channels:2,read:async(_:number,_start:number,length:number)=>new Float32Array(length)}),
    jobDirectory:async()=>({getFileHandle:async(name:string)=>({
        getFile:async()=>new Blob([new Uint8Array(fake.files.get(name)!)]),
        createWritable:async()=>{const parts:Uint8Array[]=[];return {
            write:async(data:ArrayBufferView)=>{parts.push(new Uint8Array(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)));},
            close:async()=>{const total=parts.reduce((sum,c)=>sum+c.length,0),output=new Uint8Array(total);let at=0;for(const part of parts){output.set(part,at);at+=part.length;}fake.files.set(name,output);},
            abort:async()=>{parts.length=0;},
        };},
    })}),
}));
vi.mock('../../src/processing/modelCache',()=>({loadModel:async(model:{role:string})=>{fake.timeline.push(`download:${model.role}`);return {bytes:new Uint8Array([FT_MODELS.findIndex(m=>m.role===model.role)]),cacheHit:true};}}));
vi.mock('../../src/processing/runtime',()=>({initializeRuntime:async()=>({adapter:{description:'test-adapter'},ort:{
    Tensor:class{dispose(){fake.disposed++;}},
    InferenceSession:{create:async(bytes:Uint8Array)=>{
        const role=FT_MODELS[bytes[0]!]!.role;fake.timeline.push(`create:${role}`);
        return {inputNames:['mix'],outputNames:['stems'],release:async()=>{fake.timeline.push(`release:${role}`);},
            run:async()=>{
                if(fake.throwInference)throw new Error('Injected inference failure');
                const data=new Float32Array(8*FT_FRAMES);for(let row=0;row<4;row++)data.fill(row+1,row*2*FT_FRAMES,(row+1)*2*FT_FRAMES);
                if(fake.corrupt)data[0]=NaN;
                return {stems:{data,dims:[1,4,2,FT_FRAMES],dispose:()=>{fake.disposed++;}}};
            }};
    }},
}})}));
beforeEach(()=>{fake.timeline.length=0;fake.files.clear();fake.corrupt=false;fake.throwInference=false;fake.disposed=0;});
const ref=()=>({directory:'kernel',descriptor:syntheticPort(40).getDecodedAudioDescriptor()!,hash:'test'});
it('streams the four specialist roles in sequence with releases, exact samples and WAV artifacts',async()=>{
    const result=await separate(ref(),new AbortController().signal,()=>{});
    expect(result.stems.map(s=>s.role)).toEqual(['drums','bass','other','vocals']);
    expect(fake.timeline).toEqual(FT_MODELS.flatMap(model=>[`download:${model.role}`,`create:${model.role}`,`release:${model.role}`]));
    expect(fake.disposed).toBe(8);
    expect(result.provenance.models.map(m=>m.row)).toEqual([0,1,2,3]);expect(result.provenance.configHash).toMatch(/^[a-f0-9]{64}$/);
    for(let row=0;row<4;row++){
        const stem=result.stems[row]!,wav=fake.files.get(stem.wav)!,view=new DataView(wav.buffer);
        expect(wav.length).toBe(44+40*8);for(let i=0;i<80;i++)expect(view.getFloat32(44+i*4,true)).toBeCloseTo(row+1,6);
        expect(stem.frames).toBe(40);expect(stem.energy.length).toBe(1);
    }
});
it.each(['model-load','inference','stitch','derive','persist'])('cancellation at %s releases the current session and never returns a result',async phase=>{
    const abort=new AbortController();await expect(separate(ref(),abort.signal,p=>{if(p===phase)abort.abort();})).rejects.toMatchObject({code:'job-cancelled'});
    expect(fake.timeline.filter(e=>e.startsWith('create:'))).toHaveLength(1);
    expect(fake.timeline.at(-1)).toBe('release:drums');
});
it.each(['corrupt','throwInference'])('inference %s failure releases tensors/session and aborts before the next model',async mode=>{
    if(mode==='corrupt')fake.corrupt=true;else fake.throwInference=true;
    await expect(separate(ref(),new AbortController().signal,()=>{})).rejects.toThrow();
    expect(fake.timeline.at(-1)).toBe('release:drums');expect(fake.disposed).toBe(mode==='corrupt'?2:1);
});
