import type { InjectionKey } from 'vue';
import { inject } from 'vue';
import type {
    ReplaceCurrentAnalysisCacheInput,
    SessionRepositoryPort,
} from '../persistence/sessionRepository';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type {
    DecodedAudioDescriptor,
    PlaybackSnapshot,
} from '../types/audio';
import type { StoredAnalysisCache } from '../types/session';
import {
    decodeAnalysisSeries,
    encodeAnalysisSeries,
} from './compactCodec';
import {
    createAnalysisCacheKey,
    createAnalysisConfig,
} from './config';
import {
    copyDecodedAudioToMono,
    type DecodedAudioCopyPort,
    PcmCopyError,
} from './pcm';
import {
    isFeatureId,
    isM10FeatureId,
    type AnalysisCoordinatorSnapshot,
    type AnalysisErrorCode,
    type AnalysisCursorValueResult,
    type AnalysisJobRequest,
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
    onmessage:
        | ((event: MessageEvent<AnalysisWorkerResponse>) => void)
        | null;
    onerror: ((event: ErrorEvent) => void) | null;
    postMessage(
        message: AnalysisWorkerRequest,
        transfer?: Transferable[],
    ): void;
    terminate(): void;
}

type WorkerFactory = () => AnalysisWorkerPort;

export type AnalysisConsumer = 'analyzer' | 'editor' | 'visualizer';

export interface AnalysisConsumerLease {
    token: string;
    consumer: AnalysisConsumer;
    setActiveFeatures(ids: readonly FeatureId[]): Promise<void>;
    requestCursorValue(
        featureId: FeatureId,
        timeSeconds: number,
    ): Promise<AnalysisCursorValueResult | null>;
    requestTempoEstimate(): Promise<TempoEstimateResult | null>;
    getSeries(featureId: FeatureId): AnalysisSeries | null;
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
    readonly code:
        | 'invalid-active-features'
        | 'unsupported-feature'
        | 'audio-not-ready';

    constructor(
        code:
            | 'invalid-active-features'
            | 'unsupported-feature'
            | 'audio-not-ready',
        message: string,
    ) {
        super(message);
        this.name = 'AnalysisCoordinatorError';
        this.code = code;
    }
}

