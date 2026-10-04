import { it,expect } from 'vitest';
import { prepareModelInput } from '../../src/processing/modelInput';
import { SincResampler } from '../../src/processing/dsp';
import { FT_FRAMES,FT_STRIDE } from '../../src/processing/modelManifest';
import { samples } from './fixture';
function directory(){
    const files=new Map<string,Blob>();
    return {files,handle:{async removeEntry(name:string){files.delete(name);},async getFileHandle(name:string){return {getFile:async()=>files.get(name)!,createWritable:async()=>{const parts:Uint8Array<ArrayBuffer>[]=[];return {write:async(data:ArrayBufferView)=>parts.push(new Uint8Array(new Uint8Array(data.buffer,data.byteOffset,data.byteLength))),close:async()=>{files.set(name,new Blob(parts));},abort:async()=>{parts.length=0;}};}};}} as unknown as FileSystemDirectoryHandle};
}
it.each([1,2])('reused 48k model PCM is bit-identical to direct absolute-index sinc at all segment/tail samples (%s channels)',async channels=>{
    const source={frames:700003,sampleRate:48000,channels,read:async(channel:number,start:number,length:number)=>samples(channel,start,length,48000)},frames=Math.round(source.frames*44100/48000),disk=directory();
    const prepared=await prepareModelInput(source,frames,disk.handle,new AbortController().signal,()=>{});
    const direct=new SincResampler(48000),cached=new SincResampler(44100);
    for(let start=0;start<frames;start+=FT_STRIDE){
        const [expected,actual]=await Promise.all([direct.segment(source,start,FT_FRAMES),cached.segment(prepared.reader,start,FT_FRAMES)]);
        for(let channel=0;channel<2;channel++)expect(Buffer.from(actual[channel]!.buffer).equals(Buffer.from(expected[channel]!.buffer))).toBe(true);
    }
    await prepared.cleanup();expect(disk.files.size).toBe(0);
});
it('native 44.1k bypasses the temporary cache and cancellation removes only model input files',async()=>{
    const disk=directory(),source={frames:100000,sampleRate:44100,channels:2,read:async()=>new Float32Array()};
    const prepared=await prepareModelInput(source,100000,disk.handle,new AbortController().signal,()=>{});expect(prepared.reader).toBe(source);expect(disk.files.size).toBe(0);
    const abort=new AbortController();await expect(prepareModelInput({...source,sampleRate:48000,read:async(_:number,_start:number,length:number)=>new Float32Array(length)},91875,disk.handle,abort.signal,()=>abort.abort())).rejects.toMatchObject({code:'job-cancelled'});
    expect(disk.files.size).toBe(0);
});
