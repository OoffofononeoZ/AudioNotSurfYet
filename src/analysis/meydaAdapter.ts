import Meyda from 'meyda';
import { getFeatureDefinition } from './featureRegistry';
import {
    M8_SCALAR_FEATURE_IDS,
    type AnalysisConfig,
    type ExactFeatureValue,
    type FeatureId,
    type M6SupportedFeatureId,
    type M8FeatureId,
    type M9FeatureId,
} from './types';

interface MeydaComplexValue {
    real: number[];
    imag: number[];
}

interface MeydaLoudnessValue {
    total: number;
    specific: Float32Array;
}

export type MeydaValue =
    | number
    | number[]
    | Float32Array
    | MeydaComplexValue
    | MeydaLoudnessValue;

export type MeydaBatchResult = Partial<Record<FeatureId, MeydaValue>>;

interface MeydaRuntime {
    bufferSize: number;
    sampleRate: number;
    windowingFunction: 'hanning';
    numberOfMFCCCoefficients: number;
    extract(
        feature: readonly FeatureId[],
        signal: Float32Array,
        previousSignal?: Float32Array,
    ): MeydaBatchResult | null;
}

const runtime = Meyda as unknown as MeydaRuntime;

const configure = (config: AnalysisConfig): void => {
    runtime.bufferSize = config.frameSize;
    runtime.sampleRate = config.sampleRate;
    runtime.windowingFunction = config.windowingFunction;
    runtime.numberOfMFCCCoefficients = config.numberOfMFCCCoefficients;
};

const extractBatch = (
    featureIds: readonly FeatureId[],
    frame: Float32Array,
    config: AnalysisConfig,
): MeydaBatchResult => {
    configure(config);
    const result = runtime.extract(featureIds, frame);
    if (!result) throw new Error('Meyda returned no analysis result.');
    return result;
};

export const extractM6Features = (
    featureIds: readonly M6SupportedFeatureId[],
    frame: Float32Array,
    config: AnalysisConfig,
): MeydaBatchResult => extractBatch(featureIds, frame, config);

export const spectralFluxV1 = (
    currentSpectrum: readonly number[],
    previousSpectrum?: readonly number[],
): number => {
    if (!previousSpectrum) return 0;
    if (currentSpectrum.length !== previousSpectrum.length) {
        throw new Error('Spectral Flux spectra must have equal dimensions.');
    }
    let flux = 0;
    for (let index = 0; index < currentSpectrum.length; index += 1) {
        const current = currentSpectrum[index] ?? Number.NaN;
        const previous = previousSpectrum[index] ?? Number.NaN;
        if (!Number.isFinite(current) || !Number.isFinite(previous)) {
            throw new Error('Spectral Flux received a non-finite spectrum.');
        }
        flux += Math.max(0, current - previous);
    }
    return flux;
};

