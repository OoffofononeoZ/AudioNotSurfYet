import { describe, expect, it } from 'vitest';
import { MonoResampler } from '../../src/transcription/monoResampler';
import { drumLogMel, DRUM_FRAMES, DRUM_MELS } from '../../src/transcription/drumFeatures';
import { drumClass, decodeDrumTokens } from '../../src/transcription/drumTokens';
import type { PcmReader } from '../../src/processing/dsp';

const signal = () => new AbortController().signal;
function reader(samples:Float32Array,rate:number,reads:number[] = []):PcmReader {
    return {frames:samples.length,sampleRate:rate,channels:1,async read(_channel,start,length) {
        reads.push(length); return samples.slice(start,start + length);
    }};
}
describe('bounded transcription PCM',() => {
    it('preserves native mono time and explicit leading/tail padding',async() => {
        const resampler = new MonoResampler(24000,24000);
        const source = reader(new Float32Array([0.2,0.4,0.6]),24000);
        expect(await resampler.segment(source,-2,7,signal())).toEqual(new Float32Array([0,0,0.2,0.4,0.6,0,0]));
    });
    it('preserves phase across separately requested overlapping and adjacent windows',async() => {
        const samples = Float32Array.from({length:44100 * 5},(_,i) => Math.sin(2 * Math.PI * 997 * i / 44100));
        const sizes:number[] = [],source = reader(samples,44100,sizes);
        const resampler = new MonoResampler(44100,24000);
        const whole = await resampler.segment(source,0,120000,signal());
        const head = await resampler.segment(source,0,61440,signal());
        const tail = await resampler.segment(source,61440,58560,signal());
        const overlap = await resampler.segment(source,60000,4000,signal());
        expect(head).toEqual(whole.subarray(0,61440));
        expect(tail).toEqual(whole.subarray(61440));
        expect(overlap).toEqual(whole.subarray(60000,64000));
        expect(sizes.at(-1)).toBeLessThan(7500);
        let error = 0;
        for (let i = 300; i < 61000; i++) error = Math.max(error,Math.abs(head[i]! - Math.sin(2 * Math.PI * 997 * i / 24000)));
        expect(error).toBeLessThan(0.002);
    });
    it('averages stereo and rejects incomplete, nonfinite, oversized or cancelled reads',async() => {
        const resampler = new MonoResampler(22050,22050);
        const source:PcmReader = {frames:4,sampleRate:22050,channels:2,async read(channel,_start,length) { return new Float32Array(length).fill(channel ? -0.2 : 0.6); }};
        expect((await resampler.segment(source,0,4,signal()))[0]).toBeCloseTo(0.2,7);
        await expect(resampler.segment({...source,read:async() => new Float32Array(1)},0,4,signal())).rejects.toMatchObject({code:'pcm-incomplete'});
        await expect(resampler.segment({...source,read:async() => new Float32Array(4).fill(NaN)},0,4,signal())).rejects.toMatchObject({code:'pcm-incomplete'});
        await expect(resampler.segment(source,0,22050 * 9,signal())).rejects.toMatchObject({code:'invalid-request'});
        const abort = new AbortController(); abort.abort();
        await expect(resampler.segment(source,0,4,abort.signal)).rejects.toMatchObject({code:'job-cancelled'});
    });
});

describe('ADT_STR front end and custom vocabulary',() => {
    it('has the exact retained shape and clamped silence semantics',() => {
        const output = drumLogMel(new Float32Array(61440));
        expect(output.length).toBe(DRUM_FRAMES * DRUM_MELS);
        expect(output.every(value => value === 0)).toBe(true);
        expect(() => drumLogMel(new Float32Array(61439))).toThrow();
    });
    it('matches an independent direct DFT oracle at retained frame 5',() => {
        const pcm = Float32Array.from({length:61440},(_,i) => 0.05 * Math.sin(2 * Math.PI * 1010 * i / 24000));
        const output = drumLogMel(pcm);
        const index = 49;
        const mel = (hz:number) => 2595 * Math.log10(1 + hz / 700);
        const edges = [index,index + 1,index + 2].map(i => 700 * (10 ** ((mel(20) + (mel(12000) - mel(20)) * i / 129) / 2595) - 1));
        let energy = 0;
        for (let bin = Math.ceil(edges[0]! * 2048 / 24000); bin * 24000 / 2048 < edges[2]!; bin++) {
            let re = 0,im = 0;
            for (let i = 0; i < 2048; i++) {
                const value = pcm[176 + i]! * (1 - Math.cos(2 * Math.PI * i / 2048)) / 2;
                re += value * Math.cos(2 * Math.PI * bin * i / 2048);
                im -= value * Math.sin(2 * Math.PI * bin * i / 2048);
            }
            const f = bin * 24000 / 2048;
            const weight = Math.fround(Math.max(0,Math.min((f - edges[0]!) / (edges[1]! - edges[0]!),(edges[2]! - f) / (edges[2]! - edges[1]!))));
            energy += weight * (re * re + im * im);
        }
        expect(output[index]).toBeCloseTo((Math.max(-23,Math.min(12,Math.log(energy + 1e-10))) + 23) / 35,6);
    });
    it('classifies custom hats without converting crash, tom or shaker into a hat',() => {
        expect([42,43,44].map(drumClass)).toEqual(['hat','hat','hat']);
        expect([37,39].map(drumClass)).toEqual([null,null]);
        expect([41,45,46,47,48,49,50,51,55].map(drumClass)).toEqual(Array(9).fill(null));
    });
    it('retains simultaneous classes, deduplicates only the same class and rejects malformed triplets',() => {
        const result = decodeDrumTokens([2,54,336,500,54,342,480,54,335,510,74,346,500,94,342,3],2.56,10);
        expect(result.hits.map(hit => [hit.drum,hit.startSeconds])).toEqual([['hat',3.06],['kick',3.06]]);
        expect(result.hits.find(hit => hit.drum === 'kick')?.strength).toBeCloseTo(110 / 127);
        expect(result.ignored).toBe(1);
        expect(result.malformed).toBe(1);
    });
    it('never imports padding-tail or invalid segment time events',() => {
        const result = decodeDrumTokens([2,14,336,500,259,342,480,270,338,500,3],0,0.15);
        expect(result.hits.length).toBe(1);
        expect(result.hits[0]?.endSeconds).toBe(0.15);
        expect(result.ignored).toBe(2);
    });
});
