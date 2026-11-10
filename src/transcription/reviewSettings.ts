import { ProcessingError } from '../processing/modelManifest';
import { INSTRUMENT_LABELS } from './candidateTypes';
import { DRUM_LABELS } from './drumVocabulary';
import type { CandidateInstrument, MarkerCandidate, TranscriptionResult } from './candidateTypes';

export type Sensitivity = 'conservative' | 'balanced' | 'sensitive';
export interface SoundGroupInfo {
    label: string;
    instrument: CandidateInstrument;
}
export interface ReviewSettings {
    version: 1;
    view: 'timbres' | 'notes';
    sensitivity: Sensitivity;
    groups: Record<string, SoundGroupInfo>;
    assignments: Record<string, string>;
    duplicateSelections: Record<string, string[]>;
}
export function defaultReviewSettings(): ReviewSettings {
    return {
        version: 1,
        view: 'timbres',
        sensitivity: 'conservative',
        groups: {},
        assignments: {},
        duplicateSelections: {},
    };
}
export function defaultSoundGroup(candidate: MarkerCandidate): SoundGroupInfo & { id: string } {
    return candidate.kind === 'drum'
        ? {
              id: `drum:${candidate.customPitch}`,
              instrument: 'drums',
              label: `${DRUM_LABELS[candidate.drum]} · 声音 ${candidate.customPitch}`,
          }
        : {
              id: `note:${candidate.instrument}`,
              instrument: candidate.instrument,
              label: `${INSTRUMENT_LABELS[candidate.instrument]}${['piano', 'guitar'].includes(candidate.instrument) ? '候选' : ''}`,
          };
}
export function soundGroup(candidate: MarkerCandidate, settings: ReviewSettings): SoundGroupInfo & { id: string } {
    const fallback = defaultSoundGroup(candidate);
    const assigned = settings.assignments[candidate.id];
    // Instrument corrections can legitimately change the candidate's family.
    const id = assigned && settings.groups[assigned]?.instrument === candidate.instrument ? assigned : fallback.id;
    return { ...fallback, ...settings.groups[id], id };
}
export function validateReviewSettings(settings: ReviewSettings, result: TranscriptionResult): void {
    const record = (value: unknown): value is Record<string, unknown> =>
        !!value && typeof value === 'object' && !Array.isArray(value);
    const ids = new Set(result.candidates.map(candidate => candidate.id));
    const groupId = /^(drum:\d{1,2}|note:(bass|vocals|piano|guitar|unknown|other|lead)|custom:[a-f0-9-]{36})$/;
    if (
        !settings ||
        settings.version !== 1 ||
        !['timbres', 'notes'].includes(settings.view) ||
        !['conservative', 'balanced', 'sensitive'].includes(settings.sensitivity) ||
        !record(settings.groups) ||
        !record(settings.assignments) ||
        !record(settings.duplicateSelections) ||
        Object.entries(settings.groups).some(
            ([id, group]) =>
                !groupId.test(id) ||
                !group ||
                !Object.prototype.hasOwnProperty.call(INSTRUMENT_LABELS, group.instrument) ||
                typeof group.label !== 'string' ||
                !group.label.trim() ||
                group.label.length > 80,
        ) ||
        Object.entries(settings.assignments).some(
            ([id, group]) =>
                !ids.has(id) || !groupId.test(group) || !Object.prototype.hasOwnProperty.call(settings.groups, group),
        ) ||
        Object.entries(settings.duplicateSelections).some(
            ([id, selected]) =>
                !/^duplicate-[a-f0-9]{16}$/.test(id) ||
                !Array.isArray(selected) ||
                new Set(selected).size !== selected.length ||
                selected.some(candidate => !ids.has(candidate)),
        )
    )
        throw new ProcessingError('result-invalid', '声音分组或复核设置无效。');
}
