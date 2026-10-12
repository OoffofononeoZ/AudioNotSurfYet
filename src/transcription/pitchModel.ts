import type { OrtModule } from '../processing/runtime';
import type { PcmReader } from '../processing/dsp';
import { checkCancelled, ProcessingError } from '../processing/modelManifest';
import { yieldTask } from '../processing/storage';
import { MonoResampler } from './monoResampler';
import { openModelSession, type ModelSession, type TranscriptionProgress } from './modelSession';
import { TRANSCRIPTION_CONFIG } from './modelManifest';
import { decodePitchNotes } from './pitchNotes';
import type { PitchActivations } from './pitchNotes';

const inputName = 'serving_default_input_2:0';
const noteName = 'StatefulPartitionedCall:1';
const onsetName = 'StatefulPartitionedCall:2';
const contourName = 'StatefulPartitionedCall:0';

export async function transcribePitch(ort:OrtModule,source:PcmReader,signal:AbortSignal,
    progress:TranscriptionProgress,modelBase?:string) {
    const config = TRANSCRIPTION_CONFIG.pitch;
    const resampler = new MonoResampler(source.sampleRate,config.sampleRate);
    const samples = Math.ceil(source.frames * config.sampleRate / source.sampleRate);
    const stride = config.samples - config.overlapFrames * config.hop;
    const windows = Math.ceil(samples / stride);
    const count = (windows - 1) * config.retainedFrames + Math.min(config.retainedFrames,Math.ceil((samples - (windows - 1) * stride) / config.hop));
    let activation:PitchActivations;
    try {
        activation = {frames:new Float32Array(count * 88),onsets:new Float32Array(count * 88),times:new Float64Array(count + 1)};
    } catch {
        throw new ProcessingError('memory-unavailable','Not enough memory for the selected instrument note activations.');
    }
    const session = await openModelSession(ort,'basic-pitch',signal,progress,modelBase);
    const started = performance.now();
    let inferenceMs = 0,readMs = 0,cursor = 0;
    try {
        if (session.inputNames.join(',') !== inputName || [...session.outputNames].sort().join(',') !== [noteName,onsetName,contourName].sort().join(',')) {
            throw new ProcessingError('model-incompatible','Basic Pitch tensor names mismatch.');
        }
        for (let window = 0; window < windows; window++) {
            checkCancelled(signal);
            progress('pitch-preprocess',window,windows);
            let at = performance.now();
            const pcm = await resampler.segment(source,window * stride - config.inputHeadSamples,config.samples,signal);
            readMs += performance.now() - at;
            const input = new ort.Tensor('float32',pcm,[1,config.samples,1]);
            let outputs:Awaited<ReturnType<ModelSession['run']>>|undefined;
            try {
                progress('pitch-inference',window,windows);
                at = performance.now(); outputs = await session.run({[inputName]:input}); inferenceMs += performance.now() - at;
                checkCancelled(signal);
                for (const [name,width] of [[noteName,88],[onsetName,88],[contourName,264]] as const) {
                    const tensor = outputs[name];
                    if (!tensor || tensor.type !== 'float32' || tensor.dims.join(',') !== `1,172,${width}`
                        || !(tensor.data instanceof Float32Array) || tensor.data.some(value => !Number.isFinite(value))) {
                        throw new ProcessingError('model-incompatible','Basic Pitch output shape or values mismatch.');
                    }
                }
                const frames = outputs[noteName]!.data as Float32Array;
                const onsets = outputs[onsetName]!.data as Float32Array;
                const retained = Math.min(config.retainedFrames,count - cursor);
                const offset = config.overlapFrames / 2 * 88;
                activation.frames.set(frames.subarray(offset,offset + retained * 88),cursor * 88);
                activation.onsets.set(onsets.subarray(offset,offset + retained * 88),cursor * 88);
                for (let frame = 0; frame < retained; frame++) activation.times[cursor + frame] = (window * stride + frame * config.hop) / config.sampleRate;
                cursor += retained;
            } finally { input.dispose(); if (outputs) Object.values(outputs).forEach(tensor => tensor.dispose()); }
            progress('pitch-inference',window + 1,windows);
            await yieldTask();
        }
    } finally { await session.release(); }
    checkCancelled(signal);
    activation.times[count] = source.frames / source.sampleRate;
    progress('pitch-decode',0,1);
    const notes = decodePitchNotes(activation,signal);
    progress('pitch-decode',1,1);
    return {notes,inferenceMs,readMs,elapsedMs:performance.now() - started,windows,
        activationBytes:activation.frames.byteLength + activation.onsets.byteLength + activation.times.byteLength};
}
