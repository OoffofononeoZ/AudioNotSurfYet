import type { InjectionKey } from 'vue';
import { inject, watch } from 'vue';
import type { ReplaceCurrentAnalysisCacheInput, SessionRepositoryPort } from '../persistence/sessionRepository';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type { DecodedAudioDescriptor, PlaybackSnapshot } from '../types/audio';
import type { StoredAnalysisCache } from '../types/session';
import { AnalysisFeatureCache } from './featureCache';
import { createAnalysisConfig } from './config';
import { copyDecodedAudioToMono, type DecodedAudioCopyPort, PcmCopyError } from './pcm';
import { AnalysisPcmSource } from './pcmSource';
import { wallpaperFrameIndex } from './wallpaperSpectrum';
import { AnalysisWindowRequests } from './windowRequests';
import type { AnalysisWindowInput, AnalysisWindowSeries } from './windowTypes';
import type { RealtimeAnalysisLease, RealtimeFeatureFrame } from './realtimeTypes';
import { StemAnalysisRuntime } from './stemAnalysisRuntime';
import { validateAnalysisInputs, type AnalysisInput } from './sources';
import type { StemRole } from '../processing/modelManifest';
import type { EditorSeparationService } from '../processing/editorSeparationService';
import {
    isFeatureId,
    isSupportedFeatureId,
    type AnalysisCoordinatorSnapshot,
    type AnalysisErrorCode,
    type AnalysisCursorValueResult,
    type AnalysisSourceJob,
    type AnalysisListener,
    type AnalysisSeries,
    type AnalysisWorkerRequest,
    type AnalysisWorkerResponse,
    type FeatureId,
    type TempoEstimateResult,
} from './types';

type AudioSessionStore = ReturnType<typeof useAudioSessionStore>;

interface AnalysisAudioEnginePort extends DecodedAudioCopyPort {
    subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void;
}

