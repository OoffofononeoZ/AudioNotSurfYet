import type { PcmReader } from '../processing/dsp';
import { assertFinite } from '../processing/dsp';
import { checkCancelled, ProcessingError } from '../processing/modelManifest';

const gcd = (a:number,b:number):number => b ? gcd(b,a % b) : a;

// Polyphase, zero-phase sinc with the published torchaudio Hann defaults.
// Absolute output coordinates keep overlap windows and file reads aligned.
export class MonoResampler {
    private readonly original:number;
    private readonly target:number;
    private readonly width:number;
    private readonly taps:number;
    private readonly coefficients:Float32Array;
    readonly sourceRate:number;
    readonly targetRate:number;
    constructor(sourceRate:number,targetRate:number) {
        this.sourceRate = sourceRate;
        this.targetRate = targetRate;
        if (![sourceRate,targetRate].every(rate => Number.isSafeInteger(rate) && rate >= 8000 && rate <= 192000)) {
            throw new ProcessingError('invalid-request','Unsupported transcription sample rate.');
        }
        const divisor = gcd(sourceRate,targetRate);
        this.original = sourceRate / divisor;
        this.target = targetRate / divisor;
        const base = Math.min(this.original,this.target) * 0.99;
        this.width = Math.ceil(6 * this.original / base);
        this.taps = 2 * this.width + this.original;
        // Reject pathological ratios before allocating an unbounded table.
        if (this.target * this.taps > 4_000_000) {
            throw new ProcessingError('invalid-request','Unsupported transcription resampling ratio.');
        }
        this.coefficients = new Float32Array(this.target * this.taps);
        for (let phase = 0; phase < this.target; phase++) {
            for (let tap = 0; tap < this.taps; tap++) {
                const time = Math.max(-6,Math.min(6,((tap - this.width) / this.original - phase / this.target) * base));
                const angle = Math.PI * time;
                const sinc = angle === 0 ? 1 : Math.sin(angle) / angle;
                this.coefficients[phase * this.taps + tap] = sinc * Math.cos(angle / 12) ** 2 * base / this.original;
            }
        }
    }
    async segment(source:PcmReader,start:number,count:number,signal:AbortSignal):Promise<Float32Array<ArrayBuffer>> {
        checkCancelled(signal);
        if (source.sampleRate !== this.sourceRate || ![1,2].includes(source.channels)
            || !Number.isSafeInteger(source.frames) || source.frames <= 0
            || !Number.isSafeInteger(start) || !Number.isSafeInteger(count) || count <= 0 || count > this.targetRate * 8) {
            throw new ProcessingError('invalid-request','Invalid bounded transcription PCM request.');
        }
        const output = new Float32Array(count);
        const total = Math.ceil(source.frames * this.targetRate / this.sourceRate);
        const first = Math.max(0,start),end = Math.min(total,start + count);
        if (first >= end) return output;
        const direct = this.sourceRate === this.targetRate;
        const low = Math.max(0,direct ? first : Math.floor(first / this.target) * this.original - this.width);
        const high = Math.min(source.frames,direct ? end : Math.floor((end - 1) / this.target) * this.original - this.width + this.taps);
        const mono = new Float32Array(high - low);
        for (let channel = 0; channel < source.channels; channel++) {
            const input = await source.read(channel,low,high - low);
            checkCancelled(signal);
            if (input.length !== mono.length) throw new ProcessingError('pcm-incomplete','Transcription PCM read is incomplete.');
            assertFinite(input);
            for (let sample = 0; sample < mono.length; sample++) mono[sample] = mono[sample]! + input[sample]! / source.channels;
        }
        for (let sample = first; sample < end; sample++) {
            if ((sample & 4095) === 0) checkCancelled(signal);
            if (direct) { output[sample - start] = mono[sample - low]!; continue; }
            const block = Math.floor(sample / this.target);
            const phase = sample % this.target;
            const sourceStart = block * this.original - this.width - low;
            let sum = 0;
            for (let tap = 0; tap < this.taps; tap++) {
                sum += (mono[sourceStart + tap] ?? 0) * this.coefficients[phase * this.taps + tap]!;
            }
            output[sample - start] = sum;
        }
        return output;
    }
}
