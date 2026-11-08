import type { OrtModule } from '../processing/runtime';
import { checkCancelled, ProcessingError } from '../processing/modelManifest';
import { DRUM_FRAMES, DRUM_MELS, drumLogMel } from './drumFeatures';
import { decodeDrumTokens } from './drumTokens';
import { openModelSession, type ModelSession, type TranscriptionProgress } from './modelSession';
import { TRANSCRIPTION_CONFIG } from './modelManifest';
import { drumFeatureHash, rawDrumEvents } from './drumDiagnostics';
import type { DrumWindowDiagnostic } from './drumDiagnostics';

const crossNames = Array.from({ length: 4 }, (_, layer) => [`cross_k${layer}`, `cross_v${layer}`]).flat();

export class DrumModel {
    private readonly ort: OrtModule;
    private readonly encoder: ModelSession;
    private readonly decoder: ModelSession;
    private constructor(ort: OrtModule, encoder: ModelSession, decoder: ModelSession) {
        this.ort = ort;
        this.encoder = encoder;
        this.decoder = decoder;
    }
    static async create(
        ort: OrtModule,
        signal: AbortSignal,
        progress: TranscriptionProgress,
        modelBase?: string,
    ): Promise<DrumModel> {
        const encoder = await openModelSession(ort, 'adt-encoder', signal, progress, modelBase);
        let decoder: ModelSession | undefined;
        try {
            decoder = await openModelSession(ort, 'adt-decoder', signal, progress, modelBase);
            if (
                encoder.inputNames.join(',') !== 'logmel' ||
                encoder.outputNames.join(',') !== crossNames.join(',') ||
                decoder.inputNames.join(',') !== ['tokens', ...crossNames].join(',') ||
                decoder.outputNames.join(',') !== 'logits'
            ) {
                throw new ProcessingError('model-incompatible', 'ADT_STR tensor names mismatch.');
            }
            return new DrumModel(ort, encoder, decoder);
        } catch (error) {
            await Promise.allSettled([encoder.release(), decoder?.release()]);
            throw error;
        }
    }
    async infer(
        pcm: Float32Array,
        offsetSeconds: number,
        durationSeconds: number,
        signal: AbortSignal,
        progress: TranscriptionProgress,
        maxTokens: number = TRANSCRIPTION_CONFIG.drums.maxTokens,
    ) {
        if (!Number.isSafeInteger(maxTokens) || maxTokens < 2 || maxTokens > 512) {
            throw new ProcessingError('invalid-request', 'Invalid ADT_STR decoding limit.');
        }
        checkCancelled(signal);
        const started = performance.now();
        progress('drum-preprocess', 0, 1);
        const features = drumLogMel(pcm);
        const preprocessMs = performance.now() - started;
        const featureHash = drumFeatureHash(features);
        checkCancelled(signal);
        const input = new this.ort.Tensor('float32', features, [1, DRUM_FRAMES, DRUM_MELS]);
        let cross: Awaited<ReturnType<ModelSession['run']>> | undefined;
        const tokens: number[] = [2];
        let encodeMs = 0,
            decodeMs = 0;
        try {
            progress('drum-encode', 0, 1);
            let at = performance.now();
            cross = await this.encoder.run({ logmel: input });
            encodeMs = performance.now() - at;
            checkCancelled(signal);
            for (const name of crossNames) {
                const tensor = cross[name];
                if (!tensor || tensor.type !== 'float32' || tensor.dims.join(',') !== '1,6,246,128') {
                    throw new ProcessingError('model-incompatible', 'ADT_STR encoder shape mismatch.');
                }
            }
            while (tokens.length < maxTokens) {
                checkCancelled(signal);
                progress('drum-decode', tokens.length - 1, maxTokens - 1);
                const prefix = new this.ort.Tensor(
                    'int64',
                    BigInt64Array.from(tokens, token => BigInt(token)),
                    [1, tokens.length],
                );
                let outputs: Awaited<ReturnType<ModelSession['run']>> | undefined;
                try {
                    // Re-evaluate the complete prefix: a KV cache changes the
                    // exported model's trained additive causal-mask behavior.
                    at = performance.now();
                    outputs = await this.decoder.run({ tokens: prefix, ...cross });
                    decodeMs += performance.now() - at;
                    checkCancelled(signal);
                    const logits = outputs.logits;
                    if (
                        !logits ||
                        logits.type !== 'float32' ||
                        logits.dims.join(',') !== '1,1400' ||
                        !(logits.data instanceof Float32Array) ||
                        logits.data.some(value => !Number.isFinite(value))
                    ) {
                        throw new ProcessingError('model-incompatible', 'ADT_STR decoder logits mismatch.');
                    }
                    let selected = 0;
                    for (let index = 1; index < logits.data.length; index++) {
                        if (logits.data[index]! > logits.data[selected]!) selected = index;
                    }
                    tokens.push(selected);
                    if (selected === 3) break;
                } finally {
                    prefix.dispose();
                    if (outputs) Object.values(outputs).forEach(tensor => tensor.dispose());
                }
            }
            const decoded = decodeDrumTokens(tokens, offsetSeconds, durationSeconds);
            const elapsedMs = performance.now() - started;
            const diagnostic: DrumWindowDiagnostic = {
                inputStartSeconds: offsetSeconds,
                featureHash,
                tokens: [...tokens],
                tokenCount: tokens.length,
                termination: tokens[tokens.length - 1] === 3 ? 'eos' : 'limit',
                events: rawDrumEvents(tokens, offsetSeconds),
                retainedCount: decoded.hits.length,
                ignoredCount: decoded.ignored,
                malformedCount: decoded.malformed,
                preprocessMs,
                encodeMs,
                decodeMs,
                totalMs: elapsedMs,
            };
            return { ...decoded, tokens, truncated: tokens[tokens.length - 1] !== 3, elapsedMs, diagnostic };
        } finally {
            input.dispose();
            if (cross) Object.values(cross).forEach(tensor => tensor.dispose());
        }
    }
    async dispose(): Promise<void> {
        await Promise.allSettled([this.encoder.release(), this.decoder.release()]);
    }
}