const initialSnapshot = (): AnalysisCoordinatorSnapshot => ({
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

const cloneSnapshot = (
    snapshot: AnalysisCoordinatorSnapshot,
): AnalysisCoordinatorSnapshot => ({
    ...snapshot,
    activeFeatureIds: [...snapshot.activeFeatureIds],
    readyFeatureIds: [...snapshot.readyFeatureIds],
    error: snapshot.error ? { ...snapshot.error } : undefined,
});

export class AnalysisCoordinator {
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
    private readonly cursorRequests = new Map<
        FeatureId,
        {
            requestId: string;
            resolve: (value: AnalysisCursorValueResult | null) => void;
            timeout: ReturnType<typeof setTimeout>;
        }
    >();
    private readonly unsubscribeEngine: () => void;
    private tempoRequest: {
        requestId: string;
        resolve: (value: TempoEstimateResult | null) => void;
        timeout: ReturnType<typeof setTimeout>;
    } | null = null;
    private worker: AnalysisWorkerPort | null = null;
    private restoredCache: StoredAnalysisCache | null = null;
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

    constructor(
        engine: AnalysisAudioEnginePort,
        repository: SessionRepositoryPort,
        store: AudioSessionStore,
        options: AnalysisCoordinatorOptions = {},
    ) {
        this.engine = engine;
        this.repository = repository;
        this.store = store;
        this.workerFactory = options.workerFactory ?? (() =>
            new Worker(
                new URL('./analysis.worker.ts', import.meta.url),
                { type: 'module' },
            ));
        this.createJobId =
            options.createJobId ?? (() => crypto.randomUUID());
        this.copyYieldControl = options.copyYieldControl;
        this.cursorTimeoutMs = options.cursorTimeoutMs ?? 5_000;
        this.tempoTimeoutMs = options.tempoTimeoutMs ?? 15_000;
        this.store.setAnalysis(this.snapshot);
        this.unsubscribeEngine = this.engine.subscribe((playback) => {
            this.handlePlayback(playback);
        });
    }

    setRestoredCache(cache: StoredAnalysisCache | undefined): void {
        if (this.disposed) return;
        this.restoredCache = cache ?? null;
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

    getDevelopmentConsumerProxy(
        consumer: AnalysisConsumer,
    ): AnalysisConsumerLease | null {
        const active = this.activeConsumer;
        return active?.consumer === consumer
            ? this.createConsumerLease(active, false)
            : null;
    }

    async setActiveFeatures(ids: readonly FeatureId[]): Promise<void> {
        this.assertActiveFeatures(ids);
        this.cancelActiveJob('cancelled');
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
            await this.persistSeries(generation);
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
    ): Promise<AnalysisCursorValueResult | null> {
        if (
            this.disposed
            || !this.series.has(featureId)
            || !this.activeJob
            || !this.worker
            || !Number.isFinite(timeSeconds)
        ) {
            return Promise.resolve(null);
        }
        const previous = this.cursorRequests.get(featureId);
        if (previous) {
            clearTimeout(previous.timeout);
            previous.resolve(null);
        }
        const requestId = this.createJobId();
        return new Promise((resolve) => {
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
                    sampleRate:
                        this.engine.getDecodedAudioDescriptor()?.sampleRate
                        ?? 0,
                    configHash: this.activeJob?.configHash ?? '',
                },
                featureId,
                timeSeconds,
            });
        });
    }

    requestTempoEstimate(): Promise<TempoEstimateResult | null> {
        if (
            this.disposed
            || this.activeConsumer?.consumer !== 'editor'
            || !this.activeJob
            || !this.worker
            || this.snapshot.state !== 'ready'
            || !this.snapshot.trackHash
            || !this.snapshot.configHash
        ) {
            return Promise.resolve(null);
        }
        this.resolveTempoRequest();
        const requestId = this.createJobId();
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                if (this.tempoRequest?.requestId === requestId) {
                    this.tempoRequest = null;
                    resolve(null);
                }
            }, this.tempoTimeoutMs);
            this.tempoRequest = { requestId, resolve, timeout };
            this.worker?.postMessage({
                kind: 'tempo-estimate',
                requestId,
                generation: this.snapshot.generation,
                trackHash: this.snapshot.trackHash ?? '',
                configHash: this.snapshot.configHash ?? '',
            });
        });
    }

    getSeries(featureId: FeatureId): AnalysisSeries | null {
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
        this.activeConsumer = null;
        this.cancelActiveJob('cancelled');
        this.unsubscribeEngine();
        this.worker?.terminate();
        this.worker = null;
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
        const isCurrent = () =>
            !released
            && !this.disposed
            && this.activeConsumer?.token === identity.token
            && this.activeConsumer.consumer === identity.consumer;
        return {
            token: identity.token,
            consumer: identity.consumer,
            setActiveFeatures: (ids) =>
                isCurrent()
                    ? this.setActiveFeatures(ids)
                    : Promise.resolve(),
            requestCursorValue: (featureId, timeSeconds) =>
                isCurrent()
                    ? this.requestCursorValue(featureId, timeSeconds)
                    : Promise.resolve(null),
            requestTempoEstimate: () => isCurrent()
                ? this.requestTempoEstimate()
                : Promise.resolve(null),
            getSeries: (featureId) =>
                isCurrent() ? this.getSeries(featureId) : null,
            subscribe: (listener) => this.subscribe((snapshot) => {
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
            !Array.isArray(ids)
            || ids.length > 4
            || new Set(ids).size !== ids.length
            || ids.some((id) => !isFeatureId(id))
        ) {
            throw new AnalysisCoordinatorError(
                'invalid-active-features',
                'Analysis requires 0–4 unique feature IDs.',
            );
        }
        const unsupported = ids.find((id) => !isM10FeatureId(id));
        if (unsupported) {
            throw new AnalysisCoordinatorError(
                'unsupported-feature',
                `${unsupported} is registered for a later milestone.`,
            );
        }
    }

    private currentIdentity(
        descriptor: DecodedAudioDescriptor,
    ): { trackHash: string } | null {
        const track = this.store.queue.find(
            (entry) => entry.id === descriptor.trackId,
        );
        if (!track?.trackHash) return null;
        return { trackHash: track.trackHash };
    }

    private async startCurrentAnalysis(generation: number): Promise<void> {
        const descriptor = this.engine.getDecodedAudioDescriptor();
        if (!descriptor) {
            this.publishError(
                generation,
                'audio-not-ready',
                'Decoded audio is not ready for analysis.',
                true,
            );
            return;
        }
        const identity = this.currentIdentity(descriptor);
        if (!identity) {
            this.publishError(
                generation,
                'audio-not-ready',
                'Current track hash is not ready for analysis.',
                true,
            );
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
        const misses = this.snapshot.activeFeatureIds.filter(
            (featureId) => !hits.includes(featureId),
        );
        this.publish({
            ...this.snapshot,
            trackId: descriptor.trackId,
            trackHash: identity.trackHash,
            configHash: config.configHash,
            sampleRate: descriptor.sampleRate,
            readyFeatureIds: [...hits],
            cacheState: hits.length === 0
                ? 'miss'
                : misses.length === 0
                    ? 'hit'
                    : 'partial',
        });
        let copied;
        try {
            copied = await copyDecodedAudioToMono(this.engine, {
                yieldControl: this.copyYieldControl,
            });
        } catch (error) {
            if (!this.isCurrentGeneration(generation)) return;
            if (error instanceof PcmCopyError && error.code === 'stale') {
                return;
            }
            this.publishError(
                generation,
                'audio-not-ready',
                error instanceof Error
                    ? error.message
                    : 'Unable to copy decoded audio.',
                true,
            );
            return;
        }
        if (
            !this.isCurrentGeneration(generation)
            || copied.descriptor.revision !== descriptor.revision
        ) {
            return;
        }
        const worker = this.ensureWorker();
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
        const request: AnalysisJobRequest = {
            kind: 'analyze',
            jobId,
            generation,
            trackHash: identity.trackHash,
            config,
            featureIds: misses,
            cursorFeatureIds: [...this.snapshot.activeFeatureIds],
            pcm: copied.pcm.buffer as ArrayBuffer,
            durationSeconds: copied.descriptor.durationSeconds,
        };
        worker.postMessage(request, [request.pcm]);
    }

    private restoreCacheHits(
        trackId: string,
        trackHash: string,
        configHash: string,
        featureIds: readonly FeatureId[],
    ): FeatureId[] {
        const cache = this.restoredCache;
        if (
            !cache
            || cache.manifest.trackId !== trackId
            || cache.manifest.trackHash !== trackHash
            || cache.manifest.configHash !== configHash
        ) {
            return [];
        }
        const payloads = new Map(
            cache.payloads.map((entry) => [entry.cacheKey, entry.payload]),
        );
        const hits: FeatureId[] = [];
        for (const featureId of featureIds) {
            const cacheKey = createAnalysisCacheKey(
                trackHash,
                configHash,
                featureId,
            );
            const payload = payloads.get(cacheKey);
            if (!payload) continue;
            try {
                const series = decodeAnalysisSeries(payload, {
                    trackHash,
                    configHash,
                    featureId,
                });
                this.series.set(featureId, series);
                hits.push(featureId);
            } catch {
                // Corrupt cache entries are treated as misses and replaced
                // atomically once the current analysis result is ready.
            }
        }
        return hits;
    }

    private ensureWorker(): AnalysisWorkerPort {
        if (this.worker) return this.worker;
        const worker = this.workerFactory();
        worker.onmessage = (event) => {
            this.handleWorkerMessage(event.data);
        };
        worker.onerror = (event) => {
            if (this.disposed) return;
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
            !active
            || message.jobId !== active.jobId
            || message.generation !== active.generation
            || active.generation !== this.snapshot.generation
        ) {
            this.publish({
                ...this.snapshot,
                staleMessageCount: this.snapshot.staleMessageCount + 1,
            });
            return;
        }
        if (message.kind === 'progress') {
            const completedFrames = Math.max(
                this.snapshot.completedFrames,
                message.completedFrames,
            );
            const totalFrames = Math.max(
                completedFrames,
                message.totalFrames,
            );
            this.publish({
                ...this.snapshot,
                completedFrames,
                totalFrames,
                progress: totalFrames === 0
                    ? 0
                    : completedFrames / totalFrames,
            });
            return;
        }
        if (message.kind === 'error') {
            this.publishError(
                active.generation,
                message.code,
                message.message,
                message.recoverable,
            );
            return;
        }
        if (
            message.trackHash !== active.trackHash
            || message.configHash !== active.configHash
            || message.series.some((series) =>
                series.trackHash !== active.trackHash
                || series.configHash !== active.configHash
                || !active.requestedFeatureIds.includes(series.featureId))
        ) {
            this.publish({
                ...this.snapshot,
                staleMessageCount: this.snapshot.staleMessageCount + 1,
            });
            return;
        }
        for (const series of message.series) {
            this.series.set(series.featureId, series);
        }
        this.publish({
            ...this.snapshot,
            state: 'ready',
            readyFeatureIds: this.snapshot.activeFeatureIds.filter(
                (featureId) => this.series.has(featureId),
            ),
            completedFrames: Math.max(
                this.snapshot.completedFrames,
                this.snapshot.totalFrames,
            ),
            progress: 1,
            error: undefined,
        });
        void this.persistSeries(active.generation);
    }

    private handleCursorResult(
        result: AnalysisCursorValueResult,
    ): void {
        const pending = this.cursorRequests.get(result.featureId);
        if (
            !pending
            || pending.requestId !== result.requestId
            || result.generation !== this.snapshot.generation
            || result.trackHash !== this.snapshot.trackHash
            || result.configHash !== this.snapshot.configHash
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
            !pending
            || pending.requestId !== result.requestId
            || result.generation !== this.snapshot.generation
            || result.trackHash !== this.snapshot.trackHash
            || result.configHash !== this.snapshot.configHash
            || this.activeConsumer?.consumer !== 'editor'
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
        const payloads: ReplaceCurrentAnalysisCacheInput['payloads'] = [];
        for (const featureId of this.snapshot.activeFeatureIds) {
            const series = this.series.get(featureId);
            if (!series) continue;
            payloads.push({
                featureId,
                cacheKey: createAnalysisCacheKey(
                    trackHash,
                    configHash,
                    featureId,
                ),
                payload: encodeAnalysisSeries(series),
            });
        }
        try {
            const result =
                await this.repository.replaceCurrentAnalysisCache({
                    trackId,
                    trackHash,
                    configHash,
                    payloads,
                });
            if (!this.isCurrentGeneration(generation)) return;
            if (result === 'stale') {
                this.publish({
                    ...this.snapshot,
                    staleMessageCount: this.snapshot.staleMessageCount + 1,
                });
                return;
            }
            const manifest = payloads.length === 0
                ? null
                : {
                    trackId,
                    trackHash,
                    configHash,
                    featureIds: payloads.map((entry) => entry.featureId),
                    cacheKeys: payloads.map((entry) => entry.cacheKey),
                };
            this.store.setAnalysisCacheManifest(manifest);
            this.restoredCache = payloads.length === 0
                ? null
                : {
                    manifest: manifest!,
                    payloads: payloads.map((entry) => ({
                        cacheKey: entry.cacheKey,
                        payload: entry.payload,
                    })),
                };
            this.publish({
                ...this.snapshot,
                cacheState: payloads.length === 0
                    ? 'idle'
                    : this.snapshot.cacheState === 'hit'
                        ? 'hit'
                        : 'persisted',
            });
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
        if (
            playback.state === 'empty'
            || playback.state === 'loading'
            || playback.state === 'error'
        ) {
            this.lastDescriptorRevision = null;
            this.cancelActiveJob('cancelled');
            this.series.clear();
            this.publish({
                ...this.snapshot,
                state: this.snapshot.activeFeatureIds.length === 0
                    ? 'idle'
                    : 'copying',
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
        if (
            !descriptor
            || descriptor.revision === this.lastDescriptorRevision
        ) {
            return;
        }
        this.lastDescriptorRevision = descriptor.revision;
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

    private cancelActiveJob(state: 'cancelled'): void {
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
        this.resolveTempoRequest();
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
        this.tempoRequest.resolve(null);
        this.tempoRequest = null;
    }

    private publishError(
        generation: number,
        code: AnalysisErrorCode,
        message: string,
        recoverable: boolean,
    ): void {
        if (!this.isCurrentGeneration(generation)) return;
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
        this.snapshot = cloneSnapshot(snapshot);
        this.store.setAnalysis(this.snapshot);
        const next = this.getSnapshot();
        for (const listener of this.listeners) listener(next);
    }
}

export const analysisCoordinatorKey: InjectionKey<AnalysisCoordinator> =
    Symbol('analysis-coordinator');

export const useAnalysisCoordinator = (): AnalysisCoordinator => {
    const coordinator = inject(analysisCoordinatorKey);
    if (!coordinator) {
        throw new Error('AnalysisCoordinator has not been provided.');
    }
    return coordinator;
};
