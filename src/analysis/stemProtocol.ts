import type { StemRole } from '../processing/modelManifest';
import type { AnalysisConfig, AnalysisSeries, AnalysisCursorValueResult, FeatureId } from './types';
import type { AnalysisWindowInput, AnalysisWindowSeries } from './windowTypes';

export interface StemPcmSource {
    role: StemRole;
    identity: string;
    trackHash: string;
    frames: number;
    config: AnalysisConfig;
    left: File;
    right: File;
}
export type StemWorkerRequest =
    | { kind: 'stem-analyze'; requestId: string; epoch: number; source: StemPcmSource; featureIds: FeatureId[] }
    | {
          kind: 'stem-read';
          requestId: string;
          epoch: number;
          role: StemRole;
          featureId: FeatureId;
          timeSeconds: number;
          window?: AnalysisWindowInput;
      }
    | { kind: 'stem-clear'; requestId: string; epoch: number };
export type StemWorkerResponse =
    | { kind: 'stem-progress'; requestId: string; epoch: number; role: StemRole; progress: number }
    | { kind: 'stem-result'; requestId: string; epoch: number; role: StemRole; series: AnalysisSeries[] }
    | {
          kind: 'stem-value';
          requestId: string;
          epoch: number;
          role: StemRole;
          value: AnalysisCursorValueResult | null;
          window: AnalysisWindowSeries | null;
      }
    | { kind: 'stem-error'; requestId: string; epoch: number; role: StemRole; message: string }
    | { kind: 'stem-cleared'; requestId: string; epoch: number };
