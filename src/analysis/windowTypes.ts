import type { AnalysisSeries, ConfigHash, FeatureId } from './types';
import type { TrackHash } from '../types/session';

/** Runtime display data only. Never pass a window series to the durable cache codec. */
export interface AnalysisWindowSeries extends Omit<AnalysisSeries, 'startTimeSeconds'> {
    startTimeSeconds: number;
    endTimeSeconds: number;
}
export type RenderAnalysisSeries = AnalysisSeries | AnalysisWindowSeries;

export interface AnalysisWindowInput {
    featureId: FeatureId;
    startSeconds: number;
    endSeconds: number;
    /** Desired time bucket size; feature frames keep their native hop. */
    waveformBucketSamples: number;
}
export interface AnalysisWindowRequest extends AnalysisWindowInput {
    kind: 'window-series';
    requestId: string;
    generation: number;
    trackHash: TrackHash;
    configHash: ConfigHash;
}
export interface AnalysisWindowCancel {
    kind: 'cancel-window';
    requestId: string;
}
export interface AnalysisWindowResult {
    kind: 'window-series-result';
    requestId: string;
    generation: number;
    trackHash: TrackHash;
    configHash: ConfigHash;
    featureId: FeatureId;
    series: AnalysisWindowSeries | null;
}
