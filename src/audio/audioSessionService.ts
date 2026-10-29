import type { InjectionKey } from 'vue';
import { inject, shallowReactive } from 'vue';
import Meyda from 'meyda';
import { parseBlob } from 'music-metadata';
import { AudioEngine, AudioTransportError, type AudioPlaybackCheckpoint } from './audioEngine';
import { cloneSourceWorkspace } from '../analysis/sourceWorkspace';
import {
    InvalidPersistedSessionError,
    SessionRepository,
    UnsupportedSessionSchemaError,
    type PersistedCurrentInput,
    type PersistedQueueInput,
    type SessionRepositoryPort,
} from '../persistence/sessionRepository';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type { DecodedAudioDescriptor, LocalAudioInput, PlaybackSnapshot, TrackRecord } from '../types/audio';
import {
    activeCardsToFeatureQueue,
    activeFeatureQueueToCards,
    assertValidAnalysisWorkspace,
    cloneActiveFeatureQueue,
    clonePersistedTimelineViewport,
    DEFAULT_PERSISTED_ANALYSIS_CONFIG,
    type AnalysisWorkspaceUpdate,
    type PersistedSessionV1,
    type StoredAnalysisCache,
    type StoredHandle,
} from '../types/session';
import { PlaybackPolicy, type PlaybackMode } from './playbackPolicy';
import { assertPlaybackRate } from './playbackRate';
import type { AudioPreparationPort, PreparedDecodedAudio, PreparedLocalAudio } from './preparedAudio';
import type { AudioFileAccess, LocalFileReference } from '../platform/fileContracts';
import { BrowserAudioFiles } from '../platform/webAudioFiles';

export interface TrackNavigation {
    select(trackId: string): Promise<void>;
    beforeMutation(nextTrackId: string | null): Promise<boolean>;
    cleared(): Promise<void>;
}

export interface ExportTransportLease {
    release(): void;
}

type AudioSessionStore = ReturnType<typeof useAudioSessionStore>;
type AnimationFrameCallback = (timestamp: number) => void;
type RequestFrame = (callback: AnimationFrameCallback) => number;
type CancelFrame = (handle: number) => void;

interface ParsedMetadata {
    common: {
        title?: string;
        artist?: string;
        album?: string;
        picture?: Array<{
            data: Uint8Array;
            format: string;
        }>;
    };
    format: {
        duration?: number;
        sampleRate?: number;
    };
}

type MetadataParser = (file: Blob) => Promise<ParsedMetadata>;
type FilePicker = (options: { multiple: boolean }) => Promise<LocalFileReference[]>;
type FileHasher = (file: Blob) => Promise<string>;

interface RuntimeTrack {
    file?: File;
    handle?: LocalFileReference;
    artworkUrl?: string;
}

export interface AudioSessionServiceOptions {
    engine?: AudioEnginePort;
    repository?: SessionRepositoryPort;
    parseMetadata?: MetadataParser;
    pickFiles?: FilePicker;
    fileAccess?: AudioFileAccess;
    hashFile?: FileHasher;
    createObjectURL?: (blob: Blob) => string;
    revokeObjectURL?: (url: string) => void;
    requestFrame?: RequestFrame;
    cancelFrame?: CancelFrame;
    createTrackId?: () => string;
}

export type RoutePlaybackConsumer = 'editor' | 'visualizer';
export type RouteEndedPolicy = 'repeat-one' | 'pause-at-end';

export interface RoutePlaybackLease {
    readonly token: string;
    readonly consumer: RoutePlaybackConsumer;
    readonly trackId: string;
    readonly endedPolicy: RouteEndedPolicy;
    release(): void;
}

export class RoutePlaybackUnavailableError extends Error {
    readonly trackId: string;

    constructor(trackId: string, message = 'The requested route track is unavailable.') {
        super(message);
        this.name = 'RoutePlaybackUnavailableError';
        this.trackId = trackId;
    }
}

export interface AudioEnginePort extends AudioPreparationPort {
    load(input: { trackId: string; encodedAudio: ArrayBuffer }): Promise<'loaded' | 'stale'>;
    play(): Promise<void>;
    pause(): void;
    seek(seconds: number): Promise<void>;
    setVolume(volume: number): void;
    setPlaybackRate(rate: number): Promise<void>;
    setAuditionSource(
        source: import('./auditionTypes').AuditionSource | null,
        options?: { play?: boolean },
    ): Promise<void>;
    setAuditionMuted(role: string, muted: boolean): void;
    getSnapshot(): PlaybackSnapshot;
    getTimeDomainFloatData(): Float32Array | null;
    getDecodedAudioDescriptor(): DecodedAudioDescriptor | null;
    capturePlaybackCheckpoint(): AudioPlaybackCheckpoint | null;
    restorePlaybackCheckpoint(checkpoint: AudioPlaybackCheckpoint): Promise<void>;
    copyDecodedChannelRange(input: {
        revision: number;
        channel: number;
        start: number;
        length: number;
    }): Float32Array | null;
    subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void;
    unload(): void;
    dispose(): Promise<void>;
}

const defaultRequestFrame: RequestFrame = callback => requestAnimationFrame(callback);
const defaultCancelFrame: CancelFrame = handle => cancelAnimationFrame(handle);

export const sha256Blob: FileHasher = async file => {
    const content = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', content);
    return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
};

const isAbortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

const isMissingFileError = (error: unknown) =>
    error instanceof DOMException && ['NotFoundError', 'NotReadableError'].includes(error.name);

export class AudioSessionService {
    readonly playbackPolicy = new PlaybackPolicy();
    private exportTransportToken: symbol | null = null;
    private trackNavigation: { token: symbol; commands: TrackNavigation } | null = null;
    private pendingQueueCommands = 0;
    private readonly store: AudioSessionStore;
    private readonly engine: AudioEnginePort;
    private transportRevision = 0;
    private readonly repository: SessionRepositoryPort;
    private readonly parseMetadata: MetadataParser;
    private readonly pickFiles: FilePicker;
    private readonly fileAccess: AudioFileAccess;
    private fileSelection: AbortController | null = null;
    private readonly hashFile: FileHasher;
    private readonly createObjectURL: (blob: Blob) => string;
    private readonly revokeObjectURL: (url: string) => void;
    private readonly requestFrame: RequestFrame;
    private readonly cancelFrame: CancelFrame;
    private readonly createTrackId: () => string;
    private readonly runtimeTracks = shallowReactive(new Map<string, RuntimeTrack>());
    private readonly unsubscribeEngine: () => void;
    private readonly playbackListeners = new Set<(snapshot: PlaybackSnapshot) => void>();
    private readonly playbackDiscontinuityListeners = new Set<() => void>();
    private commandGeneration = 0;
    private importGeneration = 0;
    private readonly preparedLocalAudio = new Map<
        symbol,
        { input: LocalAudioInput; track: TrackRecord; decoded: PreparedDecodedAudio | null; generation: number }
    >();
    private frameHandle: number | null = null;
    private activeRoutePlayback: {
        token: string;
        consumer: RoutePlaybackConsumer;
        trackId: string;
        endedPolicy: RouteEndedPolicy;
    } | null = null;
    private routeRepeatInFlight = false;
    private workspaceSaveRevision = 0;
    private workspaceSaveTail: Promise<void> = Promise.resolve();
    private disposed = false;

