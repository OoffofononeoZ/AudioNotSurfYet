import { createDrumSessions } from '../../src/transcription/drumRuntime';
import { DrumBatchModel } from '../../src/transcription/drumBatchModel';
import { ProcessingError } from '../../src/processing/modelManifest';
import { drumQualityClip } from './qualityFixtures';

self.onmessage = event => {
    void run(event.data.mode).catch(error => self.postMessage({ type: 'error', message: String(error) }));
};
async function run(mode: 'unavailable' | 'device-lost') {
    const signal = new AbortController().signal;
    if (mode === 'unavailable') {
        Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
        try {
            const sessions = await createDrumSessions('webgpu', signal, () => {}, '/transcription-models');
            await Promise.allSettled([sessions.encoder.release(), sessions.decoder.release()]);
            throw Error('Unexpected session despite missing GPU.');
        } catch (error) {
            if (!(error instanceof ProcessingError) || error.code !== 'webgpu-unavailable') throw error;
            self.postMessage({ type: 'result', mode, code: error.code, outputCount: 0, requestedBackend: 'webgpu' });
            return;
        }
    }
    const sessions = await createDrumSessions(
            'webgpu',
            signal,
            (phase, done, total) => self.postMessage({ type: 'progress', phase, done, total }),
            '/transcription-models',
        ),
        model = new DrumBatchModel(sessions),
        device = await sessions.ort.env.webgpu.device;
    let destroyed = false,
        outputCount = 0,
        caught: string | null = null;
    try {
        const output = await model.inferBatch(
            [{ pcm: drumQualityClip().pcm.slice(0, 61440), inputStartSeconds: 0 }],
            2.56,
            signal,
            phase => {
                if (phase === 'drum-decode' && !destroyed) {
                    destroyed = true;
                    device.destroy();
                }
            },
        );
        outputCount = output.length;
    } catch (error) {
        caught = String(error);
    } finally {
        await model.dispose();
    }
    const lost = destroyed
        ? await Promise.race([device.lost, new Promise<null>(resolve => setTimeout(() => resolve(null), 3000))])
        : null;
    self.postMessage({
        type: 'result',
        mode,
        backend: model.backend,
        destroyed,
        lostReason: lost?.reason ?? null,
        caught,
        outputCount,
        sessionsReleased: true,
    });
}
