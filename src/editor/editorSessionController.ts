import type { InjectionKey } from 'vue';
import { inject } from 'vue';
import type { AnalysisConsumerLease, AnalysisCoordinator } from '../analysis/analysisCoordinator';
import type { AnalysisWindowInput, AnalysisWindowSeries } from '../analysis/windowTypes';
import type {
    AnalysisCursorValueResult,
    AnalysisCoordinatorSnapshot,
    AnalysisListener,
    AnalysisSeries,
    FeatureId,
    TempoEstimateResult,
} from '../analysis/types';
import type { AudioSessionService, RoutePlaybackLease } from '../audio/audioSessionService';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type { EditorDraftRepositoryPort, EditorRestoredDraft } from './editorDraftRepository';
import { EditorFormatCodecRegistry, createInitialEditorProject, validateEditorProjectV2 } from './projectCodec';
import { editorProjectFileName, type EditorFileGateway } from './fileIO';
import type {
    EditorDraftEnvelopeV2,
    EditorProjectV2,
    EditorSessionSnapshot,
    EditorTrackValidationContext,
} from './types';
import { useEstimatedBpm } from './tempoMap';
import { EditorTrackChangeApproval } from './trackChangeApproval';
import { editorOverlayFeatureIds, resolveEditorOverlayOpen } from './overlay';

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
    overlayOpen: false,
    tempoEstimateState: 'idle',
});

const cloneProject = (project: EditorProjectV2): EditorProjectV2 => structuredClone(project);

const listenerSnapshot = (snapshot: EditorSessionSnapshot): EditorSessionSnapshot => ({
    ...snapshot,
    project: snapshot.project,
    conflictingDraft: snapshot.conflictingDraft,
});

const cloneEnvelope = (envelope: EditorDraftEnvelopeV2): EditorDraftEnvelopeV2 => ({
    schemaVersion: 2,
    savedAt: envelope.savedAt,
    project: cloneProject(envelope.project),
});

const cloneSnapshot = (snapshot: EditorSessionSnapshot): EditorSessionSnapshot => ({
    ...snapshot,
    project: snapshot.project ? cloneProject(snapshot.project) : null,
    conflictingDraft: snapshot.conflictingDraft ? cloneEnvelope(snapshot.conflictingDraft) : null,
});

const sameFeatureIds = (left: readonly FeatureId[], right: readonly FeatureId[]): boolean =>
    left.length === right.length && left.every((featureId, index) => featureId === right[index]);

export interface EditorSessionControllerOptions {
    audioSession: AudioSessionService;
    analysisCoordinator: AnalysisCoordinator;
    store: AudioSessionStore;
    repository: EditorDraftRepositoryPort;
    fileGateway: EditorFileGateway;
    codecs?: EditorFormatCodecRegistry;
    now?: () => Date;
    createId?: () => string;
    setTimer?: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>;
    clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
    windowTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

export type DraftConflictResolution = { kind: 'restored-old'; trackId: string } | { kind: 'fallback' };

export class EditorSessionController {
    private readonly audioSession: AudioSessionService;
    private readonly analysisCoordinator: AnalysisCoordinator;
    private readonly store: AudioSessionStore;
    private readonly repository: EditorDraftRepositoryPort;
    private readonly fileGateway: EditorFileGateway;
    private readonly codecs: EditorFormatCodecRegistry;
    private readonly now: () => Date;
    private readonly createId: () => string;
    private readonly setTimer: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>;
    private readonly clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
    private readonly windowTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
    private readonly listeners = new Set<EditorSessionListener>();
    private readonly analysisListeners = new Set<AnalysisListener>();
    private snapshot = initialSnapshot();
    private analysisSnapshot: AnalysisCoordinatorSnapshot;
    private playbackLease: RoutePlaybackLease | null = null;
    private analysisLease: AnalysisConsumerLease | null = null;
    private unsubscribeAnalysis: (() => void) | null = null;
    private tempoRequestRevision = 0;
    private baseAnalysisHandledForRoute = -1;
    private overlayActivationReady = false;
    private lastReadyBufferSeries: AnalysisSeries | null = null;
    private routeGeneration = 0;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingProject: EditorProjectV2 | null = null;
    private saveInFlight: Promise<void> | null = null;
    private beforeUnloadRegistered = false;
    private disposed = false;
    private leaveWarningEnabled = true;
    private hasUnexportedChanges = false;
    private overlayVisibilityPersistFailed = false;
    private overlayVisibilityWriteRevision = 0;
    private readonly trackChangeApproval = new EditorTrackChangeApproval();

