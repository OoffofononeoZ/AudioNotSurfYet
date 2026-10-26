import { validateRuntimeSnapshot } from './validateRuntimeSnapshot';
import { ElementSeedSession } from './seed';
import { inject, type InjectionKey } from 'vue';
import type { AudioSessionService, RoutePlaybackLease } from '../audio/audioSessionService';
import type { useAudioSessionStore } from '../stores/audioSessionStore';
import type { AnalysisConsumerLease, AnalysisCoordinator } from '../analysis/analysisCoordinator';
import type { AnalysisCoordinatorSnapshot } from '../analysis/types';
import { analysisInputKey, type AnalysisInput } from '../analysis/sources';
import type { DecodedAudioCopyPort } from '../analysis/pcm';
import { VisualizerWaveformSource } from './waveformSource';
import { NativeAudioSource } from './nativeAudioSource';
import type { EditorDraftRepositoryPort } from '../editor/editorDraftRepository';
import type { EditorFileGateway } from '../editor/fileIO';
import { EditorFormatCodecRegistry, readEditorProject } from '../editor/projectCodec';
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
    planCompositionInputs,
    removeCompositionElement,
    reorderComposition,
    appendStandaloneElements,
    synchronizeLayers,
    effectiveElements,
    pruneCompositionResources,
    elementAlgorithm,
} from './compositionModel';
import { elementRegistry } from './elementRegistry';
import { instantiatePreset, type CompositionPresetId } from './compositionPresets';
import { mergeResources } from './resourceCodec';
import { applyCommonControl } from './commonControls';
import type { CommonValue, ResourceSnapshot } from './resourceTypes';
import { parameterKey } from './compositionEffects';
import type {
    VisualizerElement,
    ElementBinding,
    VisualizerProjectV5,
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
    validateAlgorithms?: typeof validateRuntimeSnapshot;
    windowTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}
