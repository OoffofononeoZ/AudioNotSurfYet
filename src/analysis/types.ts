import type { TrackHash } from '../types/session';

export const FEATURE_IDS = [
    'rms',
    'zcr',
    'energy',
    'amplitudeSpectrum',
    'powerSpectrum',
    'spectralCentroid',
    'spectralFlatness',
    'spectralFlux',
    'spectralSlope',
    'spectralRolloff',
    'spectralSpread',
    'spectralSkewness',
    'spectralKurtosis',
    'spectralCrest',
    'chroma',
    'loudness',
    'perceptualSpread',
    'perceptualSharpness',
    'mfcc',
    'complexSpectrum',
    'buffer',
] as const;

export type FeatureId = typeof FEATURE_IDS[number];
export type ConfigHash = string;

export const M6_SUPPORTED_FEATURE_IDS = [
    'rms',
    'energy',
    'amplitudeSpectrum',
    'chroma',
] as const satisfies readonly FeatureId[];

export type M6SupportedFeatureId =
    typeof M6_SUPPORTED_FEATURE_IDS[number];

export const M7_FEATURE_IDS = [
    'rms',
    'amplitudeSpectrum',
    'chroma',
] as const satisfies readonly FeatureId[];

export type M7FeatureId = typeof M7_FEATURE_IDS[number];

export const M8_SCALAR_FEATURE_IDS = [
    'zcr',
    'energy',
    'spectralCentroid',
    'spectralFlatness',
    'spectralFlux',
    'spectralSlope',
    'spectralRolloff',
    'spectralSpread',
    'spectralSkewness',
    'spectralKurtosis',
    'spectralCrest',
    'perceptualSpread',
    'perceptualSharpness',
] as const satisfies readonly FeatureId[];

export type M8ScalarFeatureId = typeof M8_SCALAR_FEATURE_IDS[number];

export const M8_AVAILABLE_FEATURE_IDS = [
    ...M7_FEATURE_IDS,
    ...M8_SCALAR_FEATURE_IDS,
] as const satisfies readonly FeatureId[];

export type M8FeatureId = typeof M8_AVAILABLE_FEATURE_IDS[number];

export interface AnalysisConfig {
    schemaVersion: 1;
    frameSize: 1024;
    hopSize: 512;
    windowingFunction: 'hanning';
    numberOfMFCCCoefficients: 13;
    channelMode: 'average-mono';
    sampleRate: number;
    configHash: ConfigHash;
}

export type FeatureShape =
    | 'scalar'
    | 'frequency-vector'
    | 'category-vector'
    | 'waveform'
    | 'loudness-structure'
    | 'complex-spectrum';

export type RendererId =
    | 'scalar-line'
    | 'frequency-heatmap'
    | 'chroma-heatmap'
    | 'waveform'
    | 'loudness'
    | 'complex-spectrum';

export type DeliveryMilestone = 'M6' | 'M7' | 'M8' | 'M9' | 'M10';

export interface FeatureDefinition<T extends FeatureId = FeatureId> {
    id: T;
    meydaKey: T;
    label: string;
    description: string;
    outputShape: FeatureShape;
    renderer: RendererId;
    range: {
        min?: number;
        max?: number;
        unit?: string;
        signed?: boolean;
    };
    dependencies: readonly FeatureId[];
    dimensions(config: AnalysisConfig): readonly number[];
    deliveryMilestone: DeliveryMilestone;
    workerSupported: boolean;
    extractionSource: 'meyda' | 'project-spectral-flux-v1';
    zeroEnergyValue?: 0;
}

export interface ScalarPayload {
    kind: 'scalar-f32';
    values: Float32Array;
}

export interface FrequencyPayload {
    kind: 'frequency-u16';
    values: Uint16Array;
    width: number;
    scale: number;
    offset: number;
}

export interface CategoryPayload {
    kind: 'category-u16';
    values: Uint16Array;
    width: number;
    scale: number;
    offset: number;
}

export interface WaveformPayload {
    kind: 'waveform-envelope';
    min: Int16Array;
    max: Int16Array;
    scale: number;
}

export interface LoudnessPayload {
    kind: 'loudness';
    total: Float32Array;
    specific: Uint16Array;
    bands: 24;
    scale: number;
    offset: number;
}

export interface ComplexPayload {
    kind: 'complex-derived';
    magnitude: Uint16Array;
    phase: Int16Array;
    bins: number;
    magnitudeScale: number;
}

