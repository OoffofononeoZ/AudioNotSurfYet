import { inject, type InjectionKey } from 'vue';
import type {
    AudioSessionService,
    RoutePlaybackLease,
} from '../audio/audioSessionService';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type { EditorTrackIdentityV1 } from '../editor/types';
import type { VisualizerFileGateway } from './fileIO';
import {
    createInitialVisualizerProject,
    VisualizerFormatCodecRegistry,
    validateVisualizerProjectV1,
    visualizerProjectFileName,
} from './projectCodec';
import { SceneRegistry } from './sceneRegistry';
import type {
    VisualizerDraftEnvelopeV1,
    VisualizerFrameRate,
    VisualizerProjectV1,
    VisualizerResolution,
    VisualizerSessionSnapshot,
    VisualizerTemplateId,
    VisualizerTrackValidationContext,
} from './types';
import type { VisualizerDraftRepositoryPort } from './visualizerDraftRepository';

type AudioSessionStore = ReturnType<typeof useAudioSessionStore>;
type VisualizerSessionListener = (snapshot: VisualizerSessionSnapshot) => void;

const initialSnapshot = (): VisualizerSessionSnapshot => ({
    state: 'empty',
    routeTrackId: null,
    activeTrackId: null,
    project: null,
    conflictingDraft: null,
    persistence: 'clean',
    restoredFromDraft: false,
});

const cloneProject = (project: VisualizerProjectV1): VisualizerProjectV1 =>
    structuredClone(project);

const cloneEnvelope = (
    envelope: VisualizerDraftEnvelopeV1,
): VisualizerDraftEnvelopeV1 => ({
    schemaVersion: 1,
    savedAt: envelope.savedAt,
    project: cloneProject(envelope.project),
});

const cloneSnapshot = (
    snapshot: VisualizerSessionSnapshot,
): VisualizerSessionSnapshot => ({
    ...snapshot,
    project: snapshot.project ? cloneProject(snapshot.project) : null,
    conflictingDraft: snapshot.conflictingDraft
        ? cloneEnvelope(snapshot.conflictingDraft)
        : null,
});

export interface VisualizerSessionControllerOptions {
    audioSession: AudioSessionService;
    store: AudioSessionStore;
    repository: VisualizerDraftRepositoryPort;
    fileGateway: VisualizerFileGateway;
    codecs?: VisualizerFormatCodecRegistry;
    registry?: SceneRegistry;
    now?: () => Date;
    createId?: () => string;
    createSeed?: () => number;
    setTimer?: (
        handler: () => void,
        timeout: number,
    ) => ReturnType<typeof setTimeout>;
    clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
    windowTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

export type VisualizerDraftConflictResolution =
    | { kind: 'restored-old'; trackId: string }
    | { kind: 'fallback' };

export class VisualizerSessionController {
    private readonly audioSession: AudioSessionService;
    private readonly store: AudioSessionStore;
    private readonly repository: VisualizerDraftRepositoryPort;
    private readonly fileGateway: VisualizerFileGateway;
    private readonly codecs: VisualizerFormatCodecRegistry;
    private readonly registry: SceneRegistry;
    private readonly now: () => Date;
    private readonly createId: () => string;
    private readonly createSeed: () => number;
    private readonly setTimer: (
        handler: () => void,
        timeout: number,
    ) => ReturnType<typeof setTimeout>;
    private readonly clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
    private readonly windowTarget?: Pick<
        Window,
        'addEventListener' | 'removeEventListener'
    >;
    private readonly listeners = new Set<VisualizerSessionListener>();
    private snapshot = initialSnapshot();
    private playbackLease: RoutePlaybackLease | null = null;
    private routeGeneration = 0;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingProject: VisualizerProjectV1 | null = null;
    private saveInFlight: Promise<void> | null = null;
    private beforeUnloadRegistered = false;
    private disposed = false;

    constructor(options: VisualizerSessionControllerOptions) {
        this.audioSession = options.audioSession;
        this.store = options.store;
        this.repository = options.repository;
        this.fileGateway = options.fileGateway;
        this.codecs = options.codecs ?? new VisualizerFormatCodecRegistry();
        this.registry = options.registry ?? new SceneRegistry();
        this.now = options.now ?? (() => new Date());
        this.createId = options.createId ?? (() => crypto.randomUUID());
        this.createSeed = options.createSeed
            ?? (() => crypto.getRandomValues(new Uint32Array(1))[0]!);
        this.setTimer = options.setTimer
            ?? ((handler, timeout) => setTimeout(handler, timeout));
        this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
        this.windowTarget = options.windowTarget
            ?? (typeof window === 'undefined' ? undefined : window);
    }

    getSnapshot(): VisualizerSessionSnapshot {
        return cloneSnapshot(this.snapshot);
    }

