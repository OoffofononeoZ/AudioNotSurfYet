/** Reusable complex radix-2 FFT. Inverse includes the 1/N normalization. */
export class Radix2FFT {
    readonly size: number;
    private readonly reverse: Uint32Array;
    private readonly cos: Float64Array;
    private readonly sin: Float64Array;
    constructor(size: number) {
        this.size = size;
        if (size < 2 || (size & (size - 1)) !== 0) throw new RangeError('FFT size must be a power of two.');
        this.reverse = new Uint32Array(size);
        this.cos = new Float64Array(size / 2);
        this.sin = new Float64Array(size / 2);
        const bits = Math.log2(size);
        for (let i = 0; i < size; i++) {
            let value = i, reversed = 0;
            for (let bit = 0; bit < bits; bit++) { reversed = (reversed << 1) | (value & 1); value >>>= 1; }
            this.reverse[i] = reversed;
        }
        for (let i = 0; i < size / 2; i++) {
            this.cos[i] = Math.cos(2 * Math.PI * i / size);
            this.sin[i] = Math.sin(2 * Math.PI * i / size);
        }
    }
    transform(real: Float64Array, imag: Float64Array, inverse = false): void {
        const n = this.size;
        if (real.length !== n || imag.length !== n) throw new RangeError('FFT dimensions do not match.');
        for (let i = 0; i < n; i++) {
            const j = this.reverse[i]!;
            if (i < j) { [real[i], real[j]] = [real[j]!, real[i]!]; [imag[i], imag[j]] = [imag[j]!, imag[i]!]; }
        }
        for (let width = 2; width <= n; width *= 2) {
            const half = width / 2, stride = n / width;
            for (let start = 0; start < n; start += width) for (let j = 0; j < half; j++) {
                const a = start + j, b = a + half, k = j * stride;
                const c = this.cos[k]!, s = this.sin[k]! * (inverse ? 1 : -1);
                const re = real[b]! * c - imag[b]! * s, im = real[b]! * s + imag[b]! * c;
                real[b] = real[a]! - re; imag[b] = imag[a]! - im;
                real[a] = real[a]! + re; imag[a] = imag[a]! + im;
            }
        }
        if (inverse) for (let i = 0; i < n; i++) { real[i] = real[i]! / n; imag[i] = imag[i]! / n; }
    }
}

/** Arbitrary-length forward DFT of real PCM, using a cached chirp convolution. */
export class BluesteinDFT {
    readonly length: number;
    private readonly fft: Radix2FFT;
    private readonly cos: Float64Array;
    private readonly sin: Float64Array;
    private readonly kernelReal: Float64Array;
    private readonly kernelImag: Float64Array;
    private readonly real: Float64Array;
    private readonly imag: Float64Array;
    constructor(length: number) {
        this.length = length;
        if (!Number.isInteger(length) || length < 2) throw new RangeError('DFT length must be at least two.');
        const size = 2 ** Math.ceil(Math.log2(length * 2 - 1));
        this.fft = new Radix2FFT(size);
        this.cos = new Float64Array(length); this.sin = new Float64Array(length);
        this.kernelReal = new Float64Array(size); this.kernelImag = new Float64Array(size);
        this.real = new Float64Array(size); this.imag = new Float64Array(size);
        for (let i = 0; i < length; i++) {
            const angle = Math.PI * (i * i % (2 * length)) / length;
            const c = Math.cos(angle), s = Math.sin(angle);
            this.cos[i] = c; this.sin[i] = s;
            this.kernelReal[i] = c; this.kernelImag[i] = s;
            if (i > 0) { this.kernelReal[size - i] = c; this.kernelImag[size - i] = s; }
        }
        this.fft.transform(this.kernelReal, this.kernelImag);
    }
    transform(input: ArrayLike<number>, outputReal: Float64Array, outputImag: Float64Array): void {
        if (input.length !== this.length || outputReal.length > this.length || outputReal.length !== outputImag.length) throw new RangeError('DFT dimensions do not match.');
        const re = this.real, im = this.imag;
        re.fill(0); im.fill(0);
        for (let i = 0; i < this.length; i++) { re[i] = input[i]! * this.cos[i]!; im[i] = -input[i]! * this.sin[i]!; }
        this.fft.transform(re, im);
        for (let i = 0; i < re.length; i++) {
            const a = re[i]!, b = im[i]!;
            re[i] = a * this.kernelReal[i]! - b * this.kernelImag[i]!;
            im[i] = a * this.kernelImag[i]! + b * this.kernelReal[i]!;
        }
        this.fft.transform(re, im, true);
        for (let i = 0; i < outputReal.length; i++) {
            outputReal[i] = re[i]! * this.cos[i]! + im[i]! * this.sin[i]!;
            outputImag[i] = im[i]! * this.cos[i]! - re[i]! * this.sin[i]!;
        }
    }
}
