import { interleave, RollingOverlapAdd, SincResampler, StemSummary, wavHeader } from '../processing/dsp';
import { FT_FRAMES, FT_RATE, FT_STRIDE, ORT_VERSION, checkCancelled, ProcessingError } from '../processing/modelManifest';
import runtimeManifest from '../processing/runtime-manifest.json';
import { hashBytes } from '../processing/sha256';
import { prepareModelInput } from '../processing/modelInput';
import { jobDirectory, openPcm, yieldTask } from '../processing/storage';
import type { StagedPcm } from '../processing/storage';
import { openModelSession, openTranscriptionRuntime } from './modelSession';
import type { TranscriptionProgress } from './modelSession';
import { TRANSCRIPTION_CONFIG_HASH, TRANSCRIPTION_MODEL_HASH, transcriptionModel } from './modelManifest';

export type AuxiliaryInstrument = 'guitar' | 'piano';
export interface AuxiliaryStem {
    role:AuxiliaryInstrument;frames:number;sampleRate:number;left:string;right:string;wav:string;
    energy:Uint16Array;waveformMin:Float32Array;waveformMax:Float32Array;energyScale:number;energyOffset:number;
}
export interface AuxiliaryResult {
    directory:string;source:StagedPcm;stems:AuxiliaryStem[];
    provenance:{configHash:string;modelManifestHash:string;runtimeVersion:string;runtimeManifestHash:string;backend:'webgpu';model:ReturnType<typeof transcriptionModel>};
    timings:{sourceMs:number;runtimeMs:number;modelMs:number;inputMs:number;inferenceMs:number;persistMs:number;totalMs:number};
}
const roles = ['guitar','piano'] as const;

// This session is independent of four FT specialist outputs. Only its last two
// rows leave the segment; the other four never become audition or note sources.
export async function separateAuxiliary(sourceRef:StagedPcm,directoryId:string,signal:AbortSignal,
    progress:TranscriptionProgress,modelBase?:string):Promise<AuxiliaryResult> {
    checkCancelled(signal);
    if (!/^transcription-[a-f0-9-]{36}$/.test(directoryId) || directoryId === sourceRef.directory) {
        throw new ProcessingError('invalid-request','Auxiliary analysis requires its own result directory.');
    }
    const started = performance.now();
    const source = await openPcm(sourceRef,signal);
    const timings = {sourceMs:performance.now() - started,runtimeMs:0,modelMs:0,inputMs:0,inferenceMs:0,persistMs:0,totalMs:0};
    const directory = await jobDirectory(directoryId);
    const frames = Math.round(sourceRef.descriptor.durationSeconds * FT_RATE);
    let at = performance.now();
    const runtime = await openTranscriptionRuntime('webgpu',signal);
    timings.runtimeMs = performance.now() - at; at = performance.now();
    const prepared = await prepareModelInput(source,frames,directory,signal,progress);
    timings.inputMs = performance.now() - at;
    const writers:FileSystemWritableFileStream[][] = [];
    try {
        at = performance.now();
        const session = await openModelSession(runtime.ort,'htdemucs-6s',signal,progress,modelBase);
        timings.modelMs = performance.now() - at;
        const metadata = roles.map(role => ({role,frames,sampleRate:FT_RATE,left:`${role}-left.f32`,right:`${role}-right.f32`,wav:`${role}.wav`}));
        try {
            if (session.inputNames.join(',') !== 'mix' || session.outputNames.join(',') !== 'stems') {
                throw new ProcessingError('model-incompatible','HT-Demucs 6s tensor names mismatch.');
            }
            for (const stem of metadata) {
                const streams:FileSystemWritableFileStream[] = []; writers.push(streams);
                for (const name of [stem.left,stem.right,stem.wav]) streams.push(await (await directory.getFileHandle(name,{create:true})).createWritable());
                await streams[2]!.write(wavHeader(frames));
            }
            const resampler = new SincResampler(prepared.reader.sampleRate);
            const accumulators = roles.map(() => new RollingOverlapAdd(frames));
            const summaries = roles.map(() => new StemSummary(frames));
            for (let start = 0; start < frames; start += FT_STRIDE) {
                checkCancelled(signal); progress('auxiliary-input',start,frames);
                at = performance.now();
                const channels = await resampler.segment(prepared.reader,start,FT_FRAMES);
                const pcm = new Float32Array(FT_FRAMES * 2); pcm.set(channels[0]); pcm.set(channels[1],FT_FRAMES);
                const input = new runtime.ort.Tensor('float32',pcm,[1,2,FT_FRAMES]);
                timings.inputMs += performance.now() - at;
                let outputs:Awaited<ReturnType<typeof session.run>>|undefined;
                try {
                    progress('auxiliary-inference',start,frames); at = performance.now();
                    outputs = await session.run({mix:input}); timings.inferenceMs += performance.now() - at;
                    checkCancelled(signal);
                    const tensor = outputs.stems;
                    if (!tensor || tensor.type !== 'float32' || tensor.dims.join(',') !== `1,6,2,${FT_FRAMES}`
                        || !(tensor.data instanceof Float32Array) || tensor.data.some(value => !Number.isFinite(value))) {
                        throw new ProcessingError('model-incompatible','HT-Demucs 6s output shape or values mismatch.');
                    }
                    progress('auxiliary-persist',start,frames); at = performance.now();
                    for (let index = 0; index < roles.length; index++) {
                        const offset = (index + 4) * 2 * FT_FRAMES;
                        const channels:[Float32Array,Float32Array] = [tensor.data.slice(offset,offset + FT_FRAMES),tensor.data.slice(offset + FT_FRAMES,offset + 2 * FT_FRAMES)];
                        const chunk = accumulators[index]!.add(start,channels);
                        summaries[index]!.append(chunk[0],chunk[1]);
                        await writers[index]![0]!.write(chunk[0]); await writers[index]![1]!.write(chunk[1]);
                        await writers[index]![2]!.write(interleave(chunk[0],chunk[1]));
                    }
                    timings.persistMs += performance.now() - at;
                } finally { input.dispose(); if (outputs) Object.values(outputs).forEach(tensor => tensor.dispose()); }
                progress('auxiliary-persist',Math.min(start + FT_STRIDE,frames),frames); await yieldTask();
            }
            checkCancelled(signal);
            for (const streams of writers) for (const stream of streams) await stream.close();
            const stems = metadata.map((stem,index) => ({...stem,...summaries[index]!.finish()}));
            for (const stem of stems) {
                for (const [name,size] of [[stem.left,frames * 4],[stem.right,frames * 4],[stem.wav,44 + frames * 8]] as const) {
                    const file = await (await directory.getFileHandle(name)).getFile();
                    if (file.size !== size) throw new ProcessingError('artifact-export-failed','Auxiliary instrument artifact is incomplete.');
                }
            }
            timings.totalMs = performance.now() - started;
            return {directory:directoryId,source:sourceRef,stems,timings,provenance:{configHash:TRANSCRIPTION_CONFIG_HASH,
                modelManifestHash:TRANSCRIPTION_MODEL_HASH,runtimeVersion:ORT_VERSION,
                runtimeManifestHash:hashBytes(new TextEncoder().encode(JSON.stringify(runtimeManifest))),backend:'webgpu',model:transcriptionModel('htdemucs-6s')}};
        } finally { await session.release(); }
    } catch (error) {
        await Promise.allSettled(writers.flat().map(writer => writer.abort()));
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            throw new ProcessingError('quota-exceeded','Browser storage quota is exhausted during auxiliary separation.');
        }
        throw error;
    } finally { await prepared.cleanup(); timings.totalMs = performance.now() - started; }
}
