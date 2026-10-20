import { createAnalysisConfig } from './config';
import { extractM10Frame, complexMeydaValue, loudnessMeydaValue } from './meydaAdapter';
import {
    isM10FeatureId,
    isSupportedFeatureId,
    type AnalysisConfig,
    type ExactFeatureValue,
    type FeatureId,
} from './types';
import { WallpaperBlockTransform, WallpaperSmoothing, wallpaperPcmLength } from './wallpaperSpectrum';
import type { RealtimeFeatureFrame } from './realtimeTypes';

/** Causal stream: fixed PCM windows and bounded state, never a song-length series. */
export class RealtimeFeatureExtractor {
    private mono = new Float32Array(1024);
    private filled = 0;
    private samples = 0;
    private previousSpectrum?: number[];
    private readonly left: Float32Array;
    private readonly right: Float32Array;
    private stereoFilled = 0;
    private readonly transform: WallpaperBlockTransform | null;
    private readonly smoothing = new WallpaperSmoothing();
    private raw: Float32Array = new Float32Array(128);
    private we: Float32Array = new Float32Array(128);
    private nextOutput = 1 / 30;
    private latest: Partial<Record<FeatureId, ExactFeatureValue>> = {};
    private config: AnalysisConfig;
    private ids: FeatureId[];
    private constructor(config: AnalysisConfig, ids: FeatureId[]) {
        this.config = config;
        this.ids = ids;
        this.transform = ids.includes('wallpaperEngineSpectrum')
            ? new WallpaperBlockTransform(config.sampleRate)
            : null;
        this.left = new Float32Array(wallpaperPcmLength(config.sampleRate));
        this.right = new Float32Array(this.left.length);
    }
    static async create(sampleRate: number, ids: FeatureId[]) {
        if (ids.length > 4 || new Set(ids).size !== ids.length || ids.some(id => !isSupportedFeatureId(id)))
            throw Error('实时分析最多使用四种已支持的特征。');
        return new RealtimeFeatureExtractor(await createAnalysisConfig(sampleRate), ids);
    }
    push(left: Float32Array, right: Float32Array): RealtimeFeatureFrame[] {
        if (left.length !== right.length || left.length > 4096 || !left.length) throw Error('实时 PCM 块无效。');
        const frames: RealtimeFeatureFrame[] = [];
        const meydaIds = this.ids.filter(isM10FeatureId);
        for (let i = 0; i < left.length; i++) {
            const l = left[i]!,
                r = right[i]!;
            if (!Number.isFinite(l) || !Number.isFinite(r)) throw Error('实时 PCM 包含非有限值。');
            this.mono[this.filled++] = (l + r) / 2;
            if (this.transform) {
                this.left[this.stereoFilled] = l;
                this.right[this.stereoFilled++] = r;
                if (this.stereoFilled === this.left.length) {
                    this.raw = this.transform.extract(this.left, this.right, 0);
                    this.stereoFilled = 0;
                }
            }
            this.samples++;
            if (this.filled === 1024) {
                if (meydaIds.length) {
                    const extracted = extractM10Frame(meydaIds, this.mono, this.config, this.previousSpectrum);
                    this.previousSpectrum = extracted.amplitudeSpectrum;
                    for (const id of meydaIds) {
                        const value = extracted.values[id]!;
                        if (id === 'loudness') {
                            const v = loudnessMeydaValue(extracted.values);
                            this.latest[id] = { total: v.total, specific: Array.from(v.specific) };
                        } else if (id === 'complexSpectrum') {
                            const v = complexMeydaValue(extracted.values, 1024);
                            this.latest[id] = { real: Array.from(v.real), imag: Array.from(v.imag) };
                        } else this.latest[id] = typeof value === 'number' ? value : Array.from(value as Float32Array);
                    }
                }
                this.mono.copyWithin(0, 512);
                this.filled = 512;
            }
            if (this.samples / this.config.sampleRate + 1e-10 >= this.nextOutput) {
                if (this.transform) {
                    this.we = this.smoothing.advance(this.raw);
                    this.latest.wallpaperEngineSpectrum = Array.from(this.we);
                }
                frames.push({ time: this.nextOutput, values: { ...this.latest } });
                this.nextOutput += 1 / 30;
            }
        }
        return frames;
    }
}
