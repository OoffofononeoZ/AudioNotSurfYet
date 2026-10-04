import { quantizeToUint16 } from '../analysis/compactCodec';
import { FT_FRAMES, FT_OVERLAP, FT_RATE, FT_STRIDE, ProcessingError } from './modelManifest';

export interface PcmReader {
    frames: number; sampleRate: number; channels: number;
    read(channel: number, start: number, length: number): Promise<Float32Array>;
}
export function assertFinite(samples: Float32Array): void {
    if (samples.some(v=>!Number.isFinite(v))) throw new ProcessingError('pcm-incomplete','PCM contains non-finite samples.');
}
export function selectStem(data: unknown, dims: readonly number[], row: number): [Float32Array, Float32Array] {
    if (!(data instanceof Float32Array) || dims.join(',') !== `1,4,2,${FT_FRAMES}`
        || data.length !== 8 * FT_FRAMES || !Number.isInteger(row) || row < 0 || row > 3) {
        throw new ProcessingError('model-incompatible','Unexpected FT output tensor.');
    }
    if(data.some(v=>!Number.isFinite(v)))throw new ProcessingError('model-incompatible','FT output contains non-finite samples.');
    const offset = row * 2 * FT_FRAMES;
    return [data.slice(offset,offset+FT_FRAMES),data.slice(offset+FT_FRAMES,offset+2*FT_FRAMES)];
}

export class SincResampler {
    private coefficients: Float64Array;
    private ratio: number;
    constructor(sourceRate: number) {
        if (!Number.isFinite(sourceRate) || sourceRate < 8000 || sourceRate > 192000) throw new ProcessingError('invalid-request','Unsupported sample rate.');
        this.ratio = sourceRate / FT_RATE;
        const cutoff = Math.min(1, FT_RATE / sourceRate);
        this.coefficients = new Float64Array(1024 * 64);
        for (let phase=0; phase<1024; phase++) {
            let sum=0;
            for (let tap=0; tap<64; tap++) {
                const x = tap - 31 - phase / 1024;
                const window = 0.42 - 0.5*Math.cos(2*Math.PI*tap/63) + 0.08*Math.cos(4*Math.PI*tap/63);
                const value = (x === 0 ? cutoff : Math.sin(Math.PI*cutoff*x)/(Math.PI*x)) * window;
                this.coefficients[phase*64+tap] = value; sum += value;
            }
            for (let tap=0; tap<64; tap++) this.coefficients[phase*64+tap] = this.coefficients[phase*64+tap]! / sum;
        }
    }
    async segment(source: PcmReader, outputStart: number, count: number): Promise<[Float32Array,Float32Array]> {
        if(![1,2].includes(source.channels)||source.sampleRate/FT_RATE!==this.ratio
            || !Number.isSafeInteger(outputStart)||outputStart<0||!Number.isSafeInteger(count)||count<=0)throw new ProcessingError('invalid-request','Invalid resampling source or range.');
        const total = Math.round(source.frames * FT_RATE / source.sampleRate);
        const valid = Math.max(0,Math.min(count,total-outputStart));
        const result: [Float32Array,Float32Array] = [new Float32Array(count),new Float32Array(count)];
        if (valid === 0) return result;
        const low = Math.max(0,Math.floor(outputStart*this.ratio)-31);
        const high = Math.min(source.frames,Math.floor((outputStart+valid-1)*this.ratio)+33);
        for (let channel=0; channel<source.channels; channel++) {
            const input = await source.read(channel,low,high-low);
            if (input.length !== high-low) throw new ProcessingError('pcm-incomplete','PCM range is incomplete.');
            assertFinite(input);
            const output = result[channel]!;
            if (this.ratio === 1) { output.set(input.subarray(outputStart-low,outputStart-low+valid)); continue; }
            for (let i=0; i<valid; i++) {
                const position = (outputStart+i)*this.ratio, center = Math.floor(position);
                const phase = Math.min(1023,Math.floor((position-center)*1024));
                let sum=0;
                for (let tap=0; tap<64; tap++) sum += (input[center-31+tap-low] ?? 0)*this.coefficients[phase*64+tap]!;
                output[i]=sum;
            }
        }
        if (source.channels === 1) result[1].set(result[0]);
        return result;
    }
}