    constructor(store: AudioSessionStore, options: AudioSessionServiceOptions = {}) {
        this.store = store;
        this.engine = options.engine ?? new AudioEngine();
        this.repository = options.repository ?? new SessionRepository();
        this.parseMetadata = options.parseMetadata ?? (file => parseBlob(file) as Promise<ParsedMetadata>);
        this.fileAccess = options.fileAccess ?? new BrowserAudioFiles();
        this.pickFiles = options.pickFiles ?? (options => this.fileAccess.choose(options));
        this.hashFile = options.hashFile ?? sha256Blob;
        this.createObjectURL = options.createObjectURL ?? (blob => URL.createObjectURL(blob));
        this.revokeObjectURL = options.revokeObjectURL ?? (url => URL.revokeObjectURL(url));
        this.requestFrame = options.requestFrame ?? defaultRequestFrame;
        this.cancelFrame = options.cancelFrame ?? defaultCancelFrame;
        this.createTrackId = options.createTrackId ?? (() => crypto.randomUUID());
        this.unsubscribeEngine = this.engine.subscribe(snapshot => {
            this.handleEngineSnapshot(snapshot);
        });
    }

    async initialize(
        onRestoredCache?: (cache: StoredAnalysisCache | undefined) => void,
    ): Promise<StoredAnalysisCache | undefined> {
        if (this.disposed) return undefined;
        const generation = ++this.importGeneration;
        const commandGeneration = ++this.commandGeneration;
        this.store.setPersistence({ state: 'restoring' });

        let restored;
        try {
            restored = await this.repository.restore();
        } catch (error) {
            if (generation !== this.importGeneration || this.disposed) return;
            if (error instanceof UnsupportedSessionSchemaError) {
                this.store.setPersistence({
                    state: 'unsupported-schema',
                    message: '检测到无法识别的会话版本，请清除旧会话后重试。',
                });
            } else {
                this.store.setPersistence({
                    state: 'restore-error',
                    message:
                        error instanceof InvalidPersistedSessionError
                            ? '已保存的会话数据无效，请清除旧会话。'
                            : '无法读取已保存的会话，当前仍可使用内存播放。',
                });
            }
            return undefined;
        }

        if (generation !== this.importGeneration || this.disposed) {
            return undefined;
        }
        if (!restored) {
            this.store.setPersistence({ state: 'ready' });
            return undefined;
        }
        // Publish cache identity before loading decoded audio can activate a route consumer.
        onRestoredCache?.(restored.currentAnalysisCache);

        for (const trackId of [...this.runtimeTracks.keys()]) {
            this.releaseRuntimeTrack(trackId);
        }
        const handles = new Map(restored.handles.map(entry => [entry.trackId, entry.handle]));
        for (const track of restored.session.queue) {
            this.runtimeTracks.set(track.id, {
                handle: handles.get(track.id),
            });
        }

        this.store.hydrateSession(
            restored.session.queue,
            restored.session.currentTrackId,
            this.engine.getSnapshot().volume,
            {
                activeFeatureQueue: activeCardsToFeatureQueue(restored.session.activeCards),
                sources: restored.session.analysisSources,

                viewport: restored.session.viewport,
            },
        );
        this.store.setAnalysisCacheManifest(restored.session.currentAnalysisCache ?? null);

        const currentTrackId = restored.session.currentTrackId;
        let currentAvailable = false;
        let currentBlobChanged = false;
        const requireReference =
            this.fileAccess.restoreFromReferenceFirst && !!this.getTrack(currentTrackId)?.handleKey;
        if (
            !requireReference &&
            currentTrackId &&
            restored.currentBlob &&
            restored.currentBlob.trackId === currentTrackId
        ) {
            const record = this.getTrack(currentTrackId);
            if (record) {
                const currentBlobHash = await this.hashFile(restored.currentBlob.blob);
                if (generation !== this.importGeneration || this.disposed) return;
                if (currentBlobHash === record.trackHash) {
                    const file = new File([restored.currentBlob.blob], record.name, {
                        type: record.mimeType,
                        lastModified: record.lastModified,
                    });
                    if (
                        !(await this.registerRuntimeFile(
                            currentTrackId,
                            file,
                            handles.get(currentTrackId),
                            () => generation === this.importGeneration && !this.disposed,
                        ))
                    )
                        return;
                    this.store.updateTrack(currentTrackId, {
                        restoreState: 'available',
                    });
                    if (this.commandGeneration === commandGeneration)
                        await this.loadRuntimeTrack(currentTrackId, false);
                    currentAvailable = true;
                } else {
                    currentBlobChanged = true;
                    this.store.updateTrack(currentTrackId, {
                        restoreState: 'content-changed',
                    });
                }
            }
        }
        if (currentTrackId && !currentAvailable) {
            const currentHandle = this.runtimeTracks.get(currentTrackId)?.handle;
            const available = currentHandle ? await this.hydrateFromHandle(currentTrackId, false) : false;
            if (generation !== this.importGeneration || this.disposed) return;
            if (available) {
                if (this.commandGeneration === commandGeneration) await this.loadRuntimeTrack(currentTrackId, false);
            } else {
                if (!currentHandle && !currentBlobChanged) {
                    this.store.updateTrack(currentTrackId, {
                        restoreState: 'file-missing',
                    });
                }
                const currentTrack = this.getTrack(currentTrackId);
                if (this.commandGeneration === commandGeneration)
                    this.store.setPlayback({
                        trackId: currentTrackId,
                        state: 'empty',
                        currentTimeSeconds: 0,
                        durationSeconds: currentTrack?.durationSeconds ?? 0,
                        volume: this.engine.getSnapshot().volume,
                        playbackRate: this.engine.getSnapshot().playbackRate,
                    });
            }
        }

        if (generation !== this.importGeneration || this.disposed) {
            return;
        }

        for (const trackId of this.permissionQueryOrder(currentTrackId)) {
            if (generation !== this.importGeneration || this.disposed) {
                return undefined;
            }
            await this.hydrateFromHandle(trackId, false);
        }

        if (generation !== this.importGeneration || this.disposed) return;

        try {
            await this.persistQueue();
            if (generation !== this.importGeneration || this.disposed) return;
            this.store.setPersistence({ state: 'ready' });
        } catch {
            if (generation !== this.importGeneration || this.disposed) return;
            this.markPersistenceFailure();
        }
        return restored.currentAnalysisCache;
    }

