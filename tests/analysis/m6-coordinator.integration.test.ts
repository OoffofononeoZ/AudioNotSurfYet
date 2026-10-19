import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AnalysisCoordinator } from '../../src/analysis/analysisCoordinator';
import { encodeAnalysisSeries } from '../../src/analysis/compactCodec';
import { createAnalysisCacheKey, createAnalysisConfig } from '../../src/analysis/config';
import {
    AnalysisWorkerCoreError,
    extractTempoEstimate,
    runAnalysisJob,
    type RetainedAnalysisPcm,
} from '../../src/analysis/workerCore';
import type { AnalysisWorkerRequest, AnalysisWorkerResponse } from '../../src/analysis/types';
import type {
    PersistedCurrentInput,
    PersistedQueueInput,
    ReplaceCurrentAnalysisCacheInput,
    SessionRepositoryPort,
} from '../../src/persistence/sessionRepository';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type { DecodedAudioDescriptor, PlaybackSnapshot } from '../../src/types/audio';
import { createSine, SAMPLE_RATE } from '../support/audio-fixtures';

class FakeAnalysisEngine {
    readonly listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
    revision = 1;
    channels: Float32Array[];
    snapshot: PlaybackSnapshot;

    constructor(channels: Float32Array[]) {
        this.channels = channels;
        this.snapshot = {
            trackId: 'track-1',
            state: 'paused',
            currentTimeSeconds: 0,
            durationSeconds: channels[0]!.length / SAMPLE_RATE,
            volume: 1,

            playbackRate: 1,
        };
    }

    subscribe(listener: (snapshot: PlaybackSnapshot) => void) {
        this.listeners.add(listener);
        listener({ ...this.snapshot });
        return () => this.listeners.delete(listener);
    }

    getDecodedAudioDescriptor(): DecodedAudioDescriptor | null {
        if (!this.snapshot.trackId || this.snapshot.state === 'loading') {
            return null;
        }
        return {
            trackId: this.snapshot.trackId,
            revision: this.revision,
            sampleRate: SAMPLE_RATE,
            length: this.channels[0]!.length,
            channelCount: this.channels.length,
            durationSeconds: this.channels[0]!.length / SAMPLE_RATE,
        };
    }

    copyDecodedChannelRange(input: { revision: number; channel: number; start: number; length: number }) {
        if (input.revision !== this.revision) return null;
        return this.channels[input.channel]?.slice(input.start, input.start + input.length) ?? null;
    }

    emit(snapshot: PlaybackSnapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners) listener({ ...snapshot });
    }
}

class FakeRepository implements SessionRepositoryPort {
    cacheInputs: ReplaceCurrentAnalysisCacheInput[] = [];
    cacheError: Error | null = null;
    cacheResult: 'stored' | 'stale' = 'stored';

    async restore() {
        return null;
    }

    async saveQueue(_input: PersistedQueueInput) {}

    async replaceCurrent(_input: PersistedCurrentInput) {}

    async replaceCurrentAnalysisCache(input: ReplaceCurrentAnalysisCacheInput) {
        if (this.cacheError) throw this.cacheError;
        this.cacheInputs.push(input);
        return this.cacheResult;
    }

    async removeTrack() {}

    async clear() {}
}