    constructor(options: EditorSessionControllerOptions) {
        this.audioSession = options.audioSession;
        this.analysisCoordinator = options.analysisCoordinator;
        this.store = options.store;
        this.repository = options.repository;
        this.fileGateway = options.fileGateway;
        this.codecs = options.codecs ?? new EditorFormatCodecRegistry();
        this.now = options.now ?? (() => new Date());
        this.createId = options.createId ?? (() => crypto.randomUUID());
        this.setTimer = options.setTimer ?? ((handler, timeout) => setTimeout(handler, timeout));
        this.clearTimer = options.clearTimer ?? (handle => clearTimeout(handle));
        this.windowTarget = options.windowTarget ?? (typeof window === 'undefined' ? undefined : window);
        this.analysisSnapshot = this.analysisCoordinator.getSnapshot();
        void this.repository
            .getLeaveWarningEnabled()
            .then(enabled => {
                if (!this.disposed) this.leaveWarningEnabled = enabled;
            })
            .catch(() => {
                // Preference failure does not block the project editor.
            });
    }

    getSnapshot(): EditorSessionSnapshot {
        return cloneSnapshot(this.snapshot);
    }

    subscribe(listener: EditorSessionListener): () => void {
        this.listeners.add(listener);
        listener(listenerSnapshot(this.snapshot));
        return () => this.listeners.delete(listener);
    }

    subscribeAnalysis(listener: AnalysisListener): () => void {
        this.analysisListeners.add(listener);
        listener(structuredClone(this.analysisSnapshot));
        return () => this.analysisListeners.delete(listener);
    }

    getAnalysisSnapshot(): AnalysisCoordinatorSnapshot {
        return structuredClone(this.analysisSnapshot);
    }

    getOverlayAnalysisSnapshot(): AnalysisCoordinatorSnapshot {
        return (
            this.analysisLease?.getSourceSnapshot(this.snapshot.project?.workspace.overlay.stemRole) ??
            this.getAnalysisSnapshot()
        );
    }
    getAnalysisSeries(
        featureId: FeatureId,
        stemRole?: import('../processing/modelManifest').StemRole,
    ): AnalysisSeries | null {
        return (
            this.analysisLease?.getSeries(featureId, stemRole) ??
            (!stemRole && featureId === 'buffer' ? this.lastReadyBufferSeries : null)
        );
    }

    requestAnalysisCursorValue(featureId: FeatureId, timeSeconds: number): Promise<AnalysisCursorValueResult | null> {
        if (!this.snapshot.overlayOpen) return Promise.resolve(null);
        return (
            this.analysisLease?.requestCursorValue(
                featureId,
                timeSeconds,
                this.snapshot.project?.workspace.overlay.stemRole,
            ) ?? Promise.resolve(null)
        );
    }

    requestAnalysisWindow(input: AnalysisWindowInput, signal?: AbortSignal): Promise<AnalysisWindowSeries | null> {
        return this.analysisLease?.requestWindowSeries(input, signal) ?? Promise.resolve(null);
    }

    retryOverlayAnalysis(): void {
        if (!this.snapshot.overlayOpen) return;
        void this.syncOverlayAnalysis(true);
    }

    setOverlayOpen(enabled: boolean): void {
        const project = this.snapshot.project;
        if (this.snapshot.state !== 'ready' || !project) return;
        const overlayOpen = enabled && project.workspace.overlay.featureId !== null;
        if (overlayOpen === this.snapshot.overlayOpen) return;
        this.publish({
            ...this.snapshot,
            overlayOpen,
            message: undefined,
        });
        void this.syncOverlayAnalysis();
        void this.persistOverlayVisibility(project.track.contentHash, overlayOpen);
    }

