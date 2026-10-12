import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStemAuditionSource } from '../../src/processing/stemAuditionSource';
import type { StemAuditionInput } from '../../src/processing/stemAuditionSource';

const input:StemAuditionInput = {kind:'ft',directory:'editor-test',resultId:'editor-test',trackId:'song',label:'FT',mutedRoles:[],
    stems:[{role:'drums',frames:8,sampleRate:44100,left:'drums-left.f32',right:'drums-right.f32'}]};
function storage(files:Record<string,File>) {
    const directory = {async getDirectoryHandle() { return directory; },async getFileHandle(name:string) {
        if (!files[name]) throw new DOMException('Missing','NotFoundError');
        return {getFile:async() => files[name]};
    }};
    vi.stubGlobal('navigator',{storage:{getDirectory:async() => directory}});
}
afterEach(() => vi.unstubAllGlobals());
describe('OPFS audition read lease',() => {
    it('returns exact planar ranges and rejects unbounded or closed reads',async() => {
        const values = new Float32Array([0,1,2,3,4,5,6,7]);
        const file = new File([values],'drums.f32');
        storage({'drums-left.f32':file,'drums-right.f32':file});
        const source = await createStemAuditionSource(input,new AbortController().signal);
        expect(await source.read('drums',1,2,4,new AbortController().signal)).toEqual(new Float32Array([2,3,4,5]));
        await expect(source.read('drums',0,0,44100 * 5,new AbortController().signal)).rejects.toMatchObject({code:'invalid-request'});
        await source.close();
        await expect(source.read('drums',0,0,1,new AbortController().signal)).rejects.toMatchObject({code:'invalid-request'});
    });
    it('rejects missing/truncated artifacts before creating a playable source',async() => {
        storage({'drums-left.f32':new File([new Float32Array(7)],'truncated.f32'),'drums-right.f32':new File([new Float32Array(8)],'full.f32')});
        await expect(createStemAuditionSource(input,new AbortController().signal)).rejects.toMatchObject({code:'result-invalid'});
        storage({});
        await expect(createStemAuditionSource(input,new AbortController().signal)).rejects.toMatchObject({name:'NotFoundError'});
    });
    it('waits for an outstanding file read and suppresses that result after close',async() => {
        let resolve!:(buffer:ArrayBuffer) => void;
        const pending = new Promise<ArrayBuffer>(next => { resolve = next; });
        const file = {size:32,slice:() => ({arrayBuffer:() => pending})} as File;
        storage({'drums-left.f32':file,'drums-right.f32':file});
        const source = await createStemAuditionSource(input,new AbortController().signal);
        const reading = source.read('drums',0,0,8,new AbortController().signal);
        const rejected = expect(reading).rejects.toMatchObject({code:'pcm-incomplete'});
        let closed = false; const closing = source.close().then(() => { closed = true; });
        await Promise.resolve(); expect(closed).toBe(false);
        resolve(new ArrayBuffer(32)); await rejected; await closing; expect(closed).toBe(true);
    });
    it('does not publish a cancelled read after its bytes arrive',async() => {
        let resolve!:(buffer:ArrayBuffer) => void;
        const pending = new Promise<ArrayBuffer>(next => { resolve = next; });
        const file = {size:32,slice:() => ({arrayBuffer:() => pending})} as File;
        storage({'drums-left.f32':file,'drums-right.f32':file});
        const source = await createStemAuditionSource(input,new AbortController().signal),abort = new AbortController();
        const reading = source.read('drums',0,0,8,abort.signal);
        const rejected = expect(reading).rejects.toMatchObject({code:'job-cancelled'});
        abort.abort(); resolve(new ArrayBuffer(32)); await rejected; await source.close();
    });
});
