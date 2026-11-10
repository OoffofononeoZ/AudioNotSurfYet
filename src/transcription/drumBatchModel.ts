import { checkCancelled, ProcessingError } from '../processing/modelManifest';
import { drumLogMel, DRUM_FRAMES, DRUM_MELS } from './drumFeatures';
import { drumFeatureHash, rawDrumEvents } from './drumDiagnostics';
import type { DrumWindowDiagnostic } from './drumDiagnostics';
import { classifyDrumSound } from './drumVocabulary';
import type { FullDrumHit } from './drumVocabulary';
import { createDrumSessions, DRUM_RUNTIME_CONFIG } from './drumRuntime';
import type { DrumBackend, DrumSessions } from './drumRuntime';
import type { ModelSession, TranscriptionProgress } from './modelSession';

const crossNames = Array.from({ length: 4 }, (_, i) => [`cross_k${i}`, `cross_v${i}`]).flat();
export interface DrumBatchInput {
    pcm: Float32Array;
    inputStartSeconds: number;
}
export interface DrumBatchOutput {
    hits: FullDrumHit[];
    diagnostic: DrumWindowDiagnostic;
}

export function repeatedDrumEvent(tokens: readonly number[]): boolean {
    if (tokens.length < 13 || (tokens.length - 1) % 3) return false;
    const last = tokens.slice(-3);
    if (last[0]! < 4 || last[0]! >= 260 || last[1]! < 300 || last[1]! >= 400 || last[2]! < 400 || last[2]! > 527)
        return false;
    return tokens.slice(-12).every((token, index) => token === last[index % 3]);
}

export class DrumBatchModel {
    private readonly sessions: DrumSessions;
    readonly backend: DrumBackend;
    readonly adapter: unknown;
    readonly setupMs: number;
    constructor(sessions: DrumSessions) {
        this.sessions = sessions;
        this.backend = sessions.backend;
        this.adapter = sessions.adapter;
        this.setupMs = sessions.setupMs;
        if (
            sessions.encoder.inputNames.join(',') !== 'logmel' ||
            sessions.encoder.outputNames.join(',') !== crossNames.join(',') ||
            sessions.decoder.inputNames.join(',') !== ['tokens', ...crossNames].join(',') ||
            sessions.decoder.outputNames.join(',') !== 'logits'
        )
            throw new ProcessingError('model-incompatible', 'ADT batch tensor names mismatch.');
    }

    static async create(
        backend: DrumBackend,
        signal: AbortSignal,
        progress: TranscriptionProgress,
        modelBase?: string,
    ) {
        const sessions = await createDrumSessions(backend, signal, progress, modelBase);
        try {
            return new DrumBatchModel(sessions);
        } catch (error) {
            if (sessions.gpuGuard)
                await sessions.gpuGuard.release([() => sessions.encoder.release(), () => sessions.decoder.release()]);
            else await Promise.allSettled([sessions.encoder.release(), sessions.decoder.release()]);
            throw error;
        }
    }