    async selectAndImportFiles(): Promise<'imported' | 'cancelled'> {
        if (this.exportTransportToken) return 'cancelled';
        if (this.disposed) return 'cancelled';
        const task = this.beginFileSelection();
        try {
            const handles = await this.pickFiles({ multiple: true });
            if (task.signal.aborted || this.disposed || this.exportTransportToken || !handles.length)
                return 'cancelled';
            const inputs: LocalAudioInput[] = [];
            for (const handle of handles) {
                const file = await this.fileAccess.read(handle, task.signal);
                if (task.signal.aborted || this.disposed || this.exportTransportToken) return 'cancelled';
                inputs.push({ file, handle });
            }
            if (this.fileSelection === task) this.fileSelection = null;
            await this.importFiles(inputs);
            return 'imported';
        } catch (error) {
            if (isAbortError(error) || task.signal.aborted || this.disposed) return 'cancelled';
            throw error;
        } finally {
            if (this.fileSelection === task) this.fileSelection = null;
        }
    }

    private beginFileSelection(): AbortController {
        this.cancelFileSelection();
        const task = new AbortController();
        this.fileSelection = task;
        return task;
    }

    private cancelFileSelection() {
        this.fileSelection?.abort();
        this.fileSelection = null;
    }

    async prepareLocalAudio(input: LocalAudioInput, signal?: AbortSignal): Promise<PreparedLocalAudio> {
        const generation = this.commandGeneration;
        if (this.disposed || this.exportTransportToken || signal?.aborted)
            throw new DOMException('音频准备已取消。', 'AbortError');
        const [hash, metadata] = await Promise.all([
            this.hashFile(input.file),
            this.parseMetadata(input.file).catch(() => null),
        ]);
        const stale = () =>
            this.disposed || signal?.aborted || generation !== this.commandGeneration || !!this.exportTransportToken;
        if (stale()) throw new DOMException('音频准备已失效。', 'AbortError');
        const current = this.getTrack(this.store.currentTrackId);
        const descriptor = this.engine.getDecodedAudioDescriptor();
        const existing = current?.trackHash === hash && descriptor?.trackId === current.id ? descriptor : null;
        let decoded: PreparedDecodedAudio | DecodedAudioDescriptor;
        if (existing) decoded = existing;
        else {
            const bytes = await input.file.arrayBuffer();
            if (stale()) throw new DOMException('音频准备已失效。', 'AbortError');
            decoded = await this.engine.prepareEncodedAudio(bytes, signal);
        }
        const pending = existing ? null : (decoded as PreparedDecodedAudio);
        if (stale()) {
            if (pending) this.engine.discardPreparedAudio(pending.token);
            throw new DOMException('音频准备已失效。', 'AbortError');
        }
        const track: TrackRecord =
            existing && current
                ? { ...current, metadata: { ...current.metadata } }
                : {
                      id: this.createTrackId(),
                      name: input.file.name,
                      mimeType: input.file.type || 'application/octet-stream',
                      byteSize: input.file.size,
                      lastModified: input.file.lastModified,
                      durationSeconds: decoded.durationSeconds,
                      encodedSampleRate: decoded.sampleRate,
                      metadata: {
                          title: metadata?.common.title || input.file.name,
                          artist: metadata?.common.artist,
                          album: metadata?.common.album,
                      },
                      trackHash: hash,
                      restoreState: 'available',
                  };
        if (!existing && input.handle) track.handleKey = `handle:${track.id}`;
        const token = Symbol('prepared-local-audio');
        this.preparedLocalAudio.set(token, { input, track, decoded: pending, generation });
        return {
            token,
            track,
            descriptor: {
                durationSeconds: decoded.durationSeconds,
                sampleRate: decoded.sampleRate,
                length: decoded.length,
                channelCount: decoded.channelCount,
            },
        };
    }

    discardPreparedLocalAudio(token: symbol): void {
        const pending = this.preparedLocalAudio.get(token);
        if (pending?.decoded) this.engine.discardPreparedAudio(pending.decoded.token);
        this.preparedLocalAudio.delete(token);
    }

    commitPreparedLocalAudio(token: symbol): string {
        const pending = this.preparedLocalAudio.get(token);
        if (
            !pending ||
            this.disposed ||
            this.exportTransportToken ||
            pending.generation !== this.commandGeneration ||
            (pending.decoded && !this.engine.hasPreparedAudio(pending.decoded.token))
        )
            throw new Error('准备中的歌曲已失效，请重新预览。');
        this.preparedLocalAudio.delete(token);
        if (!pending.decoded) return pending.track.id;
        this.cancelFileSelection();
        ++this.importGeneration;
        const generation = ++this.commandGeneration;
        this.notifyPlaybackDiscontinuity();
        this.runtimeTracks.set(pending.track.id, {
            file: pending.input.file,
            handle: pending.input.handle,
        });
        this.store.appendTracks([pending.track]);
        this.store.setCurrentTrack(pending.track.id);
        this.store.setEnergy(0);
        this.engine.commitPreparedAudio(pending.decoded.token, pending.track.id);
        void this.persistCurrent(pending.track.id, pending.input.file, generation);
        return pending.track.id;
    }

