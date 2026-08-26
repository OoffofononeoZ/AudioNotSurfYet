import type { InjectionKey } from 'vue';
import { inject } from 'vue';
import type {
    AnalysisConsumerLease,
    AnalysisCoordinator,
} from '../analysis/analysisCoordinator';
import type {
    AudioSessionService,
    EditorPlaybackLease,
} from '../audio/audioSessionService';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import {
    createEditorDraftEnvelope,
    type EditorDraftRepositoryPort,
} from './editorDraftRepository';
import {
    EditorFormatCodecRegistry,
    createInitialEditorProject,
    validateEditorProjectV1,
} from './projectCodec';
import {
    editorProjectFileName,
    type EditorFileGateway,
} from './fileIO';
import type {
    EditorDraftEnvelopeV1,
    EditorProjectV1,
    EditorSessionSnapshot,
    EditorTrackValidationContext,
} from './types';

type AudioSessionStore = ReturnType<typeof useAudioSessionStore>;
type EditorSessionListener = (snapshot: EditorSessionSnapshot) => void;

const initialSnapshot = (): EditorSessionSnapshot => ({
    state: 'empty',
    routeTrackId: null,
    activeTrackId: null,
    project: null,
    conflictingDraft: null,
    persistence: 'clean',
    restoredFromDraft: false,
});

const cloneProject = (project: EditorProjectV1): EditorProjectV1 =>
    validateEditorProjectV1(structuredClone(project));

const cloneEnvelope = (
    envelope: EditorDraftEnvelopeV1,
): EditorDraftEnvelopeV1 => ({
    schemaVersion: 1,
    savedAt: envelope.savedAt,
    project: cloneProject(envelope.project),
});

const cloneSnapshot = (snapshot: EditorSessionSnapshot): EditorSessionSnapshot => ({
    ...snapshot,
    project: snapshot.project ? cloneProject(snapshot.project) : null,
    conflictingDraft: snapshot.conflictingDraft
        ? cloneEnvelope(snapshot.conflictingDraft)
        : null,
});

export interface EditorSessionControllerOptions {
    audioSession: AudioSessionService;
    analysisCoordinator: AnalysisCoordinator;
    store: AudioSessionStore;
    repository: EditorDraftRepositoryPort;
    fileGateway: EditorFileGateway;
    codecs?: EditorFormatCodecRegistry;
    now?: () => Date;
    createId?: () => string;
    setTimer?: typeof setTimeout;
    clearTimer?: typeof clearTimeout;
    windowTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

export type DraftConflictResolution =
    | { kind: 'restored-old'; trackId: string }
    | { kind: 'fallback' };

export class EditorSessionController {
    private readonly audioSession: AudioSessionService;
    private readonly analysisCoordinator: AnalysisCoordinator;
    private readonly store: AudioSessionStore;
    private readonly repository: EditorDraftRepositoryPort;
    private readonly fileGateway: EditorFileGateway;
    private readonly codecs: EditorFormatCodecRegistry;
    private readonly now: () => Date;
    private readonly createId: () => string;
    private readonly setTimer: typeof setTimeout;
    private readonly clearTimer: typeof clearTimeout;
    private readonly windowTarget?: Pick<
        Window,
        'addEventListener' | 'removeEventListener'
    >;
    private readonly listeners = new Set<EditorSessionListener>();
    private snapshot = initialSnapshot();
    private playbackLease: EditorPlaybackLease | null = null;
    private analysisLease: AnalysisConsumerLease | null = null;
    private routeGeneration = 0;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingProject: EditorProjectV1 | null = null;
    private saveInFlight: Promise<void> | null = null;
    private beforeUnloadRegistered = false;
    private disposed = false;
    private leaveWarningEnabled = true;
    private hasUnexportedChanges = false;

    constructor(options: EditorSessionControllerOptions) {
        this.audioSession = options.audioSession;
        this.analysisCoordinator = options.analysisCoordinator;
        this.store = options.store;
        this.repository = options.repository;
        this.fileGateway = options.fileGateway;
        this.codecs = options.codecs ?? new EditorFormatCodecRegistry();
        this.now = options.now ?? (() => new Date());
        this.createId = options.createId ?? (() => crypto.randomUUID());
        this.setTimer = options.setTimer ?? setTimeout;
        this.clearTimer = options.clearTimer ?? clearTimeout;
        this.windowTarget = options.windowTarget
            ?? (typeof window === 'undefined' ? undefined : window);
        void this.repository.getLeaveWarningEnabled().then((enabled) => {
            if (!this.disposed) this.leaveWarningEnabled = enabled;
        }).catch(() => {
            // Preference failure does not block the project editor.
        });
    }

