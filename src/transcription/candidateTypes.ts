export const TRANSCRIPTION_ROLES = ['drums','bass','vocals','piano','guitar'] as const;
export type TranscriptionRole = typeof TRANSCRIPTION_ROLES[number];
export type NoteInstrument = 'bass'|'vocals'|'piano'|'guitar'|'unknown';
export type CandidateInstrument = 'drums'|NoteInstrument;
export type DrumCategory = 'kick'|'snare'|'hat';
export interface TranscriptionIdentity {
    trackId:string;contentHash:string;pcmHash:string;ftResultId:string;durationSeconds:number;
    modelManifestHash:string;runtimeManifestHash:string;configHash:string;
    selectedRoles:TranscriptionRole[];
}
export interface CandidateSource {
    resultId:string;inputRole:TranscriptionRole;artifactId:string;
    model:'adt-str'|'basic-pitch';
}
interface CandidateBase {
    id:string;startSeconds:number;endSeconds:number;strength:number;
    deleted:boolean;source:CandidateSource;
}
export interface DrumCandidate extends CandidateBase {
    kind:'drum';instrument:'drums';drum:DrumCategory;customPitch:number;
}
export interface NoteCandidate extends CandidateBase {
    kind:'note';instrument:NoteInstrument;pitch:number;
}
export type MarkerCandidate = DrumCandidate|NoteCandidate;
export interface TranscriptionResult {
    version:1;id:string;createdAt:string;identity:TranscriptionIdentity;
    completedRoles:TranscriptionRole[];
    failures:Array<{role:TranscriptionRole;code:string;message:string}>;
    truncatedDrumSegments:number[];
    candidates:MarkerCandidate[];
    auxiliaryDirectory:string|null;
    timings:Record<string,number>;
}
export type NoteThresholds = Partial<Record<NoteInstrument,number>>;
export const INSTRUMENT_LABELS:Record<CandidateInstrument,string> = {
    drums:'鼓',bass:'低音',vocals:'人声',piano:'钢琴',guitar:'吉他',unknown:'未知乐器',
};
