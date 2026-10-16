import type { DecodedAudioCopyPort } from '../analysis/pcm';
import { NATIVE_CHUNK_FRAMES,NATIVE_FFT_SIZE,NATIVE_FRAME_RATE,renderNativeAudioChunk,type NativeAudioFrame,type NativeInputFeature } from './nativeAudioAnalysis';

const CACHE_CHUNKS=4;
/** Owns a bounded PCM copy/cache and at most one offline Web Audio job. No live output graph. */
export class NativeAudioSource {
    private identity='';
    private generation=0;
    private cache=new Map<number,NativeAudioFrame[]>();
    private pending:Promise<void>|null=null;
    private requested:{trackId:string;chunk:number}|null=null;
    private error:Error|null=null;
    private historyFeatures=new Set<NativeInputFeature>();
    private history=new Map<NativeInputFeature,Map<number,Float32Array[]>>();
    private historyThrough=new Map<NativeInputFeature,number>();
    private source:DecodedAudioCopyPort;
    private changed:()=>void;
    private render:typeof renderNativeAudioChunk;
    constructor(source:DecodedAudioCopyPort,changed:()=>void,render:typeof renderNativeAudioChunk=renderNativeAudioChunk){this.source=source;this.changed=changed;this.render=render;}
    reset(){this.identity='';this.generation++;this.cache.clear();this.requested=null;this.error=null;this.history.clear();this.historyThrough.clear();}
    configureHistory(features:NativeInputFeature[]){
        this.historyFeatures=new Set(features);
        for(const feature of this.history.keys())if(!this.historyFeatures.has(feature)){this.history.delete(feature);this.historyThrough.delete(feature);}
    }
    private identify(trackId:string){
        const descriptor=this.source.getDecodedAudioDescriptor();
        if(!descriptor||descriptor.trackId!==trackId||!descriptor.length||descriptor.channelCount<=0){this.reset();return null;}
        const identity=[trackId,descriptor.revision,descriptor.sampleRate,descriptor.length,descriptor.channelCount].join(':');
        if(identity!==this.identity){this.reset();this.identity=identity;}
        if(this.error)throw this.error;
        return descriptor;
    }
    read(trackId:string,time:number,feature:NativeInputFeature):number[]|null {
        const descriptor=this.identify(trackId);if(!descriptor)return null;
        const frame=Math.max(0,Math.floor(Math.min(time,Math.max(0,descriptor.durationSeconds-1/descriptor.sampleRate))*NATIVE_FRAME_RATE));
        const chunk=Math.floor(frame/NATIVE_CHUNK_FRAMES),cached=this.cache.get(chunk);
        if(!cached){this.requested={trackId,chunk};this.pump();return null;}
        this.cache.delete(chunk);this.cache.set(chunk,cached);
        const result=cached[frame%NATIVE_CHUNK_FRAMES]?.[feature]??null;
        if(frame%NATIVE_CHUNK_FRAMES>=NATIVE_CHUNK_FRAMES-NATIVE_FRAME_RATE && (chunk+1)*NATIVE_CHUNK_FRAMES/NATIVE_FRAME_RATE<descriptor.durationSeconds&&!this.cache.has(chunk+1)) {
            this.requested={trackId,chunk:chunk+1};this.pump();
        }
        return result;
    }
    /** Compact 64-band history is retained only for features used by integrated strings. */
    readHistory(trackId:string,time:number,feature:NativeInputFeature):number[]|null {
        const descriptor=this.identify(trackId);if(!descriptor)return null;
        this.historyFeatures.add(feature);
        const frame=Math.max(0,Math.floor(Math.min(time,Math.max(0,descriptor.durationSeconds-1/descriptor.sampleRate))*NATIVE_FRAME_RATE));
        const target=Math.floor(frame/NATIVE_CHUNK_FRAMES);
        let chunks=this.history.get(feature);if(!chunks){chunks=new Map();this.history.set(feature,chunks);}
        let through=this.historyThrough.get(feature)??0;
        while(through<=target) {
            if(!chunks.has(through)) {
                const cached=this.cache.get(through);
                if(cached)this.saveHistory(through,cached,feature);
                else {this.requested={trackId,chunk:through};this.pump();return null;}
            }
            through++;this.historyThrough.set(feature,through);
        }
        return Array.from(chunks.get(target)![frame%NATIVE_CHUNK_FRAMES]!);
    }
    private saveHistory(chunk:number,frames:NativeAudioFrame[],feature:NativeInputFeature){
        let chunks=this.history.get(feature);if(!chunks){chunks=new Map();this.history.set(feature,chunks);}
        chunks.set(chunk,frames.map(frame=>Float32Array.from({length:64},(_,i)=>{
            const input=frame[feature],start=Math.floor(i*input.length/64),end=Math.max(start+1,Math.floor((i+1)*input.length/64));
            let peak=0;for(let bin=start;bin<end;bin++)peak=Math.max(peak,input[bin]??0);return peak;
        })));
    }
    async prepare(trackId:string,time:number) {
        while(!this.read(trackId,time,'frequency')) {
            const pending=this.pending;if(!pending)throw Error('原生输入尚未就绪。');
            const generation=this.generation;await pending;
            if(generation!==this.generation)throw Error('原生输入任务已取消。');
        }
    }
    async prepareHistory(trackId:string,time:number,feature:NativeInputFeature) {
        while(!this.readHistory(trackId,time,feature)) {
            const pending=this.pending;if(!pending)throw Error('原生历史输入尚未就绪。');
            const generation=this.generation;await pending;
            if(generation!==this.generation)throw Error('原生输入任务已取消。');
        }
    }
    private pump(){
        if(this.pending||!this.requested||this.error)return;
        const {trackId,chunk}=this.requested;this.requested=null;
        if(this.cache.has(chunk))return;
        const descriptor=this.source.getDecodedAudioDescriptor();if(!descriptor||descriptor.trackId!==trackId)return;
        const generation=this.generation;
        const start=Math.round(chunk*NATIVE_CHUNK_FRAMES/NATIVE_FRAME_RATE*descriptor.sampleRate)-NATIVE_FFT_SIZE;
        const length=NATIVE_FFT_SIZE+Math.ceil(NATIVE_CHUNK_FRAMES/NATIVE_FRAME_RATE*descriptor.sampleRate);
        const pcm:Float32Array<ArrayBuffer>[]=[];
        for(let channel=0;channel<descriptor.channelCount;channel++) {
            const values=new Float32Array(length),copyStart=Math.max(0,start),copyLength=Math.max(0,Math.min(length+Math.min(0,start),descriptor.length-copyStart));
            if(copyLength){const copy=this.source.copyDecodedChannelRange({revision:descriptor.revision,channel,start:copyStart,length:copyLength});if(!copy||copy.length!==copyLength){this.reset();return;}values.set(copy,Math.max(0,-start));}
            pcm.push(values);
        }
        const cancelled=()=>generation!==this.generation||this.source.getDecodedAudioDescriptor()?.revision!==descriptor.revision;
        this.pending=this.render(pcm,descriptor.sampleRate,cancelled).then(frames=>{
            if(cancelled())return;
            for(const feature of this.historyFeatures)this.saveHistory(chunk,frames,feature);
            this.cache.set(chunk,frames);if(this.cache.size>CACHE_CHUNKS)this.cache.delete(this.cache.keys().next().value!);
        }).catch(error=>{if(!cancelled())this.error=error instanceof Error?error:new Error(String(error));}).finally(()=>{
            this.pending=null;
            if(generation===this.generation)this.changed();
            this.pump();
        });
    }
}