    getSnapshot(): EditorSessionSnapshot {
        return cloneSnapshot(this.snapshot);
    }

    subscribe(listener: EditorSessionListener): () => void {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }

    hasActivePlaybackLease(): boolean {
        return this.playbackLease !== null
            && this.snapshot.activeTrackId !== null;
    }

    hasPendingWrite(): boolean {
        return this.pendingProject !== null || this.saveInFlight !== null;
    }

    shouldWarnOnLeave(): boolean {
        return this.leaveWarningEnabled && this.hasUnexportedChanges;
    }

    async setLeaveWarningEnabled(enabled: boolean): Promise<void> {
        this.leaveWarningEnabled = enabled;
        try {
            await this.repository.setLeaveWarningEnabled(enabled);
        } catch {
            this.publish({
                ...this.snapshot,
                persistence: 'not-persisted',
                message: '离页提示偏好无法保存，当前工程仍可继续使用。',
            });
        }
    }

    async enter(trackId: string | null): Promise<void> {
        const generation = ++this.routeGeneration;
        await this.flush();
        if (generation !== this.routeGeneration || this.disposed) return;
        this.releaseLeases();
        if (!trackId) {
            this.hasUnexportedChanges = false;
            this.publish(initialSnapshot());
            return;
        }
        this.publish({
            ...initialSnapshot(),
            state: 'loading',
            routeTrackId: trackId,
        });
        const track = this.store.queue.find((entry) => entry.id === trackId);
        if (!track?.trackHash) {
            this.publishUnavailable(trackId, '找不到该歌曲，或歌曲内容身份尚未就绪。');
            return;
        }
        try {
            const playbackLease = await this.audioSession.acquireEditorPlayback(trackId);
            if (generation !== this.routeGeneration || this.disposed) {
                playbackLease.release();
                return;
            }
            this.playbackLease = playbackLease;
            this.analysisLease = this.analysisCoordinator.acquireConsumer('editor');
            const context = this.trackContext(trackId);
            if (!context) throw new Error('歌曲解码信息不可用。');
            let draft: EditorDraftEnvelopeV1 | null;
            try {
                draft = await this.repository.restore();
            } catch (error) {
                if (generation !== this.routeGeneration) return;
                this.publish({
                    ...this.snapshot,
                    state: 'draft-error',
                    activeTrackId: trackId,
                    message: error instanceof Error
                        ? `草稿无法读取：${error.message}`
                        : '草稿无法读取。',
                });
                return;
            }
            if (generation !== this.routeGeneration || this.disposed) return;
            if (draft && draft.project.track.contentHash !== context.contentHash) {
                this.publish({
                    ...this.snapshot,
                    state: 'draft-conflict',
                    activeTrackId: trackId,
                    conflictingDraft: draft,
                    message: '检测到另一首歌曲的草稿，请先选择如何处理。',
                });
                return;
            }
            if (draft) {
                const project = validateEditorProjectV1(draft.project, context);
                this.hasUnexportedChanges = true;
                this.publishReady(trackId, project, true, 'saved');
                return;
            }
            const project = this.createProject(trackId);
            this.hasUnexportedChanges = false;
            this.publishReady(trackId, project, false, 'clean');
            this.queueSave(project, true);
        } catch (error) {
            if (generation !== this.routeGeneration || this.disposed) return;
            this.releaseLeases();
            this.publishUnavailable(
                trackId,
                error instanceof Error ? error.message : '歌曲当前不可编辑。',
            );
        }
    }

    async overwriteConflictingDraft(): Promise<void> {
        if (
            this.snapshot.state !== 'draft-conflict'
            || !this.snapshot.activeTrackId
        ) return;
        const trackId = this.snapshot.activeTrackId;
        const project = this.createProject(trackId);
        this.hasUnexportedChanges = false;
        this.publishReady(trackId, project, false, 'saving');
        this.queueSave(project, true);
        await this.flush();
    }

    async exportConflictingDraft(): Promise<'saved' | 'cancelled'> {
        const draft = this.snapshot.conflictingDraft;
        if (!draft) return 'cancelled';
        return this.exportProjectValue(draft.project);
    }

