import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChunkedAudition } from '../../src/audio/chunkedAudition';
import type { AuditionSnapshot, AuditionSource } from '../../src/audio/auditionTypes';

class FakeGain {
    gain = {value:1};
    connect = vi.fn(); disconnect = vi.fn();
}
class FakeNode {
    buffer:AudioBuffer|null = null;
    onended:(() => void)|null = null;
    at = 0;
    connect = vi.fn(); disconnect = vi.fn();
    start = vi.fn((at:number) => { this.at = at; });
    stop = vi.fn();
}
class FakeContext {
    currentTime = 0;
    gains:FakeGain[] = [];
    nodes:FakeNode[] = [];
    createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain; }
    createBufferSource() { const node = new FakeNode(); this.nodes.push(node); return node; }
    createBuffer(_channels:number,length:number,sampleRate:number) {
        return {length,sampleRate,duration:length / sampleRate,copyToChannel:vi.fn()};
    }
    finishPastNodes() {
        for (const node of this.nodes) if (node.buffer && node.onended && node.at + node.buffer.duration <= this.currentTime) node.onended();
    }
}
function setup(roles = ['drums','bass','other','vocals']) {
    const context = new FakeContext(),snapshots:AuditionSnapshot[] = [],reads:Array<{start:number;length:number}> = [];
    const source:AuditionSource = {kind:'ft',resultId:'result-1',trackId:'track-1',label:'FT',sampleRate:8000,frames:8000 * 30,roles,mutedRoles:[],
        async read(_role,_channel,start,length) { reads.push({start,length}); return new Float32Array(length).fill(0.2); },close:vi.fn(async() => {})};
    const audition = new ChunkedAudition(context as unknown as AudioContext,{} as AudioNode,source,snapshot => snapshots.push(snapshot));
    return {audition,context,source,snapshots,reads};
}
function deferred() {
    let resolve!:(value:Float32Array) => void;
    const promise = new Promise<Float32Array>(next => { resolve = next; });
    return {promise,resolve};
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('bounded audition scheduler',() => {
    it('prepares eight seconds in four-second reads and schedules all roles at common times',async() => {
        const {audition,context,reads,source} = setup();
        await audition.play();
        expect(reads).toHaveLength(16);
        expect(reads.every(read => read.length <= 32000)).toBe(true);
        expect(context.nodes.map(node => node.at)).toEqual([0.02,0.02,0.02,0.02,4.02,4.02,4.02,4.02]);
        expect(audition.getSnapshot().state).toBe('playing');
        context.currentTime = 2.02;
        expect(audition.getSnapshot().currentTimeSeconds).toBe(2);
        audition.setMuted('bass',true);
        expect(context.gains[1]?.gain.value).toBe(0);
        expect(audition.getSnapshot().mutedRoles).toEqual(['bass']);
        expect(audition.getSnapshot().currentTimeSeconds).toBe(2);
        await audition.dispose();
        expect(source.close).toHaveBeenCalledOnce();
        expect(context.nodes.every(node => node.buffer === null && node.onended === null)).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
    it('freezes at the audio boundary during a stalled read and resumes without accumulating silence time',async() => {
        const {audition,context,source} = setup(['drums']);
        const gate = deferred();
        source.read = vi.fn(async(_role,channel,start,length) => start === 64000 && channel === 0 ? gate.promise : new Float32Array(length));
        await audition.play();
        context.currentTime = 1; await vi.advanceTimersByTimeAsync(100);
        context.currentTime = 8.6; await vi.advanceTimersByTimeAsync(100);
        expect(audition.getSnapshot()).toMatchObject({state:'buffering',currentTimeSeconds:8});
        context.currentTime = 11; await vi.advanceTimersByTimeAsync(100);
        expect(audition.getSnapshot().currentTimeSeconds).toBe(8);
        gate.resolve(new Float32Array(32000)); await vi.advanceTimersByTimeAsync(0);
        expect(audition.getSnapshot()).toMatchObject({state:'playing',currentTimeSeconds:8});
        context.currentTime = 11.52;
        expect(audition.getSnapshot().currentTimeSeconds).toBeCloseTo(8.5);
        await audition.dispose();
    });
    it('pauses and seeks without resuming stale reads or losing mute state',async() => {
        const {audition,context,source} = setup(['drums']);
        const gate = deferred();
        source.read = vi.fn(async(_role,channel,start,length) => start === 64000 && channel === 0 ? gate.promise : new Float32Array(length));
        await audition.play(); audition.setMuted('drums',true);
        context.currentTime = 1.02; await vi.advanceTimersByTimeAsync(100);
        audition.pause();
        await audition.seek(20);
        expect(audition.getSnapshot()).toMatchObject({state:'paused',currentTimeSeconds:20,mutedRoles:['drums']});
        const play = audition.play();
        gate.resolve(new Float32Array(32000)); await play;
        expect(audition.getSnapshot()).toMatchObject({state:'playing',currentTimeSeconds:20,mutedRoles:['drums']});
        expect(context.nodes.slice(-2).map(node => node.at)).toEqual([1.04,5.04]);
        await audition.dispose();
    });
    it('publishes a read error and stops advancing, while allowing an explicit retry',async() => {
        const {audition,context,source} = setup(['drums']);
        source.read = vi.fn(async(_role,_channel,start,length) => { if (start >= 64000) throw Error('OPFS read failed'); return new Float32Array(length); });
        await audition.play(); context.currentTime = 1.02; await vi.advanceTimersByTimeAsync(100);
        expect(audition.getSnapshot()).toMatchObject({state:'error',currentTimeSeconds:1,error:'OPFS read failed'});
        context.currentTime = 9;
        expect(audition.getSnapshot().currentTimeSeconds).toBe(1);
        source.read = async(_role,_channel,_start,length) => new Float32Array(length);
        await audition.play();
        expect(audition.getSnapshot()).toMatchObject({state:'playing',currentTimeSeconds:1});
        await audition.dispose();
    });
    it('waits for an outstanding read before closing its source lease',async() => {
        const {audition,context,source} = setup(['drums']);
        const gate = deferred();
        source.read = vi.fn(async(_role,channel,start,length) => start === 64000 && channel === 0 ? gate.promise : new Float32Array(length));
        await audition.play(); context.currentTime = 1; await vi.advanceTimersByTimeAsync(100);
        const disposing = audition.dispose();
        expect(source.close).not.toHaveBeenCalled();
        gate.resolve(new Float32Array(32000)); await disposing;
        expect(source.close).toHaveBeenCalledOnce();
        expect(context.nodes.every(node => node.buffer === null)).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });
    it('holds a bounded number of buffers through a long source and emits one natural end',async() => {
        const {audition,context,source,snapshots} = setup(); source.frames = 8000 * 120;
        await audition.play();
        let maximumBuffers = 0;
        for (let seconds = 1; seconds <= 121; seconds++) {
            context.currentTime = seconds + 0.02; context.finishPastNodes(); await vi.advanceTimersByTimeAsync(100);
            maximumBuffers = Math.max(maximumBuffers,context.nodes.filter(node => node.buffer !== null).length);
        }
        expect(maximumBuffers).toBeLessThanOrEqual(12);
        expect(snapshots.filter(snapshot => snapshot.state === 'ended')).toHaveLength(1);
        expect(audition.getSnapshot().currentTimeSeconds).toBe(120);
        await audition.dispose();
    });
});
