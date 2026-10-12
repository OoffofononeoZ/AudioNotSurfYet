import { openModelSession, openTranscriptionRuntime } from '../../src/transcription/modelSession';
import { DrumModel } from '../../src/transcription/drumModel';
import { checkCancelled } from '../../src/processing/modelManifest';
import { TRANSCRIPTION_CONFIG_HASH, TRANSCRIPTION_MODEL_HASH, transcriptionModel } from '../../src/transcription/modelManifest';
import { drumLogMel } from '../../src/transcription/drumFeatures';
import runtimeManifest from '../../src/processing/runtime-manifest.json';
import { hashBytes } from '../../src/processing/sha256';
import { transcribePitch } from '../../src/transcription/pitchModel';
import type { PcmReader } from '../../src/processing/dsp';

function drumClip():Float32Array<ArrayBuffer> {
    const pcm = new Float32Array(61440);
    let seed = 123456;
    const noise = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 2 ** 31 - 1; };
    for (let hit = 0; hit < 13; hit++) {
        const start = Math.round(hit * 0.2 * 24000);
        for (let i = start; i < pcm.length; i++) {
            const time = (i - start) / 24000;
            pcm[i] += 0.12 * noise() * Math.exp(-time * 60);
            if (hit % 4 === 0) pcm[i] += 0.7 * Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-time * 30)) * time) * Math.exp(-time * 8);
            if (hit % 4 === 2) pcm[i] += 0.3 * noise() * Math.exp(-time * 20);
        }
    }
    const peak = pcm.reduce((maximum,value) => Math.max(maximum,Math.abs(value)),0);
    for (let i = 0; i < pcm.length; i++) pcm[i] = pcm[i]! * 0.8 / peak;
    return pcm;
}

self.onmessage = event => { void (async() => {
    const mode = event.data.mode as 'drums'|'drums-truncated'|'pitch'|'auxiliary';
    const abort = new AbortController();
    const progress = (phase:string,done:number,total:number|null) => self.postMessage({type:'progress',phase,done,total});
    const backend = mode === 'auxiliary' ? 'webgpu' : 'wasm';
    const started = performance.now();
    const runtime = await openTranscriptionRuntime(backend,abort.signal);
    const runtimeMs = performance.now() - started;
    const result:Record<string,unknown> = {mode,backend,runtimeMs,adapter:runtime.adapter,configHash:TRANSCRIPTION_CONFIG_HASH,
        modelManifestHash:TRANSCRIPTION_MODEL_HASH,runtimeManifestHash:hashBytes(new TextEncoder().encode(JSON.stringify(runtimeManifest)))};
    if (mode === 'drums' || mode === 'drums-truncated') {
        const model = await DrumModel.create(runtime.ort,abort.signal,progress,'/transcription-models');
        try {
            const pcm = drumClip(),features = drumLogMel(pcm);
            Object.assign(result,await model.infer(pcm,0,2.56,abort.signal,progress,mode === 'drums-truncated' ? 4 : event.data.maxTokens),
                {featureShape:[1,246,128],featureHash:hashBytes(new Uint8Array(features.buffer)),models:['adt-encoder','adt-decoder'].map(id => transcriptionModel(id as 'adt-encoder'|'adt-decoder'))});
        } finally { await model.dispose(); }
    } else {
        const modelId = mode === 'pitch' ? 'basic-pitch' : 'htdemucs-6s';
        const session = await openModelSession(runtime.ort,modelId,abort.signal,progress,'/transcription-models');
        const frames = mode === 'pitch' ? 43844 : 343980;
        const rate = mode === 'pitch' ? 22050 : 44100;
        const pcm = new Float32Array(frames * (mode === 'pitch' ? 1 : 2));
        for (let i = 0; i < frames; i++) {
            const time = i / rate;
            const value = time > 0.4 && time < 1.4 ? Math.sin(2 * Math.PI * 440 * time) * 0.3 : 0;
            pcm[i] = value;
            if (mode === 'auxiliary') pcm[i + frames] = value;
        }
        const input = new runtime.ort.Tensor('float32',pcm,mode === 'pitch' ? [1,frames,1] : [1,2,frames]);
        let outputs:Awaited<ReturnType<typeof session.run>>|undefined;
        try {
            const at = performance.now();
            outputs = await session.run({[mode === 'pitch' ? 'serving_default_input_2:0' : 'mix']:input});
            checkCancelled(abort.signal);
            Object.assign(result,{inferenceMs:performance.now() - at,inputNames:session.inputNames,outputNames:session.outputNames,model:transcriptionModel(modelId),
                outputs:Object.entries(outputs).map(([name,tensor]) => ({name,type:tensor.type,dims:tensor.dims,
                    finite:(tensor.data as Float32Array).every(Number.isFinite),max:(tensor.data as Float32Array).reduce((max,v) => Math.max(max,v),-Infinity),
                    min:(tensor.data as Float32Array).reduce((min,v) => Math.min(min,v),Infinity),hash:hashBytes(new Uint8Array((tensor.data as Float32Array).buffer))}))});
            if (mode === 'pitch') {
                const notes = outputs['StatefulPartitionedCall:1']?.data as Float32Array;
                result.pitch69Peak = Array.from({length:172},(_,frame) => notes[frame * 88 + 48]).reduce((a,b) => Math.max(a,b!),0);
            }
        } finally { input.dispose(); if (outputs) Object.values(outputs).forEach(tensor => tensor.dispose()); await session.release(); }
        if (mode === 'pitch') {
            const expectedNotes = [
                {pitch:69,startSeconds:0.37,endSeconds:2.23},
                {pitch:69,startSeconds:3.13,endSeconds:3.36},
                {pitch:60,startSeconds:4.11,endSeconds:5.01},
                {pitch:64,startSeconds:4.51,endSeconds:5.61},
            ];
            let maximumReadFrames = 0;
            const source:PcmReader = {sampleRate:44100,frames:44100 * 6,channels:2,async read(_channel,start,length) {
                maximumReadFrames = Math.max(maximumReadFrames,length);
                return Float32Array.from({length},(_,index) => {
                    const time = (start + index) / 44100;
                    let value = 0;
                    for (const note of expectedNotes) if (time >= note.startSeconds && time < note.endSeconds) {
                        const envelope = Math.min(1,(time - note.startSeconds) / 0.005,(note.endSeconds - time) / 0.005);
                        value += Math.sin(2 * Math.PI * 440 * 2 ** ((note.pitch - 69) / 12) * time) * 0.3 * envelope;
                    }
                    return value;
                });
            }};
            result.transcription = await transcribePitch(runtime.ort,source,abort.signal,progress,'/transcription-models');
            result.expectedNotes = expectedNotes;
            result.maximumReadFrames = maximumReadFrames;
        }
    }
    result.totalMs = performance.now() - started;
    self.postMessage({type:'result',result});
})().catch(error => self.postMessage({type:'error',code:error.code ?? 'inference-failed',message:String(error),stack:error.stack})); };
