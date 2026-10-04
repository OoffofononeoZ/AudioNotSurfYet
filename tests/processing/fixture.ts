import { FT_FRAMES } from '../../src/processing/modelManifest';
import type { DecodedAudioCopyPort } from '../../src/analysis/pcm';
export const FIXTURE_VERSION='p1-nonzero-stereo-v1';
export function samples(channel:number,start:number,length:number,rate=44100):Float32Array<ArrayBuffer> {
    const result=new Float32Array(length);
    for(let i=0;i<length;i++){
        const index=start+i,t=index/rate;
        // Deterministic nonzero, different L/R, periodic transients and silence.
        result[i]=index<64?0:0.16*Math.sin(2*Math.PI*(channel?317:223)*t)
            +0.07*Math.sin(2*Math.PI*67*t)+(index%22050<128?0.1*(1-index%22050/128):0);
    }
    return result;
}
export function shortMix():Float32Array<ArrayBuffer> {
    const result=new Float32Array(2*FT_FRAMES);
    result.set(samples(0,0,FT_FRAMES));result.set(samples(1,0,FT_FRAMES),FT_FRAMES);return result;
}
export function syntheticPort(frames:number,rate=44100,channels=2):DecodedAudioCopyPort {
    const descriptor={trackId:'p1-synthetic',revision:1,sampleRate:rate,channelCount:channels,length:frames,durationSeconds:frames/rate};
    return {getDecodedAudioDescriptor:()=>({...descriptor}),copyDecodedChannelRange:({revision,channel,start,length})=>revision===1&&channel<channels&&start>=0&&start+length<=frames?samples(channel,start,length,rate):null};
}
