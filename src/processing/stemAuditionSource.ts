import type { AuditionSource } from '../audio/auditionTypes';
import { checkCancelled, ProcessingError } from './modelManifest';
import { jobDirectory } from './storage';

export interface StemAuditionInput {
    kind:'ft'|'auxiliary';directory:string;resultId:string;trackId:string;label:string;
    stems:Array<{role:string;frames:number;sampleRate:number;left:string;right:string}>;
    mutedRoles:readonly string[];
}

// Called only with a published/verified result. File snapshots stay private to
// this lease, whose close waits for any outstanding bounded read to finish.
export async function createStemAuditionSource(input:StemAuditionInput,signal:AbortSignal):Promise<AuditionSource> {
    checkCancelled(signal);
    const first = input.stems[0];
    if (!first || !Number.isSafeInteger(first.frames) || first.frames <= 0 || first.sampleRate !== 44100
        || input.stems.some(stem => stem.frames !== first.frames || stem.sampleRate !== first.sampleRate
            || !/^(drums|bass|other|vocals|guitar|piano)$/.test(stem.role)
            || stem.left !== `${stem.role}-left.f32` || stem.right !== `${stem.role}-right.f32`)) {
        throw new ProcessingError('result-invalid','Invalid audition stem metadata.');
    }
    const directory = await jobDirectory(input.directory);
    const files = new Map<string,readonly [File,File]>();
    for (const stem of input.stems) {
        checkCancelled(signal);
        const left = await (await directory.getFileHandle(stem.left)).getFile();
        const right = await (await directory.getFileHandle(stem.right)).getFile();
        if (left.size !== stem.frames * 4 || right.size !== stem.frames * 4) throw new ProcessingError('result-invalid','Audition PCM file is incomplete.');
        files.set(stem.role,[left,right]);
    }
    checkCancelled(signal);
    let closed = false;
    const reads = new Set<Promise<ArrayBuffer>>();
    return {kind:input.kind,resultId:input.resultId,trackId:input.trackId,label:input.label,
        frames:first.frames,sampleRate:first.sampleRate,roles:input.stems.map(stem => stem.role),mutedRoles:[...input.mutedRoles],
        async read(role,channel,start,length,readSignal) {
            checkCancelled(readSignal);
            const pair = files.get(role);
            if (closed || !pair || ![0,1].includes(channel) || !Number.isSafeInteger(start) || start < 0
                || !Number.isSafeInteger(length) || length <= 0 || length > first.sampleRate * 4 || start + length > first.frames) {
                throw new ProcessingError('invalid-request','Invalid bounded audition PCM read.');
            }
            const reading = pair[channel].slice(start * 4,(start + length) * 4).arrayBuffer();
            reads.add(reading);
            try {
                const bytes = await reading; checkCancelled(readSignal);
                if (closed || bytes.byteLength !== length * 4) throw new ProcessingError('pcm-incomplete','Audition PCM is missing.');
                return new Float32Array(bytes);
            } finally { reads.delete(reading); }
        },
        async close() { closed = true; await Promise.allSettled([...reads]); files.clear(); },
    };
}
