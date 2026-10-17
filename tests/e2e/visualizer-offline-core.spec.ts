import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

test('offline core encodes both tracks to an owned OPFS artifact without live media', async ({ page }, info) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const load = (name: string) => import('/src/visualizer/' + name + '.ts');
        const { runOfflineExport } = await load('offlineExport');
        const { createExportArtifact } = await load('exportArtifact');
        const { getVisualizerExportPreset, probeVisualizerExport } = await load('exportPresets');
        const preset = getVisualizerExportPreset('720p', 30), capability = await probeVisualizerExport(preset);
        if (!capability.codec) throw Error(capability.reason!);
        const canvas = document.createElement('canvas'); canvas.width = preset.width; canvas.height = preset.height;
        const context = canvas.getContext('2d')!;
        const descriptor = { trackId: 'offline-core', revision: 1, length: 16800, sampleRate: 48000, channelCount: 1, durationSeconds: .35 };
        const source = { getDecodedAudioDescriptor: () => descriptor,
            copyDecodedChannelRange: ({ start, length }: { start: number; length: number }) => Float32Array.from({ length }, (_, i) => .2 * Math.sin((start + i) * Math.PI * 440 / 24000)) };
        const artifact = await createExportArtifact(), times: number[] = [];
        try {
            const file = await runOfflineExport({ source, descriptor, preset, codec: capability.codec, canvas, artifact,
                signal: new AbortController().signal, prepareFrame: async () => {}, renderFrame(time: number) {
                    times.push(time); context.fillStyle = time < .15 ? 'black' : 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
                }, onProgress() {}, onFinalizing() {} });
            const secondArtifact = await createExportArtifact(); await secondArtifact.discard();
            // Another job's stale cleanup must not remove this ready file.
            const bytes = new Uint8Array(await (await artifact.file()).arrayBuffer());
            let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
            return { size: file.size, frames: times, base64: btoa(binary) };
        } finally { await artifact.discard(); }
    });
    expect(result.size).toBeGreaterThan(1000);
    expect(result.frames).toEqual(Array.from({ length: 11 }, (_, i) => i / 30));
    await mkdir('artifacts/visualizer-composition/output', { recursive: true });
    await writeFile(`artifacts/visualizer-composition/output/offline-core-${info.project.name}.webm`, Buffer.from(result.base64, 'base64'));
});

test('offline core cancels pending work and propagates storage failure', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const load = (name: string) => import('/src/visualizer/' + name + '.ts');
        const { runOfflineExport } = await load('offlineExport');
        const { createExportArtifact } = await load('exportArtifact');
        const { getVisualizerExportPreset } = await load('exportPresets');
        const preset = getVisualizerExportPreset('720p', 30);
        const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
        const context = canvas.getContext('2d')!;
        const descriptor = { trackId: 'cancel', revision: 1, length: 240000, sampleRate: 48000, channelCount: 1, durationSeconds: 5 };
        const source = { getDecodedAudioDescriptor: () => descriptor, copyDecodedChannelRange: ({ length }: { length: number }) => new Float32Array(length) };
        const abort = new AbortController(), artifact = await createExportArtifact();
        const options = { source, descriptor, preset, codec: 'vp9', canvas, artifact, signal: abort.signal,
            prepareFrame: async () => {}, renderFrame() { context.fillRect(0, 0, 1280, 720); },
            onProgress(done: number) { if (done === 2) abort.abort(); }, onFinalizing() {} };
        let cancelName = '', storageName = '';
        try { await runOfflineExport(options); } catch (error) { cancelName = (error as Error).name; }
        finally { await artifact.discard(); }
        try {
            await runOfflineExport({ ...options, signal: new AbortController().signal, onProgress() {},
                artifact: { writable: new WritableStream({ write() { throw new DOMException('quota', 'QuotaExceededError'); } }), file: async () => new File([], 'invalid'), discard: async () => {} } });
        } catch (error) { storageName = (error as Error).name; }
        const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('visualizer-export');
        const names = []; for await (const name of (directory as any).keys()) names.push(name);
        return { cancelName, storageName, files: names.length };
    });
    expect(result).toEqual({ cancelName: 'AbortError', storageName: 'QuotaExceededError', files: 0 });
});
