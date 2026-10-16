import { aggregateComplex, aggregateWaveform, aggregateScalars, aggregateVectors, quantizeToUint16 } from './compactCodec';
import { getFeatureDefinition } from './featureRegistry';
import type { AnalysisJobRequest, AnalysisSeries, FeatureId, M10FeatureId } from './types';
import { analysisAggregationFactor } from './frames';

export const buildSeries = (
    request: AnalysisJobRequest,
    featureIds: readonly M10FeatureId[],
    scalarFrames: Map<FeatureId, number[]>,
    vectorFrames: Map<FeatureId, number[][]>,
    loudnessFrames: Array<{ total: number; specific: number[] }>,
    complexFrames: Array<{ real: number[]; imag: number[] }>,
): AnalysisSeries[] => {
    const factor = analysisAggregationFactor(
        request.config.sampleRate,
        request.config.hopSize,
    );
    const sampleStepSeconds =
        factor * request.config.hopSize / request.config.sampleRate;
    return featureIds.map((featureId) => {
        const definition = getFeatureDefinition(featureId);
        const dimensions = definition.dimensions(request.config);
        if (definition.outputShape === 'scalar') {
            const values = aggregateScalars(
                scalarFrames.get(featureId) ?? [],
                factor,
            );
            return {
                schemaVersion: 1,
                trackHash: request.trackHash,
                configHash: request.config.configHash,
                featureId,
                startTimeSeconds: 0,
                sampleStepSeconds,
                sampleCount: values.length,
                dimensions,
                payload: {
                    kind: 'scalar-f32',
                    values,
                },
            };
        }
        if (definition.outputShape === 'waveform') {
            const values = aggregateWaveform(
                vectorFrames.get(featureId) ?? [],
                factor,
            );
            return {
                schemaVersion: 1,
                trackHash: request.trackHash,
                configHash: request.config.configHash,
                featureId,
                startTimeSeconds: 0,
                sampleStepSeconds,
                sampleCount: values.min.length,
                dimensions,
                payload: {
                    kind: 'waveform-envelope',
                    min: values.min,
                    max: values.max,
                    scale: values.scale,
                },
            };
        }
        if (definition.outputShape === 'loudness-structure') {
            const total = aggregateScalars(
                loudnessFrames.map((frame) => frame.total),
                factor,
            );
            const specificValues = aggregateVectors(
                loudnessFrames.map((frame) => frame.specific),
                factor,
                24,
            );
            let maximumSpecific = 0;
            for (const value of specificValues) {
                maximumSpecific = Math.max(maximumSpecific, value);
            }
            const specific = quantizeToUint16(specificValues, {
                min: 0,
                max: maximumSpecific,
            });
            return {
                schemaVersion: 1,
                trackHash: request.trackHash,
                configHash: request.config.configHash,
                featureId,
                startTimeSeconds: 0,
                sampleStepSeconds,
                sampleCount: total.length,
                dimensions,
                payload: {
                    kind: 'loudness',
                    total,
                    specific: specific.values,
                    bands: 24,
                    scale: specific.scale,
                    offset: specific.offset,
                },
            };
        }
        if (definition.outputShape === 'complex-spectrum') {
            const bins = dimensions[0] ?? 0;
            const values = aggregateComplex(complexFrames, factor, bins);
            return {
                schemaVersion: 1,
                trackHash: request.trackHash,
                configHash: request.config.configHash,
                featureId,
                startTimeSeconds: 0,
                sampleStepSeconds,
                sampleCount: values.magnitude.length / bins,
                dimensions,
                payload: {
                    kind: 'complex-derived',
                    magnitude: values.magnitude,
                    phase: values.phase,
                    bins,
                    magnitudeScale: values.magnitudeScale,
                },
            };
        }
        const width = dimensions[0] ?? 0;
        const values = aggregateVectors(
            vectorFrames.get(featureId) ?? [],
            factor,
            width,
        );
        const quantized = quantizeToUint16(values);
        return {
            schemaVersion: 1,
            trackHash: request.trackHash,
            configHash: request.config.configHash,
            featureId,
            startTimeSeconds: 0,
            sampleStepSeconds,
            sampleCount: values.length / width,
            dimensions,
            payload: {
                kind: featureId === 'chroma' || featureId === 'mfcc'
                    ? 'category-u16'
                    : 'frequency-u16',
                values: quantized.values,
                width,
                scale: quantized.scale,
                offset: quantized.offset,
            },
        };
    });
};
