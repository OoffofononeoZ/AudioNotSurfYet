import { inject, type InjectionKey } from 'vue';
import type { AudioSessionService, RoutePlaybackLease } from '../audio/audioSessionService';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type { AnalysisConsumerLease, AnalysisCoordinator } from '../analysis/analysisCoordinator';
import type { AnalysisCoordinatorSnapshot } from '../analysis/types';
import type { DecodedAudioCopyPort } from '../analysis/pcm';
import { VisualizerWaveformSource } from './waveformSource';
import { NativeAudioSource } from './nativeAudioSource';
import type { EditorDraftRepositoryPort } from '../editor/editorDraftRepository';
import type { EditorFileGateway } from '../editor/fileIO';
import { EditorFormatCodecRegistry, validateEditorProjectV1 } from '../editor/projectCodec';
import {
    createComposition,
    validateComposition,
    encodeComposition,
    decodeComposition,
    compositionFileFormat,
} from './compositionCodec';
import { CompositionResolver } from './compositionResolver';
import { CompositionDraftWriter } from './compositionDraftWriter';
import type { CompositionDraftRepositoryPort } from './compositionDraftRepository';
import {
    compositionIssues,
    planCompositionFeatures,
    removeCompositionElement,
    reorderComposition,
    appendStandaloneElements,
    synchronizeLayers,
    effectiveElements,
    pruneCompositionResources,
} from './compositionModel';
import { elementRegistry } from './elementRegistry';
import { instantiatePreset, type CompositionPresetId } from './compositionPresets';
import { mergeResources } from './resourceCodec';
import { applyCommonControl } from './commonControls';
import type { CommonValue } from './resourceTypes';
import { parameterKey } from './compositionEffects';
import type {
    VisualizerElement,
    ElementBinding,
    VisualizerProjectV4,
    CompositionSessionSnapshot,
} from './compositionTypes';
import type { VisualizerTrackValidationContext, VisualizerResolution, VisualizerFrameRate } from './types';
import type { VisualizerResolvedParameterMap, VisualizerRendererStatus } from './rendererTypes';
import type { VisualizerFileGateway } from './fileIO';
import { NativeVisualizerVideoFileGateway, type VisualizerVideoFileGateway } from './videoFileIO';
import {
    VisualizerExportSession,
    type VisualizerExportSessionOptions,
    type VisualizerExportTarget,
} from './visualizerExportSession';

const initial = (): CompositionSessionSnapshot => ({
    state: 'empty',
    routeTrackId: null,
    activeTrackId: null,
    project: null,
    conflictingDraft: null,
    unsupportedDraft: null,
    persistence: 'clean',
    restoredFromDraft: false,
    export: { status: 'idle' },
    bindingRuntime: {
        bindingRevision: 0,
        activeFeatureIds: [],
        readyFeatureIds: [],
        analysisState: 'idle',
        analysisProgress: 0,
        editorSnapshotSource: 'none',
    },
});
export interface VisualizerSessionControllerOptions {
    audioSession: AudioSessionService;
    audioReady?: Promise<unknown>;
    store: ReturnType<typeof useAudioSessionStore>;
    repository: CompositionDraftRepositoryPort;
    fileGateway: VisualizerFileGateway;
    analysisCoordinator?: AnalysisCoordinator;
    decodedAudio?: DecodedAudioCopyPort;
    editorRepository?: EditorDraftRepositoryPort;
    editorFileGateway?: EditorFileGateway;
    videoGateway?: VisualizerVideoFileGateway;
    exportRuntime?: Pick<VisualizerExportSessionOptions, 'probeCapability' | 'createArtifact' | 'runExport' | 'now'>;
    windowTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}
