import { describe, expect, it } from 'vitest';
import { decodePitchNotes } from '../../src/transcription/pitchNotes';
import type { PitchActivations } from '../../src/transcription/pitchNotes';

const signal = () => new AbortController().signal;
function activations(count:number):PitchActivations {
    return {frames:new Float32Array(count * 88),onsets:new Float32Array(count * 88),times:Float64Array.from({length:count + 1},(_,frame) => frame * 256 / 22050)};
}
function note(a:PitchActivations,pitch:number,start:number,end:number):void {
    for (let frame = start; frame < end; frame++) a.frames[frame * 88 + pitch - 21] = 0.8;
    a.onsets[start * 88 + pitch - 21] = 0.9;
}
describe('Basic Pitch note adaptation',() => {
    it('extracts polyphony and repeated notes while preserving actual frame times',() => {
        const a = activations(100);
        note(a,60,10,30); note(a,64,10,50); note(a,60,45,80);
        const output = decodePitchNotes(a,signal());
        expect(output.map(n => [n.pitch,n.startSeconds,n.endSeconds])).toEqual([
            [60,a.times[10],a.times[30]], [64,a.times[10],a.times[50]], [60,a.times[45],a.times[80]],
        ]);
    });
    it('keeps notes crossing a model boundary as one range',() => {
        const a = activations(300);
        for (let i = 0; i < a.times.length; i++) a.times[i] = (Math.floor(i / 142) * 36164 + (i % 142) * 256) / 22050;
        note(a,69,130,170);
        const output = decodePitchNotes(a,signal());
        expect(output).toHaveLength(1);
        expect(output[0]?.startSeconds).toBe(a.times[130]);
        expect(output[0]?.endSeconds).toBe(a.times[170]);
    });
    it('handles silence without NaN inferred onsets, detects no-onset sustained energy and rejects invalid output',() => {
        const silent = activations(80);
        expect(decodePitchNotes(silent,signal())).toEqual([]);
        note(silent,48,10,60); silent.onsets.fill(0);
        expect(decodePitchNotes(silent,signal()).some(n => n.pitch === 48)).toBe(true);
        silent.frames[0] = NaN;
        expect(() => decodePitchNotes(silent,signal())).toThrow();
    });
    it('observes cancellation before expensive decoding',() => {
        const abort = new AbortController(); abort.abort();
        expect(() => decodePitchNotes(activations(10),abort.signal)).toThrow();
    });
});