    selectOverlayFeature(input: FeatureId | import('../analysis/sources').AnalysisInput): void {
        const { featureId, stemRole } = typeof input === 'string' ? { featureId: input, stemRole: undefined } : input;
        const project = this.snapshot.project;
        if (this.snapshot.state !== 'ready' || !project) return;
        const wasOpen = this.snapshot.overlayOpen;
        this.updateProject(
            {
                ...project,
                workspace: {
                    ...project.workspace,
                    overlay: {
                        ...project.workspace.overlay,
                        featureId,
                        stemRole,
                    },
                },
            },
            true,
        );
        if (!wasOpen) {
            this.publish({
                ...this.snapshot,
                overlayOpen: true,
                message: undefined,
            });
            void this.syncOverlayAnalysis();
        }
        void this.persistOverlayVisibility(project.track.contentHash, true);
    }

    requestTempoEstimate(): Promise<TempoEstimateResult | null> {
        return this.analysisLease?.requestTempoEstimate() ?? Promise.resolve(null);
    }

    hasActivePlaybackLease(): boolean {
        return this.playbackLease !== null && this.snapshot.activeTrackId !== null;
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

    async approveTrackChange(
        targetTrackId: string | null,
        detachedDraft?: EditorDraftEnvelopeV2,
    ): Promise<symbol | null> {
        const project = this.snapshot.project;
        this.trackChangeApproval.clear();
        if (!project && detachedDraft) {
            const current = await this.repository.restore();
            if (this.snapshot.project || JSON.stringify(current?.project) !== JSON.stringify(detachedDraft.project))
                return null;
            return this.trackChangeApproval.issue(targetTrackId, null);
        }
        if (!project || this.snapshot.state !== 'ready') return null;
        // Retry a failed draft write before allowing its single slot to be replaced.
        if (this.snapshot.persistence === 'not-persisted') this.queueSave(project, true);
        await this.flush();
        if (this.snapshot.project !== project || this.snapshot.persistence !== 'saved') return null;
        // Once confirmed, freeze old analysis revisions while processing consumers drain.
        this.tempoRequestRevision += 1;
        return this.trackChangeApproval.issue(targetTrackId, project);
    }

    isTrackChangeApproved(token: symbol | undefined, target: string | null): boolean {
        return this.trackChangeApproval.valid(token, target, this.snapshot.project);
    }

    async enter(trackId: string | null, approval?: symbol, imported?: EditorProjectV2): Promise<void> {
        const generation = ++this.routeGeneration;
        await this.flush();
        if (generation !== this.routeGeneration || this.disposed) return;
        const overwriteDraft = this.trackChangeApproval.consume(approval, trackId, this.snapshot.project);
        this.releaseLeases();
        this.overlayVisibilityWriteRevision += 1;
        this.overlayVisibilityPersistFailed = false;
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
        const track = this.store.queue.find(entry => entry.id === trackId);
        if (!track?.trackHash) {
            this.publishUnavailable(trackId, '找不到该歌曲，或歌曲内容身份尚未就绪。');
            return;
        }
        try {
            const playbackLease = await this.audioSession.acquireRoutePlayback({
                consumer: 'editor',
                trackId,
            });
            if (generation !== this.routeGeneration || this.disposed) {
                playbackLease.release();
                return;
            }
            this.playbackLease = playbackLease;
            this.analysisLease = this.analysisCoordinator.acquireConsumer('editor');
            const context = this.trackContext(trackId);
            if (!context) throw new Error('歌曲解码信息不可用。');
            if (imported) {
                const project = validateEditorProjectV2(imported, context);
                this.hasUnexportedChanges = true;
                this.publishReady(trackId, project, false, 'saving', false);
                this.queueSave(project, true);
                this.startEditorAnalysis(generation);
                await this.flush();
                return;
            }
            let draft: EditorRestoredDraft | null;
            try {
                draft = await this.repository.restore();
            } catch (error) {
                if (generation !== this.routeGeneration) return;
                this.publish({
                    ...this.snapshot,
                    state: 'draft-error',
                    activeTrackId: trackId,
                    message: error instanceof Error ? `草稿无法读取：${error.message}` : '草稿无法读取。',
                });
                return;
            }
            if (generation !== this.routeGeneration || this.disposed) return;
            if (overwriteDraft) draft = null;
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
                const project = validateEditorProjectV2(draft.project, context);
                const visibility = await this.loadOverlayVisibility(project);
                if (generation !== this.routeGeneration || this.disposed) return;
                this.overlayVisibilityPersistFailed = visibility.failed;
                this.hasUnexportedChanges = true;
                this.publishReady(
                    trackId,
                    project,
                    true,
                    visibility.failed ? 'not-persisted' : 'saved',
                    visibility.overlayOpen,
                    visibility.failed ? '叠加层显示偏好无法读取；当前工程仍可继续使用。' : undefined,
                );
                this.startEditorAnalysis(generation);
                if (draft.migratedFromV1) this.queueSave(project, true);
                return;
            }
            const project = this.createProject(trackId);
            const visibility = await this.loadOverlayVisibility(project);
            if (generation !== this.routeGeneration || this.disposed) return;
            this.overlayVisibilityPersistFailed = visibility.failed;
            this.hasUnexportedChanges = false;
            this.publishReady(
                trackId,
                project,
                false,
                visibility.failed ? 'not-persisted' : 'clean',
                visibility.overlayOpen,
                visibility.failed ? '叠加层显示偏好无法读取；当前工程仍可继续使用。' : undefined,
            );
            this.queueSave(project, true);
            this.startEditorAnalysis(generation);
        } catch (error) {
            if (generation !== this.routeGeneration || this.disposed) return;
            this.releaseLeases();
            this.publishUnavailable(trackId, error instanceof Error ? error.message : '歌曲当前不可编辑。');
        }
    }

