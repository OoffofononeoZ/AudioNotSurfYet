import { DrumModel } from '../../src/transcription/drumModel';
import { openTranscriptionRuntime } from '../../src/transcription/modelSession';
import { drumLogMel } from '../../src/transcription/drumFeatures';
import { TRANSCRIPTION_CONFIG_HASH, TRANSCRIPTION_MODEL_HASH } from '../../src/transcription/modelManifest';
import { MonoResampler } from '../../src/transcription/monoResampler';

self.onmessage = event => {
    void (async () => {
        const { pcm, starts, maxTokens } = event.data as { pcm: Float32Array; starts: number[]; maxTokens: number };
        const abort = new AbortController(),
            signal = abort.signal,
            started = performance.now();
        const progress = (phase: string, done: number, total: number | null) =>
            self.postMessage({ type: 'progress', phase, done, total });
        const runtime = await openTranscriptionRuntime('wasm', signal);
        const model = await DrumModel.create(runtime.ort, signal, progress, '/transcription-models');
        const resampler = new MonoResampler(44100, 24000);
        const reader = {
            sampleRate: 44100,
            frames: pcm.length,
            channels: 1,
            async read(_channel: number, start: number, length: number) {
                return pcm.slice(start, start + length);
            },
        };
        const windows = [];
        try {
            for (const start of starts) {
                const at = performance.now();
                const chunk = await resampler.segment(reader, Math.round(start * 24000), 61440, signal);
                const readMs = performance.now() - at;
                const result = await model.infer(chunk, start, pcm.length / 44100, signal, progress, maxTokens);
                const window = { ...result, readMs, features: Array.from(drumLogMel(chunk)) };
                windows.push(window);
                self.postMessage({ type: 'window-result', index: windows.length - 1, start, window });
                self.postMessage({
                    type: 'progress',
                    phase: 'window-complete',
                    done: windows.length,
                    total: starts.length,
                });
            }
        } finally {
            await model.dispose();
        }
        self.postMessage({
            type: 'result',
            result: {
                version: 1,
                backend: 'wasm',
                sampleRate: 24000,
                durationSeconds: pcm.length / 44100,
                configHash: TRANSCRIPTION_CONFIG_HASH,
                modelManifestHash: TRANSCRIPTION_MODEL_HASH,
                starts,
                windows,
                totalMs: performance.now() - started,
            },
        });
    })().catch(error => self.postMessage({ type: 'error', message: String(error), stack: error.stack }));
};