    async importFiles(inputs: LocalAudioInput[]): Promise<void> {
        if (this.exportTransportToken) return;
        if (this.disposed || inputs.length === 0) return;
        this.cancelFileSelection();

        const importGeneration = ++this.importGeneration;
        const shouldAutoplay = this.store.queue.length === 0 && !this.activeRoutePlayback && !this.trackNavigation;
        const records: TrackRecord[] = [];

        for (const input of inputs) {
            const { file } = input;
            const trackId = this.createTrackId();
            const trackHash = await this.hashFile(file);
            let metadata: ParsedMetadata | null = null;
            try {
                metadata = await this.parseMetadata(file);
            } catch {
                // Metadata is optional; decoding still gets a chance to succeed.
            }
            if (this.disposed || importGeneration !== this.importGeneration) {
                return;
            }

            const record: TrackRecord = {
                id: trackId,
                name: file.name || 'unknown',
                mimeType: file.type || 'application/octet-stream',
                byteSize: file.size,
                lastModified: file.lastModified,
                durationSeconds: metadata?.format.duration,
                encodedSampleRate: metadata?.format.sampleRate,
                metadata: {
                    title: metadata?.common.title || file.name || 'unknown',
                    artist: metadata?.common.artist,
                    album: metadata?.common.album,
                    artworkMimeType: metadata?.common.picture?.[0]?.format,
                },
                trackHash,
                handleKey: input.handle ? `handle:${trackId}` : undefined,
                restoreState: input.handle ? 'available' : 'not-persisted',
            };
            records.push(record);
            this.runtimeTracks.set(trackId, {
                file,
                handle: input.handle,
                artworkUrl: this.createArtwork(metadata),
            });
        }

        this.store.appendTracks(records);
        try {
            await this.persistQueue();
            if (records.some(record => !record.handleKey)) {
                this.store.setPersistence({
                    state: 'not-persisted',
                    message: '部分歌曲没有文件句柄，刷新后可能无法恢复。',
                });
            } else {
                this.store.setPersistence({ state: 'ready' });
            }
        } catch {
            for (const record of records) {
                this.store.updateTrack(record.id, {
                    restoreState: 'not-persisted',
                });
            }
            this.markPersistenceFailure();
        }

        if (shouldAutoplay && records[0]) {
            await this.playTrack(records[0].id);
        }
    }

    attachTrackNavigation(commands: TrackNavigation): () => void {
        const token = Symbol('track-navigation');
        this.trackNavigation = { token, commands };
        return () => {
            if (this.trackNavigation?.token === token) this.trackNavigation = null;
        };
    }

    async playTrack(trackId: string): Promise<void> {
        if (this.exportTransportToken) return;
        if (this.trackNavigation) {
            if (trackId === this.store.currentTrackId) await this.restartCurrent();
            else await this.trackNavigation.commands.select(trackId);
            return;
        }
        await this.loadRuntimeTrack(trackId, true);
    }

    async acquireRoutePlayback(input: {
        consumer: RoutePlaybackConsumer;
        trackId: string;
    }): Promise<RoutePlaybackLease> {
        const { consumer, trackId } = input;
        if (this.disposed) {
            throw new RoutePlaybackUnavailableError(trackId);
        }
        const record = this.getTrack(trackId);
        if (!record?.trackHash) {
            throw new RoutePlaybackUnavailableError(trackId, '找不到目标歌曲或歌曲内容身份尚未就绪。');
        }
        const descriptor = this.engine.getDecodedAudioDescriptor();
        if (descriptor?.trackId !== trackId) {
            await this.loadRuntimeTrack(trackId, false);
        }
        const currentDescriptor = this.engine.getDecodedAudioDescriptor();
        if (
            currentDescriptor?.trackId !== trackId ||
            this.store.playback.trackId !== trackId ||
            ['empty', 'loading', 'error'].includes(this.store.playback.state)
        ) {
            throw new RoutePlaybackUnavailableError(
                trackId,
                '歌曲文件当前不可恢复，请先在播放器中恢复访问或重新选择。',
            );
        }
        const token = crypto.randomUUID();
        const endedPolicy: RouteEndedPolicy = 'repeat-one';
        this.playbackPolicy.setRouteActive(true);
        this.activeRoutePlayback = {
            token,
            consumer,
            trackId,
            endedPolicy,
        };
        let released = false;
        return {
            token,
            consumer,
            trackId,
            endedPolicy,
            release: () => {
                if (released) return;
                released = true;
                if (this.activeRoutePlayback?.token === token) {
                    this.activeRoutePlayback = null;
                    this.playbackPolicy.setRouteActive(false);
                }
            },
        };
    }

    getDecodedTrackDescriptor(trackId: string): DecodedAudioDescriptor | null {
        const descriptor = this.engine.getDecodedAudioDescriptor();
        return descriptor?.trackId === trackId ? { ...descriptor } : null;
    }

    capturePlaybackCheckpoint(trackId: string): AudioPlaybackCheckpoint {
        const checkpoint = this.engine.capturePlaybackCheckpoint();
        if (checkpoint?.trackId !== trackId) {
            throw new AudioTransportError('transport-unavailable', '当前播放歌曲与可视化工程不一致。');
        }
        return checkpoint;
    }

    restorePlaybackCheckpoint(checkpoint: AudioPlaybackCheckpoint): Promise<void> {
        this.notifyPlaybackDiscontinuity();
        return this.engine.restorePlaybackCheckpoint(checkpoint);
    }

    getPlaybackSnapshot(): PlaybackSnapshot {
        return this.engine.getSnapshot();
    }

    subscribePlaybackDiscontinuity(listener: () => void): () => void {
        this.playbackDiscontinuityListeners.add(listener);
        return () => this.playbackDiscontinuityListeners.delete(listener);
    }

    private notifyPlaybackDiscontinuity(): void {
        for (const listener of this.playbackDiscontinuityListeners) listener();
    }

    subscribePlayback(listener: (snapshot: PlaybackSnapshot) => void): () => void {
        this.playbackListeners.add(listener);
        listener({ ...this.store.playback });
        return () => this.playbackListeners.delete(listener);
    }

    pause(): void {
        if (this.disposed) return;
        ++this.transportRevision;
        this.engine.pause();
    }

    async play(): Promise<void> {
        if (this.disposed) return;
        ++this.transportRevision;
        await this.engine.play();
    }

    async togglePlayback(): Promise<void> {
        if (this.disposed || this.store.queue.length === 0) return;
        ++this.transportRevision;

        if (this.store.playback.state === 'playing' || this.store.playback.state === 'buffering') {
            this.engine.pause();
            return;
        }

        if (
            this.store.playback.state === 'paused' ||
            this.store.playback.state === 'ended' ||
            (this.store.playback.state === 'error' && this.store.playback.error?.code === 'audition-read')
        ) {
            try {
                await this.engine.play();
            } catch {
                // The engine snapshot carries the typed error for the UI.
            }
            return;
        }

        const trackId = this.store.currentTrackId ?? this.store.queue[0]?.id ?? null;
        if (trackId) await this.playTrack(trackId);
    }

    setPreferredPlaybackMode(mode: PlaybackMode): void {
        this.playbackPolicy.setPreferredMode(mode);
    }