    async overwriteConflictingDraft(): Promise<void> {
        if (this.snapshot.state !== 'draft-conflict' || !this.snapshot.activeTrackId) return;
        const trackId = this.snapshot.activeTrackId;
        const project = this.createProject(trackId);
        this.hasUnexportedChanges = false;
        this.publishReady(trackId, project, false, 'saving', false);
        void this.persistOverlayVisibility(project.track.contentHash, false);
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
        const previous = this.store.queue.find(track => track.trackHash === draft.project.track.contentHash);
        if (!previous) {
            this.releaseLeases();
            this.publishUnavailable(this.snapshot.routeTrackId ?? '', '旧草稿对应歌曲已不在播放列表中，草稿已保留。');
            return { kind: 'fallback' };
        }
        const generation = ++this.routeGeneration;
        this.releaseLeases();
        try {
            const playbackLease = await this.audioSession.acquireRoutePlayback({
                consumer: 'editor',
                trackId: previous.id,
            });
            if (generation !== this.routeGeneration || this.disposed) {
                playbackLease.release();
                return { kind: 'fallback' };
            }
            this.playbackLease = playbackLease;
            this.analysisLease = this.analysisCoordinator.acquireConsumer('editor');
            const context = this.trackContext(previous.id);
            if (!context) throw new Error('旧歌曲无法恢复解码信息。');
            const project = validateEditorProjectV2(draft.project, context);
            const visibility = await this.loadOverlayVisibility(project);
            if (generation !== this.routeGeneration || this.disposed) {
                playbackLease.release();
                return { kind: 'fallback' };
            }
            this.overlayVisibilityPersistFailed = visibility.failed;
            this.hasUnexportedChanges = true;
            this.publishReady(
                previous.id,
                project,
                true,
                visibility.failed ? 'not-persisted' : 'saved',
                visibility.overlayOpen,
                visibility.failed ? '叠加层显示偏好无法读取；当前工程仍可继续使用。' : undefined,
            );
            this.startEditorAnalysis(generation);
            return { kind: 'restored-old', trackId: previous.id };
        } catch {
            this.releaseLeases();
            this.publishUnavailable(previous.id, '旧歌曲当前无法恢复，草稿已保留。');
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
        this.publishReady(trackId, project, false, 'clean', false);
        void this.persistOverlayVisibility(project.track.contentHash, false);
        this.queueSave(project, true);
        this.startEditorAnalysis(this.routeGeneration);
    }

    async importProject(codecId = 'json-v2'): Promise<'imported' | 'cancelled'> {
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
            overlayOpen: this.snapshot.overlayOpen && candidate.workspace.overlay.featureId !== null,
            persistence: 'saving',
            message: undefined,
        });
        this.queueSave(candidate, true);
        await this.flush();
        this.restartEditorAnalysis();
        return 'imported';
    }

    isCurrentProject(project: EditorProjectV2 | null): boolean {
        return this.snapshot.project === project;
    }

    readImportDraft(): Promise<EditorRestoredDraft | null> {
        return this.repository.restore();
    }

    exportImportDraft(draft: EditorDraftEnvelopeV2): Promise<'saved' | 'cancelled'> {
        return this.exportProjectValue(draft.project);
    }

