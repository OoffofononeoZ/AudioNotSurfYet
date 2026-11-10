import type { DrumWindowDiagnostic } from './drumDiagnostics';
import type { DrumBackend } from './drumRuntime';
import type { IncompleteDrumRange } from './drumTranscription';
import type { DrumSoundCategory } from './drumVocabulary';
import type { CandidateAcoustics } from './candidateAcoustics';
import type { LeadEvidence } from './leadPath';
export const TRANSCRIPTION_ROLES = ['drums', 'bass', 'vocals', 'piano', 'guitar', 'other'] as const;
export type TranscriptionRole = (typeof TRANSCRIPTION_ROLES)[number];
export type NoteInstrument = 'bass' | 'vocals' | 'piano' | 'guitar' | 'other' | 'unknown';
export type CandidateInstrument = 'drums' | NoteInstrument;
export type DrumCategory = DrumSoundCategory;
export interface TranscriptionIdentity {
    drumBackend: DrumBackend;
    drumConfigHash: string;
    analysisConfigHash: string;
    trackId: string;
    contentHash: string;
    pcmHash: string;
    ftResultId: string;
    durationSeconds: number;
    modelManifestHash: string;
    runtimeManifestHash: string;
    configHash: string;
    selectedRoles: TranscriptionRole[];
}
export interface CandidateSource {
    resultId: string;
    inputRole: TranscriptionRole;
    artifactId: string;
    model: 'adt-str' | 'basic-pitch';
}
interface CandidateBase {
    id: string;
    startSeconds: number;
    endSeconds: number;
    strength: number;
    deleted: boolean;
    source: CandidateSource;
    acoustics?: CandidateAcoustics;
}
export interface DrumCandidate extends CandidateBase {
    kind: 'drum';
    instrument: 'drums';
    drum: DrumCategory;
    customPitch: number;
}
export interface NoteCandidate extends CandidateBase {
    kind: 'note';
    instrument: NoteInstrument;
    pitch: number;
    onsetStrength?: number;
    inferredRole?: 'lead' | 'other';
    musicalRole?: 'lead' | 'other';
    roleEvidence?: LeadEvidence;
}
export type MarkerCandidate = DrumCandidate | NoteCandidate;
export interface TranscriptionResult {
    version: 2;
    id: string;
    createdAt: string;
    identity: TranscriptionIdentity;
    completedRoles: TranscriptionRole[];
    failures: Array<{ role: TranscriptionRole; code: string; message: string }>;
    truncatedDrumSegments: number[];
    drumDiagnostics?: DrumWindowDiagnostic[];
    incompleteDrumRanges?: IncompleteDrumRange[];
    drumAdapter?: unknown;
    candidates: MarkerCandidate[];
    auxiliaryDirectory: string | null;
    timings: Record<string, number>;
}
export type NoteThresholds = Partial<Record<NoteInstrument, number>>;
export const INSTRUMENT_LABELS: Record<CandidateInstrument, string> = {
    drums: '鼓',
    bass: '低音',
    vocals: '人声',
    piano: '钢琴',
    guitar: '吉他',
    other: '其他音色',
    unknown: '未知乐器',
};
