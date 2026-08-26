import type { InjectionKey } from 'vue';
import { inject, shallowReactive } from 'vue';
import Meyda from 'meyda';
import { parseBlob } from 'music-metadata';
import { AudioEngine } from './audioEngine';
import {
    InvalidPersistedSessionError,
    SessionRepository,
    UnsupportedSessionSchemaError,
    type PersistedCurrentInput,
    type PersistedQueueInput,
    type SessionRepositoryPort,
} from '../persistence/sessionRepository';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type {
    DecodedAudioDescriptor,
    LocalAudioInput,
    PlaybackSnapshot,
    TrackRecord,
} from '../types/audio';
import {
    assertValidAnalysisWorkspace,
    cloneActiveAnalysisCards,
    clonePersistedTimelineViewport,
    DEFAULT_PERSISTED_ANALYSIS_CONFIG,
    type AnalysisWorkspaceUpdate,
    type PersistedSessionV1,
    type StoredAnalysisCache,
    type StoredHandle,
} from '../types/session';

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
type FilePicker = (
    options: {
        multiple: boolean;
    },
) => Promise<FileSystemFileHandle[]>;
type FileHasher = (file: Blob) => Promise<string>;

interface PermissionedFileHandle extends FileSystemFileHandle {
    queryPermission?: (
        descriptor?: { mode?: 'read' | 'readwrite' },
    ) => Promise<PermissionState>;
    requestPermission?: (
        descriptor?: { mode?: 'read' | 'readwrite' },
    ) => Promise<PermissionState>;
}

interface RuntimeTrack {
    file?: File;
    handle?: PermissionedFileHandle;
    artworkUrl?: string;
}

export interface AudioSessionServiceOptions {
    engine?: AudioEnginePort;
    repository?: SessionRepositoryPort;
    parseMetadata?: MetadataParser;
    pickFiles?: FilePicker;
    hashFile?: FileHasher;
    createObjectURL?: (blob: Blob) => string;
    revokeObjectURL?: (url: string) => void;
    requestFrame?: RequestFrame;
    cancelFrame?: CancelFrame;
    createTrackId?: () => string;
}

export interface EditorPlaybackLease {
    token: string;
    trackId: string;
    release(): void;
}

export class EditorPlaybackUnavailableError extends Error {
    readonly trackId: string;

    constructor(
        trackId: string,
        message = 'The requested Editor track is unavailable.',
    ) {
        super(message);
        this.name = 'EditorPlaybackUnavailableError';
        this.trackId = trackId;
    }
}

export interface AudioEnginePort {
    load(input: {
        trackId: string;
        encodedAudio: ArrayBuffer;
    }): Promise<'loaded' | 'stale'>;
    play(): Promise<void>;
    pause(): void;
    seek(seconds: number): Promise<void>;
    setVolume(volume: number): void;
    getSnapshot(): PlaybackSnapshot;
    getTimeDomainFloatData(): Float32Array | null;
    getDecodedAudioDescriptor(): DecodedAudioDescriptor | null;
    copyDecodedChannelRange(input: {
        revision: number;
        channel: number;
        start: number;
        length: number;
    }): Float32Array | null;
    subscribe(
        listener: (snapshot: PlaybackSnapshot) => void,
    ): () => void;
    unload(): void;
    dispose(): Promise<void>;
}

const defaultRequestFrame: RequestFrame = (callback) =>
    requestAnimationFrame(callback);
const defaultCancelFrame: CancelFrame = (handle) =>
    cancelAnimationFrame(handle);

const defaultPickFiles: FilePicker = async ({ multiple }) => {
    const picker = (
        window as unknown as {
            showOpenFilePicker?: (
                options: Record<string, unknown>,
            ) => Promise<FileSystemFileHandle[]>;
        }
    ).showOpenFilePicker;
    if (!picker) {
        throw new Error(
            '当前浏览器或页面环境不支持本地文件句柄，请使用最新版 Chrome/Edge 并通过 HTTPS 或 localhost 访问。',
        );
    }
    return picker({
        multiple,
        excludeAcceptAllOption: true,
        types: [{
            description: 'Audio files',
            accept: {
                'audio/*': ['.mp3', '.wav', '.flac'],
            },
        }],
    });
};

export const sha256Blob: FileHasher = async (file) => {
    const content = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', content);
    return [...new Uint8Array(digest)]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
};