    async applyImportedProject(project: EditorProjectV2, expected: EditorProjectV2): Promise<void> {
        if (!this.isCurrentProject(expected)) throw new Error('工程已变化，请重新预览谱面。');
        const trackId = this.snapshot.activeTrackId;
        const context = trackId ? this.trackContext(trackId) : null;
        if (!context) throw new Error('歌曲当前不可编辑。');
        const candidate = validateEditorProjectV2(project, context);
        this.tempoRequestRevision++;
        this.updateProject(candidate, true);
        await this.flush();
    }

    async exportProject(codecId = 'json-v2'): Promise<'saved' | 'cancelled'> {
        const project = this.snapshot.project;
        if (!project) return 'cancelled';
        const result = await this.exportProjectValue(project, codecId);
        if (result === 'saved') this.hasUnexportedChanges = false;
        return result;
    }

    updateProject(project: EditorProjectV2, immediate = false): void {
        const context = this.snapshot.activeTrackId ? this.trackContext(this.snapshot.activeTrackId) : null;
        if (!context || this.snapshot.state !== 'ready') return;
        const tempoChanged = JSON.stringify(project.tempoMap) !== JSON.stringify(this.snapshot.project?.tempoMap ?? []);
        const overlayChanged =
            project.workspace.overlay.featureId !== this.snapshot.project?.workspace.overlay.featureId ||
            project.workspace.overlay.stemRole !== this.snapshot.project?.workspace.overlay.stemRole;
        if (tempoChanged) {
            this.tempoRequestRevision += 1;
        }
        const durationTolerance = Math.max(1e-6, 1 / context.sampleRate);
        if (
            project.track.contentHash !== context.contentHash ||
            Math.abs(project.track.durationSeconds - context.durationSeconds) > durationTolerance
        )
            return;
        const candidate: EditorProjectV2 = {
            ...project,
            updatedAt: this.now().toISOString(),
        };
        this.hasUnexportedChanges = true;
        this.publish({
            ...this.snapshot,
            project: candidate,
            overlayOpen:
                overlayChanged && candidate.workspace.overlay.featureId === null ? false : this.snapshot.overlayOpen,
            persistence: 'saving',
            message: undefined,
            ...(tempoChanged
                ? {
                      tempoEstimateState: 'idle' as const,
                      tempoEstimateConfidence: undefined,
                  }
                : {}),
        });
        this.queueSave(candidate, immediate);
        if (overlayChanged) void this.syncOverlayAnalysis();
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
        this.saveInFlight = this.repository
            .replace({
                schemaVersion: 2,
                savedAt: this.now().toISOString(),
                project,
            })
            .then(() => {
                this.publish({
                    ...this.snapshot,
                    persistence: this.overlayVisibilityPersistFailed ? 'not-persisted' : 'saved',
                    message: this.overlayVisibilityPersistFailed
                        ? '叠加层显示偏好无法保存；当前工程和页面状态仍可继续使用。'
                        : undefined,
                });
            })
            .catch(() => {
                this.publish({
                    ...this.snapshot,
                    persistence: 'not-persisted',
                    message: '当前工程仍在内存中，但无法保存草稿。',
                });
            })
            .finally(() => {
                this.saveInFlight = null;
                this.syncBeforeUnload();
            });
        this.syncBeforeUnload();
        await this.saveInFlight;
        if (this.pendingProject) await this.flush();
    }

    async leave(): Promise<void> {
        this.trackChangeApproval.clear();
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
        this.analysisListeners.clear();
    }

    private createProject(trackId: string): EditorProjectV2 {
        const track = this.store.queue.find(entry => entry.id === trackId);
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
        const track = this.store.queue.find(entry => entry.id === trackId);
        const descriptor = this.audioSession.getDecodedTrackDescriptor(trackId);
        return track?.trackHash && descriptor
            ? {
                  contentHash: track.trackHash,
                  durationSeconds: descriptor.durationSeconds,
                  sampleRate: descriptor.sampleRate,
              }
            : null;
    }

