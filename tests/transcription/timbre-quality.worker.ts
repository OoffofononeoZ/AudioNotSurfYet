import { stagePcm, removeJob } from '../../src/processing/storage';
import { separateAuxiliary } from '../../src/transcription/auxiliarySeparation';
import { createStemAuditionSource } from '../../src/processing/stemAuditionSource';
import { transcribePitch } from '../../src/transcription/pitchModel';
import { transcribeDrumReader } from '../../src/transcription/drumTranscription';
import { openTranscriptionRuntime } from '../../src/transcription/modelSession';
import { buildAcousticIndex } from '../../src/transcription/acousticIndex';
import { candidateAcoustics, drumAcousticBand } from '../../src/transcription/candidateAcoustics';
import { ANALYSIS_CONFIG_HASH, ROLE_PITCH_OPTIONS } from '../../src/transcription/analysisOptions';
import { drumConfigurationHash } from '../../src/transcription/drumOptions';
import { deriveCandidateReview } from '../../src/transcription/candidateReview';
import { defaultReviewSettings } from '../../src/transcription/reviewSettings';
import { TRANSCRIPTION_CONFIG_HASH, TRANSCRIPTION_MODEL_HASH } from '../../src/transcription/modelManifest';
import runtimeManifest from '../../src/processing/runtime-manifest.json';
import { hashBytes } from '../../src/processing/sha256';
import { validateCandidates } from '../../src/transcription/candidates';
import type { TranscriptionResult } from '../../src/transcription/candidateTypes';
import { instrumentClip, knownNotes, drumQualityClip } from './qualityFixtures';

const sourceId = `quality-${crypto.randomUUID()}`,
    auxId = `transcription-${crypto.randomUUID()}`;
function result(id: string, hash: string, durationSeconds: number, drums = false): TranscriptionResult {
    return {
        version: 2,
        id,
        createdAt: new Date().toISOString(),
        identity: {
            trackId: 'controlled-timbre-quality',
            contentHash: hash,
            pcmHash: hash,
            ftResultId: drums ? 'controlled-drums' : sourceId,
            durationSeconds,
            configHash: TRANSCRIPTION_CONFIG_HASH,
            modelManifestHash: TRANSCRIPTION_MODEL_HASH,
            runtimeManifestHash: hashBytes(new TextEncoder().encode(JSON.stringify(runtimeManifest))),
            analysisConfigHash: ANALYSIS_CONFIG_HASH,
            drumBackend: 'webgpu',
            drumConfigHash: drumConfigurationHash('webgpu'),
            selectedRoles: drums ? ['drums'] : ['piano', 'guitar'],
        },
        completedRoles: drums ? ['drums'] : ['piano', 'guitar'],
        failures: [],
        truncatedDrumSegments: [],
        auxiliaryDirectory: drums ? null : auxId,
        candidates: [],
        timings: {},
    };
}
self.onmessage = () => {
    void (async () => {
        const signal = new AbortController().signal,
            started = performance.now();
        const progress = (phase: string, done: number, total: number | null) =>
            self.postMessage({ type: 'progress', phase, done, total });
        const pcm = instrumentClip(),
            descriptor = {
                trackId: 'controlled-timbre-quality',
                revision: 1,
                sampleRate: 44100,
                length: pcm.length,
                channelCount: 1,
                durationSeconds: 14,
            };
        const source = await stagePcm(
            {
                getDecodedAudioDescriptor: () => descriptor,
                copyDecodedChannelRange: ({ start, length }) => pcm.slice(start, start + length),
            },
            sourceId,
            signal,
            () => {},
        );
        const auxiliary = await separateAuxiliary(source, auxId, signal, progress, '/transcription-models');
        const runtime = await openTranscriptionRuntime('wasm', signal),
            notes = result(auxId, hashBytes(new Uint8Array(pcm.buffer)), 14);
        for (const stem of auxiliary.stems) {
            const lease = await createStemAuditionSource(
                {
                    kind: 'auxiliary',
                    directory: auxId,
                    resultId: auxId,
                    trackId: descriptor.trackId,
                    label: stem.role,
                    stems: [stem],
                    mutedRoles: [],
                },
                signal,
            );
            try {
                const reader = {
                    sampleRate: 44100,
                    frames: stem.frames,
                    channels: 2,
                    read: (channel: number, start: number, length: number) =>
                        lease.read(stem.role, channel as 0 | 1, start, length, signal),
                };
                const transcript = await transcribePitch(
                    runtime.ort,
                    reader,
                    signal,
                    progress,
                    '/transcription-models',
                    ROLE_PITCH_OPTIONS[stem.role],
                );
                const acoustic = await buildAcousticIndex(reader, signal, progress);
                for (const note of transcript.notes)
                    notes.candidates.push({
                        ...note,
                        id: `${stem.role}-${notes.candidates.length}`,
                        kind: 'note',
                        instrument: stem.role,
                        deleted: false,
                        source: { resultId: auxId, inputRole: stem.role, artifactId: auxId, model: 'basic-pitch' },
                        acoustics: candidateAcoustics(acoustic, note.startSeconds, note.endSeconds),
                    });
            } finally {
                await lease.close();
            }
        }
        const drum = drumQualityClip(),
            reader = {
                sampleRate: 24000,
                frames: drum.pcm.length,
                channels: 1,
                read: async (_channel: number, start: number, length: number) => drum.pcm.slice(start, start + length),
            };
        const transcript = await transcribeDrumReader(reader, 8, 'webgpu', signal, progress, '/transcription-models');
        const acoustic = await buildAcousticIndex(reader, signal, progress),
            drums = result(`transcription-${crypto.randomUUID()}`, hashBytes(new Uint8Array(drum.pcm.buffer)), 8, true);
        drums.incompleteDrumRanges = transcript.incomplete;
        drums.drumDiagnostics = transcript.diagnostics;
        drums.truncatedDrumSegments = transcript.incomplete.map(range => range.startSeconds);
        for (const hit of transcript.hits)
            drums.candidates.push({
                ...hit,
                id: `drums-${drums.candidates.length}`,
                kind: 'drum',
                instrument: 'drums',
                endSeconds: hit.startSeconds,
                deleted: false,
                source: { resultId: drums.id, inputRole: 'drums', artifactId: 'controlled-drums', model: 'adt-str' },
                acoustics: candidateAcoustics(
                    acoustic,
                    hit.startSeconds,
                    Math.min(8, hit.startSeconds + 0.12),
                    drumAcousticBand(hit.drum),
                ),
            });
        validateCandidates(notes);
        validateCandidates(drums);
        const reviewed = (raw: TranscriptionResult) =>
            Object.fromEntries(
                (['conservative', 'balanced', 'sensitive'] as const).map(sensitivity => [
                    sensitivity,
                    deriveCandidateReview(raw, { ...defaultReviewSettings(), sensitivity }, {}),
                ]),
            );
        self.postMessage({
            type: 'result',
            result: {
                kind: 'controlled-synthetic-CC0',
                sourceHash: notes.identity.contentHash,
                drumHash: drums.identity.contentHash,
                knownNotes,
                expectedDrums: drum.expected,
                notes,
                drums,
                noteReviews: reviewed(notes),
                drumReviews: reviewed(drums),
                auxiliary,
                totalMs: performance.now() - started,
                qualityAccepted: false,
            },
        });
    })()
        .catch(error => self.postMessage({ type: 'error', message: String(error), stack: error.stack }))
        .finally(async () => {
            await removeJob(sourceId);
        });
};