const isAbortError = (error: unknown) =>
    error instanceof DOMException && error.name === 'AbortError';

const isMissingFileError = (error: unknown) =>
    error instanceof DOMException
    && ['NotFoundError', 'NotReadableError'].includes(error.name);

export class AudioSessionService {
    private readonly store: AudioSessionStore;
    private readonly engine: AudioEnginePort;
    private readonly repository: SessionRepositoryPort;
    private readonly parseMetadata: MetadataParser;
    private readonly pickFiles: FilePicker;
    private readonly hashFile: FileHasher;
    private readonly createObjectURL: (blob: Blob) => string;
    private readonly revokeObjectURL: (url: string) => void;
    private readonly requestFrame: RequestFrame;
    private readonly cancelFrame: CancelFrame;
    private readonly createTrackId: () => string;
    private readonly runtimeTracks = shallowReactive(
        new Map<string, RuntimeTrack>(),
    );
    private readonly unsubscribeEngine: () => void;
    private commandGeneration = 0;
    private importGeneration = 0;
    private frameHandle: number | null = null;
    private activeEditorPlayback: { token: string; trackId: string } | null = null;
    private editorRepeatInFlight = false;
    private disposed = false;

    constructor(
        store: AudioSessionStore,
        options: AudioSessionServiceOptions = {},
    ) {
        this.store = store;
        this.engine = options.engine ?? new AudioEngine();
        this.repository = options.repository ?? new SessionRepository();
        this.parseMetadata =
            options.parseMetadata
            ?? ((file) => parseBlob(file) as Promise<ParsedMetadata>);
        this.pickFiles = options.pickFiles ?? defaultPickFiles;
        this.hashFile = options.hashFile ?? sha256Blob;
        this.createObjectURL =
            options.createObjectURL ?? ((blob) => URL.createObjectURL(blob));
        this.revokeObjectURL =
            options.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url));
        this.requestFrame = options.requestFrame ?? defaultRequestFrame;
        this.cancelFrame = options.cancelFrame ?? defaultCancelFrame;
        this.createTrackId =
            options.createTrackId ?? (() => crypto.randomUUID());
        this.unsubscribeEngine = this.engine.subscribe((snapshot) => {
            this.handleEngineSnapshot(snapshot);
        });
    }

    async initialize(): Promise<StoredAnalysisCache | undefined> {
        if (this.disposed) return undefined;
        const generation = ++this.importGeneration;
        ++this.commandGeneration;
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
                    message: error instanceof InvalidPersistedSessionError
                        ? '已保存的会话数据无效，请清除旧会话。'
                        : '无法读取已保存的会话，当前仍可使用内存播放。',
                });
            }
            return undefined;
        }

        if (
            generation !== this.importGeneration
            || this.disposed
        ) {
            return undefined;
        }
        if (!restored) {
            this.store.setPersistence({ state: 'ready' });
            return undefined;
        }

        for (const trackId of [...this.runtimeTracks.keys()]) {
            this.releaseRuntimeTrack(trackId);
        }
        const handles = new Map(
            restored.handles.map((entry) => [
                entry.trackId,
                entry.handle as PermissionedFileHandle,
            ]),
        );
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
                activeCards: restored.session.activeCards,
                viewport: restored.session.viewport,
            },
        );
        this.store.setAnalysisCacheManifest(
            restored.session.currentAnalysisCache ?? null,
        );

        const currentTrackId = restored.session.currentTrackId;
        let currentAvailable = false;
        let currentBlobChanged = false;
        if (
            currentTrackId
            && restored.currentBlob
            && restored.currentBlob.trackId === currentTrackId
        ) {
            const record = this.getTrack(currentTrackId);
            if (record) {
                const currentBlobHash = await this.hashFile(
                    restored.currentBlob.blob,
                );
                if (currentBlobHash === record.trackHash) {
                    const file = new File(
                        [restored.currentBlob.blob],
                        record.name,
                        {
                            type: record.mimeType,
                            lastModified: record.lastModified,
                        },
                    );
                    await this.registerRuntimeFile(
                        currentTrackId,
                        file,
                        handles.get(currentTrackId),
                    );
                    this.store.updateTrack(currentTrackId, {
                        restoreState: 'available',
                    });
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
            const currentHandle =
                this.runtimeTracks.get(currentTrackId)?.handle;
            const available = currentHandle
                ? await this.hydrateFromHandle(currentTrackId, false)
                : false;
            if (available) {
                await this.loadRuntimeTrack(currentTrackId, false);
            } else {
                if (!currentHandle && !currentBlobChanged) {
                    this.store.updateTrack(currentTrackId, {
                        restoreState: 'file-missing',
                    });
                }
                const currentTrack = this.getTrack(currentTrackId);
                this.store.setPlayback({
                    trackId: currentTrackId,
                    state: 'empty',
                    currentTimeSeconds: 0,
                    durationSeconds: currentTrack?.durationSeconds ?? 0,
                    volume: this.engine.getSnapshot().volume,
                });
            }
        }

        if (
            generation !== this.importGeneration
            || this.disposed
        ) {
            return;
        }

        for (const trackId of this.permissionQueryOrder(currentTrackId)) {
            if (
                generation !== this.importGeneration
                || this.disposed
            ) {
                return undefined;
            }
            await this.hydrateFromHandle(trackId, false);
        }

        try {
            await this.persistQueue();
            this.store.setPersistence({ state: 'ready' });
        } catch {
            this.markPersistenceFailure();
        }
        return restored.currentAnalysisCache;
    }

    async selectAndImportFiles(): Promise<'imported' | 'cancelled'> {
        if (this.disposed) return 'cancelled';
        let handles: FileSystemFileHandle[];
        try {
            handles = await this.pickFiles({ multiple: true });
        } catch (error) {
            if (isAbortError(error)) return 'cancelled';
            throw error;
        }
        if (handles.length === 0) return 'cancelled';
        const inputs: LocalAudioInput[] = [];
        for (const handle of handles) {
            inputs.push({
                file: await handle.getFile(),
                handle,
            });
        }
        await this.importFiles(inputs);
        return 'imported';
    }

    async importFiles(inputs: LocalAudioInput[]): Promise<void> {
        if (this.disposed || inputs.length === 0) return;

        const importGeneration = ++this.importGeneration;
        const shouldAutoplay = this.store.queue.length === 0;
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
            if (
                this.disposed
                || importGeneration !== this.importGeneration
            ) {
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
                    artworkMimeType:
                        metadata?.common.picture?.[0]?.format,
                },
                trackHash,
                handleKey: input.handle
                    ? `handle:${trackId}`
                    : undefined,
                restoreState: input.handle
                    ? 'available'
                    : 'not-persisted',
            };
            records.push(record);
            this.runtimeTracks.set(trackId, {
                file,
                handle: input.handle as PermissionedFileHandle | undefined,
                artworkUrl: this.createArtwork(metadata),
            });
        }

        this.store.appendTracks(records);
        try {
            await this.persistQueue();
            if (records.some((record) => !record.handleKey)) {
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

    async playTrack(trackId: string): Promise<void> {
        await this.loadRuntimeTrack(trackId, true);
    }

    async acquireEditorPlayback(trackId: string): Promise<EditorPlaybackLease> {
        if (this.disposed) {
            throw new EditorPlaybackUnavailableError(trackId);
        }
        const record = this.getTrack(trackId);
        if (!record?.trackHash) {
            throw new EditorPlaybackUnavailableError(
                trackId,
                '找不到可编辑歌曲或歌曲内容身份尚未就绪。',
            );
        }
        const descriptor = this.engine.getDecodedAudioDescriptor();
        if (descriptor?.trackId !== trackId) {
            await this.loadRuntimeTrack(trackId, false);
        }
        const currentDescriptor = this.engine.getDecodedAudioDescriptor();
        if (
            currentDescriptor?.trackId !== trackId
            || this.store.playback.trackId !== trackId
            || ['empty', 'loading', 'error'].includes(this.store.playback.state)
        ) {
            throw new EditorPlaybackUnavailableError(
                trackId,
                '歌曲文件当前不可恢复，请先在播放器中恢复访问或重新选择。',
            );
        }
        const token = crypto.randomUUID();
        this.activeEditorPlayback = { token, trackId };
        let released = false;
        return {
            token,
            trackId,
            release: () => {
                if (released) return;
                released = true;
                if (this.activeEditorPlayback?.token === token) {
                    this.activeEditorPlayback = null;
                }
            },
        };
    }

    getDecodedTrackDescriptor(trackId: string): DecodedAudioDescriptor | null {
        const descriptor = this.engine.getDecodedAudioDescriptor();
        return descriptor?.trackId === trackId ? { ...descriptor } : null;
    }

    async togglePlayback(): Promise<void> {
        if (this.disposed || this.store.queue.length === 0) return;

        if (this.store.playback.state === 'playing') {
            this.engine.pause();
            return;
        }

        if (
            this.store.playback.state === 'paused'
            || this.store.playback.state === 'ended'
        ) {
            try {
                await this.engine.play();
            } catch {
                // The engine snapshot carries the typed error for the UI.
            }
            return;
        }

        const trackId =
            this.store.currentTrackId ?? this.store.queue[0]?.id ?? null;
        if (trackId) await this.playTrack(trackId);
    }

    async next(): Promise<void> {
        const target = this.getRelativeTrack(1);
        if (target) await this.playTrack(target.id);
    }

    async previous(): Promise<void> {
        const target = this.getRelativeTrack(-1);
        if (target) await this.playTrack(target.id);
    }

    async seek(seconds: number): Promise<void> {
        if (this.disposed) return;
        try {
            await this.engine.seek(seconds);
        } catch {
            // The engine snapshot carries the typed error for the UI.
        }
    }

    async updateAnalysisWorkspace(
        workspace: AnalysisWorkspaceUpdate,
    ): Promise<void> {
        if (this.disposed) return;
        assertValidAnalysisWorkspace(workspace);
        this.store.setAnalysisWorkspace({
            initialized: true,
            activeCards: cloneActiveAnalysisCards(workspace.activeCards),
            viewport: clonePersistedTimelineViewport(workspace.viewport),
        });
        try {
            await this.persistQueue();
            this.store.setPersistence({ state: 'ready' });
        } catch {
            this.markPersistenceFailure(
                '分析工作区已在当前页面生效，但无法跨刷新保存。',
            );
        }
    }

    setVolume(percent: number): void {
        const normalized = Math.min(
            100,
            Math.max(0, Number.isFinite(percent) ? percent : 0),
        ) / 100;
        this.engine.setVolume(normalized);
    }

    async restoreAccess(trackId: string): Promise<void> {
        if (this.disposed) return;
        const runtime = this.runtimeTracks.get(trackId);
        const handle = runtime?.handle;
        if (!handle) {
            this.store.updateTrack(trackId, {
                restoreState: 'file-missing',
            });
            return;
        }

        let permission: PermissionState = 'granted';
        try {
            permission = handle.requestPermission
                ? await handle.requestPermission({ mode: 'read' })
                : 'granted';
        } catch {
            permission = 'denied';
        }
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
        if (this.disposed) return;
        const record = this.getTrack(trackId);
        if (!record?.trackHash) return;

        let handles: FileSystemFileHandle[];
        try {
            handles = await this.pickFiles({ multiple: false });
        } catch (error) {
            if (isAbortError(error)) return;
            throw error;
        }
        const handle = handles[0] as PermissionedFileHandle | undefined;
        if (!handle) return;
        const file = await handle.getFile();
        const trackHash = await this.hashFile(file);
        if (trackHash !== record.trackHash) {
            this.store.updateTrack(trackId, {
                restoreState: 'content-changed',
            });
            return;
        }

        await this.registerRuntimeFile(trackId, file, handle);
        this.store.updateTrack(trackId, {
            name: file.name || record.name,
            mimeType: file.type || record.mimeType,
            byteSize: file.size,
            lastModified: file.lastModified,
            handleKey: `handle:${trackId}`,
            restoreState: 'available',
        });
        if (this.store.currentTrackId === trackId) {
            await this.loadRuntimeTrack(trackId, false);
        } else {
            await this.persistQueueSafely();
        }
    }

    async deleteTrack(trackId: string): Promise<void> {
        if (this.disposed) return;
        const index = this.store.queue.findIndex(
            (track) => track.id === trackId,
        );
        if (index < 0) return;

        const wasCurrent = this.store.currentTrackId === trackId;
        this.releaseRuntimeTrack(trackId);
        this.store.removeTrack(trackId);

        if (!wasCurrent) {
            try {
                await this.repository.removeTrack(trackId);
                this.store.setPersistence({ state: 'ready' });
            } catch {
                this.markPersistenceFailure(
                    '删除已生效，但无法保存；刷新后该歌曲可能重新出现。',
                );
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
        if (this.disposed) return;
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
    }

    async clearPersistedSession(): Promise<void> {
        if (this.disposed) return;
        try {
            await this.repository.clear();
            this.clearRuntimeSession();
            this.store.setPersistence({ state: 'ready' });
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
        this.activeEditorPlayback = null;
        ++this.commandGeneration;
        ++this.importGeneration;
        this.stopFrameLoop();
        this.unsubscribeEngine();
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

    private async loadRuntimeTrack(
        trackId: string,
        shouldPlay: boolean,
    ): Promise<void> {
        if (this.disposed) return;
        const runtimeTrack = this.runtimeTracks.get(trackId);
        const record = this.getTrack(trackId);
        if (!record) return;
        if (!runtimeTrack?.file) {
            this.store.setCurrentTrack(trackId);
            this.store.setPlayback({
                trackId,
                state: 'empty',
                currentTimeSeconds: 0,
                durationSeconds: record.durationSeconds ?? 0,
                volume: this.engine.getSnapshot().volume,
            });
            return;
        }

        const generation = ++this.commandGeneration;
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
        });

        try {
            const encodedAudio = await runtimeTrack.file.arrayBuffer();
            if (
                generation !== this.commandGeneration
                || this.disposed
                || !this.runtimeTracks.has(trackId)
            ) {
                return;
            }
            const result = await this.engine.load({
                trackId,
                encodedAudio,
            });
            if (
                result === 'stale'
                || generation !== this.commandGeneration
                || this.disposed
            ) {
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
            await this.persistCurrent(
                trackId,
                runtimeTrack.file,
                generation,
            );
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
                    error: {
                        code: 'decode',
                        message:
                            error instanceof Error
                                ? error.message
                                : 'Unable to read this audio file.',
                    },
                });
            }
            this.store.setEnergy(0);
            this.markPersistenceFailure(
                '当前歌曲未能完成加载；已保存会话保持不变。',
            );
        }
    }

    private async hydrateFromHandle(
        trackId: string,
        permissionAlreadyGranted: boolean,
    ): Promise<boolean> {
        const runtime = this.runtimeTracks.get(trackId);
        const record = this.getTrack(trackId);
        const handle = runtime?.handle;
        if (!runtime || !record || !handle) {
            this.store.updateTrack(trackId, {
                restoreState: 'file-missing',
            });
            return false;
        }

        if (!permissionAlreadyGranted) {
            let permission: PermissionState;
            try {
                permission = handle.queryPermission
                    ? await handle.queryPermission({ mode: 'read' })
                    : 'granted';
            } catch {
                permission = 'denied';
            }
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
            file = await handle.getFile();
        } catch (error) {
            this.store.updateTrack(trackId, {
                restoreState: isMissingFileError(error)
                    ? 'file-missing'
                    : 'permission-denied',
            });
            return false;
        }

        const hash = await this.hashFile(file);
        if (record.trackHash && hash !== record.trackHash) {
            this.store.updateTrack(trackId, {
                restoreState: 'content-changed',
            });
            return false;
        }

        await this.registerRuntimeFile(trackId, file, handle);
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
        handle?: PermissionedFileHandle,
    ) {
        let metadata: ParsedMetadata | null = null;
        try {
            metadata = await this.parseMetadata(file);
        } catch {
            // Existing persisted metadata remains usable.
        }
        const previous = this.runtimeTracks.get(trackId);
        if (previous?.artworkUrl) {
            this.revokeObjectURL(previous.artworkUrl);
        }
        this.runtimeTracks.set(trackId, {
            file,
            handle: handle ?? previous?.handle,
            artworkUrl: this.createArtwork(metadata),
        });
    }

    private createArtwork(
        metadata: ParsedMetadata | null,
    ): string | undefined {
        const picture = metadata?.common.picture?.[0];
        if (!picture) return undefined;
        try {
            const artwork = new Blob(
                [picture.data as unknown as BlobPart],
                { type: picture.format || 'image/png' },
            );
            return this.createObjectURL(artwork);
        } catch {
            return undefined;
        }
    }

    private async persistCurrent(
        trackId: string,
        file: File,
        generation: number,
    ) {
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
            current?.trackHash
            && analysisCache?.trackId === current.id
            && analysisCache.trackHash === current.trackHash
                ? {
                    ...analysisCache,
                    featureIds: [...analysisCache.featureIds],
                    cacheKeys: [...analysisCache.cacheKeys],
                }
                : undefined;
        return {
            schemaVersion: 1,
            savedAt: new Date().toISOString(),
            queue: this.store.queue.map((track) => ({
                ...track,
                metadata: { ...track.metadata },
            })),
            currentTrackId: this.store.currentTrackId,
            activeCards: cloneActiveAnalysisCards(
                this.store.analysisWorkspace.activeCards,
            ),
            analysisConfig: {
                ...DEFAULT_PERSISTED_ANALYSIS_CONFIG,
            },
            viewport: clonePersistedTimelineViewport(
                this.store.analysisWorkspace.viewport,
            ),
            handles: this.storedHandles().map((entry) => ({
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

    private markPersistenceFailure(
        message = '当前页面仍可使用，但本次会话无法跨刷新保存。',
    ) {
        this.store.setPersistence({
            state: 'not-persisted',
            message,
        });
    }

    private permissionQueryOrder(
        currentTrackId: string | null,
    ): string[] {
        const queue = this.store.queue;
        if (queue.length <= 1) return [];
        const currentIndex = Math.max(
            0,
            queue.findIndex((track) => track.id === currentTrackId),
        );
        const result: string[] = [];
        const seen = new Set<string>([queue[currentIndex]?.id ?? '']);
        for (let distance = 1; result.length < queue.length - 1; distance += 1) {
            for (const rawIndex of [
                currentIndex + distance,
                currentIndex - distance,
            ]) {
                const index =
                    (rawIndex + queue.length) % queue.length;
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
        return this.store.queue.find((track) => track.id === trackId);
    }

    private handleEngineSnapshot(snapshot: PlaybackSnapshot): void {
        if (this.disposed) return;
        this.store.setPlayback(snapshot);
        if (snapshot.trackId) {
            this.store.setCurrentTrack(snapshot.trackId);
        }

        if (snapshot.state === 'playing') {
            this.startFrameLoop();
            return;
        }

        this.stopFrameLoop();
        this.store.setEnergy(0);
        if (snapshot.state === 'ended' && this.store.queue.length > 0) {
            const lease = this.activeEditorPlayback;
            if (lease && snapshot.trackId === lease.trackId) {
                void this.repeatEditorTrack(lease.token, lease.trackId);
            } else {
                void this.next();
            }
        }
    }

    private async repeatEditorTrack(token: string, trackId: string): Promise<void> {
        if (this.editorRepeatInFlight) return;
        this.editorRepeatInFlight = true;
        try {
            if (
                this.disposed
                || this.activeEditorPlayback?.token !== token
                || this.activeEditorPlayback.trackId !== trackId
                || this.engine.getDecodedAudioDescriptor()?.trackId !== trackId
            ) return;
            await this.engine.seek(0);
            if (
                this.disposed
                || this.activeEditorPlayback?.token !== token
                || this.activeEditorPlayback.trackId !== trackId
            ) return;
            await this.engine.play();
        } catch {
            // AudioEngine publishes the typed failure; the lease remains active
            // so the user can retry with the Editor transport.
        } finally {
            this.editorRepeatInFlight = false;
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
                extracted = samples
                    ? Meyda.extract('energy', samples)
                    : null;
            } catch {
                extracted = null;
            }
            const energy =
                typeof extracted === 'number' && Number.isFinite(extracted)
                    ? extracted
                    : 0;
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

    private getRelativeTrack(delta: number): TrackRecord | null {
        const queue = this.store.queue;
        if (queue.length === 0) return null;
        const currentIndex = queue.findIndex(
            (track) => track.id === this.store.currentTrackId,
        );
        const baseIndex = currentIndex >= 0 ? currentIndex : 0;
        const targetIndex =
            (baseIndex + delta + queue.length) % queue.length;
        return queue[targetIndex] ?? null;
    }

    private clearRuntimeSession() {
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

export const audioSessionServiceKey: InjectionKey<AudioSessionService> =
    Symbol('audio-session-service');

export const useAudioSessionService = (): AudioSessionService => {
    const service = inject(audioSessionServiceKey);
    if (!service) {
        throw new Error('AudioSessionService has not been provided.');
    }
    return service;
};