export class VisualizerExportLockedError extends Error {
    readonly code = 'export-locked';
    constructor() {
        super('导出准备、进行或收尾期间不能修改工程。');
    }
}
export class VisualizerSessionController {
    private options: VisualizerSessionControllerOptions;
    private snapshot = initial();
    private listeners = new Set<(snapshot: CompositionSessionSnapshot) => void>();
    private nativeListeners = new Set<() => void>();
    private playbackLease: RoutePlaybackLease | null = null;
    private analysisLease: AnalysisConsumerLease | null = null;
    private unsubscribeAnalysis: (() => void) | null = null;
    private resolver = new CompositionResolver();
    private waveform: VisualizerWaveformSource | null;
    private native: NativeAudioSource | null;
    private writer: CompositionDraftWriter;
    private exporter: VisualizerExportSession;
    private generation = 0;
    private ioGeneration = 0;
    private editorIoGeneration = 0;
    private disposed = false;
    private windowTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
    private beforeUnload = false;
    constructor(options: VisualizerSessionControllerOptions) {
        this.waveform = options.decodedAudio ? new VisualizerWaveformSource(options.decodedAudio) : null;
        this.native = options.decodedAudio
            ? new NativeAudioSource(options.decodedAudio, () => {
                  if (!this.disposed) for (const listener of this.nativeListeners) listener();
              })
            : null;
        this.options = options;
        this.windowTarget = options.windowTarget ?? (typeof window === 'undefined' ? undefined : window);
        this.writer = new CompositionDraftWriter(options.repository, (persistence, project, message) => {
            if (this.snapshot.project?.projectId !== project.projectId || this.disposed) return;
            this.publish({
                ...this.snapshot,
                persistence,
                state: persistence === 'not-persisted' ? 'not-persisted' : 'ready',
                message: persistence === 'not-persisted' ? '草稿未保存：' + message : undefined,
            });
        });
        this.exporter = new VisualizerExportSession({
            ...options.exportRuntime,
            audioSession: options.audioSession,
            source: options.decodedAudio,
            videoGateway: options.videoGateway ?? new NativeVisualizerVideoFileGateway(),
            readContext: () => ({
                state: this.snapshot.state,
                activeTrackId: this.snapshot.activeTrackId,
                project: this.snapshot.project,
                bindingRuntime: this.snapshot.bindingRuntime,
                configurationIssues: this.snapshot.project ? compositionIssues(this.snapshot.project) : [],
            }),
            prepareFrame: (time, signal) => this.prepareExportFrame(time, signal),
            resolveValues: time => [...this.resolveValuesAt(time).values()],
            onState: value => {
                if (!this.disposed) this.publish({ ...this.snapshot, export: value });
            },
        });
        this.windowTarget?.addEventListener('pagehide', this.handlePageHide);
    }
    getSnapshot() {
        return structuredClone(this.snapshot);
    }
    readProject() {
        return this.snapshot.project;
    }
    subscribe(listener: (snapshot: CompositionSessionSnapshot) => void) {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }
    subscribeNativeInput(listener: () => void) {
        this.nativeListeners.add(listener);
        return () => {
            this.nativeListeners.delete(listener);
        };
    }
    private publish(snapshot: CompositionSessionSnapshot) {
        this.snapshot = snapshot;
        for (const listener of this.listeners) listener(this.getSnapshot());
        this.syncBeforeUnload();
    }
    private assertUnlocked() {
        if (this.exporter.isLocked()) throw new VisualizerExportLockedError();
    }
    hasActivePlaybackLease() {
        return !!this.playbackLease;
    }
    hasPendingWrite() {
        return this.writer.hasPending();
    }
    isExportLocked() {
        return this.exporter.isLocked();
    }
    hasUnresolvedExportOutput() {
        return this.exporter.hasUnresolvedOutput();
    }
    attachExportTarget(target: VisualizerExportTarget) {
        return this.exporter.attachTarget(target);
    }
    notifyRendererStatus(status: VisualizerRendererStatus) {
        this.exporter.notifyRendererStatus(status);
    }
    startExport() {
        return this.exporter.start();
    }
    cancelExport() {
        return this.exporter.cancel();
    }
    saveExport() {
        return this.exporter.save();
    }
    discardExport() {
        return this.exporter.discard();
    }
    resetExportError() {
        this.exporter.resetError();
    }
    getReadyExportFileForDiagnostics() {
        return this.exporter.getReadyFileForDiagnostics();
    }
    private async prepareExportFrame(time: number, signal: AbortSignal) {
        signal.throwIfAborted();
        const project = this.snapshot.project,
            trackId = this.snapshot.activeTrackId;
        if (!project || !trackId) throw Error('导出歌曲身份已失效。');
        const nativeElements = effectiveElements(project).filter(
            e => e.enabled && e.bindings.some(b => b.source.kind === 'native'),
        );
        if (!nativeElements.length) return;
        if (!this.native) throw Error('原生输入不可用。');
        let abort!: () => void;
        const cancelled = new Promise<never>((_, reject) => {
            abort = () => {
                this.native?.reset();
                reject(signal.reason);
            };
            signal.addEventListener('abort', abort, { once: true });
        });
        try {
            await Promise.race([
                (async () => {
                    await this.native!.prepare(trackId, time);
                    signal.throwIfAborted();
                    for (const e of nativeElements.filter(e => e.type === 'spectral-strings'))
                        for (const b of e.bindings)
                            if (b.source.kind === 'native') {
                                await this.native!.prepareHistory(trackId, time, b.source.featureId);
                                signal.throwIfAborted();
                            }
                })(),
                cancelled,
            ]);
        } finally {
            signal.removeEventListener('abort', abort);
        }
    }
    async togglePlayback() {
        this.assertUnlocked();
        await this.options.audioSession.togglePlayback();
    }
    async seek(seconds: number) {
        this.assertUnlocked();
        await this.options.audioSession.seek(seconds);
    }
    private context(trackId = this.snapshot.activeTrackId): VisualizerTrackValidationContext | null {
        const track = this.options.store.queue.find(t => t.id === trackId),
            decoded = trackId ? this.options.audioSession.getDecodedTrackDescriptor(trackId) : null;
        return track?.trackHash && decoded
            ? { contentHash: track.trackHash, durationSeconds: decoded.durationSeconds, sampleRate: decoded.sampleRate }
            : null;
    }
    private createProject(trackId: string) {
        const track = this.options.store.queue.find(t => t.id === trackId),
            context = this.context(trackId);
        if (!track || !context) throw Error('歌曲身份尚未就绪。');
        return createComposition({
            ...context,
            fileName: track.name,
            ...(track.metadata.title ? { title: track.metadata.title } : {}),
            ...(track.metadata.artist ? { artist: track.metadata.artist } : {}),
        });
    }
    async enter(trackId: string | null, overwrite = false): Promise<void> {
        this.assertUnlocked();
        const generation = ++this.generation;
        this.ioGeneration++;
        this.editorIoGeneration++;
        if (!(await this.flush())) throw Error('请先重试保存或导出当前工程。');
        if (generation !== this.generation || this.disposed) return;
        await this.exporter.notifyIdentityChange();
        if (generation !== this.generation || this.disposed) return;
        this.releaseLeases();
        this.publish({ ...initial(), state: trackId ? 'loading' : 'empty', routeTrackId: trackId });
        if (!trackId) return;
        try {
            await this.options.audioReady;
            if (generation !== this.generation || this.disposed) return;
            const lease = await this.options.audioSession.acquireRoutePlayback({ consumer: 'visualizer', trackId });
            if (generation !== this.generation || this.disposed) {
                lease.release();
                return;
            }
            this.playbackLease = lease;
            this.publish({ ...this.snapshot, activeTrackId: trackId });
            const context = this.context(trackId);
            if (!context) throw Error('歌曲无法解码。');
            const restored = await this.options.repository.restore();
            if (generation !== this.generation || this.disposed) return;
            if (!overwrite && restored?.kind === 'unsupported') {
                this.publish({
                    ...this.snapshot,
                    state: 'unsupported-draft',
                    unsupportedDraft: restored.raw,
                    message: 'V4 草稿无效，请先导出或明确覆盖。',
                });
                return;
            }
            if (
                !overwrite &&
                restored?.kind === 'current' &&
                restored.draft.project.track.contentHash !== context.contentHash
            ) {
                this.publish({
                    ...this.snapshot,
                    state: 'draft-conflict',
                    conflictingDraft: restored.draft,
                    message: '另一首歌曲已有草稿。',
                });
                return;
            }
            let project =
                !overwrite && restored?.kind === 'current'
                    ? validateComposition(restored.draft.project, context)
                    : this.createProject(trackId);
            if (!project.editorSnapshot && this.options.editorRepository) {
                try {
                    const editor = await this.options.editorRepository.restore();
                    if (generation !== this.generation || this.disposed) return;
                    if (editor?.project.track.contentHash === context.contentHash)
                        project = validateComposition(
                            { ...project, editorSnapshot: { capturedAt: editor.savedAt, project: editor.project } },
                            context,
                        );
                } catch {
                    /* Optional Editor data remains explicitly disconnected. */
                }
            }
            this.publish({
                ...this.snapshot,
                state: 'ready',
                project,
                persistence: restored?.kind === 'current' && !overwrite ? 'saved' : 'saving',
                restoredFromDraft: restored?.kind === 'current' && !overwrite,
                bindingRuntime: {
                    ...initial().bindingRuntime,
                    bindingRevision: this.snapshot.bindingRuntime.bindingRevision + 1,
                    editorSnapshotSource: project.editorSnapshot ? 'project' : 'none',
                },
            });
            this.activateAnalysis();
            if (overwrite || !restored) this.writer.queue(project);
            this.syncBeforeUnload();
        } catch (error) {
            if (generation !== this.generation || this.disposed) return;
            this.releaseLeases();
            this.publish({
                ...initial(),
                state: 'unavailable',
                routeTrackId: trackId,
                message: (error as Error).message,
            });
        }
    }
    updateProject(input: VisualizerProjectV4) {
        this.assertUnlocked();
        const context = this.context();
        if (!context || !this.snapshot.project) return;
        const project = validateComposition(
            pruneCompositionResources({ ...input, updatedAt: new Date().toISOString() }),
            context,
        );
        this.resolver.reset();
        this.publish({
            ...this.snapshot,
            state: 'ready',
            project,
            persistence: 'saving',
            message: undefined,
            bindingRuntime: {
                ...this.snapshot.bindingRuntime,
                bindingRevision: this.snapshot.bindingRuntime.bindingRevision + 1,
                editorSnapshotSource: project.editorSnapshot
                    ? this.snapshot.bindingRuntime.editorSnapshotSource === 'none'
                        ? 'project'
                        : this.snapshot.bindingRuntime.editorSnapshotSource
                    : 'none',
            },
        });
        this.writer.queue(project);
        this.activateAnalysis();
        this.syncBeforeUnload();
    }
    addElement(type: string) {
        this.assertUnlocked();
        const project = this.snapshot.project;
        if (!project) return null;
        const element = elementRegistry.create(type, project.track.durationSeconds, project.elements.length);
        this.updateProject(appendStandaloneElements(project, [element]));
        return element.id;
    }
    addPreset(id: CompositionPresetId) {
        this.assertUnlocked();
        const p = this.snapshot.project;
        if (!p) return null;
        const added = instantiatePreset(id, p.track.durationSeconds, p.elements.length);
        this.updateProject(
            synchronizeLayers({
                ...p,
                elements: [...p.elements, ...added.elements],
                items: [...p.items, added.group],
                resources: mergeResources(p.resources, added.resources),
            }),
        );
        return added.group.id;
    }
    updateElement(id: string, patch: Partial<VisualizerElement>) {
        const p = this.snapshot.project;
        if (p)
            this.updateProject({
                ...p,
                elements: p.elements.map(e => (e.id === id ? { ...e, ...structuredClone(patch), id } : e)),
            });
    }
    updatePreset(id: string, patch: { name?: string; enabled?: boolean }) {
        const p = this.snapshot.project;
        if (p)
            this.updateProject({
                ...p,
                items: p.items.map(i => (i.kind === 'preset' && i.id === id ? { ...i, ...patch } : i)),
            });
    }
    updateVisibility(id: string, enabled: boolean) {
        const p = this.snapshot.project;
        if (p?.items.some(i => i.kind === 'preset' && i.id === id)) this.updatePreset(id, { enabled });
        else this.updateElement(id, { enabled });
    }
    updateCommonControl(id: string, controlId: string, value: CommonValue) {
        const p = this.snapshot.project,
            group = p?.items.find(i => i.kind === 'preset' && i.id === id);
        if (p && group?.kind === 'preset') this.updateProject(applyCommonControl(p, group, controlId, value));
    }
    updateBinding(id: string, binding: ElementBinding) {
        const e = this.snapshot.project?.elements.find(e => e.id === id);
        if (e)
            this.updateElement(id, {
                bindings: e.bindings.map(b => (b.parameterId === binding.parameterId ? structuredClone(binding) : b)),
            });
    }
    removeElement(id: string) {
        if (this.snapshot.project) this.updateProject(removeCompositionElement(this.snapshot.project, id));
    }
    reorderElements(ids: string[], parentId?: string) {
        if (this.snapshot.project) this.updateProject(reorderComposition(this.snapshot.project, ids, parentId));
    }
    updateOutput(resolution: VisualizerResolution, frameRate: VisualizerFrameRate) {
        const p = this.snapshot.project;
        if (p) this.updateProject({ ...p, output: { aspectRatio: '16:9', resolution, frameRate } });
    }
    resolveValuesAt(time: number): VisualizerResolvedParameterMap {
        const project = this.snapshot.project;
        if (!project) return new Map();
        const trackId = this.snapshot.activeTrackId;
        const result = this.resolver.resolve(
            project,
            Math.max(0, time),
            id => this.analysisLease?.getSeries(id) ?? null,
            at => (trackId ? (this.waveform?.read(trackId, at) ?? null) : null),
            (feature, at, history) =>
                trackId
                    ? ((history
                          ? this.native?.readHistory(trackId, at, feature)
                          : this.native?.read(trackId, at, feature)) ?? null)
                    : null,
        );
        const flat = new Map();
        for (const [id, values] of result)
            for (const [parameter, value] of values) flat.set(parameterKey(id, parameter), value);
        return flat;
    }
    async reloadEditorDraft() {
        this.assertUnlocked();
        const generation = this.generation,
            io = ++this.editorIoGeneration;
        const draft = await this.options.editorRepository?.restore();
        if (generation !== this.generation || io !== this.editorIoGeneration || this.disposed) return;
        if (!draft) throw Error('没有可用的同歌 Editor 草稿。');
        this.setEditorSnapshot(draft.project, draft.savedAt, 'draft');
    }
    async importEditorProject() {
        this.assertUnlocked();
        const generation = this.generation,
            io = ++this.editorIoGeneration;
        const codec = new EditorFormatCodecRegistry().get('json-v1');
        const opened = await this.options.editorFileGateway?.open(codec);
        if (!opened || generation !== this.generation || io !== this.editorIoGeneration || this.disposed) return;
        const context = this.context();
        if (!context) return;
        this.setEditorSnapshot(codec.decode(opened.bytes, context), new Date().toISOString(), 'imported');
    }
    private setEditorSnapshot(input: unknown, capturedAt: string, source: 'draft' | 'imported') {
        const context = this.context(),
            p = this.snapshot.project;
        if (!context || !p) return;
        const project = validateEditorProjectV1(input, context);
        this.updateProject({ ...p, editorSnapshot: { capturedAt, project } });
        this.publish({
            ...this.snapshot,
            bindingRuntime: { ...this.snapshot.bindingRuntime, editorSnapshotSource: source },
        });
    }
    removeEditorSnapshot() {
        const p = this.snapshot.project;
        if (!p) return;
        const next = structuredClone(p);
        delete next.editorSnapshot;
        this.updateProject(next);
    }
    async importProject() {
        this.assertUnlocked();
        const generation = this.generation,
            io = ++this.ioGeneration;
        const opened = await this.options.fileGateway.open(compositionFileFormat);
        if (!opened || generation !== this.generation || io !== this.ioGeneration || this.disposed) return 'cancelled';
        const context = this.context();
        if (!context) return 'cancelled';
        const project = decodeComposition(opened.bytes, context);
        this.updateProject(project);
        await this.flush();
        return 'imported';
    }
    async exportProject() {
        const p = this.snapshot.project;
        if (!p) return 'cancelled';
        return this.options.fileGateway.save(
            compositionFileFormat,
            p.track.fileName.replace(/\.[^.]+$/, '') + compositionFileFormat.extension,
            encodeComposition(p),
        );
    }
    async exportConflictingDraft() {
        const conflict = this.snapshot.conflictingDraft,
            raw = this.snapshot.unsupportedDraft;
        if (conflict)
            return this.options.fileGateway.save(
                compositionFileFormat,
                conflict.project.track.fileName + compositionFileFormat.extension,
                encodeComposition(conflict.project),
            );
        if (raw !== null)
            return this.options.fileGateway.save(
                compositionFileFormat,
                'previous-visualizer-draft.json',
                new TextEncoder().encode(JSON.stringify(raw, null, 2) + '\n'),
            );
        return 'cancelled';
    }
    async overwriteConflictingDraft() {
        if (this.snapshot.activeTrackId) await this.enter(this.snapshot.activeTrackId, true);
    }
    retryAnalysis() {
        const features = this.snapshot.bindingRuntime.activeFeatureIds;
        return this.analysisLease?.setActiveFeatures(features);
    }
    retryNativeInput() {
        this.assertUnlocked();
        this.native?.reset();
        this.publish({
            ...this.snapshot,
            bindingRuntime: {
                ...this.snapshot.bindingRuntime,
                bindingRevision: this.snapshot.bindingRuntime.bindingRevision + 1,
            },
        });
    }
    private activateAnalysis() {
        const project = this.snapshot.project;
        if (!project) return;
        this.native?.configureHistory(
            effectiveElements(project)
                .filter(e => e.enabled && e.type === 'spectral-strings')
                .flatMap(e => e.bindings.flatMap(b => (b.source.kind === 'native' ? [b.source.featureId] : []))),
        );
        if (!this.options.analysisCoordinator) return;
        const ids = planCompositionFeatures(project),
            previous = this.snapshot.bindingRuntime.activeFeatureIds;
        const changed = ids.join('|') !== previous.join('|');
        this.publish({
            ...this.snapshot,
            bindingRuntime: {
                ...this.snapshot.bindingRuntime,
                activeFeatureIds: ids,
                readyFeatureIds: changed ? [] : this.snapshot.bindingRuntime.readyFeatureIds,
                analysisState: ids.length ? (changed ? 'loading' : this.snapshot.bindingRuntime.analysisState) : 'idle',
                analysisProgress: ids.length ? this.snapshot.bindingRuntime.analysisProgress : 0,
            },
        });
        const acquired = !this.analysisLease;
        if (!this.analysisLease) {
            this.analysisLease = this.options.analysisCoordinator.acquireConsumer('visualizer');
            this.unsubscribeAnalysis = this.analysisLease.subscribe(s => this.handleAnalysis(s));
        }
        if (changed || acquired) {
            const generation = this.generation,
                revision = this.snapshot.bindingRuntime.bindingRevision;
            void this.analysisLease.setActiveFeatures(ids).catch(error => {
                if (
                    generation === this.generation &&
                    revision === this.snapshot.bindingRuntime.bindingRevision &&
                    !this.disposed
                )
                    this.publish({
                        ...this.snapshot,
                        bindingRuntime: {
                            ...this.snapshot.bindingRuntime,
                            analysisState: 'error',
                            analysisMessage: (error as Error).message,
                        },
                    });
            });
        }
    }
    private handleAnalysis(s: AnalysisCoordinatorSnapshot) {
        if (
            !this.snapshot.project ||
            this.disposed ||
            (s.trackHash && s.trackHash !== this.snapshot.project.track.contentHash)
        )
            return;
        const r = this.snapshot.bindingRuntime,
            ready = s.readyFeatureIds.filter(id => r.activeFeatureIds.includes(id));
        const state = !r.activeFeatureIds.length
            ? 'idle'
            : s.error
              ? 'error'
              : ready.length === r.activeFeatureIds.length && s.state === 'ready'
                ? 'ready'
                : 'loading';
        const changed = state !== r.analysisState || ready.join('|') !== r.readyFeatureIds.join('|');
        if (changed) this.resolver.reset();
        this.publish({
            ...this.snapshot,
            bindingRuntime: {
                ...r,
                bindingRevision: r.bindingRevision + (changed ? 1 : 0),
                readyFeatureIds: ready,
                analysisState: state,
                analysisProgress: s.progress,
                analysisMessage: s.error?.message,
            },
        });
    }
    async flush() {
        const success = await this.writer.flush();
        this.syncBeforeUnload();
        return success;
    }
    private releaseLeases() {
        this.unsubscribeAnalysis?.();
        this.unsubscribeAnalysis = null;
        this.analysisLease?.release();
        this.analysisLease = null;
        this.playbackLease?.release();
        this.playbackLease = null;
        this.resolver.reset();
        this.waveform?.reset();
        this.native?.reset();
    }
    async leave() {
        this.generation++;
        this.ioGeneration++;
        this.editorIoGeneration++;
        await this.exporter.notifyIdentityChange();
        await this.flush();
        this.releaseLeases();
        this.publish(initial());
    }
    async dispose() {
        await this.leave();
        await this.exporter.dispose();
        this.disposed = true;
        this.options.repository.close();
        this.options.editorRepository?.close();
        this.windowTarget?.removeEventListener('pagehide', this.handlePageHide);
        this.windowTarget?.removeEventListener('beforeunload', this.handleBeforeUnload as EventListener);
        this.listeners.clear();
        this.nativeListeners.clear();
    }
    private readonly handlePageHide = () => {
        void this.exporter.handlePageHide();
    };
    private readonly handleBeforeUnload = (event: BeforeUnloadEvent) => {
        if (this.hasPendingWrite() || this.hasUnresolvedExportOutput()) {
            event.preventDefault();
            event.returnValue = '';
        }
    };
    private syncBeforeUnload() {
        const needed = this.hasPendingWrite() || this.hasUnresolvedExportOutput();
        if (needed === this.beforeUnload) return;
        this.beforeUnload = needed;
        if (needed) this.windowTarget?.addEventListener('beforeunload', this.handleBeforeUnload as EventListener);
        else this.windowTarget?.removeEventListener('beforeunload', this.handleBeforeUnload as EventListener);
    }
}
export const visualizerSessionControllerKey: InjectionKey<VisualizerSessionController> = Symbol(
    'visualizer-session-controller',
);
export const useVisualizerSessionController = () => {
    const controller = inject(visualizerSessionControllerKey);
    if (!controller) throw Error('Visualizer controller 未提供。');
    return controller;
};