    async inferBatch(
        inputs: readonly DrumBatchInput[],
        durationSeconds: number,
        signal: AbortSignal,
        progress: TranscriptionProgress,
        maxTokens: number = DRUM_RUNTIME_CONFIG.maximumTokens,
    ): Promise<DrumBatchOutput[]> {
        if (
            !inputs.length ||
            inputs.length > DRUM_RUNTIME_CONFIG.batchSize ||
            !Number.isSafeInteger(maxTokens) ||
            maxTokens < 2 ||
            maxTokens > 512 ||
            !Number.isFinite(durationSeconds) ||
            durationSeconds <= 0 ||
            inputs.some(input => !Number.isFinite(input.inputStartSeconds))
        )
            throw new ProcessingError('invalid-request', 'Invalid ADT batch.');
        checkCancelled(signal);
        const started = performance.now(),
            batch = inputs.length;
        const features = new Float32Array(batch * DRUM_FRAMES * DRUM_MELS),
            hashes: string[] = [],
            preprocessMs: number[] = [];
        for (let row = 0; row < batch; row++) {
            const at = performance.now(),
                feature = drumLogMel(inputs[row]!.pcm);
            features.set(feature, row * feature.length);
            hashes.push(drumFeatureHash(feature));
            preprocessMs.push(performance.now() - at);
            checkCancelled(signal);
        }
        const input = new this.sessions.ort.Tensor('float32', features, [batch, DRUM_FRAMES, DRUM_MELS]);
        const sequences = inputs.map(() => [2]),
            lengths = inputs.map(() => 0);
        const reasons: DrumWindowDiagnostic['termination'][] = inputs.map(() => 'limit');
        let cross: Awaited<ReturnType<ModelSession['run']>> | undefined,
            encodeMs = 0,
            decodeMs = 0;
        try {
            progress('drum-encode', 0, batch);
            let at = performance.now();
            cross = await this.run(() => this.sessions.encoder.run({ logmel: input }));
            encodeMs = performance.now() - at;
            checkCancelled(signal);
            for (const name of crossNames)
                if (cross[name]?.type !== 'float32' || cross[name]!.dims.join(',') !== `${batch},6,246,128`) {
                    throw new ProcessingError('model-incompatible', 'ADT batch encoder shape mismatch.');
                }
            for (let step = 1; step < maxTokens; step++) {
                checkCancelled(signal);
                progress('drum-decode', step, maxTokens - 1);
                const length = sequences[0]!.length,
                    values = new BigInt64Array(batch * length);
                for (let row = 0; row < batch; row++)
                    for (let column = 0; column < length; column++)
                        values[row * length + column] = BigInt(sequences[row]![column]!);
                const prefix = new this.sessions.ort.Tensor('int64', values, [batch, length]);
                let outputs: Awaited<ReturnType<ModelSession['run']>> | undefined;
                try {
                    at = performance.now();
                    outputs = await this.run(() => this.sessions.decoder.run({ tokens: prefix, ...cross }));
                    decodeMs += performance.now() - at;
                    checkCancelled(signal);
                    const logits = outputs.logits;
                    if (
                        !logits ||
                        logits.type !== 'float32' ||
                        logits.dims.join(',') !== `${batch},1400` ||
                        !(logits.data instanceof Float32Array) ||
                        logits.data.some(value => !Number.isFinite(value))
                    )
                        throw new ProcessingError('model-incompatible', 'ADT batch decoder shape or values mismatch.');
                    for (let row = 0; row < batch; row++) {
                        if (lengths[row]) {
                            sequences[row]!.push(3);
                            continue;
                        }
                        let best = 0;
                        for (let token = 1; token < 1400; token++)
                            if (logits.data[row * 1400 + token]! > logits.data[row * 1400 + best]!) best = token;
                        sequences[row]!.push(best);
                        if (best === 3 || repeatedDrumEvent(sequences[row]!)) {
                            lengths[row] = sequences[row]!.length;
                            reasons[row] = best === 3 ? 'eos' : 'repeated-event';
                        }
                    }
                    if (lengths.every(Boolean)) break;
                } finally {
                    this.disposeTensors([prefix, ...Object.values(outputs ?? {})]);
                }
            }
            return inputs.map((request, row) => {
                const tokens = sequences[row]!.slice(0, lengths[row] || maxTokens),
                    events = rawDrumEvents(tokens, request.inputStartSeconds);
                const unique = new Map<string, FullDrumHit>();
                let ignored = 0;
                for (const event of events) {
                    const drum = classifyDrumSound(event.customPitch).category;
                    if (
                        event.timeSeconds < 0 ||
                        event.timeSeconds >= durationSeconds ||
                        event.timeSeconds - request.inputStartSeconds >= 2.56
                    ) {
                        ignored++;
                        continue;
                    }
                    const key = `${event.customPitch}:${Math.round(event.timeSeconds * 1e6)}`,
                        strength = event.velocity / 127;
                    const previous = unique.get(key);
                    if (!previous || strength > previous.strength)
                        unique.set(key, {
                            startSeconds: event.timeSeconds,
                            endSeconds: Math.min(durationSeconds, event.timeSeconds + 0.1),
                            drum,
                            customPitch: event.customPitch,
                            strength,
                        });
                }
                const hits = [...unique.values()].sort(
                    (a, b) => a.startSeconds - b.startSeconds || a.drum.localeCompare(b.drum),
                );
                return {
                    hits,
                    diagnostic: {
                        inputStartSeconds: request.inputStartSeconds,
                        featureHash: hashes[row]!,
                        tokens,
                        tokenCount: tokens.length,
                        termination: reasons[row]!,
                        events,
                        retainedCount: hits.length,
                        ignoredCount: ignored,
                        malformedCount: tokens.slice(1).filter(token => token !== 3).length - events.length * 3,
                        preprocessMs: preprocessMs[row]!,
                        encodeMs: encodeMs / batch,
                        decodeMs: decodeMs / batch,
                        totalMs: performance.now() - started,
                    },
                };
            });
        } finally {
            this.disposeTensors([input, ...Object.values(cross ?? {})]);
        }
    }

    private run<T>(operation: () => Promise<T>): Promise<T> {
        return this.sessions.gpuGuard ? this.sessions.gpuGuard.run(operation) : operation();
    }
    private disposeTensors(tensors: Array<{ dispose(): void }>): void {
        let failure: unknown;
        for (const tensor of tensors)
            try {
                tensor.dispose();
            } catch (error) {
                if (!this.sessions.gpuGuard?.hasLost) failure ??= error;
            }
        if (failure) throw failure;
    }

    async dispose(): Promise<void> {
        if (this.sessions.gpuGuard)
            await this.sessions.gpuGuard.release([
                () => this.sessions.encoder.release(),
                () => this.sessions.decoder.release(),
            ]);
        else await Promise.allSettled([this.sessions.encoder.release(), this.sessions.decoder.release()]);
    }
}
