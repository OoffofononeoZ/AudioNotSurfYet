import { DrumBatchModel } from '../../src/transcription/drumBatchModel';
import { MonoResampler } from '../../src/transcription/monoResampler';
import { drumConfigurationHash } from '../../src/transcription/drumOptions';
self.onmessage = event => {
    void (async () => {
        const { pcm, starts } = event.data as { pcm: Float32Array; starts: number[] };
        const signal = new AbortController().signal,
            started = performance.now();
        const progress = (phase: string, done: number, total: number | null) =>
            self.postMessage({ type: 'progress', phase, done, total });
        const model = await DrumBatchModel.create('webgpu', signal, progress, '/transcription-models');
        const reader = {
            sampleRate: 44100,
            frames: pcm.length,
            channels: 1,
            read: async (_channel: number, start: number, count: number) => pcm.slice(start, start + count),
        };
        const resampler = new MonoResampler(44100, 24000),
            windows = [];
        try {
            for (let start = 0; start < starts.length; start += 8) {
                const inputs = [];
                for (const inputStartSeconds of starts.slice(start, start + 8))
                    inputs.push({
                        inputStartSeconds,
                        pcm: await resampler.segment(reader, Math.round(inputStartSeconds * 24000), 61440, signal),
                    });
                windows.push(...(await model.inferBatch(inputs, pcm.length / 44100, signal, progress)));
            }
        } finally {
            await model.dispose();
        }
        self.postMessage({
            type: 'result',
            result: {
                windows,
                totalMs: performance.now() - started,
                setupMs: model.setupMs,
                adapter: model.adapter,
                configHash: drumConfigurationHash('webgpu'),
            },
        });
    })().catch(error => self.postMessage({ type: 'error', message: String(error), stack: error.stack }));
};
