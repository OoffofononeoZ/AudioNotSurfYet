import { DrumBatchModel } from '../../src/transcription/drumBatchModel';
import { DrumModel } from '../../src/transcription/drumModel';
import { openTranscriptionRuntime } from '../../src/transcription/modelSession';
import { drumQualityClip } from './qualityFixtures';

self.onmessage = () => {
    void (async () => {
        const abort = new AbortController(),
            signal = abort.signal;
        const progress = (phase: string, done: number, total: number | null) =>
            self.postMessage({ type: 'progress', phase, done, total });
        const pcm = drumQualityClip().pcm.slice(0, 61440);
        const gpu = await DrumBatchModel.create('webgpu', signal, progress, '/transcription-models');
        let rows, limited;
        try {
            rows = await gpu.inferBatch(
                [0, 2.56, 5.12].map(inputStartSeconds => ({ pcm, inputStartSeconds })),
                8,
                signal,
                progress,
            );
            limited = await gpu.inferBatch([{ pcm, inputStartSeconds: 0 }], 8, signal, progress, 4);
        } finally {
            await gpu.dispose();
        }
        const referenceRuntime = await openTranscriptionRuntime('wasm', signal);
        const reference = await DrumModel.create(referenceRuntime.ort, signal, progress, '/transcription-models');
        let cpu;
        try {
            cpu = await reference.infer(pcm, 0, 8, signal, progress);
        } finally {
            await reference.dispose();
        }
        const wasm = await DrumBatchModel.create('wasm', signal, progress, '/transcription-models');
        let wasmRows;
        try {
            wasmRows = await wasm.inferBatch(
                [0, 2.56, 5.12].map(inputStartSeconds => ({ pcm, inputStartSeconds })),
                8,
                signal,
                progress,
            );
        } finally {
            await wasm.dispose();
        }
        self.postMessage({
            type: 'result',
            result: {
                backend: gpu.backend,
                adapter: gpu.adapter,
                setupMs: gpu.setupMs,
                rows,
                limited,
                cpu,
                wasmBackend: wasm.backend,
                wasmRows,
            },
        });
    })().catch(error => self.postMessage({ type: 'error', message: String(error), stack: error.stack }));
};
