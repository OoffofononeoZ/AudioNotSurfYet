import { ProcessingError } from '../processing/modelManifest';

const SIZE = 2048;
const HOP = 240;
const BINS = SIZE / 2 + 1;
export const DRUM_FRAMES = 246;
export const DRUM_MELS = 128;
const mel = (hz:number) => 2595 * Math.log10(1 + hz / 700);
const hz = (value:number) => 700 * (10 ** (value / 2595) - 1);

interface Band { start:number;weights:Float32Array }
const bands:Band[] = Array.from({length:DRUM_MELS},(_,index) => {
    const edges = [index,index + 1,index + 2].map(step => hz(mel(20) + (mel(12000) - mel(20)) * step / (DRUM_MELS + 1)));
    const start = Math.max(0,Math.ceil(edges[0]! * SIZE / 24000));
    const end = Math.min(BINS,Math.floor(edges[2]! * SIZE / 24000) + 1);
    return {start,weights:Float32Array.from({length:end - start},(_,offset) => {
        const frequency = (start + offset) * 24000 / SIZE;
        return Math.max(0,Math.min((frequency - edges[0]!) / (edges[1]! - edges[0]!), (edges[2]! - frequency) / (edges[2]! - edges[1]!)));
    })};
});
const hann = Float64Array.from({length:SIZE},(_,i) => (1 - Math.cos(2 * Math.PI * i / SIZE)) / 2);
const reverse = Uint16Array.from({length:SIZE},(_,i) => {
    let result = 0;
    for (let bit = 0; bit < 11; bit++) result = result * 2 + ((i >> bit) & 1);
    return result;
});
const cos = Float64Array.from({length:SIZE / 2},(_,i) => Math.cos(2 * Math.PI * i / SIZE));
const sin = Float64Array.from({length:SIZE / 2},(_,i) => -Math.sin(2 * Math.PI * i / SIZE));

function powerSpectrum(input:Float64Array,imaginary:Float64Array,output:Float64Array):void {
    for (let i = 0; i < SIZE; i++) {
        const j = reverse[i]!;
        if (j > i) { const previous = input[i]!; input[i] = input[j]!; input[j] = previous; }
        imaginary[i] = 0;
    }
    for (let span = 2; span <= SIZE; span *= 2) {
        const half = span / 2,step = SIZE / span;
        for (let base = 0; base < SIZE; base += span) {
            for (let offset = 0; offset < half; offset++) {
                const a = base + offset,b = a + half;
                const real = input[b]! * cos[offset * step]! - imaginary[b]! * sin[offset * step]!;
                const imag = input[b]! * sin[offset * step]! + imaginary[b]! * cos[offset * step]!;
                input[b] = input[a]! - real; input[a] = input[a]! + real;
                imaginary[b] = imaginary[a]! - imag; imaginary[a] = imaginary[a]! + imag;
            }
        }
    }
    for (let bin = 0; bin < BINS; bin++) output[bin] = input[bin]! ** 2 + imaginary[bin]! ** 2;
}

// The retained centered STFT frames are 5..250, so every window falls inside
// this zero-padded 2.56s segment; no extra timing offset is added to tokens.
export function drumLogMel(pcm:Float32Array):Float32Array<ArrayBuffer> {
    if (pcm.length !== 61440 || pcm.some(sample => !Number.isFinite(sample))) {
        throw new ProcessingError('pcm-incomplete','ADT_STR needs 61440 finite mono samples at 24kHz.');
    }
    const result = new Float32Array(DRUM_FRAMES * DRUM_MELS);
    const real = new Float64Array(SIZE),imaginary = new Float64Array(SIZE),power = new Float64Array(BINS);
    for (let frame = 0; frame < DRUM_FRAMES; frame++) {
        const start = (frame + 5) * HOP - SIZE / 2;
        for (let sample = 0; sample < SIZE; sample++) real[sample] = pcm[start + sample]! * hann[sample]!;
        powerSpectrum(real,imaginary,power);
        for (let index = 0; index < bands.length; index++) {
            const band = bands[index]!;
            let energy = 0;
            for (let bin = 0; bin < band.weights.length; bin++) energy += power[band.start + bin]! * band.weights[bin]!;
            result[frame * DRUM_MELS + index] = (Math.max(-23,Math.min(12,Math.log(energy + 1e-10))) + 23) / 35;
        }
    }
    return result;
}