    private async loadOverlayVisibility(project: EditorProjectV2): Promise<{
        overlayOpen: boolean;
        failed: boolean;
    }> {
        try {
            const stored = await this.repository.getOverlayVisibility(project.track.contentHash);
            return {
                overlayOpen: resolveEditorOverlayOpen(project.workspace.overlay.featureId, stored),
                failed: false,
            };
        } catch {
            return {
                overlayOpen: resolveEditorOverlayOpen(project.workspace.overlay.featureId, null),
                failed: true,
            };
        }
    }

    private async persistOverlayVisibility(contentHash: string, enabled: boolean): Promise<void> {
        const revision = ++this.overlayVisibilityWriteRevision;
        try {
            await this.repository.setOverlayVisibility(contentHash, enabled);
            if (
                revision !== this.overlayVisibilityWriteRevision ||
                this.snapshot.project?.track.contentHash !== contentHash
            )
                return;
            this.overlayVisibilityPersistFailed = false;
        } catch {
            if (
                revision !== this.overlayVisibilityWriteRevision ||
                this.snapshot.project?.track.contentHash !== contentHash
            )
                return;
            this.overlayVisibilityPersistFailed = true;
            this.publish({
                ...this.snapshot,
                persistence: 'not-persisted',
                message: '叠加层显示偏好无法保存；当前工程和页面状态仍可继续使用。',
            });
        }
    }

    private queueSave(project: EditorProjectV2, immediate: boolean): void {
        this.pendingProject = project;
        if (this.saveTimer) this.clearTimer(this.saveTimer);
        this.saveTimer = null;
        this.syncBeforeUnload();
        if (immediate) {
            this.saveTimer = this.setTimer(() => {
                this.saveTimer = null;
                void this.flush();
            }, 0);
        } else {
            this.saveTimer = this.setTimer(() => {
                this.saveTimer = null;
                void this.flush();
            }, 250);
        }
    }

    private async exportProjectValue(project: EditorProjectV2, codecId = 'json-v2'): Promise<'saved' | 'cancelled'> {
        const codec = this.codecs.get(codecId);
        const bytes = codec.encode(project);
        return this.fileGateway.save(codec, editorProjectFileName(project.track.fileName, codec), bytes);
    }

