

export type NativeInputFeature = 'frequency' | 'waveform';
export const nativeInputFeatures = [
    {value:'frequency' as const,label:'频谱（立体声）'},
    {value:'waveform' as const,label:'时域波形'},
];
export const NATIVE_FFT_SIZE=2048;
export const NATIVE_FRAME_RATE=30;
export const NATIVE_CHUNK_FRAMES=120;
export interface NativeAudioFrame { frequency:number[]; waveform:number[] }

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
        analyser.minDecibels=-100;analyser.maxDecibels=-30;
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
                analyser.getByteFrequencyData(bytes);frequency.push(...bytes);
                analyser.getFloatTimeDomainData(waves[i]!);
            });
            const waveform=Array.from(waves[0]!, (value,i)=>(value+waves[1]![i]!)/2);
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
