import type { OrtModule } from '../processing/runtime';
import { initializeRuntime } from '../processing/runtime';
import { loadModel, verifyBlob } from '../processing/modelCache';
import runtimeManifest from '../processing/runtime-manifest.json';
import { checkCancelled, ProcessingError } from '../processing/modelManifest';
import { transcriptionModel } from './modelManifest';
import { expandQuantizedConstants, CONSTANT_EXPANSION_VERSION } from './onnxConstants';
import type { TranscriptionProgress, ModelSession } from './modelSession';

export type DrumBackend = 'webgpu' | 'wasm';
export const DRUM_RUNTIME_CONFIG = {
    version: 'adt-batched-runtime-v2-shared-adapter',
    graphOptimization: 'all',
    batchSize: 8,
    expansion: CONSTANT_EXPANSION_VERSION,
    decoder: 'full-prefix-greedy',
    maximumTokens: 512,
} as const;

export interface DrumSessions {
    ort: OrtModule;
    encoder: ModelSession;
    decoder: ModelSession;
    backend: DrumBackend;
    adapter: unknown;
    setupMs: number;
}

async function drumRuntime(backend: DrumBackend, signal: AbortSignal) {
    if (backend === 'wasm') return initializeRuntime(signal, true);
    // An auxiliary GPU session may already have initialized this locked module.
    // ORT makes env.webgpu.adapter read-only after initialization. Reuse that
    // actual adapter; do not change FT/auxiliary initialization or guess a device.
    for (const asset of runtimeManifest.assets.filter(
        asset => asset.file === 'ort.all.min.mjs' || asset.file.includes('jsep'),
    )) {
        const response = await fetch(`/processing-runtime/${asset.file}`, { signal });
        if (!response.ok) throw new ProcessingError('runtime-asset-mismatch', 'Drum runtime asset missing.');
        await verifyBlob(await response.blob(), asset.bytes, asset.sha256, signal);
    }
    checkCancelled(signal);
    const url = new URL('/processing-runtime/ort.all.min.mjs', location.origin).href;
    const ort = (await import(/* @vite-ignore */ url)) as OrtModule;
    const adapter = ort.env.webgpu.adapter;
    if (!adapter) return initializeRuntime(signal);
    if (adapter.info.isFallbackAdapter)
        throw new ProcessingError('webgpu-unavailable', 'A hardware WebGPU adapter is required.');
    const { vendor, architecture, device, description, isFallbackAdapter } = adapter.info;
    return { ort, adapter: { vendor, architecture, device, description, isFallbackAdapter } };
}

/** The FT runtime defaults and sessions are not modified by transcription. */
export async function createDrumSessions(
    backend: DrumBackend,
    signal: AbortSignal,
    progress: TranscriptionProgress,
    modelBase?: string,
): Promise<DrumSessions> {
    const started = performance.now();
    const runtime = await drumRuntime(backend, signal);
    const sessions: ModelSession[] = [];
    try {
        for (const id of ['adt-encoder', 'adt-decoder'] as const) {
            const artifact = transcriptionModel(id);
            const loaded = await loadModel(
                artifact,
                signal,
                progress,
                modelBase ? `${modelBase}/${artifact.file}` : artifact.url,
            );
            progress('drum-model-prepare', sessions.length, 2);
            const weights = backend === 'webgpu' ? await expandQuantizedConstants(loaded.bytes, signal) : loaded.bytes;
            checkCancelled(signal);
            const options: Parameters<OrtModule['InferenceSession']['create']>[1] = {
                executionProviders: [backend],
                graphOptimizationLevel: 'all',
                logSeverityLevel: 2,
                ...(backend === 'webgpu' && id === 'adt-encoder'
                    ? { preferredOutputLocation: 'gpu-buffer' as const }
                    : {}),
            };
            sessions.push(await runtime.ort.InferenceSession.create(weights, options));
            checkCancelled(signal);
        }
        return {
            ort: runtime.ort,
            encoder: sessions[0]!,
            decoder: sessions[1]!,
            backend,
            adapter: runtime.adapter,
            setupMs: performance.now() - started,
        };
    } catch (error) {
        await Promise.allSettled(sessions.map(session => session.release()));
        checkCancelled(signal);
        if (error instanceof ProcessingError) throw error;
        throw new ProcessingError(
            'model-incompatible',
            `ADT ${backend}: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}