    private publishReady(
        trackId: string,
        project: EditorProjectV2,
        restoredFromDraft: boolean,
        persistence: EditorSessionSnapshot['persistence'],
        overlayOpen: boolean,
        message?: string,
    ): void {
        this.publish({
            state: 'ready',
            routeTrackId: trackId,
            activeTrackId: trackId,
            project,
            conflictingDraft: null,
            persistence,
            restoredFromDraft,
            overlayOpen,
            ...(message ? { message } : {}),
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
        this.tempoRequestRevision += 1;
        this.unsubscribeAnalysis?.();
        this.unsubscribeAnalysis = null;
        this.analysisLease?.release();
        this.analysisLease = null;
        this.lastReadyBufferSeries = null;
        this.baseAnalysisHandledForRoute = -1;
        this.overlayActivationReady = false;
        this.playbackLease?.release();
        this.playbackLease = null;
    }

    private startEditorAnalysis(routeGeneration: number): void {
        const lease = this.analysisLease;
        if (!lease) return;
        this.unsubscribeAnalysis?.();
        this.unsubscribeAnalysis = lease.subscribe(snapshot => {
            this.analysisSnapshot = snapshot;
            if (snapshot.readyFeatureIds.includes('buffer')) {
                this.lastReadyBufferSeries = lease.getSeries('buffer') ?? this.lastReadyBufferSeries;
            }
            const next = structuredClone(snapshot);
            for (const listener of this.analysisListeners) listener(next);
            if (snapshot.readyFeatureIds.includes('buffer') && this.baseAnalysisHandledForRoute !== routeGeneration) {
                this.baseAnalysisHandledForRoute = routeGeneration;
                void this.runAutomaticTempoEstimate(routeGeneration);
                return;
            }
            if (
                this.overlayActivationReady &&
                snapshot.state === 'ready' &&
                !sameFeatureIds(
                    snapshot.activeFeatureIds,
                    editorOverlayFeatureIds(
                        this.snapshot.project?.workspace.overlay.stemRole
                            ? null
                            : (this.snapshot.project?.workspace.overlay.featureId ?? null),
                        this.snapshot.overlayOpen,
                    ),
                )
            ) {
                void this.syncOverlayAnalysis();
            }
        });
        this.overlayActivationReady = true;
        void this.syncOverlayAnalysis();
    }

    private restartEditorAnalysis(): void {
        this.baseAnalysisHandledForRoute = -1;
        this.overlayActivationReady = false;
        this.lastReadyBufferSeries = null;
        this.startEditorAnalysis(this.routeGeneration);
    }

    private async syncOverlayAnalysis(force = false): Promise<void> {
        const lease = this.analysisLease;
        const featureId = this.snapshot.project?.workspace.overlay.featureId ?? null;
        if (!lease || this.snapshot.state !== 'ready' || !this.overlayActivationReady) return;
        const stemRole = this.snapshot.project?.workspace.overlay.stemRole;
        const activeFeatureIds = editorOverlayFeatureIds(stemRole ? null : featureId, this.snapshot.overlayOpen);
        const inputs: import('../analysis/sources').AnalysisInput[] = activeFeatureIds.map(featureId => ({
            featureId,
        }));
        if (stemRole && featureId && this.snapshot.overlayOpen) inputs.push({ featureId, stemRole });
        if (force) await lease.setActiveInputs([]);
        await lease.setActiveInputs(inputs);
    }

    private async runAutomaticTempoEstimate(routeGeneration: number): Promise<void> {
        const project = this.snapshot.project;
        const segment = project?.tempoMap[0];
        if (
            !project ||
            this.trackChangeApproval.hasPending(project) ||
            project.tempoMap.length !== 1 ||
            segment?.mode !== 'metered' ||
            segment.bpm !== null ||
            segment.bpmSource !== 'unset'
        )
            return;
        const requestRevision = ++this.tempoRequestRevision;
        this.publish({
            ...this.snapshot,
            tempoEstimateState: 'estimating',
            tempoEstimateConfidence: undefined,
        });
        const result = await this.requestTempoEstimate();
        if (this.disposed || routeGeneration !== this.routeGeneration || requestRevision !== this.tempoRequestRevision)
            return;
        if (!result) {
            this.publish({ ...this.snapshot, tempoEstimateState: 'unavailable' });
            return;
        }
        if (result.state === 'low-confidence') {
            this.publish({
                ...this.snapshot,
                tempoEstimateState: 'low-confidence',
                tempoEstimateConfidence: result.confidence,
            });
            return;
        }
        const current = this.snapshot.project;
        const currentSegment = current?.tempoMap[0];
        if (!current || !currentSegment || current.tempoMap.length !== 1) return;
        const estimated = useEstimatedBpm(currentSegment, result.bpm);
        if (!estimated) return;
        const candidate = validateEditorProjectV2(
            {
                ...current,
                updatedAt: this.now().toISOString(),
                tempoMap: [estimated],
            },
            this.trackContext(this.snapshot.activeTrackId ?? '') ?? undefined,
        );
        this.publish({
            ...this.snapshot,
            project: candidate,
            persistence: 'saving',
            tempoEstimateState: 'reliable',
            tempoEstimateConfidence: result.confidence,
        });
        this.queueSave(candidate, true);
    }

    private publish(snapshot: EditorSessionSnapshot): void {
        this.snapshot = snapshot;
        for (const listener of this.listeners) {
            listener(listenerSnapshot(snapshot));
        }
    }

    private readonly handleBeforeUnload = (event: BeforeUnloadEvent): void => {
        if (!this.hasPendingWrite()) return;
        event.preventDefault();
        event.returnValue = '';
    };

    private syncBeforeUnload(): void {
        if (this.hasPendingWrite() && !this.beforeUnloadRegistered) {
            this.windowTarget?.addEventListener('beforeunload', this.handleBeforeUnload as EventListener);
            this.beforeUnloadRegistered = true;
        } else if (!this.hasPendingWrite()) {
            this.removeBeforeUnload();
        }
    }

    private removeBeforeUnload(): void {
        if (!this.beforeUnloadRegistered) return;
        this.windowTarget?.removeEventListener('beforeunload', this.handleBeforeUnload as EventListener);
        this.beforeUnloadRegistered = false;
    }
}

export const editorSessionControllerKey: InjectionKey<EditorSessionController> = Symbol('editor-session-controller');

export const useEditorSessionController = (): EditorSessionController => {
    const controller = inject(editorSessionControllerKey);
    if (!controller) {
        throw new Error('EditorSessionController has not been provided.');
    }
    return controller;
};
