import type { PcmReader } from '../processing/dsp';
import { checkCancelled } from '../processing/modelManifest';
import { MonoResampler } from './monoResampler';
import { DrumBatchModel } from './drumBatchModel';
import type { DrumBackend } from './drumRuntime';
import { DRUM_RUNTIME_CONFIG } from './drumRuntime';
import { DRUM_WINDOW_CONFIG, ownsDrumTime, primaryDrumWindows, retryDrumWindows } from './drumWindows';
import type { DrumWindow } from './drumWindows';
import type { FullDrumHit } from './drumVocabulary';
import type { DrumWindowDiagnostic } from './drumDiagnostics';
import type { TranscriptionProgress } from './modelSession';

export interface DrumAttemptDiagnostic extends DrumWindowDiagnostic {
    coverageStartSeconds: number;
    coverageEndSeconds: number;
    attempt: 0 | 1;
    batchSize: number;
}
export interface IncompleteDrumRange {
    startSeconds: number;
    endSeconds: number;
    reason: 'limit' | 'repeated-event';
}
export interface DrumTranscription {
    hits: FullDrumHit[];
    diagnostics: DrumAttemptDiagnostic[];
    incomplete: IncompleteDrumRange[];
    backend: DrumBackend;
    adapter: unknown;
    setupMs: number;
    totalMs: number;
}
type Model = Pick<DrumBatchModel, 'inferBatch' | 'dispose' | 'backend' | 'adapter' | 'setupMs'>;

export async function transcribeDrumReader(
    reader: PcmReader,
    durationSeconds: number,
    backend: DrumBackend,
    signal: AbortSignal,
    progress: TranscriptionProgress,
    modelBase?: string,
    create: typeof DrumBatchModel.create = DrumBatchModel.create,
): Promise<DrumTranscription> {
    const started = performance.now();
    const model: Model = await create(backend, signal, progress, modelBase);
    const resampler = new MonoResampler(reader.sampleRate, DRUM_WINDOW_CONFIG.sampleRate);
    const hits: FullDrumHit[] = [],
        diagnostics: DrumAttemptDiagnostic[] = [],
        incomplete: IncompleteDrumRange[] = [];
    try {
        const run = async (windows: DrumWindow[]): Promise<DrumWindow[]> => {
            const failed: DrumWindow[] = [];
            for (let start = 0; start < windows.length; start += DRUM_RUNTIME_CONFIG.batchSize) {
                checkCancelled(signal);
                const batch = windows.slice(start, start + DRUM_RUNTIME_CONFIG.batchSize),
                    inputs = [];
                for (const window of batch)
                    inputs.push({
                        inputStartSeconds: window.inputStartSample / DRUM_WINDOW_CONFIG.sampleRate,
                        pcm: await resampler.segment(
                            reader,
                            window.inputStartSample,
                            DRUM_WINDOW_CONFIG.inputSamples,
                            signal,
                        ),
                    });
                const outputs = await model.inferBatch(inputs, durationSeconds, signal, progress);
                checkCancelled(signal);
                for (let row = 0; row < batch.length; row++) {
                    const window = batch[row]!,
                        output = outputs[row]!;
                    const complete = output.diagnostic.termination === 'eos';
                    const retained = complete ? output.hits.filter(hit => ownsDrumTime(window, hit.startSeconds)) : [];
                    hits.push(...retained);
                    diagnostics.push({
                        ...output.diagnostic,
                        retainedCount: retained.length,
                        coverageStartSeconds: window.coverageStartSample / DRUM_WINDOW_CONFIG.sampleRate,
                        coverageEndSeconds: Math.min(
                            durationSeconds,
                            window.coverageEndSample / DRUM_WINDOW_CONFIG.sampleRate,
                        ),
                        attempt: window.attempt,
                        batchSize: batch.length,
                    });
                    if (!complete) {
                        if (!window.attempt) failed.push(window);
                        else
                            incomplete.push({
                                startSeconds: window.coverageStartSample / DRUM_WINDOW_CONFIG.sampleRate,
                                endSeconds: Math.min(
                                    durationSeconds,
                                    window.coverageEndSample / DRUM_WINDOW_CONFIG.sampleRate,
                                ),
                                reason: output.diagnostic.termination as IncompleteDrumRange['reason'],
                            });
                    }
                }
                progress(
                    windows[0]?.attempt ? 'drum-retry-windows' : 'drum-windows',
                    Math.min(start + batch.length, windows.length),
                    windows.length,
                );
            }
            return failed;
        };
        const failed = await run(primaryDrumWindows(durationSeconds));
        if (failed.length) await run(failed.flatMap(retryDrumWindows));
        checkCancelled(signal);
        return {
            hits: hits.sort((a, b) => a.startSeconds - b.startSeconds || a.drum.localeCompare(b.drum)),
            diagnostics,
            incomplete,
            backend: model.backend,
            adapter: model.adapter,
            setupMs: model.setupMs,
            totalMs: performance.now() - started,
        };
    } finally {
        await model.dispose();
    }
}