interface AnalysisWorkerPort {
    onmessage: ((event: MessageEvent<AnalysisWorkerResponse>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    postMessage(message: AnalysisWorkerRequest, transfer?: Transferable[]): void;
    terminate(): void;
}

type WorkerFactory = () => AnalysisWorkerPort;

export type AnalysisConsumer = 'analyzer' | 'editor' | 'visualizer';

export interface AnalysisConsumerLease {
    token: string;
    consumer: AnalysisConsumer;
    setActiveFeatures(ids: readonly FeatureId[]): Promise<void>;
    setActiveInputs(inputs: readonly AnalysisInput[]): Promise<void>;
    getSourceSnapshot(stemRole?: StemRole): AnalysisCoordinatorSnapshot;
    readStemWaveform(stemRole: StemRole, time: number): readonly number[] | null;
    prepareStemWaveform(stemRole: StemRole, time: number): Promise<void>;
    requestCursorValue(
        featureId: FeatureId,
        timeSeconds: number,
        stemRole?: StemRole,
    ): Promise<AnalysisCursorValueResult | null>;
    requestWindowSeries(input: AnalysisWindowInput, signal?: AbortSignal): Promise<AnalysisWindowSeries | null>;
    requestTempoEstimate(): Promise<TempoEstimateResult | null>;
    getSeries(featureId: FeatureId, stemRole?: StemRole): AnalysisSeries | null;
    subscribe(listener: AnalysisListener): () => void;
    release(): void;
}

export interface AnalysisCoordinatorOptions {
    workerFactory?: WorkerFactory;
    createJobId?: () => string;
    copyYieldControl?: () => Promise<void>;
    cursorTimeoutMs?: number;
    tempoTimeoutMs?: number;
}

export class AnalysisCoordinatorError extends Error {
    readonly code: 'invalid-active-features' | 'unsupported-feature' | 'audio-not-ready';

    constructor(code: 'invalid-active-features' | 'unsupported-feature' | 'audio-not-ready', message: string) {
        super(message);
        this.name = 'AnalysisCoordinatorError';
        this.code = code;
    }
}

const initialSnapshot = (): AnalysisCoordinatorSnapshot => ({
    pcmState: 'empty',
    state: 'idle',
    generation: 0,
    trackId: null,
    trackHash: null,
    configHash: null,
    sampleRate: null,
    activeFeatureIds: [],
    readyFeatureIds: [],
    completedFrames: 0,
    totalFrames: 0,
    progress: 0,
    cacheState: 'idle',
    staleMessageCount: 0,
});

const cloneSnapshot = (snapshot: AnalysisCoordinatorSnapshot): AnalysisCoordinatorSnapshot => ({
    ...snapshot,
    activeFeatureIds: [...snapshot.activeFeatureIds],
    readyFeatureIds: [...snapshot.readyFeatureIds],
    error: snapshot.error ? { ...snapshot.error } : undefined,
});

export class AnalysisCoordinator {
    private stems: StemAnalysisRuntime | null = null;
    configureStemSources(service: EditorSeparationService): void {
        this.stems = new StemAnalysisRuntime(
            service,
            () => {
                const track = this.store.queue.find(t => t.id === this.store.currentTrackId);
                return track?.trackHash ? { id: track.id, hash: track.trackHash } : null;
            },
            request => this.ensureWorker().postMessage(request),
            () => {
                for (const listener of this.listeners) listener(this.getSnapshot());
            },
        );
    }
    private readonly engine: AnalysisAudioEnginePort;
    private readonly repository: SessionRepositoryPort;
    private readonly store: AudioSessionStore;
    private readonly workerFactory: WorkerFactory;
    private readonly createJobId: () => string;
    private readonly copyYieldControl?: () => Promise<void>;
    private readonly cursorTimeoutMs: number;
    private readonly tempoTimeoutMs: number;
    private readonly listeners = new Set<AnalysisListener>();
    private readonly series = new Map<FeatureId, AnalysisSeries>();
    private readonly windowRequests = new AnalysisWindowRequests(message => this.worker?.postMessage(message));
    private readonly cursorRequests = new Map<
        FeatureId,
        {
            requestId: string;
            resolve: (value: AnalysisCursorValueResult | null) => void;
            timeout: ReturnType<typeof setTimeout>;
        }
    >();
    private readonly unsubscribeEngine: () => void;
    private readonly unsubscribeQueue: () => void;
    private tempoRequest: {
        started: boolean;
        refresh(): void;
        generation: number;
        token: string;
        requestId: string;
        resolve: (value: TempoEstimateResult | null) => void;
        timeout: ReturnType<typeof setTimeout>;
    } | null = null;
    private readonly pcmSource = new AnalysisPcmSource();
    private worker: AnalysisWorkerPort | null = null;
    private readonly featureCache = new AnalysisFeatureCache();
    private restoredCache: StoredAnalysisCache | undefined;
    private cachePersistence: { revision: number; promise: Promise<'stored' | 'stale'> } | null = null;
    private activeJob: {
        jobId: string;
        generation: number;
        trackHash: string;
        configHash: string;
        requestedFeatureIds: FeatureId[];
        cachedFeatureIds: FeatureId[];
    } | null = null;
    private lastDescriptorRevision: number | null = null;
    private activeConsumer: {
        token: string;
        consumer: AnalysisConsumer;
    } | null = null;
    private snapshot = initialSnapshot();
    private disposed = false;
    private realtime: { id: string; frame(value: RealtimeFeatureFrame): void; error(message: string): void } | null =
        null;

    acquireRealtime(
        port: MessagePort,
        sampleRate: number,
        featureIds: FeatureId[],
        frame: (value: RealtimeFeatureFrame) => void,
        error: (message: string) => void,
    ): RealtimeAnalysisLease {
        if (this.disposed) throw Error('AnalysisCoordinator has been disposed.');
        this.assertActiveFeatures(featureIds);
        this.deactivateConsumer();
        this.activeConsumer = null;
        const id = crypto.randomUUID();
        this.realtime = { id, frame, error };
        this.pcmSource.clear();
        this.ensureWorker().postMessage({ kind: 'realtime-start', sessionId: id, sampleRate, featureIds, port }, [
            port,
        ]);
        return {
            release: () => {
                if (this.realtime?.id === id) this.releaseRealtime();
            },
        };
    }

    private releaseRealtime() {
        const current = this.realtime;
        this.realtime = null;
        if (current) this.worker?.postMessage({ kind: 'realtime-stop', sessionId: current.id });
    }

    constructor(
        engine: AnalysisAudioEnginePort,
        repository: SessionRepositoryPort,
        store: AudioSessionStore,
        options: AnalysisCoordinatorOptions = {},
    ) {
        this.engine = engine;
        this.repository = repository;
        this.store = store;
        this.workerFactory =
            options.workerFactory ??
            (() => new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' }));
        this.createJobId = options.createJobId ?? (() => crypto.randomUUID());
        this.copyYieldControl = options.copyYieldControl;
        this.cursorTimeoutMs = options.cursorTimeoutMs ?? 5_000;
        this.tempoTimeoutMs = options.tempoTimeoutMs ?? 15_000;
        this.store.setAnalysis(this.snapshot);
        this.unsubscribeQueue = watch(
            () => this.store.queue.length,
            length => {
                if (!length) {
                    this.featureCache.clear();
                    this.restoredCache = undefined;
                }
            },
            { flush: 'sync' },
        );
        this.unsubscribeEngine = this.engine.subscribe(playback => {
            this.handlePlayback(playback);
        });
    }

    setRestoredCache(cache: StoredAnalysisCache | undefined): void {
        if (this.disposed) return;
        this.restoredCache = cache;
    }

    acquireConsumer(consumer: AnalysisConsumer): AnalysisConsumerLease {
        if (this.disposed) {
            throw new Error('AnalysisCoordinator has been disposed.');
        }
        this.deactivateConsumer();
        const active = { token: crypto.randomUUID(), consumer };
        this.activeConsumer = active;
        return this.createConsumerLease(active, true);
    }

    getDevelopmentConsumerProxy(consumer: AnalysisConsumer): AnalysisConsumerLease | null {
        const active = this.activeConsumer;
        return active?.consumer === consumer ? this.createConsumerLease(active, false) : null;
    }

    async setActiveFeatures(ids: readonly FeatureId[], preserveCache = false): Promise<void> {
        this.assertActiveFeatures(ids);
        this.cancelActiveJob('cancelled', true);
        const generation = this.snapshot.generation + 1;
        this.series.clear();
        this.publish({
            ...this.snapshot,
            state: ids.length === 0 ? 'idle' : 'copying',
            generation,
            activeFeatureIds: [...ids],
            readyFeatureIds: [],
            sampleRate: null,
            completedFrames: 0,
            totalFrames: 0,
            progress: 0,
            cacheState: 'idle',
            error: undefined,
        });
        if (ids.length === 0) {
            if (!preserveCache) await this.persistSeries(generation);
            return;
        }
        await this.startCurrentAnalysis(generation);
    }

    async retry(): Promise<void> {
        if (this.disposed || this.snapshot.activeFeatureIds.length === 0) {
            return;
        }
        this.cancelActiveJob('cancelled');
        this.series.clear();
        const generation = this.snapshot.generation + 1;
        this.publish({
            ...this.snapshot,
            state: 'copying',
            generation,
            readyFeatureIds: [],
            completedFrames: 0,
            totalFrames: 0,
            progress: 0,
            cacheState: 'idle',
            error: undefined,
        });
        await this.startCurrentAnalysis(generation);
    }

    cancel(): void {
        if (this.disposed) return;
        this.cancelActiveJob('cancelled');
        const generation = this.snapshot.generation + 1;
        this.publish({
            ...this.snapshot,
            state: 'cancelled',
            generation,
            completedFrames: 0,
            totalFrames: 0,
            progress: 0,
            error: undefined,
        });
    }

    requestCursorValue(
        featureId: FeatureId,
        timeSeconds: number,
        stemRole?: StemRole,
    ): Promise<AnalysisCursorValueResult | null> {
        if (stemRole)
            return (
                this.stems
                    ?.read(stemRole, featureId, timeSeconds)
                    .then(value => (value && 'kind' in value ? value : null)) ?? Promise.resolve(null)
            );
        if (
            this.disposed ||
            !this.series.has(featureId) ||
            !this.activeJob ||
            !this.worker ||
            !Number.isFinite(timeSeconds)
        ) {
            return Promise.resolve(null);
        }
        const spectrum = this.series.get(featureId);
        if (featureId === 'wallpaperEngineSpectrum' && spectrum?.payload.kind === 'stereo-spectrum-f32') {
            const index = wallpaperFrameIndex(timeSeconds, spectrum.sampleCount);
            return Promise.resolve({
                kind: 'cursor-value-result',
                requestId: this.createJobId(),
                generation: this.snapshot.generation,
                trackHash: spectrum.trackHash,
                configHash: spectrum.configHash,
                featureId,
                frameStartSeconds: index * spectrum.sampleStepSeconds,
                value: Array.from(spectrum.payload.values.subarray(index * 128, (index + 1) * 128)),
            });
        }
        const previous = this.cursorRequests.get(featureId);
        if (previous) {
            clearTimeout(previous.timeout);
            previous.resolve(null);
        }
        const requestId = this.createJobId();
        return new Promise(resolve => {
            const timeout = setTimeout(() => {
                const current = this.cursorRequests.get(featureId);
                if (current?.requestId === requestId) {
                    this.cursorRequests.delete(featureId);
                    resolve(null);
                }
            }, this.cursorTimeoutMs);
            this.cursorRequests.set(featureId, {
                requestId,
                resolve,
                timeout,
            });
            this.worker?.postMessage({
                kind: 'cursor-value',
                requestId,
                generation: this.snapshot.generation,
                trackHash: this.activeJob?.trackHash ?? '',
                config: {
                    schemaVersion: 1,
                    frameSize: 1024,
                    hopSize: 512,
                    windowingFunction: 'hanning',
                    numberOfMFCCCoefficients: 13,
                    channelMode: 'average-mono',
                    sampleRate: this.engine.getDecodedAudioDescriptor()?.sampleRate ?? 0,
                    configHash: this.activeJob?.configHash ?? '',
                },
                featureId,
                timeSeconds,
            });
        });
    }

    requestWindowSeries(input: AnalysisWindowInput, signal?: AbortSignal): Promise<AnalysisWindowSeries | null> {
        if (input.stemRole)
            return (
                this.stems
                    ?.read(input.stemRole, input.featureId, input.startSeconds, input, signal)
                    .then(value => (value && !('kind' in value) ? value : null)) ?? Promise.resolve(null)
            );
        if (
            this.disposed ||
            this.activeConsumer?.consumer !== 'editor' ||
            !this.worker ||
            !this.activeJob ||
            !this.pcmSource.ready ||
            !this.series.has(input.featureId) ||
            input.featureId === 'wallpaperEngineSpectrum'
        )
            return Promise.resolve(null);
        return this.windowRequests.request(
            {
                ...input,
                kind: 'window-series',
                requestId: this.createJobId(),
                generation: this.snapshot.generation,
                trackHash: this.activeJob.trackHash,
                configHash: this.activeJob.configHash,
            },
            signal,
        );
    }

    requestTempoEstimate(): Promise<TempoEstimateResult | null> {
        if (
            this.disposed ||
            this.activeConsumer?.consumer !== 'editor' ||
            !this.activeJob ||
            !this.worker ||
            !this.pcmSource.ready ||
            !this.snapshot.trackHash ||
            !this.snapshot.configHash
        ) {
            return Promise.resolve(null);
        }
        this.resolveTempoRequest();
        const requestId = this.createJobId();
        return new Promise(resolve => {
            const expire = () => {
                if (this.tempoRequest?.requestId === requestId) this.resolveTempoRequest();
            };
            const timeout = setTimeout(expire, this.tempoTimeoutMs);
            this.tempoRequest = {
                requestId,
                resolve,
                timeout,
                generation: this.snapshot.generation,
                token: this.activeConsumer!.token,
                started: false,
                refresh: () => {
                    const pending = this.tempoRequest;
                    if (pending?.requestId !== requestId) return;
                    clearTimeout(pending.timeout);
                    pending.timeout = setTimeout(expire, this.tempoTimeoutMs);
                },
            };
            this.worker?.postMessage({
                kind: 'tempo-estimate',
                requestId,
                generation: this.snapshot.generation,
                trackHash: this.snapshot.trackHash ?? '',
                configHash: this.snapshot.configHash ?? '',
            });
        });
    }

    getSeries(featureId: FeatureId, stemRole?: StemRole): AnalysisSeries | null {
        if (stemRole) return this.stems?.getSeries(stemRole, featureId) ?? null;
        return this.series.get(featureId) ?? null;
    }

    getSnapshot(): AnalysisCoordinatorSnapshot {
        return cloneSnapshot(this.snapshot);
    }

    subscribe(listener: AnalysisListener): () => void {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        await this.stems?.dispose();
        this.releaseRealtime();
        this.activeConsumer = null;
        this.cancelActiveJob('cancelled');
        this.unsubscribeEngine();
        this.unsubscribeQueue();
        this.restoredCache = undefined;
        this.pcmSource.clear();
        this.worker?.terminate();
        this.worker = null;
        this.featureCache.clear();
        this.resolveAllCursorRequests();
        this.resolveTempoRequest();
        this.series.clear();
        this.publish({
            ...this.snapshot,
            state: 'disposed',
            generation: this.snapshot.generation + 1,
            readyFeatureIds: [],
        });
        this.listeners.clear();
    }

    private createConsumerLease(
        identity: { token: string; consumer: AnalysisConsumer },
        canRelease: boolean,
    ): AnalysisConsumerLease {
        let released = false;
        let inputRevision = 0;
        const isCurrent = () =>
            !released &&
            !this.disposed &&
            this.activeConsumer?.token === identity.token &&
            this.activeConsumer.consumer === identity.consumer;
        return {
            token: identity.token,
            consumer: identity.consumer,
            readStemWaveform: (role, time) => (isCurrent() ? (this.stems?.readWaveform(role, time) ?? null) : null),
            prepareStemWaveform: (role, time) =>
                isCurrent() && this.stems
                    ? this.stems.prepareWaveform(role, time)
                    : Promise.reject(Error('分轨输入已失效。')),
            setActiveFeatures: ids => (isCurrent() ? this.setActiveFeatures(ids) : Promise.resolve()),
            setActiveInputs: async inputs => {
                if (!isCurrent()) return;
                const revision = ++inputRevision;
                validateAnalysisInputs(inputs);
                const originals = [...new Set(inputs.filter(i => !i.stemRole).map(i => i.featureId))];
                this.assertActiveFeatures(originals);
                if (originals.join('|') !== this.snapshot.activeFeatureIds.join('|') || this.snapshot.state === 'error')
                    await this.setActiveFeatures(originals, originals.length === 0);
                if (isCurrent() && revision === inputRevision) this.stems?.setRequests(inputs);
            },
            getSourceSnapshot: role =>
                role
                    ? (this.stems?.getSnapshot(role) ?? {
                          ...initialSnapshot(),
                          state: 'error',
                          error: { code: 'audio-not-ready', message: '需完成音频分离。', recoverable: true },
                      })
                    : this.getSnapshot(),
            requestCursorValue: (featureId, timeSeconds, role) =>
                isCurrent() ? this.requestCursorValue(featureId, timeSeconds, role) : Promise.resolve(null),
            requestWindowSeries: (input, signal) =>
                isCurrent() ? this.requestWindowSeries(input, signal) : Promise.resolve(null),
            requestTempoEstimate: () => (isCurrent() ? this.requestTempoEstimate() : Promise.resolve(null)),
            getSeries: (featureId, role) => (isCurrent() ? this.getSeries(featureId, role) : null),
            subscribe: listener =>
                this.subscribe(snapshot => {
                    if (isCurrent()) listener(snapshot);
                }),
            release: () => {
                if (!canRelease || released) return;
                released = true;
                if (this.activeConsumer?.token === identity.token) {
                    this.activeConsumer = null;
                    this.deactivateConsumer();
                }
            },
        };
    }

    private deactivateConsumer(): void {
        this.stems?.clear();
        this.releaseRealtime();
        this.cancelActiveJob('cancelled');
        this.series.clear();
        const generation = this.snapshot.generation + 1;
        this.publish({
            ...this.snapshot,
            state: 'idle',
            generation,
            activeFeatureIds: [],
            readyFeatureIds: [],
            sampleRate: null,
            completedFrames: 0,
            totalFrames: 0,
            progress: 0,
            cacheState: 'idle',
            error: undefined,
        });
    }

    private assertActiveFeatures(ids: readonly FeatureId[]): void {
        if (
            !Array.isArray(ids) ||
            ids.length > 4 ||
            new Set(ids).size !== ids.length ||
            ids.some(id => !isFeatureId(id))
        ) {
            throw new AnalysisCoordinatorError('invalid-active-features', 'Analysis requires 0–4 unique feature IDs.');
        }
        const unsupported = ids.find(id => !isSupportedFeatureId(id));
        if (unsupported) {
            throw new AnalysisCoordinatorError(
                'unsupported-feature',
                `${unsupported} is registered for a later milestone.`,
            );
        }
    }

    private currentIdentity(descriptor: DecodedAudioDescriptor): { trackHash: string } | null {
        const track = this.store.queue.find(entry => entry.id === descriptor.trackId);
        if (!track?.trackHash) return null;
        return { trackHash: track.trackHash };
    }

    private async startCurrentAnalysis(generation: number): Promise<void> {
        const descriptor = this.engine.getDecodedAudioDescriptor();
        if (!descriptor) {
            this.publishError(generation, 'audio-not-ready', 'Decoded audio is not ready for analysis.', true);
            return;
        }
        const identity = this.currentIdentity(descriptor);
        if (!identity) {
            this.publishError(generation, 'audio-not-ready', 'Current track hash is not ready for analysis.', true);
            return;
        }
        const config = await createAnalysisConfig(descriptor.sampleRate);
        if (!this.isCurrentGeneration(generation)) return;
        const hits = this.restoreCacheHits(
            descriptor.trackId,
            identity.trackHash,
            config.configHash,
            this.snapshot.activeFeatureIds,
        );
        const misses = this.snapshot.activeFeatureIds.filter(featureId => !hits.includes(featureId));
        this.publish({
            ...this.snapshot,
            trackId: descriptor.trackId,
            trackHash: identity.trackHash,
            configHash: config.configHash,
            sampleRate: descriptor.sampleRate,
            readyFeatureIds: [...hits],
            cacheState: hits.length === 0 ? 'miss' : misses.length === 0 ? 'hit' : 'partial',
        });
        const worker = this.ensureWorker();
        const sourceKey = JSON.stringify([
            descriptor.trackId,
            identity.trackHash,
            descriptor.revision,
            config.configHash,
        ]);
        let stereoPcm: readonly [Float32Array, Float32Array] | undefined;
        try {
            await this.pcmSource.prepare(
                sourceKey,
                config,
                identity.trackHash,
                this.engine,
                (message, transfer) => worker.postMessage(message, transfer),
                this.copyYieldControl,
            );
            if (!this.isCurrentGeneration(generation)) return;
            if (misses.includes('wallpaperEngineSpectrum')) {
                stereoPcm = (
                    await copyDecodedAudioToMono(this.engine, {
                        yieldControl: this.copyYieldControl,
                        stereo: true,
                        copyMono: false,
                        isCancelled: () => !this.isCurrentGeneration(generation),
                    })
                ).stereoPcm;
            }
        } catch (error) {
            if (!this.isCurrentGeneration(generation) || (error instanceof PcmCopyError && error.code === 'stale'))
                return;
            this.publishError(
                generation,
                'audio-not-ready',
                error instanceof Error ? error.message : 'Unable to prepare audio.',
                true,
            );
            return;
        }
        if (
            !this.isCurrentGeneration(generation) ||
            this.engine.getDecodedAudioDescriptor()?.revision !== descriptor.revision
        )
            return;
        const jobId = this.createJobId();
        this.activeJob = {
            jobId,
            generation,
            trackHash: identity.trackHash,
            configHash: config.configHash,
            requestedFeatureIds: [...misses],
            cachedFeatureIds: [...hits],
        };
        this.publish({
            ...this.snapshot,
            state: misses.length === 0 ? 'ready' : 'analyzing',
            completedFrames: 0,
            totalFrames: 0,
            progress: misses.length === 0 ? 1 : 0,
        });
        const request: AnalysisSourceJob = {
            kind: 'analyze',
            jobId,
            generation,
            trackHash: identity.trackHash,
            sourceKey,
            featureIds: misses,
            cursorFeatureIds: [...this.snapshot.activeFeatureIds],
            stereoPcm: stereoPcm ? [stereoPcm[0].buffer as ArrayBuffer, stereoPcm[1].buffer as ArrayBuffer] : undefined,
        };
        worker.postMessage(request, [...(request.stereoPcm ?? [])]);
    }

    private restoreCacheHits(
        trackId: string,
        trackHash: string,
        configHash: string,
        featureIds: readonly FeatureId[],
    ): FeatureId[] {
        const restored = this.restoredCache;
        if (restored) {
            // Engine unload/loading notifications can precede initialization's decode.
            if (
                restored.manifest.trackId === trackId &&
                restored.manifest.trackHash === trackHash &&
                restored.manifest.configHash === configHash
            )
                this.featureCache.restore(restored);
            this.restoredCache = undefined;
        }
        this.featureCache.select({ trackId, trackHash, configHash }, featureIds);
        const hits: FeatureId[] = [];
        for (const featureId of featureIds) {
            const series = this.featureCache.get(featureId);
            if (!series) continue;
            this.series.set(featureId, series);
            hits.push(featureId);
        }
        return hits;
    }

    private ensureWorker(): AnalysisWorkerPort {
        if (this.worker) return this.worker;
        const worker = this.workerFactory();
        worker.onmessage = event => {
            this.handleWorkerMessage(event.data);
        };
        worker.onerror = event => {
            this.pcmSource.clear(new Error(event.message || 'Analysis Worker failed.'));
            this.stems?.workerFailed(event.message || '分轨分析 Worker 失败。');
            if (this.disposed) return;
            this.realtime?.error(event.message || '实时分析 Worker 失败。');
            this.releaseRealtime();
            this.publishError(
                this.snapshot.generation,
                'worker-failed',
                event.message || 'Analysis Worker failed.',
                true,
            );
        };
        this.worker = worker;
        return worker;
    }

    private handleWorkerMessage(message: AnalysisWorkerResponse): void {
        if (message.kind === 'tempo-started') {
            const pending = this.tempoRequest;
            if (pending?.requestId === message.requestId && pending.generation === message.generation) {
                pending.started = true;
                pending.refresh();
            }
            return;
        }
        if (
            message.kind === 'stem-progress' &&
            message.epoch === this.stems?.getSnapshot(message.role).generation &&
            this.tempoRequest &&
            !this.tempoRequest.started
        )
            this.tempoRequest.refresh();
        if (message.kind === 'source-error') {
            this.pcmSource.fail(message.sourceKey, message.message);
            return;
        }
        if (message.kind === 'source-ready') {
            this.pcmSource.acknowledge(message.sourceKey);
            return;
        }
        if (
            message.kind === 'stem-progress' ||
            message.kind === 'stem-result' ||
            message.kind === 'stem-value' ||
            message.kind === 'stem-error' ||
            message.kind === 'stem-cleared'
        ) {
            this.stems?.handle(message);
            return;
        }
        if (message.kind === 'window-series-result') {
            this.windowRequests.handle(message);
            return;
        }
        if (message.kind === 'realtime-frame' || message.kind === 'realtime-error') {
            const current = this.realtime;
            if (!current || current.id !== message.sessionId) return;
            if (message.kind === 'realtime-frame') current.frame(message.frame);
            else {
                current.error(message.message);
                this.releaseRealtime();
            }
            return;
        }
        if (message.kind === 'cursor-value-result') {
            this.handleCursorResult(message);
            return;
        }
        if (message.kind === 'tempo-estimate-result') {
            this.handleTempoResult(message);
            return;
        }
        const active = this.activeJob;
        if (
            !active ||
            message.jobId !== active.jobId ||
            message.generation !== active.generation ||
            active.generation !== this.snapshot.generation
        ) {
            this.publish({
                ...this.snapshot,
                staleMessageCount: this.snapshot.staleMessageCount + 1,
            });
            return;
        }
        if (message.kind === 'progress') {
            if (this.tempoRequest && !this.tempoRequest.started) this.tempoRequest.refresh();
            const completedFrames = Math.max(this.snapshot.completedFrames, message.completedFrames);
            const totalFrames = Math.max(completedFrames, message.totalFrames);
            this.publish({
                ...this.snapshot,
                completedFrames,
                totalFrames,
                progress: totalFrames === 0 ? 0 : completedFrames / totalFrames,
            });
            return;
        }
        if (message.kind === 'error') {
            this.publishError(active.generation, message.code, message.message, message.recoverable);
            return;
        }
        if (
            message.trackHash !== active.trackHash ||
            message.configHash !== active.configHash ||
            message.series.some(
                series =>
                    series.trackHash !== active.trackHash ||
                    series.configHash !== active.configHash ||
                    !active.requestedFeatureIds.includes(series.featureId),
            )
        ) {
            this.publish({
                ...this.snapshot,
                staleMessageCount: this.snapshot.staleMessageCount + 1,
            });
            return;
        }
        for (const series of message.series) {
            if (this.series.has(series.featureId)) continue;
            this.series.set(series.featureId, series);
            this.featureCache.put(series);
        }
        this.publish({
            ...this.snapshot,
            state: message.kind === 'series-ready' ? 'analyzing' : 'ready',
            readyFeatureIds: this.snapshot.activeFeatureIds.filter(featureId => this.series.has(featureId)),
            completedFrames:
                message.kind === 'series-ready'
                    ? this.snapshot.completedFrames
                    : Math.max(this.snapshot.completedFrames, this.snapshot.totalFrames),
            progress: message.kind === 'series-ready' ? this.snapshot.progress : 1,
            error: undefined,
        });
        if (message.kind !== 'series-ready') void this.persistSeries(active.generation);
    }

    private handleCursorResult(result: AnalysisCursorValueResult): void {
        const pending = this.cursorRequests.get(result.featureId);
        if (
            !pending ||
            pending.requestId !== result.requestId ||
            result.generation !== this.snapshot.generation ||
            result.trackHash !== this.snapshot.trackHash ||
            result.configHash !== this.snapshot.configHash
        ) {
            return;
        }
        clearTimeout(pending.timeout);
        this.cursorRequests.delete(result.featureId);
        pending.resolve(result);
    }

    private handleTempoResult(result: TempoEstimateResult): void {
        const pending = this.tempoRequest;
        if (
            !pending ||
            pending.requestId !== result.requestId ||
            result.generation !== pending.generation ||
            result.trackHash !== this.snapshot.trackHash ||
            result.configHash !== this.snapshot.configHash ||
            this.activeConsumer?.consumer !== 'editor' ||
            this.activeConsumer.token !== pending.token
        ) {
            return;
        }
        clearTimeout(pending.timeout);
        this.tempoRequest = null;
        pending.resolve(result);
    }

    private async persistSeries(generation: number): Promise<void> {
        if (!this.isCurrentGeneration(generation)) return;
        const trackId = this.snapshot.trackId;
        const trackHash = this.snapshot.trackHash;
        const configHash = this.snapshot.configHash;
        if (!trackId || !trackHash || !configHash) {
            this.store.setAnalysisCacheManifest(null);
            return;
        }
        if (this.featureCache.revision === this.featureCache.persistedRevision) return;
        const cache = this.featureCache.stored();
        if (!cache) return;
        const revision = this.featureCache.revision;
        const payloads: ReplaceCurrentAnalysisCacheInput['payloads'] = cache.payloads.map(entry => ({
            ...entry,
            featureId: cache.manifest.featureIds[cache.manifest.cacheKeys.indexOf(entry.cacheKey)]!,
        }));
        try {
            if (this.cachePersistence?.revision !== revision) {
                const promise = this.repository.replaceCurrentAnalysisCache({
                    trackId,
                    trackHash,
                    configHash,
                    payloads,
                });
                const pending = { revision, promise };
                this.cachePersistence = pending;
                void promise
                    .finally(() => {
                        if (this.cachePersistence === pending) this.cachePersistence = null;
                    })
                    .catch(() => {});
            }
            const result = await this.cachePersistence!.promise;
            if (result !== 'stale' && this.featureCache.matches(cache.manifest))
                this.featureCache.persistedRevision = Math.max(this.featureCache.persistedRevision, revision);
            if (!this.isCurrentGeneration(generation)) return;
            if (result === 'stale') {
                this.publish({ ...this.snapshot, staleMessageCount: this.snapshot.staleMessageCount + 1 });
                return;
            }
            this.store.setAnalysisCacheManifest(cache.manifest);
            this.publish({ ...this.snapshot, cacheState: this.snapshot.cacheState === 'hit' ? 'hit' : 'persisted' });
        } catch {
            if (!this.isCurrentGeneration(generation)) return;
            this.publish({
                ...this.snapshot,
                cacheState: 'not-persisted',
            });
        }
    }

    private handlePlayback(playback: PlaybackSnapshot): void {
        if (this.disposed) return;
        if (playback.state === 'empty' || playback.state === 'loading' || playback.state === 'error') {
            this.lastDescriptorRevision = null;
            const track = this.store.queue.find(entry => entry.id === playback.trackId);
            if (playback.state !== 'loading' || !this.featureCache.matchesTrack(playback.trackId, track?.trackHash))
                this.featureCache.clear();
            this.pcmSource.clear();
            this.worker?.postMessage({ kind: 'release-source' });
            this.cancelActiveJob('cancelled');
            this.series.clear();
            this.publish({
                ...this.snapshot,
                state: this.snapshot.activeFeatureIds.length === 0 ? 'idle' : 'copying',
                generation: this.snapshot.generation + 1,
                trackId: playback.trackId,
                trackHash: null,
                configHash: null,
                sampleRate: null,
                readyFeatureIds: [],
                completedFrames: 0,
                totalFrames: 0,
                progress: 0,
                cacheState: 'idle',
                error: undefined,
            });
            return;
        }
        const descriptor = this.engine.getDecodedAudioDescriptor();
        if (!descriptor || descriptor.revision === this.lastDescriptorRevision) {
            return;
        }
        this.lastDescriptorRevision = descriptor.revision;
        this.pcmSource.clear();
        this.worker?.postMessage({ kind: 'release-source' });
        if (this.snapshot.activeFeatureIds.length > 0) {
            this.cancelActiveJob('cancelled');
            const generation = this.snapshot.generation + 1;
            this.publish({
                ...this.snapshot,
                state: 'copying',
                generation,
                readyFeatureIds: [],
                completedFrames: 0,
                totalFrames: 0,
                progress: 0,
                error: undefined,
            });
            void this.startCurrentAnalysis(generation);
        }
    }

    private cancelActiveJob(state: 'cancelled', preserveTempo = false): void {
        this.windowRequests.clear();
        const active = this.activeJob;
        if (active && this.worker) {
            this.worker.postMessage({
                kind: 'cancel',
                jobId: active.jobId,
                generation: active.generation,
            });
        }
        this.activeJob = null;
        this.resolveAllCursorRequests();
        if (!preserveTempo) this.resolveTempoRequest();
        if (this.snapshot.state === 'analyzing') {
            this.publish({
                ...this.snapshot,
                state,
            });
        }
    }

    private resolveAllCursorRequests(): void {
        for (const pending of this.cursorRequests.values()) {
            clearTimeout(pending.timeout);
            pending.resolve(null);
        }
        this.cursorRequests.clear();
    }

    private resolveTempoRequest(): void {
        if (!this.tempoRequest) return;
        clearTimeout(this.tempoRequest.timeout);
        this.worker?.postMessage({ kind: 'cancel-tempo', requestId: this.tempoRequest.requestId });
        this.tempoRequest.resolve(null);
        this.tempoRequest = null;
    }

    private publishError(generation: number, code: AnalysisErrorCode, message: string, recoverable: boolean): void {
        if (!this.isCurrentGeneration(generation)) return;
        this.windowRequests.clear();
        this.publish({
            ...this.snapshot,
            state: 'error',
            error: {
                code,
                message,
                recoverable,
            },
        });
    }

    private isCurrentGeneration(generation: number): boolean {
        return !this.disposed && this.snapshot.generation === generation;
    }

    private publish(snapshot: AnalysisCoordinatorSnapshot): void {
        snapshot = {
            ...snapshot,
            pcmState: this.pcmSource.ready ? 'ready' : snapshot.state === 'copying' ? 'copying' : 'empty',
        };
        this.snapshot = cloneSnapshot(snapshot);
        this.store.setAnalysis(this.snapshot);
        const next = this.getSnapshot();
        for (const listener of this.listeners) listener(next);
    }
}

export const analysisCoordinatorKey: InjectionKey<AnalysisCoordinator> = Symbol('analysis-coordinator');

export const useAnalysisCoordinator = (): AnalysisCoordinator => {
    const coordinator = inject(analysisCoordinatorKey);
    if (!coordinator) {
        throw new Error('AnalysisCoordinator has not been provided.');
    }
    return coordinator;
};
