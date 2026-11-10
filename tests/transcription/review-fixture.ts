import { ANALYSIS_CONFIG_HASH } from '../../src/transcription/analysisOptions';
import { drumConfigurationHash } from '../../src/transcription/drumOptions';
import type {
    NoteCandidate,
    DrumCandidate,
    NoteInstrument,
    TranscriptionResult,
} from '../../src/transcription/candidateTypes';
import type { CandidateAcoustics } from '../../src/transcription/candidateAcoustics';

export function evidence(start: number, end: number, rms = 0.5): CandidateAcoustics {
    return {
        rms,
        band: 'full',
        bandRms: rms,
        localContrast: 2,
        onset: 0.5,
        onsetSeconds: start,
        salience: 0.8,
        mfcc: [0, 1, ...Array(11).fill(0)],
        chroma: [1, ...Array(11).fill(0)],
        activity: [{ startSeconds: start, endSeconds: end }],
    };
}
export function noteCandidate(
    id: string,
    start: number,
    end: number,
    instrument: NoteInstrument = 'piano',
    pitch = 60,
): NoteCandidate {
    const inputRole = instrument === 'unknown' ? 'piano' : instrument;
    return {
        id,
        kind: 'note',
        instrument,
        pitch,
        startSeconds: start,
        endSeconds: end,
        strength: 0.8,
        onsetStrength: 0.8,
        deleted: false,
        source: {
            resultId: 'review-result',
            inputRole,
            artifactId: ['piano', 'guitar'].includes(inputRole) ? 'aux' : 'editor-source',
            model: 'basic-pitch',
        },
        acoustics: evidence(start, end),
    };
}
export function drumCandidate(id: string, start: number, customPitch = 36): DrumCandidate {
    return {
        id,
        kind: 'drum',
        instrument: 'drums',
        drum: 'kick',
        customPitch,
        startSeconds: start,
        endSeconds: start,
        strength: 0.8,
        deleted: false,
        source: { resultId: 'review-result', inputRole: 'drums', artifactId: 'editor-source', model: 'adt-str' },
        acoustics: evidence(start, start + 0.1),
    };
}
export function reviewResult(candidates: TranscriptionResult['candidates']): TranscriptionResult {
    return {
        version: 2,
        id: 'review-result',
        createdAt: '2026-11-10T00:00:00Z',
        identity: {
            trackId: 'song',
            contentHash: 'a'.repeat(64),
            pcmHash: 'b'.repeat(64),
            ftResultId: 'editor-source',
            durationSeconds: 30,
            modelManifestHash: 'c'.repeat(64),
            runtimeManifestHash: 'd'.repeat(64),
            configHash: 'e'.repeat(64),
            drumBackend: 'webgpu',
            drumConfigHash: drumConfigurationHash('webgpu'),
            analysisConfigHash: ANALYSIS_CONFIG_HASH,
            selectedRoles: ['drums', 'bass', 'vocals', 'piano', 'guitar'],
        },
        completedRoles: ['drums', 'bass', 'vocals', 'piano', 'guitar'],
        failures: [],
        truncatedDrumSegments: [],
        candidates,
        auxiliaryDirectory: 'aux',
        timings: {},
    };
}