    async cancelConflictingEntry(): Promise<DraftConflictResolution> {
        const draft = this.snapshot.conflictingDraft;
        if (!draft) return { kind: 'fallback' };
        const previous = this.store.queue.find(
            (track) => track.trackHash === draft.project.track.contentHash,
        );
        if (!previous) {
            this.releaseLeases();
            this.publishUnavailable(
                this.snapshot.routeTrackId ?? '',
                '旧草稿对应歌曲已不在播放列表中，草稿已保留。',
            );
            return { kind: 'fallback' };
        }
        const generation = ++this.routeGeneration;
        this.releaseLeases();
        try {
            const playbackLease = await this.audioSession.acquireEditorPlayback(
                previous.id,
            );
            if (generation !== this.routeGeneration || this.disposed) {
                playbackLease.release();
                return { kind: 'fallback' };
            }
            this.playbackLease = playbackLease;
            this.analysisLease = this.analysisCoordinator.acquireConsumer('editor');
            const context = this.trackContext(previous.id);
            if (!context) throw new Error('旧歌曲无法恢复解码信息。');
            const project = validateEditorProjectV1(draft.project, context);
            this.hasUnexportedChanges = true;
            this.publishReady(previous.id, project, true, 'saved');
            return { kind: 'restored-old', trackId: previous.id };
        } catch {
            this.releaseLeases();
            this.publishUnavailable(
                previous.id,
                '旧歌曲当前无法恢复，草稿已保留。',
            );
            return { kind: 'fallback' };
        }
    }

    async clearInvalidDraftAndCreate(): Promise<void> {
        const trackId = this.snapshot.activeTrackId;
        if (!trackId || this.snapshot.state !== 'draft-error') return;
        try {
            await this.repository.clear();
        } catch (error) {
            this.publish({
                ...this.snapshot,
                persistence: 'not-persisted',
                message: error instanceof Error ? error.message : '草稿无法清除。',
            });
            return;
        }
        const project = this.createProject(trackId);
        this.hasUnexportedChanges = false;
        this.publishReady(trackId, project, false, 'clean');
        this.queueSave(project, true);
    }

    async importProject(codecId = 'json-v1'): Promise<'imported' | 'cancelled'> {
        const trackId = this.snapshot.activeTrackId;
        const context = trackId ? this.trackContext(trackId) : null;
        if (!trackId || !context || this.snapshot.state !== 'ready') {
            return 'cancelled';
        }
        const codec = this.codecs.get(codecId);
        const opened = await this.fileGateway.open(codec);
        if (!opened) return 'cancelled';
        const candidate = codec.decode(opened.bytes, context);
        this.hasUnexportedChanges = false;
        this.publish({
            ...this.snapshot,
            project: candidate,
            persistence: 'saving',
            message: undefined,
        });
        this.queueSave(candidate, true);
        await this.flush();
        return 'imported';
    }

    async exportProject(codecId = 'json-v1'): Promise<'saved' | 'cancelled'> {
        const project = this.snapshot.project;
        if (!project) return 'cancelled';
        const result = await this.exportProjectValue(project, codecId);
        if (result === 'saved') this.hasUnexportedChanges = false;
        return result;
    }

    updateProject(project: EditorProjectV1, immediate = false): void {
        const context = this.snapshot.activeTrackId
            ? this.trackContext(this.snapshot.activeTrackId)
            : null;
        if (!context || this.snapshot.state !== 'ready') return;
        const candidate = validateEditorProjectV1({
            ...project,
            updatedAt: this.now().toISOString(),
        }, context);
        this.hasUnexportedChanges = true;
        this.publish({
            ...this.snapshot,
            project: candidate,
            persistence: 'saving',
            message: undefined,
        });
        this.queueSave(candidate, immediate);
    }

    async flush(): Promise<void> {
        if (this.saveTimer) {
            this.clearTimer(this.saveTimer);
            this.saveTimer = null;
        }
        if (this.saveInFlight) await this.saveInFlight;
        if (!this.pendingProject) {
            this.syncBeforeUnload();
            return;
        }
        const project = this.pendingProject;
        this.pendingProject = null;
        this.publish({ ...this.snapshot, persistence: 'saving' });
        this.saveInFlight = this.repository.replace(
            createEditorDraftEnvelope(project, this.now),
        ).then(() => {
            this.publish({
                ...this.snapshot,
                persistence: 'saved',
                message: undefined,
            });
        }).catch(() => {
            this.publish({
                ...this.snapshot,
                persistence: 'not-persisted',
                message: '当前工程仍在内存中，但无法保存草稿。',
            });
        }).finally(() => {
            this.saveInFlight = null;
            this.syncBeforeUnload();
        });
        this.syncBeforeUnload();
        await this.saveInFlight;
        if (this.pendingProject) await this.flush();
    }

