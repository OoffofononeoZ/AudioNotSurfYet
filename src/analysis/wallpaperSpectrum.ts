import { BluesteinDFT } from './bluestein';
import type { AnalysisConfig, AnalysisSeries } from './types';

// Algorithm identity includes every fixed choice, independently of the Meyda config.
export const WALLPAPER_SPECTRUM_IDENTITY = 'we-approx:v1:owe=4aaec723:real127:dft1920:pcm67:bins1-639:pow.25:weight.501-.499:scale.001x640/(N/2):gain50:threshold0:groups8:peakfloor.333:silence.0001:minlevel.001:up1:down.5:follow20:slew40:30hz:speakers';
export const WALLPAPER_FRAME_RATE = 30;
export const wallpaperFrameIndex = (time: number, count: number): number =>
    Math.max(0, Math.min(count - 1, Math.floor(Math.max(0, time) * WALLPAPER_FRAME_RATE + 1e-8)));
export const wallpaperBlockLength = (sampleRate: number): number => Math.floor(Math.max(sampleRate / 44100, 1) * 1920);
export const wallpaperPcmLength = (sampleRate: number): number => Math.floor(wallpaperBlockLength(sampleRate) * 0.67);

export const wallpaperBandMap = (): Uint8Array => {
    const map = new Uint8Array(640);
    let previous = 0;
    for (let bin = 1; bin < 640; bin++) {
        previous = Math.min(Math.floor(((bin - 1) / 639) ** 0.25 * 64) % 64, previous + 1);
        map[bin] = previous;
    }
    return map;
};
const BAND_MAP = wallpaperBandMap();

/** Reference intervals of scanned DFT bins, not calibrated filter passbands. */
export const wallpaperBandRanges = (sampleRate: number): Array<readonly [number, number]> => {
    const step = sampleRate / wallpaperBlockLength(sampleRate);
    return Array.from({ length: 64 }, (_, band) => {
        let first = 640, last = 0;
        for (let bin = 1; bin < 640; bin++) if (BAND_MAP[bin] === band) { first = Math.min(first, bin); last = bin; }
        return [Math.max(0, first - 0.5) * step, (last + 0.5) * step] as const;
    });
};

/** Raw real-PCM block transform; no DC offset, imaginary encoding or time window. */
export class WallpaperBlockTransform {
    readonly length: number;
    readonly pcmLength: number;
    private readonly dft: BluesteinDFT;
    private readonly input: Float64Array;
    private readonly real = new Float64Array(640);
    private readonly imag = new Float64Array(640);
    private readonly weights = Float64Array.from({ length: 640 }, (_, bin) => 0.501 - 0.499 * Math.cos(Math.PI * (bin - 1) / 639));
    constructor(sampleRate: number) {
        this.length = wallpaperBlockLength(sampleRate); this.pcmLength = wallpaperPcmLength(sampleRate);
        this.dft = new BluesteinDFT(this.length); this.input = new Float64Array(this.length);
    }
    extract(left: Float32Array, right: Float32Array, start: number): Float32Array {
        const result = new Float32Array(128), scale = 0.001 * 640 / (this.length / 2);
        for (let channel = 0; channel < 2; channel++) {
            const pcm = channel === 0 ? left : right;
            this.input.fill(0);
            for (let i = 0; i < this.pcmLength; i++) {
                const value = pcm[start + i] ?? 0;
                if (!Number.isFinite(value)) throw new RangeError('PCM must be finite.');
                this.input[i] = value * 127;
            }
            this.dft.transform(this.input, this.real, this.imag);
            for (let bin = 1; bin < 640; bin++) {
                const magnitude = Math.sqrt(this.weights[bin]!) * Math.hypot(this.real[bin]!, this.imag[bin]!) * scale;
                const slot = channel * 64 + BAND_MAP[bin]!;
                result[slot] = Math.max(result[slot]!, magnitude);
            }
        }
        return result;
    }
}

/** OWE group gain and temporal response, advanced only on the fixed song clock. */
export class WallpaperSmoothing {
    private readonly levels = new Float64Array(16);
    private readonly smoothed = new Float64Array(128);
    private readonly previous = new Float64Array(128);
    advance(raw: Float32Array): Float32Array {
        const rate = 1 / WALLPAPER_FRAME_RATE, peaks = new Float64Array(16);
        let overall = 0;
        for (let i = 0; i < 128; i++) { peaks[i >> 3] = Math.max(peaks[i >> 3]!, raw[i]!); overall = Math.max(overall, raw[i]!); }
        const sounding = overall >= 0.0001;
        if (sounding && this.levels[0]! <= 0.0001) this.levels.fill(1);
        for (let group = 0; group < 16; group++) {
            const target = Math.max(peaks[group]!, overall * 0.333), diff = target - this.levels[group]!;
            this.levels[group] = Math.abs(diff) > 0.0001
                ? this.levels[group]! + Math.min(rate, Math.abs(diff)) * (diff > 0 ? 1 : -0.5) : target;
        }
        const output = new Float32Array(128);
        if (sounding) for (let i = 0; i < 128; i++) {
            this.smoothed[i] = this.smoothed[i]! + (raw[i]! / Math.max(this.levels[i >> 3]!, 0.001) - this.smoothed[i]!) * Math.min(rate * 20, 1);
            const change = this.smoothed[i]! - this.previous[i]!;
            output[i] = this.previous[i]! + Math.max(-1, Math.min(1, change));
            this.previous[i] = output[i]!;
        }
        return output;
    }
}

export async function analyzeWallpaperSpectrum(
    left: Float32Array, right: Float32Array, config: AnalysisConfig, trackHash: string,
    hooks: { isCancelled?: () => boolean; yieldControl: () => Promise<void>; onProgress?: (completed: number, total: number) => void },
): Promise<AnalysisSeries> {
    const transform = new WallpaperBlockTransform(config.sampleRate), smoothing = new WallpaperSmoothing();
    const count = Math.ceil(left.length / config.sampleRate * WALLPAPER_FRAME_RATE);
    const values = new Float32Array(count * 128);
    let completedSamples = 0, batchStart = performance.now();
    let raw: Float32Array = new Float32Array(128);
    for (let frame = 0; frame < count; frame++) {
        if (hooks.isCancelled?.()) throw new Error('Wallpaper spectrum cancelled.');
        const available = Math.floor(frame * config.sampleRate / WALLPAPER_FRAME_RATE);
        while (completedSamples + transform.pcmLength <= available) {
            raw = transform.extract(left, right, completedSamples); completedSamples += transform.pcmLength;
        }
        values.set(smoothing.advance(raw), frame * 128);
        if (frame === count - 1 || performance.now() - batchStart >= 8 || frame % 32 === 31) {
            hooks.onProgress?.(frame + 1, count);
            await hooks.yieldControl(); batchStart = performance.now();
        }
    }
    if (hooks.isCancelled?.()) throw new Error('Wallpaper spectrum cancelled.');
    return { schemaVersion: 1, trackHash, configHash: config.configHash, featureId: 'wallpaperEngineSpectrum', startTimeSeconds: 0,
        sampleStepSeconds: 1 / WALLPAPER_FRAME_RATE, sampleCount: count, dimensions: [128], payload: { kind: 'stereo-spectrum-f32', width: 128, values } };
}
