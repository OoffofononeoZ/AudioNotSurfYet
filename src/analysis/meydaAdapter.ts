import Meyda from 'meyda';
import type {
    AnalysisConfig,
    ExactFeatureValue,
    FeatureId,
    M6SupportedFeatureId,
} from './types';

interface MeydaComplexValue {
    real: number[];
    imag: number[];
}

interface MeydaLoudnessValue {
    total: number;
    specific: Float32Array;
}

type MeydaValue =
    | number
    | number[]
    | Float32Array
    | MeydaComplexValue
    | MeydaLoudnessValue;

type MeydaBatchResult = Partial<Record<FeatureId, MeydaValue>>;

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
    runtime.numberOfMFCCCoefficients =
        config.numberOfMFCCCoefficients;
};

export const extractM6Features = (
    featureIds: readonly M6SupportedFeatureId[],
    frame: Float32Array,
    config: AnalysisConfig,
): MeydaBatchResult => {
    configure(config);
    const result = runtime.extract(featureIds, frame);
    if (!result) {
        throw new Error('Meyda returned no analysis result.');
    }
    return result;
};

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

export const scalarMeydaValue = (
    result: MeydaBatchResult,
    featureId: 'rms' | 'energy',
): number => {
    const value = result[featureId];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${featureId} returned an invalid scalar.`);
    }
    return value;
};

export const vectorMeydaValue = (
    result: MeydaBatchResult,
    featureId: 'amplitudeSpectrum' | 'chroma',
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
