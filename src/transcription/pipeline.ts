import type { SeparationResult } from '../processing/kernel';
import type { ProcessingJob } from '../processing/workerProtocol';
import { checkCapacity, databaseGet } from '../processing/storage';
import { checkCancelled, ProcessingError } from '../processing/modelManifest';
import { createStemAuditionSource } from '../processing/stemAuditionSource';
import type { PcmReader } from '../processing/dsp';
import { transcribeDrumReader } from './drumTranscription';
import { transcribePitch } from './pitchModel';
import { openTranscriptionRuntime } from './modelSession';
import { separateAuxiliary } from './auxiliarySeparation';
import type { AuxiliaryResult } from './auxiliarySeparation';
import { transcriptionModel } from './modelManifest';
import type { TranscriptionModelId } from './modelManifest';
import { validateCandidates } from './candidates';
import type { NoteCandidate, TranscriptionIdentity, TranscriptionResult, TranscriptionRole } from './candidateTypes';
import type { TranscriptionBundle } from './workerProtocol';
import { buildAcousticIndex } from './acousticIndex';
import { candidateAcoustics, drumAcousticBand } from './candidateAcoustics';
import { ROLE_PITCH_OPTIONS } from './analysisOptions';
import { selectLeadPath } from './leadPath';

export type PipelineProgress = (phase: string, role: string | null, done: number, total: number | null) => void;

async function stemReader(
    directory: string,
    stem: { role: string; frames: number; sampleRate: number; left: string; right: string },
    trackId: string,
    signal: AbortSignal,
) {
    const lease = await createStemAuditionSource(
        {
            kind: stem.role === 'piano' || stem.role === 'guitar' ? 'auxiliary' : 'ft',
            directory,
            resultId: directory,
            trackId,
            label: stem.role,
            stems: [stem],
            mutedRoles: [],
        },
        signal,
    );
    const reader: PcmReader = {
        sampleRate: lease.sampleRate,
        frames: lease.frames,
        channels: 2,
        read: (channel, start, length) => lease.read(stem.role, channel as 0 | 1, start, length, signal),
    };
    return { reader, close: () => lease.close() };
}