    async next(): Promise<void> {
        await this.advance(1);
    }
    async previous(): Promise<void> {
        await this.advance(-1);
    }

    private async advance(delta: -1 | 1): Promise<void> {
        if (this.playbackPolicy.state.effectiveMode === 'repeat-one') {
            await this.restartCurrent();
            return;
        }
        if (this.exportTransportToken) return;
        const target = this.playbackPolicy.target(
            this.store.queue.map(track => track.id),
            this.store.currentTrackId,
            delta,
        );
        if (target) await this.playTrack(target);
    }

    private async restartCurrent(): Promise<void> {
        if (this.disposed || !this.store.currentTrackId) return;
        this.notifyPlaybackDiscontinuity();
        const trackId = this.store.currentTrackId;
        const revision = ++this.transportRevision;
        await this.engine.seek(0);
        if (this.disposed || revision !== this.transportRevision || this.store.currentTrackId !== trackId) return;
        await this.engine.play();
    }

    /** Protects the decoded source and queue while same-track playback remains available. */
    acquireExportTransport(trackId: string): ExportTransportLease {
        if (this.exportTransportToken || this.pendingQueueCommands > 0 || this.store.currentTrackId !== trackId) {
            throw new AudioTransportError('transport-busy', '播放命令已锁定或歌曲身份失效。');
        }
        const token = Symbol('export-transport');
        this.exportTransportToken = token;
        this.playbackPolicy.state.exportLocked = true;
        ++this.commandGeneration;
        ++this.importGeneration;
        return {
            release: () => {
                if (this.exportTransportToken !== token) return;
                this.exportTransportToken = null;
                this.playbackPolicy.state.exportLocked = false;
            },
        };
    }

    async seek(seconds: number): Promise<void> {
        if (this.disposed) return;
        this.notifyPlaybackDiscontinuity();
        ++this.transportRevision;
        try {
            await this.engine.seek(seconds);
        } catch {
            // The engine snapshot carries the typed error for the UI.
        }
    }

    async setAuditionSource(
        source: import('./auditionTypes').AuditionSource | null,
        options?: { play?: boolean },
    ): Promise<void> {
        if (this.disposed || this.exportTransportToken) {
            if (source) await source.close();
            return;
        }
        this.notifyPlaybackDiscontinuity();
        ++this.transportRevision;
        await this.engine.setAuditionSource(source, options);
    }

    setAuditionMuted(role: string, muted: boolean): void {
        if (!this.disposed && !this.exportTransportToken) this.engine.setAuditionMuted(role, muted);
    }

    async updateAnalysisWorkspace(workspace: AnalysisWorkspaceUpdate): Promise<void> {
        if (this.disposed) return;
        assertValidAnalysisWorkspace(workspace);
        const snapshot = {
            activeFeatureQueue: cloneActiveFeatureQueue(workspace.activeFeatureQueue),
            sources: cloneSourceWorkspace(workspace.sources ?? this.store.analysisWorkspace.sources),

            viewport: clonePersistedTimelineViewport(workspace.viewport),
        };
        this.store.setAnalysisWorkspace({
            initialized: true,
            ...snapshot,
        });
        const revision = ++this.workspaceSaveRevision;
        const input = this.persistedQueueInput();
        this.store.setPersistence({ state: 'saving' });
        const save = this.workspaceSaveTail.catch(() => undefined).then(() => this.repository.saveQueue(input));
        this.workspaceSaveTail = save.catch(() => undefined);
        try {
            await save;
            if (revision === this.workspaceSaveRevision && !this.disposed) {
                this.store.setPersistence({ state: 'ready' });
            }
        } catch {
            if (revision === this.workspaceSaveRevision && !this.disposed) {
                this.markPersistenceFailure('分析工作区已在当前页面生效，但无法跨刷新保存。');
            }
        }
    }