    async leave(): Promise<void> {
        ++this.routeGeneration;
        await this.flush();
        this.releaseLeases();
        this.publish(initialSnapshot());
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        ++this.routeGeneration;
        await this.flush();
        this.releaseLeases();
        this.repository.close();
        this.removeBeforeUnload();
        this.listeners.clear();
    }

    private createProject(trackId: string): EditorProjectV1 {
        const track = this.store.queue.find((entry) => entry.id === trackId);
        const descriptor = this.audioSession.getDecodedTrackDescriptor(trackId);
        if (!track?.trackHash || !descriptor) {
            throw new Error('歌曲内容身份或解码信息不可用。');
        }
        return createInitialEditorProject({
            track: {
                contentHash: track.trackHash,
                fileName: track.name,
                ...(track.metadata.title ? { title: track.metadata.title } : {}),
                ...(track.metadata.artist ? { artist: track.metadata.artist } : {}),
                durationSeconds: descriptor.durationSeconds,
                sampleRate: descriptor.sampleRate,
            },
            createId: this.createId,
            now: this.now,
        });
    }

    private trackContext(trackId: string): EditorTrackValidationContext | null {
        const track = this.store.queue.find((entry) => entry.id === trackId);
        const descriptor = this.audioSession.getDecodedTrackDescriptor(trackId);
        return track?.trackHash && descriptor
            ? {
                contentHash: track.trackHash,
                durationSeconds: descriptor.durationSeconds,
                sampleRate: descriptor.sampleRate,
            }
            : null;
    }

    private queueSave(project: EditorProjectV1, immediate: boolean): void {
        this.pendingProject = cloneProject(project);
        if (this.saveTimer) this.clearTimer(this.saveTimer);
        this.saveTimer = null;
        this.syncBeforeUnload();
        if (immediate) {
            void this.flush();
        } else {
            this.saveTimer = this.setTimer(() => {
                this.saveTimer = null;
                void this.flush();
            }, 250);
        }
    }

    private async exportProjectValue(
        project: EditorProjectV1,
        codecId = 'json-v1',
    ): Promise<'saved' | 'cancelled'> {
        const codec = this.codecs.get(codecId);
        const bytes = codec.encode(project);
        return this.fileGateway.save(
            codec,
            editorProjectFileName(project.track.fileName, codec),
            bytes,
        );
    }

    private publishReady(
        trackId: string,
        project: EditorProjectV1,
        restoredFromDraft: boolean,
        persistence: EditorSessionSnapshot['persistence'],
    ): void {
        this.publish({
            state: 'ready',
            routeTrackId: trackId,
            activeTrackId: trackId,
            project,
            conflictingDraft: null,
            persistence,
            restoredFromDraft,
        });
    }

    private publishUnavailable(trackId: string, message: string): void {
        this.publish({
            ...initialSnapshot(),
            state: 'unavailable',
            routeTrackId: trackId || null,
            message,
        });
    }

    private releaseLeases(): void {
        this.analysisLease?.release();
        this.analysisLease = null;
        this.playbackLease?.release();
        this.playbackLease = null;
    }

    private publish(snapshot: EditorSessionSnapshot): void {
        this.snapshot = cloneSnapshot(snapshot);
        const next = this.getSnapshot();
        for (const listener of this.listeners) listener(next);
    }

    private readonly handleBeforeUnload = (event: BeforeUnloadEvent): void => {
        if (!this.hasPendingWrite()) return;
        event.preventDefault();
        event.returnValue = '';
    };

    private syncBeforeUnload(): void {
        if (this.hasPendingWrite() && !this.beforeUnloadRegistered) {
            this.windowTarget?.addEventListener(
                'beforeunload',
                this.handleBeforeUnload as EventListener,
            );
            this.beforeUnloadRegistered = true;
        } else if (!this.hasPendingWrite()) {
            this.removeBeforeUnload();
        }
    }

    private removeBeforeUnload(): void {
        if (!this.beforeUnloadRegistered) return;
        this.windowTarget?.removeEventListener(
            'beforeunload',
            this.handleBeforeUnload as EventListener,
        );
        this.beforeUnloadRegistered = false;
    }
}

export const editorSessionControllerKey: InjectionKey<EditorSessionController> =
    Symbol('editor-session-controller');

export const useEditorSessionController = (): EditorSessionController => {
    const controller = inject(editorSessionControllerKey);
    if (!controller) {
        throw new Error('EditorSessionController has not been provided.');
    }
    return controller;
};
