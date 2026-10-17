import { expect, test, vi } from 'vitest';
import { VisualizerExportSession } from '../../src/visualizer/visualizerExportSession';
import { createComposition } from '../../src/visualizer/compositionCodec';
import type { AudioSessionService } from '../../src/audio/audioSessionService';
import type { OfflineExportOptions } from '../../src/visualizer/offlineExport';
import type { VisualizerExportState } from '../../src/visualizer/exportTypes';

function harness(run?: (options: OfflineExportOptions) => Promise<File>) {
    const project = createComposition({ contentHash: 'a'.repeat(64), fileName: 'export.wav', durationSeconds: 3, sampleRate: 48000 });
    const descriptor = { trackId: 'song', revision: 1, length: 144000, sampleRate: 48000, channelCount: 2, durationSeconds: 3 };
    const source = { getDecodedAudioDescriptor: () => descriptor, copyDecodedChannelRange: () => null };
    const pause = vi.fn(), release = vi.fn(), restore = vi.fn(async () => {});
    const artifact = { writable: {} as FileSystemWritableFileStream, file: vi.fn(), discard: vi.fn(async () => {}) };
    const file = new File(['encoded'], 'output.webm', { type: 'video/webm' });
    const surface = { canvas: {} as HTMLCanvasElement, width: 1280, height: 720, renderAtTime: vi.fn(), release: vi.fn() };
    const target = { getStatus: () => ({ state: 'ready' as const }), acquireExportSurface: vi.fn(() => surface) };
    const audio = { capturePlaybackCheckpoint: vi.fn(() => ({ trackId: 'song', state: 'paused', currentTimeSeconds: 1.5 })),
        acquireExportTransport: vi.fn(() => ({ pause, release })), restorePlaybackCheckpoint: restore } as unknown as AudioSessionService;
    const createArtifact = vi.fn(async () => artifact), prepareFrame = vi.fn(async () => {});
    const probe = vi.fn(async () => ({ available: true, codec: 'vp9' as const, reason: null }));
    const save = vi.fn(async (_name: string, _blob: Blob): Promise<'saved' | 'cancelled'> => 'saved');
    const states: VisualizerExportState[] = [];
    const session = new VisualizerExportSession({ audioSession: audio, source, videoGateway: { save },
        readContext: () => ({ state: 'ready', activeTrackId: 'song', project, configurationIssues: [],
            bindingRuntime: { bindingRevision: 1, activeFeatureIds: [], readyFeatureIds: [], analysisState: 'idle', analysisProgress: 0, editorSnapshotSource: 'none' } }),
        prepareFrame, resolveValues: () => [], onState: state => states.push(state),
        createArtifact, probeCapability: probe, runExport: run ?? (async options => {
            await options.prepareFrame(0, options.signal); options.renderFrame(0);
            options.onProgress(90, 90); options.onFinalizing(); return file;
        }) });
    session.attachTarget(target);
    return { session, project, source, descriptor, audio, target, surface, artifact, file, createArtifact, prepareFrame, probe, save, states, pause, release, restore };
}

test('offline session locks, renders explicit time, restores playback, and saves the disk-backed file', async () => {
    const h = harness(), task = h.session.start();
    expect(h.session.isLocked()).toBe(true);
    await task;
    expect(h.pause).toHaveBeenCalledOnce(); expect(h.release).toHaveBeenCalledOnce();
    expect(h.surface.renderAtTime).toHaveBeenCalledWith(0);
    expect(h.restore).toHaveBeenCalledWith({ trackId: 'song', state: 'paused', currentTimeSeconds: 1.5 });
    expect(h.session.getState().status).toBe('ready');
    expect(h.session.getReadyFileForDiagnostics()).toBe(h.file);
    h.save.mockResolvedValueOnce('cancelled'); await h.session.save();
    expect(h.session.hasUnresolvedOutput()).toBe(true); expect(h.artifact.discard).not.toHaveBeenCalled();
    await h.session.save(); expect(h.save.mock.calls[0]?.[1]).toBe(h.file);
    expect(h.artifact.discard).toHaveBeenCalledOnce(); expect(h.session.getState().status).toBe('idle');
});

test('unsupported capability fails before acquiring transport, surface or file', async () => {
    const h = harness(); h.probe.mockResolvedValue({ available: false, codec: null as unknown as 'vp9', reason: null });
    await h.session.start(); expect(h.session.getState()).toMatchObject({ status: 'error', code: 'export-unsupported' });
    expect(h.audio.acquireExportTransport).not.toHaveBeenCalled(); expect(h.createArtifact).not.toHaveBeenCalled();
    expect(h.target.acquireExportSurface).not.toHaveBeenCalled();
});

test.each(['cancel', 'identity', 'renderer'] as const)('%s stops work, cleans once and rejects late output', async reason => {
    let active!: OfflineExportOptions, finish!: (file: File) => void;
    const h = harness(async options => { active = options; return new Promise<File>(resolve => { finish = resolve; }); });
    const started = h.session.start(); await vi.waitFor(() => expect(active).toBeDefined());
    const stopping = reason === 'identity' ? h.session.notifyIdentityChange() : reason === 'renderer'
        ? (h.session.notifyRendererStatus({ state: 'recovering' }), h.session.cancel()) : h.session.cancel();
    expect(active.signal.aborted).toBe(true); finish(h.file); await stopping; await started;
    expect(h.artifact.discard).toHaveBeenCalledOnce(); expect(h.surface.release).toHaveBeenCalledOnce();
    expect(h.session.getReadyFileForDiagnostics()).toBeNull();
    if (reason === 'identity') expect(h.restore).not.toHaveBeenCalled();
});

test('quota and encoder failure free all leases and preserve a retryable error', async () => {
    const h = harness(async () => { throw new DOMException('quota exhausted', 'QuotaExceededError'); });
    await h.session.start(); expect(h.session.getState()).toMatchObject({ status: 'error', code: 'storage-full' });
    expect(h.artifact.discard).toHaveBeenCalledOnce(); expect(h.surface.release).toHaveBeenCalledOnce(); expect(h.release).toHaveBeenCalledOnce();
    h.session.resetError(); expect(h.session.getState().status).toBe('idle');
});

test('save failures retain output and concurrent save calls share one operation', async () => {
    const h = harness(); await h.session.start();
    h.save.mockRejectedValueOnce(Error('disk unavailable')); await expect(h.session.save()).rejects.toThrow('disk unavailable');
    expect(h.session.getReadyFileForDiagnostics()).toBe(h.file);
    const first = h.session.save(), second = h.session.save(); expect(first).toBe(second); await first;
    expect(h.save).toHaveBeenCalledTimes(2); expect(h.artifact.discard).toHaveBeenCalledOnce();
});
