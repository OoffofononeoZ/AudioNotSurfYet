import {
    aggregateComplexValues,
    aggregateScalars,
    aggregateVectors,
    quantizeComplexValues,
    quantizeToUint16,
} from './compactCodec';
import { getFeatureDefinition } from './featureRegistry';
import { analysisAggregationFactor } from './frames';
import {
    complexMeydaValue,
    loudnessMeydaValue,
    scalarMeydaValue,
    vectorMeydaValue,
    type MeydaBatchResult,
} from './meydaAdapter';
import type { AnalysisConfig, AnalysisSeries, CompactPayload, M10FeatureId } from './types';

/** Keep at most one aggregation bucket of frames, rather than the whole song. */
export class SeriesAccumulator {
    private readonly definition;
    private readonly width;
    private readonly count;
    private readonly factor;
    private readonly first: Float32Array;
    private readonly second: Float32Array;
    private readonly scalars: number[] = [];
    private readonly vectors: number[][] = [];
    private readonly complex: Array<{ real: number[]; imag: number[] }> = [];
    private bucketFrames = 0;
    private bucketIndex = 0;
    private readonly id: M10FeatureId;
    private readonly config: AnalysisConfig;
    constructor(id: M10FeatureId, config: AnalysisConfig, frames: number) {
        this.id = id;
        this.config = config;
        this.definition = getFeatureDefinition(id);
        this.width = this.definition.dimensions(config)[0] ?? 1;
        this.factor = analysisAggregationFactor(config.sampleRate, config.hopSize);
        this.count = Math.ceil(frames / this.factor);
        const shape = this.definition.outputShape;
        this.first = new Float32Array(
            this.count *
                (shape === 'frequency-vector' || shape === 'category-vector' || shape === 'complex-spectrum'
                    ? this.width
                    : 1),
        );
        this.second = new Float32Array(
            shape === 'waveform'
                ? this.count
                : shape === 'loudness-structure' || shape === 'complex-spectrum'
                  ? this.count * this.width
                  : 0,
        );
    }
    push(result: MeydaBatchResult): void {
        const shape = this.definition.outputShape;
        if (shape === 'scalar') this.scalars.push(scalarMeydaValue(result, this.id));
        else if (shape === 'loudness-structure') {
            const value = loudnessMeydaValue(result);
            this.scalars.push(value.total);
            this.vectors.push(value.specific);
        } else if (shape === 'complex-spectrum') this.complex.push(complexMeydaValue(result, this.width));
        else
            this.vectors.push(
                vectorMeydaValue(
                    result,
                    this.id as 'buffer' | 'amplitudeSpectrum' | 'powerSpectrum' | 'chroma' | 'mfcc',
                    this.width,
                ),
            );
        if (++this.bucketFrames === this.factor) this.flush();
    }
    private flush(): void {
        if (!this.bucketFrames) return;
        const index = this.bucketIndex++,
            shape = this.definition.outputShape;
        if (shape === 'scalar' || shape === 'loudness-structure')
            this.first[index] = aggregateScalars(this.scalars, this.factor)[0]!;
        if (shape === 'loudness-structure')
            this.second.set(aggregateVectors(this.vectors, this.factor, this.width), index * this.width);
        else if (shape === 'frequency-vector' || shape === 'category-vector')
            this.first.set(aggregateVectors(this.vectors, this.factor, this.width), index * this.width);
        else if (shape === 'waveform') {
            let min = Infinity,
                max = -Infinity;
            for (const frame of this.vectors)
                for (const value of frame) {
                    min = Math.min(min, value);
                    max = Math.max(max, value);
                }
            this.first[index] = min;
            this.second[index] = max;
        } else if (shape === 'complex-spectrum') {
            const values = aggregateComplexValues(this.complex, this.factor, this.width);
            this.first.set(values.magnitudes, index * this.width);
            this.second.set(values.phases, index * this.width);
        }
        this.scalars.length = this.vectors.length = this.complex.length = this.bucketFrames = 0;
    }
    finish(trackHash: string): AnalysisSeries {
        this.flush();
        const shape = this.definition.outputShape;
        let payload: CompactPayload;
        if (shape === 'scalar') payload = { kind: 'scalar-f32', values: this.first };
        else if (shape === 'waveform') {
            let peak = 0;
            for (let i = 0; i < this.count; i++)
                peak = Math.max(peak, Math.abs(this.first[i]!), Math.abs(this.second[i]!));
            const scale = peak / 32767,
                min = new Int16Array(this.count),
                max = new Int16Array(this.count);
            if (scale > 0)
                for (let i = 0; i < this.count; i++) {
                    min[i] = Math.round(this.first[i]! / scale);
                    max[i] = Math.round(this.second[i]! / scale);
                }
            payload = { kind: 'waveform-envelope', min, max, scale };
        } else if (shape === 'loudness-structure') {
            let max = 0;
            for (const value of this.second) max = Math.max(max, value);
            const specific = quantizeToUint16(this.second, { min: 0, max });
            payload = {
                kind: 'loudness',
                total: this.first,
                specific: specific.values,
                bands: 24,
                scale: specific.scale,
                offset: specific.offset,
            };
        } else if (shape === 'complex-spectrum')
            payload = { kind: 'complex-derived', ...quantizeComplexValues(this.first, this.second), bins: this.width };
        else
            payload = {
                kind: shape === 'category-vector' ? 'category-u16' : 'frequency-u16',
                ...quantizeToUint16(this.first),
                width: this.width,
            };
        return {
            schemaVersion: 1,
            trackHash,
            configHash: this.config.configHash,
            featureId: this.id,
            startTimeSeconds: 0,
            sampleStepSeconds: (this.factor * this.config.hopSize) / this.config.sampleRate,
            sampleCount: this.count,
            dimensions: this.definition.dimensions(this.config),
            payload,
        };
    }
}