// Keeps only the current segment and its overlap. Each flushed sample is final.
export class RollingOverlapAdd {
    private left = new Float32Array(FT_FRAMES);
    private right = new Float32Array(FT_FRAMES);
    private weights = new Float32Array(FT_FRAMES);
    private position = 0;
    private total: number;
    constructor(frames: number) { this.total = frames; }
    add(start: number, channels: readonly [Float32Array,Float32Array]): [Float32Array<ArrayBuffer>,Float32Array<ArrayBuffer>] {
        if (start !== this.position || channels.some(c=>c.length!==FT_FRAMES)) throw new ProcessingError('invalid-request','Invalid overlap sequence.');
        channels.forEach(assertFinite);
        const valid = Math.min(FT_FRAMES,this.total-start);
        for (let i=0;i<valid;i++) {
            const ramp = Math.min(i,FT_FRAMES-1-i,FT_OVERLAP-1)/(FT_OVERLAP-1);
            // The reference has zero weight at sample zero. Preserve uncovered
            // endpoints rather than discarding their absolute-time samples.
            const weight = Math.max(1e-8,ramp);
            this.left[i] = this.left[i]! + channels[0][i]!*weight;
            this.right[i] = this.right[i]! + channels[1][i]!*weight;
            this.weights[i] = this.weights[i]! + weight;
        }
        const count = Math.min(FT_STRIDE,this.total-start);
        const output: [Float32Array<ArrayBuffer>,Float32Array<ArrayBuffer>] = [new Float32Array(count),new Float32Array(count)];
        for(let i=0;i<count;i++) {
            if (!(this.weights[i]! > 0)) throw new ProcessingError('stem-duration-mismatch','Uncovered output frame.');
            output[0][i] = this.left[i]!/this.weights[i]!;
            output[1][i] = this.right[i]!/this.weights[i]!;
        }
        for(const data of [this.left,this.right,this.weights]) { data.copyWithin(0,count); data.fill(0,FT_FRAMES-count); }
        this.position += count;
        return output;
    }
}

export class StemSummary {
    private frames = 0;
    private sum = 0;
    private minimum = Infinity;
    private maximum = -Infinity;
    private energy: number[] = [];
    private mins: number[] = [];
    private maxs: number[] = [];
    private expected: number;
    constructor(frames: number) { this.expected=frames; }
    append(left: Float32Array,right: Float32Array): void {
        if(left.length!==right.length || this.frames+left.length>this.expected) throw new ProcessingError('stem-duration-mismatch','Stem length mismatch.');
        assertFinite(left); assertFinite(right);
        for(let i=0;i<left.length;i++) {
            const l=left[i]!,r=right[i]!;
            this.sum += (l*l+r*r)/2;
            this.minimum=Math.min(this.minimum,l,r); this.maximum=Math.max(this.maximum,l,r);
            this.frames++;
            if(this.frames===Math.min(this.expected,Math.floor((this.energy.length+1)*FT_RATE/30))) this.flush();
        }
    }
    private flush(): void {
        const count=this.frames-Math.floor(this.energy.length*FT_RATE/30);
        this.energy.push(Math.max(-80,Math.min(0,10*Math.log10(this.sum/count))));
        this.mins.push(this.minimum); this.maxs.push(this.maximum);
        this.sum=0; this.minimum=Infinity; this.maximum=-Infinity;
    }
    finish() {
        if(this.frames!==this.expected) throw new ProcessingError('stem-duration-mismatch','Incomplete stem.');
        return { energy:quantizeToUint16(this.energy,{min:-80,max:0}).values,
            waveformMin:new Float32Array(this.mins),waveformMax:new Float32Array(this.maxs),
            energyScale:80/65535,energyOffset:-80 };
    }
}
export function wavHeader(frames: number): Uint8Array<ArrayBuffer> {
    const bytes=frames*8;
    if(!Number.isSafeInteger(frames)||frames<=0||bytes>0xffffffff-36) throw new ProcessingError('artifact-export-failed','WAV length exceeds RIFF capacity.');
    const buffer=new ArrayBuffer(44), view=new DataView(buffer);
    function label(at:number,text:string){for(let i=0;i<text.length;i++)view.setUint8(at+i,text.charCodeAt(i));}
    label(0,'RIFF');view.setUint32(4,36+bytes,true);label(8,'WAVE');label(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,3,true);view.setUint16(22,2,true);
    view.setUint32(24,FT_RATE,true);view.setUint32(28,FT_RATE*8,true);
    view.setUint16(32,8,true);view.setUint16(34,32,true);label(36,'data');view.setUint32(40,bytes,true);
    return new Uint8Array(buffer);
}
export function interleave(left:Float32Array,right:Float32Array): Uint8Array<ArrayBuffer> {
    if(left.length!==right.length) throw new ProcessingError('artifact-export-failed','Channel lengths differ.');
    assertFinite(left);assertFinite(right);
    const data=new ArrayBuffer(left.length*8),view=new DataView(data);
    for(let i=0;i<left.length;i++){view.setFloat32(i*8,left[i]!,true);view.setFloat32(i*8+4,right[i]!,true);}
    return new Uint8Array(data);
}