    subscribe(listener: VisualizerSessionListener): () => void {
        this.listeners.add(listener);
        listener(cloneSnapshot(this.snapshot));
        return () => this.listeners.delete(listener);
    }

    listTemplates() {
        return this.registry.list();
    }

    hasActivePlaybackLease(): boolean {
        return this.playbackLease !== null && this.snapshot.activeTrackId !== null;
    }

    hasPendingWrite(): boolean {
        return this.pendingProject !== null || this.saveInFlight !== null;
    }

    async enter(trackId: string | null): Promise<void> {
        const generation = ++this.routeGeneration;
        await this.flush();
        if (generation !== this.routeGeneration || this.disposed) return;
        this.releaseLease();
        if (!trackId) {
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
            const lease = await this.audioSession.acquireRoutePlayback({
                consumer: 'visualizer',
                trackId,
            });
            if (generation !== this.routeGeneration || this.disposed) {
                lease.release();
                return;
            }
            this.playbackLease = lease;
            this.publish({
                ...this.snapshot,
                state: 'loading',
                activeTrackId: trackId,
            });
            const context = this.trackContext(trackId);
            if (!context) throw new Error('歌曲解码信息不可用。');
            const draft = await this.repository.restore();
            if (generation !== this.routeGeneration || this.disposed) return;
            if (draft && draft.project.track.contentHash !== context.contentHash) {
                this.publish({
                    ...this.snapshot,
                    state: 'draft-conflict',
                    activeTrackId: trackId,
                    conflictingDraft: draft,
                    message: '检测到另一首歌曲的可视化草稿，请先选择如何处理。',
                });
                return;
            }
            if (draft) {
                const project = validateVisualizerProjectV1(
                    draft.project,
                    context,
                    this.registry,
                );
                this.publishReady(trackId, project, true, 'saved');
                return;
            }
            const project = this.createProject(trackId);
            this.publishReady(trackId, project, false, 'clean');
            this.queueSave(project, true);
        } catch (error) {
            if (generation !== this.routeGeneration || this.disposed) return;
            this.releaseLease();
            this.publishUnavailable(
                trackId,
                error instanceof Error ? error.message : '歌曲当前不可用于可视化。',
            );
        }
    }

    updateOutput(resolution: VisualizerResolution, frameRate: VisualizerFrameRate): void {
        const project = this.snapshot.project;
        if (!project) return;
        this.updateProject({
            ...project,
            output: { ...project.output, resolution, frameRate },
        }, true);
    }

    switchTemplate(templateId: VisualizerTemplateId): void {
        const project = this.snapshot.project;
        if (!project || project.scene.templateId === templateId) return;
        this.updateProject({
            ...project,
            scene: {
                templateId,
                templateVersion: 1,
                seed: project.scene.seed,
                bindings: this.registry.createConstantBindings(templateId),
            },
        }, true);
    }

    updateProject(project: VisualizerProjectV1, immediate = false): void {
        const activeTrackId = this.snapshot.activeTrackId;
        const context = activeTrackId ? this.trackContext(activeTrackId) : null;
        if (
            !context
            || !['ready', 'not-persisted'].includes(this.snapshot.state)
        ) return;
        const candidate = validateVisualizerProjectV1({
            ...project,
            updatedAt: this.now().toISOString(),
        }, context, this.registry);
        this.publish({
            ...this.snapshot,
            state: 'ready',
            project: candidate,
            persistence: 'saving',
            message: undefined,
        });
        this.queueSave(candidate, immediate);
    }