export type CompactPayload =
    | ScalarPayload
    | FrequencyPayload
    | CategoryPayload
    | WaveformPayload
    | LoudnessPayload
    | ComplexPayload;

export interface AnalysisSeries {
    schemaVersion: 1;
    trackHash: TrackHash;
    configHash: ConfigHash;
    featureId: FeatureId;
    startTimeSeconds: 0;
    sampleStepSeconds: number;
    sampleCount: number;
    dimensions: readonly number[];
    payload: CompactPayload;
}

export type ExactFeatureValue =
    | number
    | number[]
    | { total: number; specific: number[] }
    | { real: number[]; imag: number[] };

export interface AnalysisJobRequest {
    kind: 'analyze';
    jobId: string;
    generation: number;
    trackHash: TrackHash;
    config: AnalysisConfig;
    featureIds: readonly FeatureId[];
    cursorFeatureIds: readonly FeatureId[];
    pcm: ArrayBuffer;
    durationSeconds: number;
}

export interface AnalysisJobCancel {
    kind: 'cancel';
    jobId: string;
    generation: number;
}

export interface AnalysisJobProgress {
    kind: 'progress';
    jobId: string;
    generation: number;
    completedFrames: number;
    totalFrames: number;
}

export interface AnalysisJobResult {
    kind: 'result';
    jobId: string;
    generation: number;
    trackHash: TrackHash;
    configHash: ConfigHash;
    series: AnalysisSeries[];
}

export type AnalysisErrorCode =
    | 'invalid-request'
    | 'invalid-active-features'
    | 'unsupported-feature'
    | 'extract-failed'
    | 'cancelled'
    | 'worker-failed'
    | 'audio-not-ready';

export interface AnalysisJobError {
    kind: 'error';
    jobId: string;
    generation: number;
    code: AnalysisErrorCode;
    message: string;
    recoverable: boolean;
}

export interface AnalysisCursorValueRequest {
    kind: 'cursor-value';
    requestId: string;
    generation: number;
    trackHash: TrackHash;
    config: AnalysisConfig;
    featureId: FeatureId;
    timeSeconds: number;
}

export interface AnalysisCursorValueResult {
    kind: 'cursor-value-result';
    requestId: string;
    generation: number;
    trackHash: TrackHash;
    configHash: ConfigHash;
    featureId: FeatureId;
    frameStartSeconds: number;
    value: ExactFeatureValue;
}

export type AnalysisWorkerRequest =
    | AnalysisJobRequest
    | AnalysisJobCancel
    | AnalysisCursorValueRequest;

export type AnalysisWorkerResponse =
    | AnalysisJobProgress
    | AnalysisJobResult
    | AnalysisJobError
    | AnalysisCursorValueResult;

export type AnalysisCacheState =
    | 'idle'
    | 'hit'
    | 'miss'
    | 'partial'
    | 'persisted'
    | 'not-persisted';

export type AnalysisCoordinatorState =
    | 'idle'
    | 'copying'
    | 'analyzing'
    | 'ready'
    | 'cancelled'
    | 'error'
    | 'disposed';

export interface AnalysisCoordinatorSnapshot {
    state: AnalysisCoordinatorState;
    generation: number;
    trackId: string | null;
    trackHash: TrackHash | null;
    configHash: ConfigHash | null;
    sampleRate: number | null;
    activeFeatureIds: FeatureId[];
    readyFeatureIds: FeatureId[];
    completedFrames: number;
    totalFrames: number;
    progress: number;
    cacheState: AnalysisCacheState;
    staleMessageCount: number;
    error?: {
        code: AnalysisErrorCode;
        message: string;
        recoverable: boolean;
    };
}

export type AnalysisListener =
    (snapshot: AnalysisCoordinatorSnapshot) => void;

export const isFeatureId = (value: unknown): value is FeatureId =>
    typeof value === 'string'
    && (FEATURE_IDS as readonly string[]).includes(value);

export const isM6SupportedFeatureId = (
    value: FeatureId,
): value is M6SupportedFeatureId =>
    (M6_SUPPORTED_FEATURE_IDS as readonly FeatureId[]).includes(value);

export const isM8FeatureId = (
    value: FeatureId,
): value is M8FeatureId =>
    (M8_AVAILABLE_FEATURE_IDS as readonly FeatureId[]).includes(value);