export const scalarMeydaValue = (
    result: MeydaBatchResult,
    featureId: FeatureId,
): number => {
    const value = result[featureId];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${featureId} returned an invalid scalar.`);
    }
    return value;
};

export const vectorMeydaValue = (
    result: MeydaBatchResult,
    featureId:
        | 'amplitudeSpectrum'
        | 'chroma'
        | 'powerSpectrum'
        | 'mfcc'
        | 'buffer',
    width: number,
): number[] => {
    const value = result[featureId];
    if (!(value instanceof Float32Array) && !Array.isArray(value)) {
        throw new Error(`${featureId} returned an invalid vector.`);
    }
    const output = Array.from(value);
    if (
        output.length !== width
        || output.some((entry) => !Number.isFinite(entry))
    ) {
        throw new Error(`${featureId} returned invalid dimensions.`);
    }
    return output;
};

export interface M8FrameExtraction {
    values: MeydaBatchResult;
    amplitudeSpectrum?: number[];
}

export type M9FrameExtraction = M8FrameExtraction;

const extractSupportedFrame = (
    featureIds: readonly M9FeatureId[],
    frame: Float32Array,
    config: AnalysisConfig,
    previousAmplitudeSpectrum?: readonly number[],
): M9FrameExtraction => {
    const requested = new Set<FeatureId>(featureIds);
    const needsFlux = requested.delete('spectralFlux');
    const needsZeroEnergyPolicy = featureIds.some((featureId) =>
        (M8_SCALAR_FEATURE_IDS as readonly FeatureId[]).includes(featureId));
    if (needsZeroEnergyPolicy) requested.add('energy');
    if (needsFlux) requested.add('amplitudeSpectrum');

    const result = extractBatch([...requested], frame, config);
    const energy = needsZeroEnergyPolicy
        ? scalarMeydaValue(result, 'energy')
        : null;
    const zeroEnergy = energy === 0;
    const amplitudeSpectrum = needsFlux
        ? vectorMeydaValue(
            result,
            'amplitudeSpectrum',
            config.frameSize / 2,
        )
        : undefined;

    for (const featureId of featureIds) {
        const definition = getFeatureDefinition(featureId);
        if (definition.outputShape === 'scalar') {
            if (zeroEnergy && definition.zeroEnergyValue === 0) {
                result[featureId] = 0;
                continue;
            }
            if (featureId === 'spectralFlux') {
                result[featureId] = spectralFluxV1(
                    amplitudeSpectrum ?? [],
                    previousAmplitudeSpectrum,
                );
            }
            scalarMeydaValue(result, featureId);
        } else if (
            definition.outputShape === 'frequency-vector'
            || definition.outputShape === 'category-vector'
            || definition.outputShape === 'waveform'
        ) {
            vectorMeydaValue(
                result,
                featureId as
                    | 'amplitudeSpectrum'
                    | 'chroma'
                    | 'powerSpectrum'
                    | 'mfcc'
                    | 'buffer',
                definition.dimensions(config)[0] ?? 0,
            );
        }
    }

    return { values: result, amplitudeSpectrum };
};

export const extractM8Frame = (
    featureIds: readonly M8FeatureId[],
    frame: Float32Array,
    config: AnalysisConfig,
    previousAmplitudeSpectrum?: readonly number[],
): M8FrameExtraction => extractSupportedFrame(
    featureIds,
    frame,
    config,
    previousAmplitudeSpectrum,
);

export const extractM9Frame = (
    featureIds: readonly M9FeatureId[],
    frame: Float32Array,
    config: AnalysisConfig,
    previousAmplitudeSpectrum?: readonly number[],
): M9FrameExtraction => extractSupportedFrame(
    featureIds,
    frame,
    config,
    previousAmplitudeSpectrum,
);

export const exactValueFromMeyda = (
    featureId: M6SupportedFeatureId,
    frame: Float32Array,
    config: AnalysisConfig,
): ExactFeatureValue => {
    const result = extractM6Features([featureId], frame, config);
    const value = result[featureId];
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error(`${featureId} returned a non-finite value.`);
        }
        return value;
    }
    if (value instanceof Float32Array || Array.isArray(value)) {
        const output = Array.from(value);
        if (output.some((entry) => !Number.isFinite(entry))) {
            throw new Error(`${featureId} returned a non-finite vector.`);
        }
        return output;
    }
    throw new Error(`${featureId} returned an unexpected value.`);
};

export const exactM8Value = (
    featureId: M8FeatureId,
    frame: Float32Array,
    config: AnalysisConfig,
    previousFrame?: Float32Array,
): ExactFeatureValue => {
    let previousAmplitudeSpectrum: number[] | undefined;
    if (featureId === 'spectralFlux' && previousFrame) {
        const previous = extractM6Features(
            ['amplitudeSpectrum'],
            previousFrame,
            config,
        );
        previousAmplitudeSpectrum = vectorMeydaValue(
            previous,
            'amplitudeSpectrum',
            config.frameSize / 2,
        );
    }
    const extracted = extractM8Frame(
        [featureId],
        frame,
        config,
        previousAmplitudeSpectrum,
    ).values;
    const value = extracted[featureId];
    if (typeof value === 'number') {
        return scalarMeydaValue(extracted, featureId);
    }
    if (value instanceof Float32Array || Array.isArray(value)) {
        const output = Array.from(value);
        if (output.some((entry) => !Number.isFinite(entry))) {
            throw new Error(`${featureId} returned a non-finite vector.`);
        }
        return output;
    }
    throw new Error(`${featureId} returned an unexpected value.`);
};

export const exactM9Value = (
    featureId: M9FeatureId,
    frame: Float32Array,
    config: AnalysisConfig,
    previousFrame?: Float32Array,
): ExactFeatureValue => {
    let previousAmplitudeSpectrum: number[] | undefined;
    if (featureId === 'spectralFlux' && previousFrame) {
        const previous = extractM6Features(
            ['amplitudeSpectrum'],
            previousFrame,
            config,
        );
        previousAmplitudeSpectrum = vectorMeydaValue(
            previous,
            'amplitudeSpectrum',
            config.frameSize / 2,
        );
    }
    const extracted = extractM9Frame(
        [featureId],
        frame,
        config,
        previousAmplitudeSpectrum,
    ).values;
    const value = extracted[featureId];
    if (typeof value === 'number') {
        return scalarMeydaValue(extracted, featureId);
    }
    if (value instanceof Float32Array || Array.isArray(value)) {
        return vectorMeydaValue(
            extracted,
            featureId as
                | 'amplitudeSpectrum'
                | 'chroma'
                | 'powerSpectrum'
                | 'mfcc'
                | 'buffer',
            getFeatureDefinition(featureId).dimensions(config)[0] ?? 0,
        );
    }
    throw new Error(`${featureId} returned an unexpected value.`);
};