export class VisualizerExportLockedError extends Error {
    readonly code = 'export-locked';
    constructor() {
        super('导出准备、进行或收尾期间不能修改工程。');
    }
}
export class VisualizerSessionController {
    updateMedia(payload: {
        elementId: string;
        inputId: string;
        binding: import('./mediaTypes').MediaBinding;
        assets: import('./mediaTypes').MediaAsset[];
    }) {
        this.assertUnlocked();
        const project = this.snapshot.project,
            element = project?.elements.find(e => e.id === payload.elementId);
        if (!project || !element) return;
        const mediaAssets = [
            ...new Map([...(project.mediaAssets ?? []), ...payload.assets].map(a => [a.id, a])).values(),
        ];
        this.updateProject({
            ...project,
            mediaAssets,
            elements: project.elements.map(e =>
                e.id === element.id
                    ? { ...e, mediaBindings: { ...e.mediaBindings, [payload.inputId]: payload.binding } }
                    : e,
            ),
        });
    }
    private options: VisualizerSessionControllerOptions;
    private snapshot = initial();
    private seeds = new ElementSeedSession();
    private listeners = new Set<(snapshot: CompositionSessionSnapshot) => void>();
    private nativeListeners = new Set<() => void>();
    private inputIdentities = new WeakMap<object, number>();
    private inputSequence = 0;
    private nativeRevision = 0;
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
    private algorithmTask: AbortController | null = null;
    private programValidator: ((resources: ResourceSnapshot) => void) | null = null;
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
    readRenderSeeds() {
        return this.seeds.values;
    }
    readAlgorithmInputIdentity(element: VisualizerElement, parameterIds: readonly string[]): string {
        const decoded = this.options.decodedAudio?.getDecodedAudioDescriptor();
        return element.bindings
            .filter(b => parameterIds.includes(b.parameterId))
            .map(binding => {
                const source = binding.source;
                if (source.kind === 'native')
                    return `${binding.parameterId}:native:${decoded?.revision}:${this.nativeRevision}`;
                if (source.kind !== 'analysis') return '';
                const series = this.analysisLease?.getSeries(source.featureId, source.stemRole);
                if (series && !this.inputIdentities.has(series)) this.inputIdentities.set(series, ++this.inputSequence);
                return `${binding.parameterId}:${series ? this.inputIdentities.get(series) : 'pending'}:${source.featureId === 'buffer' ? decoded?.revision : ''}`;
            })
            .join('|');
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
    attachAlgorithmValidator(validator: (resources: ResourceSnapshot) => void) {
        this.programValidator = validator;
        return () => {
            if (this.programValidator === validator) this.programValidator = null;
        };
    }
    async validateResources(resources: ResourceSnapshot, signal?: AbortSignal) {
        await (this.options.validateAlgorithms ?? validateRuntimeSnapshot)(resources, signal);
        signal?.throwIfAborted();
        this.programValidator?.(resources);
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
        await this.prepareValuesAt(time);
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
                    for (const e of nativeElements.filter(
                        e => elementAlgorithm(project, e).contract.historyParameters.length > 0,
                    ))
                        for (const b of e.bindings)
                            if (
                                b.source.kind === 'native' &&
                                elementAlgorithm(project, e).contract.historyParameters.includes(b.parameterId)
                            ) {
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
        await this.options.audioSession.togglePlayback();
    }
    async seek(seconds: number) {
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
        this.algorithmTask?.abort();
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
                    message: 'V5 草稿无效，请先导出或明确覆盖。',
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
            const algorithmTask = new AbortController();
            this.algorithmTask = algorithmTask;
            await this.validateResources(project.resources, algorithmTask.signal);
            if (generation !== this.generation || this.disposed || algorithmTask.signal.aborted) return;
            this.seeds.sync(project.elements, true);
            this.publish({
                ...this.snapshot,
                state: 'ready',
                project,
                persistence: restored?.kind === 'current' && !overwrite && !restored.needsSave ? 'saved' : 'saving',
                restoredFromDraft: restored?.kind === 'current' && !overwrite,
                bindingRuntime: {
                    ...initial().bindingRuntime,
                    bindingRevision: this.snapshot.bindingRuntime.bindingRevision + 1,
                    editorSnapshotSource: project.editorSnapshot ? 'project' : 'none',
                },
            });
            this.activateAnalysis();
            if (overwrite || !restored || (restored.kind === 'current' && restored.needsSave))
                this.writer.queue(project);
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
    updateProject(input: VisualizerProjectV5, options: { resetSeed?: boolean } = {}) {
        this.assertUnlocked();
        const context = this.context();
        if (!context || !this.snapshot.project) return;
        const project = validateComposition(
            pruneCompositionResources({ ...input, updatedAt: new Date().toISOString() }),
            context,
        );
        this.seeds.sync(project.elements, options.resetSeed || project.projectId !== this.snapshot.project.projectId);
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
                ...(added.mediaAssets.length
                    ? {
                          mediaAssets: [
                              ...new Map(
                                  [...(p.mediaAssets ?? []), ...added.mediaAssets].map(asset => [asset.id, asset]),
                              ).values(),
                          ],
                      }
                    : {}),
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
    updateOutput(resolution: VisualizerResolution, frameRate: VisualizerFrameRate, audioVideoOffsetMs?: number) {
        const p = this.snapshot.project;
        if (p)
            this.updateProject({
                ...p,
                output: {
                    ...p.output,
                    resolution,
                    frameRate,
                    audioVideoOffsetMs: audioVideoOffsetMs ?? p.output.audioVideoOffsetMs,
                },
            });
    }
    resolveValuesAt(time: number): VisualizerResolvedParameterMap {
        const project = this.snapshot.project;
        if (!project) return new Map();
        const trackId = this.snapshot.activeTrackId;
        const result = this.resolver.resolve(
            project,
            Math.max(0, time),
            (id, role) => this.analysisLease?.getSeries(id, role) ?? null,
            (at, role) =>
                role
                    ? (this.analysisLease?.readStemWaveform(role, at) ?? null)
                    : trackId
                      ? (this.waveform?.read(trackId, at) ?? null)
                      : null,
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
    async prepareValuesAt(time: number): Promise<void> {
        const project = this.snapshot.project,
            lease = this.analysisLease,
            generation = this.generation;
        if (!project || !lease) return;
        const roles = new Set(
            planCompositionInputs(project)
                .filter(input => input.stemRole && input.featureId === 'buffer')
                .map(input => input.stemRole!),
        );
        if ([...roles].some(role => lease.getSourceSnapshot(role).state !== 'ready')) return;
        await Promise.all([...roles].map(role => lease.prepareStemWaveform(role, time)));
        if (generation !== this.generation || project !== this.snapshot.project || lease !== this.analysisLease)
            throw Error('分轨输入准备已取消。');
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
        const codec = new EditorFormatCodecRegistry().get('json-v2');
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
        const project = readEditorProject(input, context);
        this.updateProject({ ...p, editorSnapshot: { capturedAt, project } });
        this.publish({
            ...this.snapshot,
            bindingRuntime: { ...this.snapshot.bindingRuntime, editorSnapshotSource: source },
        });
    }
    removeEditorSnapshot() {
        const p = this.snapshot.project;
        if (!p) return;
        if (
            p.elements.some(
                e =>
                    e.timing.kind === 'editor-range' ||
                    Object.values(e.markerBindings ?? {}).some(b => b.kind !== 'unbound'),
            )
        )
            throw Error('Editor 快照仍被元素引用，请先解除标记绑定。');
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
        const previous = this.snapshot.project;
        this.algorithmTask?.abort();
        const task = new AbortController();
        this.algorithmTask = task;
        await this.validateResources(project.resources, task.signal);
        if (
            generation !== this.generation ||
            io !== this.ioGeneration ||
            this.disposed ||
            task.signal.aborted ||
            this.snapshot.project !== previous
        )
            return 'cancelled';
        this.updateProject(project, { resetSeed: true });
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
    async retryAnalysis() {
        const project = this.snapshot.project;
        if (!project || !this.analysisLease) return;
        await this.analysisLease.setActiveInputs([]);
        await this.analysisLease.setActiveInputs(planCompositionInputs(project));
    }
    retryNativeInput() {
        this.assertUnlocked();
        this.nativeRevision++;
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
                .filter(e => e.enabled && elementAlgorithm(project, e).contract.historyParameters.length > 0)
                .flatMap(e =>
                    e.bindings.flatMap(b =>
                        b.source.kind === 'native' &&
                        elementAlgorithm(project, e).contract.historyParameters.includes(b.parameterId)
                            ? [b.source.featureId]
                            : [],
                    ),
                ),
        );
        if (!this.options.analysisCoordinator) return;
        const inputs = planCompositionInputs(project),
            ids = planCompositionFeatures(project),
            previous =
                this.snapshot.bindingRuntime.activeInputs ??
                this.snapshot.bindingRuntime.activeFeatureIds.map(featureId => ({ featureId }));
        const changed = inputs.map(analysisInputKey).join('|') !== previous.map(analysisInputKey).join('|');
        this.publish({
            ...this.snapshot,
            bindingRuntime: {
                ...this.snapshot.bindingRuntime,
                activeFeatureIds: ids,
                activeInputs: inputs,
                readyInputs: changed ? [] : this.snapshot.bindingRuntime.readyInputs,
                readyFeatureIds: changed ? [] : this.snapshot.bindingRuntime.readyFeatureIds,
                analysisState: inputs.length
                    ? changed
                        ? 'loading'
                        : this.snapshot.bindingRuntime.analysisState
                    : 'idle',
                analysisProgress: inputs.length ? this.snapshot.bindingRuntime.analysisProgress : 0,
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
            void this.analysisLease.setActiveInputs(inputs).catch(error => {
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
        const r = this.snapshot.bindingRuntime;
        const inputs: AnalysisInput[] = r.activeInputs ?? r.activeFeatureIds.map(featureId => ({ featureId }));
        const sourceStates = [...new Set(inputs.map(input => input.stemRole))].map(role =>
            role ? this.analysisLease!.getSourceSnapshot(role) : s,
        );
        const readyInputs = inputs.filter(input => {
            const snapshot = input.stemRole ? this.analysisLease!.getSourceSnapshot(input.stemRole) : s;
            return snapshot.state === 'ready' && snapshot.readyFeatureIds.includes(input.featureId);
        });
        const ready = readyInputs.filter(input => !input.stemRole).map(input => input.featureId);
        const error = sourceStates.find(snapshot => snapshot.error)?.error;
        const state = !inputs.length
            ? 'idle'
            : error
              ? 'error'
              : readyInputs.length === inputs.length
                ? 'ready'
                : 'loading';
        const changed =
            state !== r.analysisState ||
            readyInputs.map(analysisInputKey).join('|') !==
                (r.readyInputs ?? r.readyFeatureIds.map(featureId => ({ featureId }))).map(analysisInputKey).join('|');
        if (changed) this.resolver.reset();
        this.publish({
            ...this.snapshot,
            bindingRuntime: {
                ...r,
                bindingRevision: r.bindingRevision + (changed ? 1 : 0),
                readyFeatureIds: ready,
                readyInputs,
                analysisState: state,
                analysisProgress: sourceStates.length
                    ? sourceStates.reduce((sum, snapshot) => sum + snapshot.progress, 0) / sourceStates.length
                    : 0,
                analysisMessage:
                    error?.message ??
                    (sourceStates.some(snapshot => snapshot.cacheState === 'not-persisted')
                        ? '当前分析缓存未持久化。'
                        : undefined),
            },
        });
        for (const listener of this.nativeListeners) listener();
    }
    async flush() {
        const success = await this.writer.flush();
        this.syncBeforeUnload();
        return success;
    }
    private releaseLeases() {
        this.seeds.clear();
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
        this.algorithmTask?.abort();
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