export async function runTranscription(
    job: ProcessingJob,
    ft: SeparationResult,
    identity: TranscriptionIdentity,
    signal: AbortSignal,
    progress: PipelineProgress,
    cacheLimit: number,
    modelBase?: string,
): Promise<TranscriptionBundle> {
    checkCancelled(signal);
    const started = performance.now();
    const result: TranscriptionResult = {
        version: 2,
        id: job.jobId,
        createdAt: new Date().toISOString(),
        identity,
        completedRoles: [],
        failures: [],
        truncatedDrumSegments: [],
        drumDiagnostics: [],
        candidates: [],
        auxiliaryDirectory: null,
        timings: {},
    };
    const needsAuxiliary = identity.selectedRoles.some(role => role === 'piano' || role === 'guitar');
    const frames = Math.round(identity.durationSeconds * 44100);
    const capacity = async (ids: TranscriptionModelId[], additional = 0) => {
        let missingBytes = 0;
        for (const id of ids) {
            const model = transcriptionModel(id),
                cached = await databaseGet<Blob>('models', model.sha256);
            if (!(cached instanceof Blob) || cached.size !== model.bytes) missingBytes += model.bytes;
        }
        checkCancelled(signal);
        await checkCapacity(missingBytes + additional, cacheLimit);
    };
    let wasm: Awaited<ReturnType<typeof openTranscriptionRuntime>> | undefined;
    const runtime = async () => {
        wasm ??= await openTranscriptionRuntime('wasm', signal);
        return wasm;
    };
    const failed = (role: TranscriptionRole, error: unknown) => {
        checkCancelled(signal);
        result.failures.push({
            role,
            code: error instanceof ProcessingError ? error.code : 'inference-failed',
            message: error instanceof Error ? error.message : String(error),
        });
    };
    const source = (role: TranscriptionRole, artifactId: string, model: 'adt-str' | 'basic-pitch') => ({
        resultId: result.id,
        inputRole: role,
        artifactId,
        model,
    });
    const runDrums = async () => {
        if (!identity.selectedRoles.includes('drums')) return;
        const at = performance.now();
        let lease: Awaited<ReturnType<typeof stemReader>> | undefined;
        try {
            await capacity(['adt-encoder', 'adt-decoder']);
            const stem = ft.stems.find(stem => stem.role === 'drums');
            if (!stem) throw new ProcessingError('result-invalid', 'Missing FT drums.');
            lease = await stemReader(ft.source.directory, stem, identity.trackId, signal);
            const transcript = await transcribeDrumReader(
                lease.reader,
                identity.durationSeconds,
                identity.drumBackend,
                signal,
                (phase, done, total) => progress(phase, 'drums', done, total),
                modelBase,
            );
            result.drumDiagnostics = transcript.diagnostics;
            result.incompleteDrumRanges = transcript.incomplete;
            result.truncatedDrumSegments = transcript.incomplete.map(range => range.startSeconds);
            result.drumAdapter = transcript.adapter;
            result.timings.drumsSetupMs = transcript.setupMs;
            const acousticStart = performance.now();
            const acoustic = await buildAcousticIndex(lease.reader, signal, (phase, done, total) =>
                progress(phase, 'drums', done, total),
            );
            result.timings.drumsAcousticMs = performance.now() - acousticStart;
            for (const hit of transcript.hits)
                result.candidates.push({
                    id: `drums-${result.candidates.length}`,
                    kind: 'drum',
                    instrument: 'drums',
                    drum: hit.drum,
                    customPitch: hit.customPitch,
                    startSeconds: hit.startSeconds,
                    endSeconds: hit.startSeconds,
                    strength: hit.strength,
                    deleted: false,
                    source: source('drums', ft.source.directory, 'adt-str'),
                    acoustics: candidateAcoustics(
                        acoustic,
                        hit.startSeconds,
                        Math.min(acoustic.durationSeconds, hit.startSeconds + 0.12),
                        drumAcousticBand(hit.drum),
                    ),
                });
            result.completedRoles.push('drums');
        } catch (error) {
            // A failed role never publishes a partial song as a complete role.
            result.candidates = result.candidates.filter(candidate => candidate.source.inputRole !== 'drums');
            failed('drums', error);
        } finally {
            await lease?.close();
            result.timings.drumsMs = performance.now() - at;
        }
    };
    const pitched = async (
        role: 'bass' | 'vocals' | 'piano' | 'guitar' | 'other',
        directory: string,
        stem: { role: string; frames: number; sampleRate: number; left: string; right: string },
    ) => {
        const at = performance.now();
        let lease: Awaited<ReturnType<typeof stemReader>> | undefined;
        try {
            await capacity(['basic-pitch']);
            lease = await stemReader(directory, stem, identity.trackId, signal);
            const module = await runtime();
            const transcript = await transcribePitch(
                module.ort,
                lease.reader,
                signal,
                (phase, done, total) => progress(phase, role, done, total),
                modelBase,
                ROLE_PITCH_OPTIONS[role],
            );
            const acousticStart = performance.now();
            const acoustic = await buildAcousticIndex(lease.reader, signal, (phase, done, total) =>
                progress(phase, role, done, total),
            );
            result.timings[`${role}AcousticMs`] = performance.now() - acousticStart;
            for (const note of transcript.notes) {
                const candidate: NoteCandidate = {
                    id: `${role}-${result.candidates.length}`,
                    kind: 'note',
                    instrument: role,
                    pitch: note.pitch,
                    startSeconds: note.startSeconds,
                    endSeconds: Math.min(note.endSeconds, identity.durationSeconds),
                    strength: note.strength,
                    onsetStrength: note.onsetStrength,
                    deleted: false,
                    source: source(role, directory, 'basic-pitch'),
                    acoustics: candidateAcoustics(
                        acoustic,
                        note.startSeconds,
                        Math.min(note.endSeconds, acoustic.durationSeconds),
                    ),
                };
                if (candidate.startSeconds < candidate.endSeconds) result.candidates.push(candidate);
            }
            if (role === 'other') {
                const candidates = result.candidates.filter(
                    (candidate): candidate is NoteCandidate =>
                        candidate.kind === 'note' && candidate.source.inputRole === 'other',
                );
                const pathStart = performance.now();
                const path = await selectLeadPath(candidates, identity.durationSeconds, signal, (done, total) =>
                    progress('lead-path', role, done, total),
                );
                const selected = new Set(path.leadIds);
                for (const candidate of candidates) {
                    candidate.inferredRole = selected.has(candidate.id) ? 'lead' : 'other';
                    candidate.roleEvidence = path.evidence[candidate.id];
                }
                result.timings.otherLeadMs = performance.now() - pathStart;
                result.timings.otherLeadPrunedFrames = path.prunedFrames;
            }
            result.completedRoles.push(role);
            result.timings[`${role}InferenceMs`] = transcript.inferenceMs;
            result.timings[`${role}ActivationBytes`] = transcript.activationBytes;
        } catch (error) {
            result.candidates = result.candidates.filter(candidate => candidate.source.inputRole !== role);
            failed(role, error);
        } finally {
            await lease?.close();
            result.timings[`${role}Ms`] = performance.now() - at;
        }
    };
    for (const role of ['bass', 'vocals', 'other'] as const) {
        if (!identity.selectedRoles.includes(role)) continue;
        checkCancelled(signal);
        const stem = ft.stems.find(stem => stem.role === role);
        if (!stem) {
            failed(role, new ProcessingError('result-invalid', `Missing FT ${role}.`));
            continue;
        }
        await pitched(role, ft.source.directory, stem);
    }
    let auxiliary: AuxiliaryResult | null = null;
    if (needsAuxiliary) {
        const at = performance.now();
        try {
            await capacity(
                ['htdemucs-6s', 'basic-pitch'],
                frames * (32 + (ft.source.descriptor.sampleRate === 44100 ? 0 : 8)),
            );
            // The six-row session is released before Basic Pitch starts. Only
            // the guitar and piano PCM is retained, in this job's OPFS folder.
            auxiliary = await separateAuxiliary(
                ft.source,
                job.directory,
                signal,
                (phase, done, total) => progress(phase, 'piano/guitar', done, total),
                modelBase,
            );
            result.auxiliaryDirectory = auxiliary.directory;
        } catch (error) {
            for (const role of ['piano', 'guitar'] as const)
                if (identity.selectedRoles.includes(role)) failed(role, error);
        }
        result.timings.auxiliaryMs = performance.now() - at;
        if (auxiliary)
            for (const role of ['piano', 'guitar'] as const) {
                if (!identity.selectedRoles.includes(role)) continue;
                checkCancelled(signal);
                const stem = auxiliary.stems.find(stem => stem.role === role)!;
                await pitched(role, auxiliary.directory, stem);
            }
    }
    // Keep the existing auxiliary separation untouched. It initializes the GPU
    // first; drum sessions then reuse that adapter without reassigning ORT env.
    await runDrums();
    checkCancelled(signal);
    result.timings.totalMs = performance.now() - started;
    validateCandidates(result);
    return { result, auxiliary };
}
