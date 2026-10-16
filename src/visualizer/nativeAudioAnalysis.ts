import { SPECTRUM_REFERENCE } from './analysisSignal';

export type NativeInputFeature = 'frequency' | 'waveform';
export const nativeInputFeatures = [
    {value:'frequency' as const,label:'频谱（立体声）'},
    {value:'waveform' as const,label:'时域波形'},
];
export const NATIVE_FFT_SIZE=2048;
export const NATIVE_FRAME_RATE=30;
export const NATIVE_CHUNK_FRAMES=120;
export interface NativeAudioFrame { frequency:number[]; waveform:number[] }

/** Low frequencies use near-linear bands, then exponential bands up to 16 kHz. */
export function nativeFrequencyBands(bytes:Uint8Array,sampleRate:number):number[] {
    const edge=(i:number)=>i<=29?700*i/29:700*Math.pow(Math.min(16000,sampleRate/2)/700,(i-29)/35);
    const bands=Array.from({length:64},(_,i)=>{
        const start=Math.max(1,edge(i)*NATIVE_FFT_SIZE/sampleRate);
        const end=Math.max(start+.001,Math.min(bytes.length,edge(i+1)*NATIVE_FFT_SIZE/sampleRate));
        let sum=0,weight=0;
        for(let bin=Math.floor(start);bin<Math.ceil(end);bin++) {
            const w=Math.max(0,Math.min(end,bin+1)-Math.max(start,bin));
            sum+=(bytes[bin]??0)*w;weight+=w;
        }
        return sum/weight/255;
    });
    // Spatial smoothing only. No dependence on playback/RAF history, no wrap across channels.
    return bands.map((value,i)=>{
        const average=((bands[Math.max(0,i-1)]??0)+2*value+(bands[Math.min(63,i+1)]??0))/4;
        // Fixed visual calibration; keeps 0.6 responsiveness and avoids the default -30 dB ceiling.
        const strength=average*average*2/3;
        return Math.expm1(strength*Math.log1p(SPECTRUM_REFERENCE));
    });
}

/** Browser-native FFT, in bounded silent offline chunks so pause/seek/export use identical data. */
export async function renderNativeAudioChunk(pcm:readonly Float32Array<ArrayBuffer>[],sampleRate:number,isCancelled:()=>boolean):Promise<NativeAudioFrame[]> {
    const length=pcm[0]!.length,context=new OfflineAudioContext(2,length+128,sampleRate);
    const buffer=context.createBuffer(pcm.length,length,sampleRate);
    for(let channel=0;channel<pcm.length;channel++)buffer.copyToChannel(pcm[channel]!,channel);
    const source=context.createBufferSource(),downmix=context.createGain(),splitter=context.createChannelSplitter(2),silent=context.createGain();
    const analysers=[context.createAnalyser(),context.createAnalyser()];
    const bytes=new Uint8Array(NATIVE_FFT_SIZE/2),waves=[new Float32Array(NATIVE_FFT_SIZE),new Float32Array(NATIVE_FFT_SIZE)];
    // Native speaker down-mixing retains center/surround content; mono expands to both channels.
    downmix.channelCount=2;downmix.channelCountMode='explicit';downmix.channelInterpretation='speakers';
    source.buffer=buffer;source.connect(downmix);downmix.connect(splitter);silent.gain.value=0;silent.connect(context.destination);
    analysers.forEach((analyser,i)=>{
        analyser.fftSize=NATIVE_FFT_SIZE;analyser.smoothingTimeConstant=0;
        analyser.minDecibels=-100;analyser.maxDecibels=0;
        splitter.connect(analyser,i);analyser.connect(silent);
    });
    source.start();
    let pause=context.suspend(NATIVE_FFT_SIZE/sampleRate);
    const rendering=context.startRendering();
    const frames:NativeAudioFrame[]=[];
    try {
        for(let frame=0;frame<NATIVE_CHUNK_FRAMES;frame++) {
            await pause;
            if(isCancelled())break;
            const frequency:number[]=[];
            analysers.forEach((analyser,i)=>{
                analyser.getByteFrequencyData(bytes);frequency.push(...nativeFrequencyBands(bytes,sampleRate));
                analyser.getFloatTimeDomainData(waves[i]!);
            });
            const waveform=Array.from(waves[0]!, (value,i)=>Math.abs((value+waves[1]![i]!)/2)*SPECTRUM_REFERENCE);
            frames.push({frequency,waveform});
            if(frame+1<NATIVE_CHUNK_FRAMES)pause=context.suspend(NATIVE_FFT_SIZE/sampleRate+(frame+1)/NATIVE_FRAME_RATE);
            await context.resume();
        }
    } finally {
        if(context.state==='suspended')await context.resume();
        if(isCancelled())source.stop();
        try {await rendering;} finally {source.disconnect();downmix.disconnect();splitter.disconnect();analysers.forEach(a=>a.disconnect());silent.disconnect();}
    }
    return frames;
}
