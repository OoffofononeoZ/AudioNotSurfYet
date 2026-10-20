import type { ExactFeatureValue, FeatureId } from './types';

export interface RealtimeFeatureFrame {
    time: number;
    values: Partial<Record<FeatureId, ExactFeatureValue>>;
}
export interface RealtimeAnalysisStart {
    kind: 'realtime-start';
    sessionId: string;
    sampleRate: number;
    featureIds: FeatureId[];
    port: MessagePort;
}
export type RealtimeAnalysisRequest = RealtimeAnalysisStart | { kind: 'realtime-stop'; sessionId: string };
export type RealtimeAnalysisResponse =
    | { kind: 'realtime-frame'; sessionId: string; frame: RealtimeFeatureFrame }
    | { kind: 'realtime-error'; sessionId: string; message: string };
export interface RealtimeAnalysisLease {
    release(): void;
}
