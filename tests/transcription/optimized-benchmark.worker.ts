import { transcribeDrumReader } from '../../src/transcription/drumTranscription';
import { drumConfigurationHash } from '../../src/transcription/drumOptions';
import { hashBytes } from '../../src/processing/sha256';

self.onmessage = event => {
    void (async () => {
        const pcm = event.data.pcm as Float32Array;
        const reader = {
            sampleRate: 44100,
            frames: pcm.length,
            channels: 1,
            async read(_channel: number, start: number, length: number) {
                return pcm.slice(start, start + length);
            },
        };
        let last = 0;
        const progress = (phase: string, done: number, total: number | null) => {
            const now = performance.now();
            if (!phase.includes('windows') && now - last < 500 && done !== total) return;
            last = now;
            self.postMessage({ type: 'progress', phase, done, total });
        };
        const result = await transcribeDrumReader(
            reader,
            pcm.length / 44100,
            'webgpu',
            new AbortController().signal,
            progress,
            '/transcription-models',
        );
        self.postMessage({
            type: 'result',
            result: {
                ...result,
                sourceMonoHash: hashBytes(new Uint8Array(pcm.buffer)),
                configHash: drumConfigurationHash('webgpu'),
            },
        });
    })().catch(error => self.postMessage({ type: 'error', message: String(error), stack: error.stack }));
};
