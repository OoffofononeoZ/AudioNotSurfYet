import type { EditorSeparationService } from '../processing/editorSeparationService';
import type { StemRole } from '../processing/modelManifest';
import { jobDirectory, checkCapacity } from '../processing/storage';
import { hashBytes } from '../processing/sha256';
import { createAnalysisConfig } from './config';
import { encodeAnalysisSeries, decodeAnalysisSeries } from './compactCodec';
import { wallpaperFrameIndex } from './wallpaperSpectrum';
import { StemWaveformFrames } from './stemWaveformFrames';
import type { AnalysisInput } from './sources';
import type { StemPcmSource, StemWorkerRequest, StemWorkerResponse } from './stemProtocol';
import type { AnalysisCoordinatorSnapshot, AnalysisCursorValueResult, AnalysisSeries, FeatureId } from './types';
import type { AnalysisWindowInput, AnalysisWindowSeries } from './windowTypes';

interface SourceState {
    snapshot: AnalysisCoordinatorSnapshot;
    source?: StemPcmSource;
    series: Map<FeatureId, AnalysisSeries>;
    requestId?: string;
}
const empty = (generation: number): AnalysisCoordinatorSnapshot => ({
    state: 'idle',
    generation,
    trackId: null,
    trackHash: null,
    configHash: null,
    sampleRate: 44100,
    activeFeatureIds: [],
    readyFeatureIds: [],
    completedFrames: 0,
    totalFrames: 0,
    progress: 0,
    cacheState: 'idle',
    staleMessageCount: 0,
});