    setVolume(percent: number): void {
        const normalized = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0)) / 100;
        this.engine.setVolume(normalized);
    }

    async setPlaybackRate(rate: number): Promise<void> {
        assertPlaybackRate(rate);
        if (this.disposed || rate === this.engine.getSnapshot().playbackRate) return;
        this.notifyPlaybackDiscontinuity();
        ++this.transportRevision;
        await this.engine.setPlaybackRate(rate);
    }

    async restoreAccess(trackId: string): Promise<void> {
        if (this.exportTransportToken) return;
        if (this.disposed) return;
        const runtime = this.runtimeTracks.get(trackId);
        const generation = this.importGeneration;
        const handle = runtime?.handle;
        if (!handle) {
            this.store.updateTrack(trackId, {
                restoreState: 'file-missing',
            });
            return;
        }

        let permission: PermissionState = 'granted';
        try {
            permission = await this.fileAccess.requestPermission(handle);
        } catch {
            permission = 'denied';
        }
        if (this.disposed || this.importGeneration !== generation || this.runtimeTracks.get(trackId) !== runtime)
            return;
        if (permission !== 'granted') {
            this.store.updateTrack(trackId, {
                restoreState: 'permission-denied',
            });
            return;
        }

        const available = await this.hydrateFromHandle(trackId, true);
        if (!available) return;
        if (this.store.currentTrackId === trackId) {
            await this.loadRuntimeTrack(trackId, false);
        } else {
            await this.persistQueueSafely();
        }
    }

    async reselectTrack(trackId: string): Promise<void> {
        if (this.exportTransportToken) return;
        if (this.disposed) return;
        const record = this.getTrack(trackId);
        if (!record?.trackHash) return;
        const expectedHash = record.trackHash;
        const task = this.beginFileSelection();
        const isCurrent = () =>
            !task.signal.aborted &&
            !this.disposed &&
            !this.exportTransportToken &&
            this.getTrack(trackId)?.trackHash === expectedHash;
        try {
            const handles = await this.pickFiles({ multiple: false });
            const handle = handles[0];
            if (!handle || !isCurrent()) return;
            const file = await this.fileAccess.read(handle, task.signal);
            const trackHash = await this.hashFile(file);
            if (!isCurrent()) return;
            if (trackHash !== expectedHash) {
                this.store.updateTrack(trackId, { restoreState: 'content-changed' });
                return;
            }
            if (!(await this.registerRuntimeFile(trackId, file, handle, isCurrent))) return;
            this.store.updateTrack(trackId, {
                name: file.name || record.name,
                mimeType: file.type || record.mimeType,
                byteSize: file.size,
                lastModified: file.lastModified,
                handleKey: `handle:${trackId}`,
                restoreState: 'available',
            });
            if (this.store.currentTrackId === trackId) await this.loadRuntimeTrack(trackId, false);
            else await this.persistQueueSafely();
        } catch (error) {
            if (isAbortError(error) || task.signal.aborted || this.disposed) return;
            throw error;
        } finally {
            if (this.fileSelection === task) this.fileSelection = null;
        }
    }

    async deleteTrack(trackId: string): Promise<void> {
        if (this.exportTransportToken || this.disposed) return;
        this.pendingQueueCommands++;
        try {
            await this.deleteTrackNow(trackId);
        } finally {
            this.pendingQueueCommands--;
        }
    }

    private async deleteTrackNow(trackId: string): Promise<void> {
        if (this.exportTransportToken) return;
        if (this.disposed) return;
        const index = this.store.queue.findIndex(track => track.id === trackId);
        if (index < 0) return;

        const wasCurrent = this.store.currentTrackId === trackId;
        const remaining = this.store.queue.filter(track => track.id !== trackId);
        const nextId = remaining[Math.min(index, remaining.length - 1)]?.id ?? null;
        if (wasCurrent && !nextId) {
            await this.clear();
            return;
        }
        if (wasCurrent && this.trackNavigation && !(await this.trackNavigation.commands.beforeMutation(nextId))) return;
        if (this.exportTransportToken || this.disposed) return;
        this.releaseRuntimeTrack(trackId);
        this.store.removeTrack(trackId);

        if (!wasCurrent) {
            try {
                await this.repository.removeTrack(trackId);
                this.store.setPersistence({ state: 'ready' });
            } catch {
                this.markPersistenceFailure('删除已生效，但无法保存；刷新后该歌曲可能重新出现。');
            }
            return;
        }
        if (this.store.queue.length === 0) {
            await this.clear();
            return;
        }

        const nextIndex = Math.min(index, this.store.queue.length - 1);
        const nextTrack = this.store.queue[nextIndex];
        if (nextTrack) await this.playTrack(nextTrack.id);
    }

    async clear(): Promise<void> {
        if (this.exportTransportToken || this.disposed) return;
        this.pendingQueueCommands++;
        try {
            await this.clearNow();
        } finally {
            this.pendingQueueCommands--;
        }
    }

    private async clearNow(): Promise<void> {
        if (this.exportTransportToken) return;
        if (this.disposed) return;
        if (this.trackNavigation && !(await this.trackNavigation.commands.beforeMutation(null))) return;
        try {
            await this.repository.clear();
        } catch {
            this.store.setPersistence({
                state: 'not-persisted',
                message: '无法清除已保存会话；当前队列保持不变。',
            });
            return;
        }
        this.clearRuntimeSession();
        this.store.setPersistence({ state: 'ready' });
        await this.trackNavigation?.commands.cleared();
    }

    async clearPersistedSession(): Promise<void> {
        if (this.exportTransportToken || this.disposed) return;
        this.pendingQueueCommands++;
        try {
            await this.clearPersistedSessionNow();
        } finally {
            this.pendingQueueCommands--;
        }
    }

    private async clearPersistedSessionNow(): Promise<void> {
        if (this.exportTransportToken) return;
        if (this.disposed) return;
        if (this.trackNavigation && !(await this.trackNavigation.commands.beforeMutation(null))) return;
        try {
            await this.repository.clear();
            this.clearRuntimeSession();
            this.store.setPersistence({ state: 'ready' });
            await this.trackNavigation?.commands.cleared();
        } catch {
            this.store.setPersistence({
                state: 'restore-error',
                message: '无法清除旧会话，请在浏览器站点设置中清除本地数据。',
            });
        }
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        this.cancelFileSelection();
        for (const token of this.preparedLocalAudio.keys()) this.discardPreparedLocalAudio(token);
        ++this.workspaceSaveRevision;
        this.activeRoutePlayback = null;
        this.trackNavigation = null;
        ++this.commandGeneration;
        ++this.importGeneration;
        this.stopFrameLoop();
        this.unsubscribeEngine();
        this.playbackListeners.clear();
        this.playbackDiscontinuityListeners.clear();
        for (const trackId of [...this.runtimeTracks.keys()]) {
            this.releaseRuntimeTrack(trackId);
        }
        try {
            await this.engine.dispose();
        } catch {
            // Disposal is best effort after the layout has left the page.
        } finally {
            this.store.clearSession(this.engine.getSnapshot().volume);
        }
    }

    getArtworkUrl(trackId: string): string | undefined {
        return this.runtimeTracks.get(trackId)?.artworkUrl;
    }

    private async loadRuntimeTrack(trackId: string, shouldPlay: boolean): Promise<void> {
        if (this.disposed) return;
        let runtimeTrack = this.runtimeTracks.get(trackId);
        const record = this.getTrack(trackId);
        if (!record) return;
        const generation = ++this.commandGeneration;
        if (!runtimeTrack?.file && runtimeTrack?.handle) {
            await this.hydrateFromHandle(trackId, false);
            if (generation !== this.commandGeneration || this.disposed) return;
            runtimeTrack = this.runtimeTracks.get(trackId);
        }
        if (!runtimeTrack?.file) {
            this.store.setCurrentTrack(trackId);
            this.store.setPlayback({
                trackId,
                state: 'empty',
                currentTimeSeconds: 0,
                durationSeconds: record.durationSeconds ?? 0,
                volume: this.engine.getSnapshot().volume,
                playbackRate: this.engine.getSnapshot().playbackRate,
            });
            return;
        }

        this.notifyPlaybackDiscontinuity();
        this.engine.unload();
        this.store.setCurrentTrack(trackId);
        this.store.setEnergy(0);
        this.store.setPersistence({ state: 'saving' });
        this.store.setPlayback({
            trackId,
            state: 'loading',
            currentTimeSeconds: 0,
            durationSeconds: record.durationSeconds ?? 0,
            volume: this.engine.getSnapshot().volume,
            playbackRate: this.engine.getSnapshot().playbackRate,
        });

        try {
            const encodedAudio = await runtimeTrack.file.arrayBuffer();
            if (generation !== this.commandGeneration || this.disposed || !this.runtimeTracks.has(trackId)) {
                return;
            }
            const result = await this.engine.load({
                trackId,
                encodedAudio,
            });
            if (result === 'stale' || generation !== this.commandGeneration || this.disposed) {
                return;
            }

            const snapshot = this.engine.getSnapshot();
            this.store.updateTrack(trackId, {
                durationSeconds: snapshot.durationSeconds,
                restoreState: 'available',
            });
            if (shouldPlay) {
                await this.engine.play();
            }
            await this.persistCurrent(trackId, runtimeTrack.file, generation);
        } catch (error) {
            if (generation !== this.commandGeneration || this.disposed) return;
            this.store.updateTrack(trackId, {
                restoreState: 'decode-error',
            });
            if (this.engine.getSnapshot().state !== 'error') {
                this.store.setPlayback({
                    trackId,
                    state: 'error',
                    currentTimeSeconds: 0,
                    durationSeconds: record.durationSeconds ?? 0,
                    volume: this.engine.getSnapshot().volume,
                    playbackRate: this.engine.getSnapshot().playbackRate,
                    error: {
                        code: 'decode',
                        message: error instanceof Error ? error.message : 'Unable to read this audio file.',
                    },
                });
            }
            this.store.setEnergy(0);
            this.markPersistenceFailure('当前歌曲未能完成加载；已保存会话保持不变。');
        }
    }

    private async hydrateFromHandle(trackId: string, permissionAlreadyGranted: boolean): Promise<boolean> {
        const runtime = this.runtimeTracks.get(trackId);
        const record = this.getTrack(trackId);
        const handle = runtime?.handle;
        if (!runtime || !record || !handle) {
            this.store.updateTrack(trackId, {
                restoreState: 'file-missing',
            });
            return false;
        }

        const generation = this.importGeneration,
            expectedHash = record.trackHash;
        const isCurrent = () =>
            !this.disposed &&
            generation === this.importGeneration &&
            this.runtimeTracks.get(trackId) === runtime &&
            this.getTrack(trackId)?.trackHash === expectedHash;

        if (!permissionAlreadyGranted) {
            let permission: PermissionState;
            try {
                permission = await this.fileAccess.queryPermission(handle);
            } catch {
                permission = 'denied';
            }
            if (!isCurrent()) return false;
            if (permission === 'prompt') {
                this.store.updateTrack(trackId, {
                    restoreState: 'permission-required',
                });
                return false;
            }
            if (permission !== 'granted') {
                this.store.updateTrack(trackId, {
                    restoreState: 'permission-denied',
                });
                return false;
            }
        }

        let file: File;
        try {
            file = await this.fileAccess.read(handle);
        } catch (error) {
            if (!isCurrent()) return false;
            this.store.updateTrack(trackId, {
                restoreState: isMissingFileError(error) ? 'file-missing' : 'permission-denied',
            });
            return false;
        }

        const hash = await this.hashFile(file);
        if (!isCurrent()) return false;
        if (expectedHash && hash !== expectedHash) {
            this.store.updateTrack(trackId, {
                restoreState: 'content-changed',
            });
            return false;
        }

        if (!(await this.registerRuntimeFile(trackId, file, handle, isCurrent))) return false;
        this.store.updateTrack(trackId, {
            mimeType: file.type || record.mimeType,
            byteSize: file.size,
            lastModified: file.lastModified,
            trackHash: hash,
            handleKey: `handle:${trackId}`,
            restoreState: 'available',
        });
        return true;
    }

    private async registerRuntimeFile(
        trackId: string,
        file: File,
        handle?: LocalFileReference,
        isCurrent = () => !this.disposed,
    ): Promise<boolean> {
        let metadata: ParsedMetadata | null = null;
        try {
            metadata = await this.parseMetadata(file);
        } catch {
            // Existing persisted metadata remains usable.
        }
        if (!isCurrent()) return false;
        const previous = this.runtimeTracks.get(trackId);
        if (previous?.artworkUrl) {
            this.revokeObjectURL(previous.artworkUrl);
        }
        this.runtimeTracks.set(trackId, {
            file,
            handle: handle ?? previous?.handle,
            artworkUrl: this.createArtwork(metadata),
        });
        return true;
    }

    private createArtwork(metadata: ParsedMetadata | null): string | undefined {
        const picture = metadata?.common.picture?.[0];
        if (!picture) return undefined;
        try {
            const artwork = new Blob([picture.data as unknown as BlobPart], { type: picture.format || 'image/png' });
            return this.createObjectURL(artwork);
        } catch {
            return undefined;
        }
    }

    private async persistCurrent(trackId: string, file: File, generation: number) {
        if (generation !== this.commandGeneration || this.disposed) return;
        const record = this.getTrack(trackId);
        if (!record?.trackHash) return;
        const input: PersistedCurrentInput = {
            ...this.persistedQueueInput(),
            currentBlob: {
                trackId,
                blobKey: 'current',
                trackHash: record.trackHash,
                blob: file,
            },
        };
        input.session.currentBlob = {
            trackId,
            blobKey: 'current',
            trackHash: record.trackHash,
        };
        try {
            await this.repository.replaceCurrent(input);
            if (generation !== this.commandGeneration || this.disposed) {
                return;
            }
            this.store.updateTrack(trackId, {
                restoreState: 'available',
            });
            this.store.setPersistence({ state: 'ready' });
        } catch {
            if (generation !== this.commandGeneration || this.disposed) {
                return;
            }
            this.store.updateTrack(trackId, {
                restoreState: 'not-persisted',
            });
            this.markPersistenceFailure();
        }
    }

    private persistedQueueInput(): PersistedQueueInput {
        return {
            session: this.buildPersistedSession(),
            handles: this.storedHandles(),
        };
    }

    private buildPersistedSession(): PersistedSessionV1 {
        const current = this.getTrack(this.store.currentTrackId);
        const currentBlob = current?.trackHash
            ? {
                  trackId: current.id,
                  blobKey: 'current',
                  trackHash: current.trackHash,
              }
            : undefined;
        const analysisCache = this.store.analysisCacheManifest;
        const currentAnalysisCache =
            current?.trackHash && analysisCache?.trackId === current.id && analysisCache.trackHash === current.trackHash
                ? {
                      ...analysisCache,
                      featureIds: [...analysisCache.featureIds],
                      cacheKeys: [...analysisCache.cacheKeys],
                  }
                : undefined;
        return {
            schemaVersion: 1,
            analyzerWorkspaceVersion: 2,
            savedAt: new Date().toISOString(),
            queue: this.store.queue.map(track => ({
                ...track,
                metadata: { ...track.metadata },
            })),
            currentTrackId: this.store.currentTrackId,
            activeCards: activeFeatureQueueToCards(this.store.analysisWorkspace.activeFeatureQueue),
            analysisSources: cloneSourceWorkspace(this.store.analysisWorkspace.sources),

            analysisConfig: {
                ...DEFAULT_PERSISTED_ANALYSIS_CONFIG,
            },
            viewport: clonePersistedTimelineViewport(this.store.analysisWorkspace.viewport),
            handles: this.storedHandles().map(entry => ({
                trackId: entry.trackId,
                handleKey: entry.handleKey,
            })),
            currentBlob,
            currentAnalysisCache,
        };
    }

    private storedHandles(): StoredHandle[] {
        const handles: StoredHandle[] = [];
        for (const track of this.store.queue) {
            const handle = this.runtimeTracks.get(track.id)?.handle;
            if (!handle) continue;
            handles.push({
                trackId: track.id,
                handleKey: track.handleKey ?? `handle:${track.id}`,
                handle,
            });
        }
        return handles;
    }

    private async persistQueue() {
        this.store.setPersistence({ state: 'saving' });
        await this.repository.saveQueue(this.persistedQueueInput());
    }

    private async persistQueueSafely() {
        try {
            await this.persistQueue();
            this.store.setPersistence({ state: 'ready' });
        } catch {
            this.markPersistenceFailure();
        }
    }

    private markPersistenceFailure(message = '当前页面仍可使用，但本次会话无法跨刷新保存。') {
        this.store.setPersistence({
            state: 'not-persisted',
            message,
        });
    }

    private permissionQueryOrder(currentTrackId: string | null): string[] {
        const queue = this.store.queue;
        if (queue.length <= 1) return [];
        const currentIndex = Math.max(
            0,
            queue.findIndex(track => track.id === currentTrackId),
        );
        const result: string[] = [];
        const seen = new Set<string>([queue[currentIndex]?.id ?? '']);
        for (let distance = 1; result.length < queue.length - 1; distance += 1) {
            for (const rawIndex of [currentIndex + distance, currentIndex - distance]) {
                const index = (rawIndex + queue.length) % queue.length;
                const trackId = queue[index]?.id;
                if (trackId && !seen.has(trackId)) {
                    seen.add(trackId);
                    result.push(trackId);
                }
            }
        }
        return result;
    }

    private getTrack(trackId: string | null): TrackRecord | undefined {
        if (!trackId) return undefined;
        return this.store.queue.find(track => track.id === trackId);
    }

    private handleEngineSnapshot(snapshot: PlaybackSnapshot): void {
        if (this.disposed) return;
        const justEnded = snapshot.state === 'ended' && this.store.playback.state !== 'ended';
        this.store.setPlayback(snapshot);
        for (const listener of this.playbackListeners) {
            listener({
                ...snapshot,
                error: snapshot.error ? { ...snapshot.error } : undefined,
            });
        }
        if (snapshot.trackId) {
            this.playbackPolicy.selected(snapshot.trackId);
            this.store.setCurrentTrack(snapshot.trackId);
        }

        if (snapshot.state === 'playing') {
            this.startFrameLoop();
            return;
        }

        this.stopFrameLoop();
        this.store.setEnergy(0);
        if (justEnded && this.store.queue.length > 0) {
            const lease = this.activeRoutePlayback;
            if (lease && snapshot.trackId === lease.trackId) {
                if (lease.endedPolicy === 'repeat-one') {
                    void this.repeatRouteTrack(lease.token, lease.trackId);
                }
            } else {
                void this.advance(1);
            }
        }
    }

    private async repeatRouteTrack(token: string, trackId: string): Promise<void> {
        if (this.routeRepeatInFlight) return;
        const revision = this.transportRevision;
        const source = this.engine.getSnapshot().audition;
        this.routeRepeatInFlight = true;
        try {
            if (
                this.disposed ||
                revision !== this.transportRevision ||
                this.activeRoutePlayback?.token !== token ||
                this.activeRoutePlayback.trackId !== trackId ||
                this.activeRoutePlayback.endedPolicy !== 'repeat-one' ||
                this.engine.getDecodedAudioDescriptor()?.trackId !== trackId
            )
                return;
            this.notifyPlaybackDiscontinuity();
            await this.engine.seek(0);
            if (
                this.disposed ||
                revision !== this.transportRevision ||
                this.engine.getSnapshot().audition?.kind !== source?.kind ||
                this.engine.getSnapshot().audition?.resultId !== source?.resultId ||
                this.activeRoutePlayback?.token !== token ||
                this.activeRoutePlayback.trackId !== trackId ||
                this.activeRoutePlayback.endedPolicy !== 'repeat-one'
            )
                return;
            await this.engine.play();
        } catch {
            // AudioEngine publishes the typed failure; the lease remains active
            // so the user can retry with the Editor transport.
        } finally {
            this.routeRepeatInFlight = false;
        }
    }

    private startFrameLoop(): void {
        if (this.frameHandle !== null || this.disposed) return;

        const tick = () => {
            this.frameHandle = null;
            if (this.disposed || this.engine.getSnapshot().state !== 'playing') {
                this.store.setEnergy(0);
                return;
            }

            this.store.setPlayback(this.engine.getSnapshot());
            const samples = this.engine.getTimeDomainFloatData();
            let extracted: ReturnType<typeof Meyda.extract> = null;
            try {
                extracted = samples ? Meyda.extract('energy', samples) : null;
            } catch {
                extracted = null;
            }
            const energy = typeof extracted === 'number' && Number.isFinite(extracted) ? extracted : 0;
            this.store.setEnergy(energy);
            this.frameHandle = this.requestFrame(tick);
        };

        this.frameHandle = this.requestFrame(tick);
    }

    private stopFrameLoop(): void {
        if (this.frameHandle !== null) {
            this.cancelFrame(this.frameHandle);
            this.frameHandle = null;
        }
    }

    private clearRuntimeSession() {
        this.cancelFileSelection();
        ++this.commandGeneration;
        ++this.importGeneration;
        this.stopFrameLoop();
        for (const trackId of [...this.runtimeTracks.keys()]) {
            this.releaseRuntimeTrack(trackId);
        }
        this.engine.unload();
        this.store.clearSession(this.engine.getSnapshot().volume);
    }

    private releaseRuntimeTrack(trackId: string): void {
        const runtimeTrack = this.runtimeTracks.get(trackId);
        if (runtimeTrack?.artworkUrl) {
            this.revokeObjectURL(runtimeTrack.artworkUrl);
        }
        this.runtimeTracks.delete(trackId);
    }
}

export const audioSessionServiceKey: InjectionKey<AudioSessionService> = Symbol('audio-session-service');

export const useAudioSessionService = (): AudioSessionService => {
    const service = inject(audioSessionServiceKey);
    if (!service) {
        throw new Error('AudioSessionService has not been provided.');
    }
    return service;
};