    async importProject(codecId = 'json-v1'): Promise<'imported' | 'cancelled'> {
        const activeTrackId = this.snapshot.activeTrackId;
        const context = activeTrackId ? this.trackContext(activeTrackId) : null;
        if (!activeTrackId || !context || !this.snapshot.project) return 'cancelled';
        const generation = this.routeGeneration;
        const codec = this.codecs.get(codecId);
        const opened = await this.fileGateway.open(codec);
        if (!opened || generation !== this.routeGeneration || this.disposed) return 'cancelled';
        const candidate = codec.decode(opened.bytes, context, this.registry);
        if (generation !== this.routeGeneration || this.disposed) return 'cancelled';
        this.publish({
            ...this.snapshot,
            state: 'ready',
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
        return this.exportProjectValue(project, codecId);
    }

    async exportConflictingDraft(): Promise<'saved' | 'cancelled'> {
        const draft = this.snapshot.conflictingDraft;
        return draft ? this.exportProjectValue(draft.project) : 'cancelled';
    }

    async overwriteConflictingDraft(): Promise<void> {
        const trackId = this.snapshot.activeTrackId;
        if (this.snapshot.state !== 'draft-conflict' || !trackId) return;
        const project = this.createProject(trackId);
        this.publishReady(trackId, project, false, 'saving');
        this.queueSave(project, true);
        await this.flush();
    }

    async cancelConflictingEntry(): Promise<VisualizerDraftConflictResolution> {
        const draft = this.snapshot.conflictingDraft;
        if (!draft) return { kind: 'fallback' };
        const previous = this.store.queue.find(
            (track) => track.trackHash === draft.project.track.contentHash,
        );
        if (!previous) {
            this.releaseLease();
            this.publishUnavailable(
                this.snapshot.routeTrackId ?? '',
                '旧草稿对应歌曲已不在播放列表中，草稿已保留。',
            );
            return { kind: 'fallback' };
        }
        const generation = ++this.routeGeneration;
        this.releaseLease();
        try {
            const lease = await this.audioSession.acquireRoutePlayback({
                consumer: 'visualizer',
                trackId: previous.id,
            });
            if (generation !== this.routeGeneration || this.disposed) {
                lease.release();
                return { kind: 'fallback' };
            }
            this.playbackLease = lease;
            const context = this.trackContext(previous.id);
            if (!context) throw new Error('旧歌曲无法恢复解码信息。');
            const project = validateVisualizerProjectV1(
                draft.project,
                context,
                this.registry,
            );
            this.publishReady(previous.id, project, true, 'saved');
            return { kind: 'restored-old', trackId: previous.id };
        } catch {
            this.releaseLease();
            this.publishUnavailable(previous.id, '旧歌曲当前无法恢复，草稿已保留。');
            return { kind: 'fallback' };
        }
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
        this.saveInFlight = this.repository.replace({
            schemaVersion: 1,
            savedAt: this.now().toISOString(),
            project,
        }).then(() => {
            this.publish({
                ...this.snapshot,
                state: 'ready',
                persistence: 'saved',
                message: undefined,
            });
        }).catch(() => {
            this.publish({
                ...this.snapshot,
                state: 'not-persisted',
                persistence: 'not-persisted',
                message: '当前可视化工程仍在内存中，但无法保存草稿。',
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
        this.releaseLease();
        this.publish(initialSnapshot());
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        ++this.routeGeneration;
        await this.flush();
        this.releaseLease();
        this.repository.close();
        this.removeBeforeUnload();
        this.listeners.clear();
    }

    private createProject(trackId: string): VisualizerProjectV1 {
        const track = this.trackIdentity(trackId);
        if (!track) throw new Error('歌曲内容身份或解码信息不可用。');
        return createInitialVisualizerProject({
            track,
            registry: this.registry,
            createId: this.createId,
            createSeed: this.createSeed,
            now: this.now,
        });
    }

    private trackIdentity(trackId: string): EditorTrackIdentityV1 | null {
        const track = this.store.queue.find((entry) => entry.id === trackId);
        const descriptor = this.audioSession.getDecodedTrackDescriptor(trackId);
        if (!track?.trackHash || !descriptor) return null;
        return {
            contentHash: track.trackHash,
            fileName: track.name,
            ...(track.metadata.title ? { title: track.metadata.title } : {}),
            ...(track.metadata.artist ? { artist: track.metadata.artist } : {}),
            durationSeconds: descriptor.durationSeconds,
            sampleRate: descriptor.sampleRate,
        };
    }

    private trackContext(trackId: string): VisualizerTrackValidationContext | null {
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

    private queueSave(project: VisualizerProjectV1, immediate: boolean): void {
        this.pendingProject = cloneProject(project);
        if (this.saveTimer) this.clearTimer(this.saveTimer);
        this.saveTimer = this.setTimer(() => {
            this.saveTimer = null;
            void this.flush();
        }, immediate ? 0 : 250);
        this.syncBeforeUnload();
    }

    private async exportProjectValue(
        project: VisualizerProjectV1,
        codecId = 'json-v1',
    ): Promise<'saved' | 'cancelled'> {
        const codec = this.codecs.get(codecId);
        return this.fileGateway.save(
            codec,
            visualizerProjectFileName(project.track.fileName, codec),
            codec.encode(project, this.registry),
        );
    }

    private publishReady(
        trackId: string,
        project: VisualizerProjectV1,
        restoredFromDraft: boolean,
        persistence: VisualizerSessionSnapshot['persistence'],
    ): void {
        this.publish({
            state: persistence === 'not-persisted' ? 'not-persisted' : 'ready',
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

    private releaseLease(): void {
        this.playbackLease?.release();
        this.playbackLease = null;
    }

    private publish(snapshot: VisualizerSessionSnapshot): void {
        this.snapshot = snapshot;
        for (const listener of this.listeners) listener(cloneSnapshot(snapshot));
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

export const visualizerSessionControllerKey: InjectionKey<VisualizerSessionController> =
    Symbol('visualizer-session-controller');

export const useVisualizerSessionController = (): VisualizerSessionController => {
    const controller = inject(visualizerSessionControllerKey);
    if (!controller) throw new Error('VisualizerSessionController has not been provided.');
    return controller;
};
