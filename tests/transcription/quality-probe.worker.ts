import { stagePcm,removeJob } from '../../src/processing/storage';
import { separateAuxiliary } from '../../src/transcription/auxiliarySeparation';
import { createStemAuditionSource } from '../../src/processing/stemAuditionSource';
import { transcribePitch } from '../../src/transcription/pitchModel';
import { openTranscriptionRuntime } from '../../src/transcription/modelSession';
import { DrumModel } from '../../src/transcription/drumModel';
import { TRANSCRIPTION_CONFIG,TRANSCRIPTION_CONFIG_HASH,TRANSCRIPTION_MODEL_HASH } from '../../src/transcription/modelManifest';
import { hashBytes } from '../../src/processing/sha256';
import { drumQualityClip,instrumentClip,knownNotes } from './qualityFixtures';
const sourceId = `quality-${crypto.randomUUID()}`,auxId = `transcription-${crypto.randomUUID()}`;
self.onmessage = () => { void (async() => {
    const abort = new AbortController(),signal = abort.signal,started = performance.now();
    const progress = (phase:string,done:number,total:number|null) => self.postMessage({type:'progress',phase,done,total});
    const pcm = instrumentClip(),descriptor = {trackId:'controlled-instrument-quality',revision:1,sampleRate:44100,length:pcm.length,channelCount:1,durationSeconds:14};
    const source = await stagePcm({getDecodedAudioDescriptor:() => descriptor,copyDecodedChannelRange:({start,length}) => pcm.slice(start,start+length)},sourceId,signal,(done,total) => progress('stage',done,total));
    const auxiliary = await separateAuxiliary(source,auxId,signal,progress,'/transcription-models');
    const runtime = await openTranscriptionRuntime('wasm',signal);
    const notes:Record<string,Awaited<ReturnType<typeof transcribePitch>>> = {};
    let maximumReadFrames = 0;
    for (const stem of auxiliary.stems) {
        const lease = await createStemAuditionSource({kind:'auxiliary',directory:auxId,resultId:auxId,trackId:descriptor.trackId,label:stem.role,stems:[stem],mutedRoles:[]},signal);
        try { notes[stem.role] = await transcribePitch(runtime.ort,{sampleRate:44100,frames:stem.frames,channels:2,read:(channel,start,length) => { maximumReadFrames = Math.max(maximumReadFrames,length);return lease.read(stem.role,channel as 0|1,start,length,signal); }},signal,progress,'/transcription-models'); }
        finally { await lease.close(); }
    }
    const drum = drumQualityClip(),model = await DrumModel.create(runtime.ort,signal,progress,'/transcription-models'),hits:unknown[] = [],segments:unknown[] = [];
    try { for (let start=0;start<drum.pcm.length;start+=TRANSCRIPTION_CONFIG.drums.samples) {
        const chunk = new Float32Array(TRANSCRIPTION_CONFIG.drums.samples);chunk.set(drum.pcm.subarray(start,start+chunk.length));
        const result = await model.infer(chunk,start/24000,8,signal,progress);hits.push(...result.hits);segments.push({startSeconds:start/24000,truncated:result.truncated,tokenCount:result.tokens.length,malformed:result.malformed,ignored:result.ignored});
    }} finally { await model.dispose(); }
    await removeJob(sourceId);
    self.postMessage({type:'result',result:{kind:'controlled-synthetic-CC0',sourceHash:hashBytes(new Uint8Array(pcm.buffer)),drumHash:hashBytes(new Uint8Array(drum.pcm.buffer)),configHash:TRANSCRIPTION_CONFIG_HASH,modelManifestHash:TRANSCRIPTION_MODEL_HASH,
        knownNotes,expectedDrums:drum.expected,notes,hits,segments,maximumReadFrames,auxiliary,totalMs:performance.now()-started,qualityAccepted:false}});
})().catch(error => self.postMessage({type:'error',message:String(error),stack:error.stack})).finally(async() => { await removeJob(sourceId); }); };