/** Source-scoped jobs share the coordinator's single worker and route lease. */
export class StemAnalysisRuntime {
    private epoch = 0;
    private requests: AnalysisInput[] = [];
    private states = new Map<StemRole, SourceState>();
    private waveforms = new Map<StemRole, StemWaveformFrames>();
    private pending = new Map<
        string,
        {
            resolve: (value: AnalysisCursorValueResult | AnalysisWindowSeries | null) => void;
            timer: ReturnType<typeof setTimeout>;
            abort?: () => void;
        }
    >();
    private clearWaiters = new Map<string, () => void>();
    private resultKey = '';
    private unsubscribe: () => void;
    private unregister: () => void;
    private operations = new Set<Promise<unknown>>();
    private service: EditorSeparationService;
    private trackHash: () => { id: string; hash: string } | null;
    private post: (request: StemWorkerRequest) => void;
    private changed: () => void;
    constructor(
        service: EditorSeparationService,
        trackHash: () => { id: string; hash: string } | null,
        post: (request: StemWorkerRequest) => void,
        changed: () => void,
    ) {
        this.service = service;
        this.trackHash = trackHash;
        this.post = post;
        this.changed = changed;
        this.unsubscribe = service.subscribe(() => {
            const state = service.getSnapshot(),
                key = JSON.stringify([state.trackId, state.status, state.result?.source.directory ?? null]);
            if (key !== this.resultKey) {
                this.resultKey = key;
                this.restart();
            }
        });
        this.unregister = service.registerSourceConsumer(() => this.invalidate());
    }
    getSnapshot(role: StemRole): AnalysisCoordinatorSnapshot {
        const state = this.states.get(role)?.snapshot ?? empty(this.epoch);
        return { ...state, activeFeatureIds: [...state.activeFeatureIds], readyFeatureIds: [...state.readyFeatureIds] };
    }
    getSeries(role: StemRole, featureId: FeatureId) {
        return this.states.get(role)?.series.get(featureId) ?? null;
    }
    setRequests(inputs: readonly AnalysisInput[], force = false) {
        const next = inputs.filter(i => i.stemRole);
        if (!force && JSON.stringify(next) === JSON.stringify(this.requests)) return;
        this.requests = next.map(i => ({ ...i }));
        this.restart();
    }
    private restart() {
        const cleanup = this.invalidate();
        const epoch = this.epoch,
            state = this.service.getSnapshot(),
            track = this.trackHash(),
            trackHash = track?.hash ?? null;
        const available =
            state.status === 'ready' &&
            !!state.result &&
            state.trackId === track?.id &&
            state.result.source.descriptor.trackId === track?.id;
        if (!this.requests.length) return;
        const groups = new Map<StemRole, FeatureId[]>();
        for (const input of this.requests) {
            const role = input.stemRole!;
            const ids = groups.get(role) ?? [];
            if (!ids.includes(input.featureId)) ids.push(input.featureId);
            groups.set(role, ids);
        }
        for (const [role, ids] of groups)
            this.states.set(role, {
                series: new Map(),
                snapshot: {
                    ...empty(epoch),
                    state: available ? 'copying' : 'error',
                    trackId: track?.id ?? null,
                    trackHash,
                    activeFeatureIds: ids,
                    ...(available
                        ? {}
                        : {
                              error: {
                                  code: 'audio-not-ready' as const,
                                  message: '需完成音频分离。',
                                  recoverable: true,
                              },
                          }),
                },
            });
        this.changed();
        if (!available || !state.result || !trackHash) return;
        const result = state.result;
        const operation = (async () => {
            await cleanup;
            for (const [role, ids] of groups) {
                if (epoch !== this.epoch) return;
                const current = this.states.get(role)!;
                try {
                    const artifact = result.stems.find(s => s.role === role)!;
                    const directory = await jobDirectory(result.source.directory),
                        config = await createAnalysisConfig(44100);
                    const identity = JSON.stringify([
                        result.source.directory,
                        result.source.hash,
                        result.provenance,
                        role,
                    ]);
                    config.configHash = hashBytes(new TextEncoder().encode(`${config.configHash}:${identity}`));
                    const [left, right] = await Promise.all(
                        [artifact.left, artifact.right].map(async name =>
                            (await directory.getFileHandle(name)).getFile(),
                        ),
                    );
                    if (epoch !== this.epoch) return;
                    const source: StemPcmSource = {
                        role,
                        identity,
                        trackHash,
                        frames: artifact.frames,
                        config,
                        left: left!,
                        right: right!,
                    };
                    current.source = source;
                    current.snapshot.configHash = config.configHash;
                    for (const id of ids) {
                        try {
                            const file = await (await directory.getFileHandle(this.cacheName(source, id))).getFile();
                            const series = decodeAnalysisSeries(await file.arrayBuffer(), {
                                trackHash,
                                configHash: config.configHash,
                                featureId: id,
                            });
                            if (epoch !== this.epoch) return;
                            current.series.set(id, series);
                        } catch {
                            /* A missing or invalid derived cache is recomputed. */
                        }
                    }
                    if (epoch !== this.epoch) return;
                    const misses = ids.filter(id => !current.series.has(id));
                    current.snapshot = {
                        ...current.snapshot,
                        state: misses.length ? 'analyzing' : 'ready',
                        readyFeatureIds: ids.filter(id => current.series.has(id)),
                        cacheState: misses.length ? (current.series.size ? 'partial' : 'miss') : 'hit',
                        progress: misses.length ? 0 : 1,
                    };
                    current.requestId = crypto.randomUUID();
                    this.post({
                        kind: 'stem-analyze',
                        epoch,
                        requestId: current.requestId,
                        source,
                        featureIds: misses,
                    });
                    this.changed();
                } catch (error) {
                    if (epoch === this.epoch) {
                        current.snapshot.state = 'error';
                        current.snapshot.error = {
                            code: 'extract-failed',
                            message: error instanceof Error ? error.message : '分轨分析失败。',
                            recoverable: true,
                        };
                        this.changed();
                    }
                }
            }
        })();
        this.track(operation);
    }
    private cacheName(source: StemPcmSource, id: FeatureId) {
        return `analysis-${source.role}-${source.config.configHash}-${id}.bin`;
    }
    private track(operation: Promise<unknown>) {
        this.operations.add(operation);
        void operation.finally(() => this.operations.delete(operation)).catch(() => {});
    }
    handle(message: StemWorkerResponse) {
        if (message.kind === 'stem-cleared') {
            this.clearWaiters.get(message.requestId)?.();
            this.clearWaiters.delete(message.requestId);
            return;
        }
        if (message.epoch !== this.epoch) return;
        if (message.kind === 'stem-value') {
            this.resolve(message.requestId, message.value ?? message.window);
            return;
        }
        const state = this.states.get(message.role);
        if (!state) return;
        if (message.kind === 'stem-error') {
            if (this.pending.has(message.requestId)) {
                this.resolve(message.requestId, null);
                return;
            }
            if (state.requestId !== message.requestId) return;
            state.snapshot = {
                ...state.snapshot,
                state: 'error',
                error: { code: 'extract-failed', message: message.message, recoverable: true },
            };
        } else if (message.requestId !== state.requestId) return;
        else if (message.kind === 'stem-progress')
            state.snapshot.progress = Math.max(state.snapshot.progress, message.progress);
        else if (message.kind === 'stem-result') {
            if (
                message.series.some(
                    s =>
                        s.trackHash !== state.source?.trackHash ||
                        s.configHash !== state.source.config.configHash ||
                        !state.snapshot.activeFeatureIds.includes(s.featureId),
                )
            )
                return;
            for (const series of message.series) state.series.set(series.featureId, series);
            state.snapshot = {
                ...state.snapshot,
                state: 'ready',
                readyFeatureIds: [...state.snapshot.activeFeatureIds],
                progress: 1,
                error: undefined,
            };
            this.track(this.persist(state, message.series, this.epoch));
        }
        this.changed();
    }
    private async persist(state: SourceState, series: AnalysisSeries[], epoch: number) {
        if (!series.length || !state.source) return;
        try {
            const result = this.service.getSnapshot().result;
            if (!result || epoch !== this.epoch) return;
            const directory = await jobDirectory(result.source.directory);
            for (const value of series) {
                const bytes = encodeAnalysisSeries(value);
                await checkCapacity(bytes.byteLength, this.service.getSnapshot().cacheLimit);
                if (epoch !== this.epoch) return;
                const writer = await (
                    await directory.getFileHandle(this.cacheName(state.source, value.featureId), { create: true })
                ).createWritable();
                try {
                    await writer.write(bytes);
                    if (epoch !== this.epoch) {
                        await writer.abort();
                        return;
                    }
                    await writer.close();
                } catch (error) {
                    await writer.abort().catch(() => {});
                    throw error;
                }
            }
            if (epoch === this.epoch && state.snapshot.cacheState !== 'hit') state.snapshot.cacheState = 'persisted';
        } catch {
            if (epoch === this.epoch) state.snapshot.cacheState = 'not-persisted';
        }
        if (epoch === this.epoch) this.changed();
    }
    read(
        role: StemRole,
        featureId: FeatureId,
        timeSeconds: number,
        window?: AnalysisWindowInput,
        signal?: AbortSignal,
    ): Promise<AnalysisCursorValueResult | AnalysisWindowSeries | null> {
        const state = this.states.get(role);
        if (signal?.aborted || !state?.source || state.snapshot.state !== 'ready' || !state.series.has(featureId))
            return Promise.resolve(null);
        if (!window && featureId === 'wallpaperEngineSpectrum') {
            const series = state.series.get(featureId)!;
            if (series.payload.kind !== 'stereo-spectrum-f32') return Promise.resolve(null);
            const index = wallpaperFrameIndex(timeSeconds, series.sampleCount);
            return Promise.resolve({
                kind: 'cursor-value-result',
                requestId: crypto.randomUUID(),
                generation: this.epoch,
                trackHash: series.trackHash,
                configHash: series.configHash,
                featureId,
                frameStartSeconds: index / 30,
                value: Array.from(series.payload.values.subarray(index * 128, (index + 1) * 128)),
            });
        }
        const requestId = crypto.randomUUID();
        return new Promise(resolve => {
            const abort = signal ? () => this.resolve(requestId, null) : undefined;
            this.pending.set(requestId, {
                resolve,
                timer: setTimeout(() => this.resolve(requestId, null), 15000),
                abort: abort ? () => signal!.removeEventListener('abort', abort) : undefined,
            });
            if (abort) signal!.addEventListener('abort', abort, { once: true });
            this.post({ kind: 'stem-read', requestId, epoch: this.epoch, role, featureId, timeSeconds, window });
        });
    }
    private resolve(id: string, value: AnalysisCursorValueResult | AnalysisWindowSeries | null) {
        const pending = this.pending.get(id);
        if (pending) {
            clearTimeout(pending.timer);
            pending.abort?.();
            this.pending.delete(id);
            pending.resolve(value);
        }
    }
    async invalidate() {
        const hadWork = this.states.size > 0,
            epoch = ++this.epoch;
        this.states.clear();
        this.waveforms.clear();
        for (const id of this.pending.keys()) this.resolve(id, null);
        // Capture current I/O only; a newly scheduled activation waits for this cleanup.
        const operations = [...this.operations];
        const cleared = hadWork
            ? new Promise<void>(resolve => {
                  const requestId = crypto.randomUUID();
                  this.clearWaiters.set(requestId, resolve);
                  this.post({ kind: 'stem-clear', requestId, epoch });
              })
            : Promise.resolve();
        this.changed();
        await cleared;
        await Promise.allSettled(operations);
    }
    clear() {
        this.requests = [];
        void this.invalidate();
    }
    private waveform(role: StemRole) {
        const state = this.states.get(role);
        if (!state?.source || state.snapshot.state !== 'ready' || !state.series.has('buffer'))
            throw Error('分轨完整波形尚未就绪，请先完成分离与分析。');
        let frames = this.waveforms.get(role);
        if (!frames) {
            const epoch = this.epoch;
            frames = new StemWaveformFrames(state.source, () => epoch !== this.epoch);
            this.waveforms.set(role, frames);
        }
        return frames;
    }
    readWaveform(role: StemRole, time: number): readonly number[] | null {
        const frames = this.waveform(role),
            value = frames.read(time);
        if (!value)
            void this.prepareWaveform(role, time)
                .then(() => this.changed())
                .catch(() => {});
        return value;
    }
    async prepareWaveform(role: StemRole, time: number): Promise<void> {
        const operation = this.waveform(role).prepare(time);
        this.track(operation);
        await operation;
    }
    workerFailed(message: string) {
        for (const resolve of this.clearWaiters.values()) resolve();
        this.clearWaiters.clear();
        for (const id of this.pending.keys()) this.resolve(id, null);
        for (const state of this.states.values()) {
            state.snapshot.state = 'error';
            state.snapshot.error = { code: 'worker-failed', message, recoverable: true };
        }
        this.changed();
    }
    async dispose() {
        this.requests = [];
        this.unsubscribe();
        this.unregister();
        await this.invalidate();
    }
}
