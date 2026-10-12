import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../src/audio/audioEngine';
import type { AuditionSource } from '../../src/audio/auditionTypes';

class BufferValue {
    readonly channels:Float32Array[];
    readonly sampleRate:number;
    readonly length:number;
    readonly numberOfChannels:number;
    readonly duration:number;
    constructor(channels = 2,length = 240000,rate = 8000) {
        this.channels = Array.from({length:channels},() => new Float32Array(length));
        this.sampleRate = rate; this.length = length; this.numberOfChannels = channels; this.duration = length / rate;
    }
    copyToChannel(values:Float32Array,channel:number) { this.channels[channel]!.set(values); }
    copyFromChannel(values:Float32Array,channel:number,start:number) { values.set(this.channels[channel]!.subarray(start,start + values.length)); }
}
class NodeValue {
    gain = {value:1}; fftSize = 1024;
    buffer:AudioBuffer|null = null; onended:(() => void)|null = null;
    connect = vi.fn(); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn();
    getFloatTimeDomainData(values:Float32Array) { values.fill(0); }
}
class ContextValue {
    currentTime = 0; state:AudioContextState = 'running';
    destination = new NodeValue(); original = new BufferValue();
    gains:NodeValue[] = []; nodes:NodeValue[] = [];
    resume = vi.fn(async() => { this.state = 'running'; });
    close = vi.fn(async() => { this.state = 'closed'; });
    async decodeAudioData() { return this.original; }
    createGain() { const node = new NodeValue(); this.gains.push(node); return node; }
    createAnalyser() { return new NodeValue(); }
    createBuffer(channels:number,length:number,rate:number) { return new BufferValue(channels,length,rate); }
    createBufferSource() { const node = new NodeValue(); this.nodes.push(node); return node; }
}
function source(id:string):AuditionSource {
    return {kind:'ft',resultId:id,trackId:'song',label:'FT',sampleRate:8000,frames:240000,
        roles:['drums','bass','other','vocals'],mutedRoles:[],
        async read(_role,_channel,_start,length) { return new Float32Array(length).fill(0.2); },close:vi.fn(async() => {})};
}
function gate() {
    let resolve!:(pcm:Float32Array) => void;
    const promise = new Promise<Float32Array>(next => { resolve = next; }); return {promise,resolve};
}
async function setup() {
    const context = new ContextValue();
    const factory = vi.fn(() => context as unknown as AudioContext);
    const engine = new AudioEngine({audioContextFactory:factory});
    await engine.load({trackId:'song',encodedAudio:new ArrayBuffer(1)});
    return {engine,context,factory};
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('AudioEngine shared audition transport',() => {
    it('shares context, clock, pause, seek, gain and original PCM across source switches',async() => {
        const {engine,context,factory} = await setup();
        const descriptor = engine.getDecodedAudioDescriptor();
        await engine.seek(6); await engine.play(); context.currentTime = 1;
        const stems = source('result-1'); await engine.setAuditionSource(stems);
        expect(factory).toHaveBeenCalledOnce();
        expect(engine.getSnapshot()).toMatchObject({state:'playing',currentTimeSeconds:7,audition:{kind:'ft',resultId:'result-1',mutedRoles:[]}});
        context.currentTime = 2;
        expect(engine.getSnapshot().currentTimeSeconds).toBeCloseTo(7.98);
        engine.setVolume(0.25); engine.setAuditionMuted('bass',true);
        expect(context.gains[0]?.gain.value).toBe(0.25);
        expect(context.gains[2]?.gain.value).toBe(0);
        expect(engine.getDecodedAudioDescriptor()).toEqual(descriptor);
        engine.pause(); context.currentTime = 20;
        expect(engine.getSnapshot()).toMatchObject({state:'paused',currentTimeSeconds:7.98});
        await engine.seek(3); await engine.play(); context.currentTime = 21;
        const position = engine.getSnapshot().currentTimeSeconds;
        await engine.setAuditionSource(null);
        expect(engine.getSnapshot()).toMatchObject({state:'playing',currentTimeSeconds:position,volume:0.25,audition:{kind:'original'}});
        expect(stems.close).toHaveBeenCalledOnce(); expect(factory).toHaveBeenCalledOnce();
        await engine.dispose(); expect(context.close).toHaveBeenCalledOnce();
    });
    it('lets newer pause and seek win while an old audition read is releasing',async() => {
        const {engine} = await setup();
        const old = source('old'),pending = gate();
        old.read = vi.fn(async() => pending.promise);
        await engine.setAuditionSource(old);
        const playing = engine.play(); await vi.advanceTimersByTimeAsync(0);
        expect(engine.getSnapshot().state).toBe('buffering');
        const next = source('next'); const switching = engine.setAuditionSource(next,{play:true});
        await engine.seek(10); engine.pause();
        pending.resolve(new Float32Array(32000)); await playing; await switching;
        expect(engine.getSnapshot()).toMatchObject({state:'paused',currentTimeSeconds:10,audition:{resultId:'next'}});
        expect(old.close).toHaveBeenCalledOnce(); await engine.dispose(); expect(next.close).toHaveBeenCalledOnce();
    });
    it('cancels late source selection when the song changes',async() => {
        const {engine} = await setup();
        const old = source('old'),pending = gate(); old.read = vi.fn(async() => pending.promise);
        await engine.setAuditionSource(old); const playing = engine.play(); await vi.advanceTimersByTimeAsync(0);
        const next = source('next'); const switching = engine.setAuditionSource(next);
        const loading = engine.load({trackId:'new-song',encodedAudio:new ArrayBuffer(2)});
        pending.resolve(new Float32Array(32000)); await playing; await switching; await loading;
        expect(engine.getSnapshot()).toMatchObject({trackId:'new-song',state:'paused',currentTimeSeconds:0,audition:{kind:'original'}});
        expect(next.close).toHaveBeenCalledOnce(); await engine.dispose();
    });
    it('releases reads and scheduled nodes before closing the one context',async() => {
        const {engine,context} = await setup();
        const stems = source('result'),pending = gate(); stems.read = vi.fn(async() => pending.promise);
        await engine.setAuditionSource(stems); const playing = engine.play(); await vi.advanceTimersByTimeAsync(0);
        const disposing = engine.dispose(); expect(context.close).not.toHaveBeenCalled();
        pending.resolve(new Float32Array(32000)); await playing; await disposing;
        expect(stems.close).toHaveBeenCalledOnce(); expect(context.close).toHaveBeenCalledOnce();
        expect(context.nodes.every(node => node.buffer === null)).toBe(true); expect(vi.getTimerCount()).toBe(0);
    });
    it('selects and plays atomically, and closes the graph even if a lease release fails',async() => {
        const {engine,context} = await setup();const stems = source('result');
        await engine.setAuditionSource(stems,{play:true});expect(engine.getSnapshot().state).toBe('playing');
        vi.mocked(stems.close).mockRejectedValueOnce(new Error('lease failure'));
        await expect(engine.dispose()).rejects.toThrow('lease failure');expect(context.close).toHaveBeenCalledOnce();expect(context.nodes.every(node => node.buffer === null)).toBe(true);expect(vi.getTimerCount()).toBe(0);
    });
});