class CoreWorker {
    onmessage: ((event: MessageEvent<AnalysisWorkerResponse>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    readonly analyzeRequests: Extract<AnalysisWorkerRequest, { kind: 'analyze' }>[] = [];
    readonly cancelled = new Set<string>();
    terminated = false;
    retained: RetainedAnalysisPcm | null = null;

    postMessage(request: AnalysisWorkerRequest) {
        if (request.kind === 'cancel') {
            this.cancelled.add(request.jobId);
            return;
        }
        if (request.kind === 'cursor-value') {
            return;
        }
        if (request.kind === 'tempo-estimate') {
            const result = this.retained ? extractTempoEstimate(this.retained, request) : null;
            if (result) {
                this.onmessage?.({ data: result } as MessageEvent<AnalysisWorkerResponse>);
            }
            return;
        }
        this.analyzeRequests.push(request);
        void runAnalysisJob(request, {
            isCancelled: () => this.cancelled.has(request.jobId),
            onProgress: (completedFrames, totalFrames) => {
                this.onmessage?.({
                    data: {
                        kind: 'progress',
                        jobId: request.jobId,
                        generation: request.generation,
                        completedFrames,
                        totalFrames,
                    },
                } as MessageEvent<AnalysisWorkerResponse>);
            },
            yieldControl: async () => undefined,
        })
            .then(({ result, retained }) => {
                this.retained = retained;
                this.onmessage?.({
                    data: result,
                } as MessageEvent<AnalysisWorkerResponse>);
            })
            .catch(error => {
                const known = error instanceof AnalysisWorkerCoreError;
                this.onmessage?.({
                    data: {
                        kind: 'error',
                        jobId: request.jobId,
                        generation: request.generation,
                        code: known ? error.code : 'worker-failed',
                        message: error instanceof Error ? error.message : 'failed',
                        recoverable: true,
                    },
                } as MessageEvent<AnalysisWorkerResponse>);
            });
    }

    terminate() {
        this.terminated = true;
    }
}

const setup = (
    options: {
        repository?: FakeRepository;
        worker?: CoreWorker;
        pcm?: Float32Array;
    } = {},
) => {
    const pcm = options.pcm ?? createSine(440, 4_096);
    const engine = new FakeAnalysisEngine([pcm]);
    const repository = options.repository ?? new FakeRepository();
    const worker = options.worker ?? new CoreWorker();
    const store = useAudioSessionStore();
    store.queue = [
        {
            id: 'track-1',
            name: 'fixture.wav',
            mimeType: 'audio/wav',
            byteSize: pcm.byteLength,
            lastModified: 1,
            metadata: { title: 'fixture' },
            trackHash: 'track-hash',
            restoreState: 'available',
        },
    ];
    store.currentTrackId = 'track-1';
    store.playback = { ...engine.snapshot };
    const workerFactory = vi.fn(() => worker);
    const coordinator = new AnalysisCoordinator(engine, repository, store, {
        workerFactory,
        copyYieldControl: async () => undefined,
        createJobId: (() => {
            let id = 0;
            return () => `id-${++id}`;
        })(),
        cursorTimeoutMs: 20,
    });
    return {
        coordinator,
        engine,
        repository,
        store,
        worker,
        workerFactory,
    };
};

beforeEach(() => {
    setActivePinia(createPinia());
});

describe('AnalysisCoordinator integration', () => {
    test('copies stereo only on a Wallpaper cache miss and restores exact cursors without PCM extraction', async () => {
        const harness = setup({ pcm: createSine(440, 48000) });
        harness.engine.channels = [createSine(440, 48000), createSine(4000, 48000)];
        await harness.coordinator.setActiveFeatures(['wallpaperEngineSpectrum', 'rms']);
        await vi.waitFor(() => expect(harness.coordinator.getSnapshot().cacheState).toBe('persisted'));
        expect(harness.worker.analyzeRequests[0]?.stereoPcm).toHaveLength(2);
        const exact = await harness.coordinator.requestCursorValue('wallpaperEngineSpectrum', 0.51);
        expect(exact?.value).toHaveLength(128);
        const series = harness.coordinator.getSeries('wallpaperEngineSpectrum')!;
        const cacheKey = createAnalysisCacheKey('track-hash', series.configHash, 'wallpaperEngineSpectrum');
        const restored = setup({ pcm: createSine(440, 48000) });
        restored.coordinator.setRestoredCache({
            manifest: {
                trackId: 'track-1',
                trackHash: 'track-hash',
                configHash: series.configHash,
                featureIds: ['wallpaperEngineSpectrum'],
                cacheKeys: [cacheKey],
            },
            payloads: [{ cacheKey, payload: encodeAnalysisSeries(series) }],
        });
        await restored.coordinator.setActiveFeatures(['wallpaperEngineSpectrum', 'energy']);
        await vi.waitFor(() => expect(restored.coordinator.getSnapshot().state).toBe('ready'));
        expect(restored.worker.analyzeRequests[0]?.featureIds).toEqual(['energy']);
        expect(restored.worker.analyzeRequests[0]?.stereoPcm).toBeUndefined();
        expect((await restored.coordinator.requestCursorValue('wallpaperEngineSpectrum', 0.51))?.value).toEqual(
            exact?.value,
        );
        await harness.coordinator.dispose();
        await restored.coordinator.dispose();
        expect(harness.worker.terminated && restored.worker.terminated).toBe(true);
    });
    test('keeps the default at zero features without creating a Worker', async () => {
        const harness = setup();
        await harness.coordinator.setActiveFeatures([]);
        expect(harness.coordinator.getSnapshot()).toMatchObject({
            state: 'idle',
            activeFeatureIds: [],
            readyFeatureIds: [],
        });
        expect(harness.workerFactory).not.toHaveBeenCalled();
        expect(harness.repository.cacheInputs).toHaveLength(0);
        await harness.coordinator.dispose();
    });

    test('runs four unique features, persists them, and keeps Pinia serializable', async () => {
        const harness = setup();
        await harness.coordinator.setActiveFeatures(['energy', 'zcr', 'spectralFlux', 'spectralFlatness']);
        await vi.waitFor(() => {
            expect(harness.coordinator.getSnapshot().state).toBe('ready');
            expect(harness.coordinator.getSnapshot().cacheState).toBe('persisted');
        });
        expect(harness.worker.analyzeRequests[0]?.featureIds).toEqual([
            'energy',
            'zcr',
            'spectralFlux',
            'spectralFlatness',
        ]);
        expect(harness.repository.cacheInputs[0]?.payloads).toHaveLength(4);
        expect(() => JSON.stringify(harness.store.$state)).not.toThrow();
        expect(JSON.stringify(harness.store.$state)).not.toContain('ArrayBuffer');
        expect(JSON.stringify(harness.store.$state)).not.toContain('Float32Array');
        await harness.coordinator.dispose();
        expect(harness.worker.terminated).toBe(true);
    });

    test('reuses a valid structured cache and sends only structured misses to the Worker', async () => {
        const config = await createAnalysisConfig(SAMPLE_RATE);
        const pcm = createSine(440, 4_096);
        const direct = await runAnalysisJob({
            kind: 'analyze',
            jobId: 'cache-seed',
            generation: 1,
            trackHash: 'track-hash',
            config,
            featureIds: ['loudness'],
            cursorFeatureIds: ['loudness'],
            pcm: pcm.buffer.slice(0) as ArrayBuffer,
            durationSeconds: pcm.length / SAMPLE_RATE,
        });
        const cachedSeries = direct.result.series[0]!;
        const cacheKey = createAnalysisCacheKey('track-hash', config.configHash, 'loudness');
        const harness = setup({ pcm });
        harness.coordinator.setRestoredCache({
            manifest: {
                trackId: 'track-1',
                trackHash: 'track-hash',
                configHash: config.configHash,
                featureIds: ['loudness'],
                cacheKeys: [cacheKey],
            },
            payloads: [
                {
                    cacheKey,
                    payload: encodeAnalysisSeries(cachedSeries),
                },
            ],
        });

        await harness.coordinator.setActiveFeatures(['loudness', 'complexSpectrum']);
        await vi.waitFor(() => {
            expect(harness.coordinator.getSnapshot().state).toBe('ready');
        });
        expect(harness.worker.analyzeRequests[0]?.featureIds).toEqual(['complexSpectrum']);
        expect(harness.coordinator.getSeries('loudness')).toEqual(cachedSeries);
        expect(harness.coordinator.getSnapshot().readyFeatureIds).toEqual(['loudness', 'complexSpectrum']);
        await harness.coordinator.dispose();
    });

    test('drops stale results after an active-feature generation change', async () => {
        const worker = new CoreWorker();
        const harness = setup({ worker });
        worker.postMessage = function postMessage(request: AnalysisWorkerRequest) {
            if (request.kind === 'analyze') {
                this.analyzeRequests.push(request);
            } else if (request.kind === 'cancel') {
                this.cancelled.add(request.jobId);
            }
        };
        await harness.coordinator.setActiveFeatures(['rms']);
        const staleRequest = worker.analyzeRequests[0]!;
        await harness.coordinator.setActiveFeatures(['energy']);
        const config = staleRequest.config;
        const staleOutput = await runAnalysisJob({
            ...staleRequest,
            pcm: createSine(440, 4_096).buffer as ArrayBuffer,
        });
        worker.onmessage?.({
            data: staleOutput.result,
        } as MessageEvent<AnalysisWorkerResponse>);
        expect(harness.coordinator.getSnapshot().staleMessageCount).toBeGreaterThan(0);
        expect(harness.coordinator.getSeries('rms')).toBeNull();
        expect(harness.coordinator.getSnapshot().configHash).toBe(config.configHash);
        await harness.coordinator.dispose();
    });

    test('keeps playback intact when cache persistence fails', async () => {
        const repository = new FakeRepository();
        repository.cacheError = new DOMException('quota', 'QuotaExceededError');
        const harness = setup({ repository });
        harness.store.playback.state = 'playing';
        await harness.coordinator.setActiveFeatures(['rms']);
        await vi.waitFor(() => {
            expect(harness.coordinator.getSnapshot().state).toBe('ready');
            expect(harness.coordinator.getSnapshot().cacheState).toBe('not-persisted');
        });
        expect(harness.store.playback.state).toBe('playing');
        expect(harness.coordinator.getSeries('rms')).not.toBeNull();
        await harness.coordinator.dispose();
    });

    test('rejects duplicate, five-item and unknown feature intent', async () => {
        const harness = setup();
        await expect(harness.coordinator.setActiveFeatures(['rms', 'rms'])).rejects.toMatchObject({
            code: 'invalid-active-features',
        });
        await expect(
            harness.coordinator.setActiveFeatures(['rms', 'energy', 'amplitudeSpectrum', 'chroma', 'powerSpectrum']),
        ).rejects.toMatchObject({
            code: 'invalid-active-features',
        });
        await expect(harness.coordinator.setActiveFeatures(['unknown-feature' as never])).rejects.toMatchObject({
            code: 'invalid-active-features',
        });
        await harness.coordinator.dispose();
    });

    test('serves tempo only to the current Editor consumer and drops stale leases', async () => {
        const pcm = createSine(440, SAMPLE_RATE * 2);
        const harness = setup({ pcm });
        const analyzer = harness.coordinator.acquireConsumer('analyzer');
        const editor = harness.coordinator.acquireConsumer('editor');
        await analyzer.setActiveFeatures(['rms']);
        expect(harness.coordinator.getSnapshot().activeFeatureIds).toEqual([]);
        await editor.setActiveFeatures(['buffer']);
        await vi.waitFor(() => {
            expect(harness.coordinator.getSnapshot().state).toBe('ready');
        });
        const result = await editor.requestTempoEstimate();
        expect(result).toMatchObject({
            kind: 'tempo-estimate-result',
            state: 'low-confidence',
            trackHash: 'track-hash',
        });
        const replacement = harness.coordinator.acquireConsumer('analyzer');
        expect(await editor.requestTempoEstimate()).toBeNull();
        replacement.release();
        await harness.coordinator.dispose();
    });
});
