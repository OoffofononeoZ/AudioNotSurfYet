import { inject, type InjectionKey } from 'vue';
import type { EditorSessionController } from '../editor/editorSessionController';
import type { AuditionTransportPort } from '../audio/auditionTypes';
import { createStemAuditionSource } from '../processing/stemAuditionSource';
import { EditorProcessingGate } from '../processing/editorProcessingGate';
import type { EditorSeparationService, EditorSeparationSnapshot } from '../processing/editorSeparationService';
import { checkCancelled, ProcessingError } from '../processing/modelManifest';
import runtimeManifest from '../processing/runtime-manifest.json';
import { hashBytes } from '../processing/sha256';
import { databaseDelete, databaseGet } from '../processing/storage';
import { TranscriptionController } from './controller';
import { TranscriptionRepository, sameTranscriptionSource } from './resultRepository';
import type { TranscriptionRepositoryPort } from './resultRepository';
import { TRANSCRIPTION_CONFIG_HASH, TRANSCRIPTION_MODEL_HASH, TRANSCRIPTION_MODELS } from './modelManifest';
import { TRANSCRIPTION_ROLES } from './candidateTypes';
import type { NoteInstrument, NoteThresholds, TranscriptionIdentity, TranscriptionRole } from './candidateTypes';
import { correctCandidate } from './candidates';
import { drumConfigurationHash } from './drumOptions';
import { ANALYSIS_CONFIG_HASH } from './analysisOptions';
import type { DrumBackend } from './drumRuntime';
import { applyCandidateResult, resultAlreadyApplied } from './applyCandidates';
import { applySoundMarkers } from './applySoundMarkers';
import { deriveCandidateReview } from './candidateReview';
import type { CandidateReview } from './candidateReview';
import { defaultReviewSettings, validateReviewSettings } from './reviewSettings';
import type { ReviewSettings, Sensitivity } from './reviewSettings';
import type { TranscriptionBundle, TranscriptionEvent } from './workerProtocol';
import type { DecodedAudioCopyPort } from '../analysis/pcm';
import { EditorExampleService } from './examples/service';

export type TranscriptionStatus =
    'idle' | 'restoring' | 'running' | 'cancelling' | 'ready' | 'partial' | 'cancelled' | 'error' | 'clearing';
export interface EditorTranscriptionSnapshot {
    drumBackend: DrumBackend;
    trackId: string | null;
    ftResultId: string | null;
    status: TranscriptionStatus;
    bundle: TranscriptionBundle | null;
    selectedRoles: TranscriptionRole[];
    thresholds: NoteThresholds;
    review: ReviewSettings;
    preview: CandidateReview | null;
    progress: Extract<TranscriptionEvent, { type: 'progress' }> | null;
    message: string | null;
    errorCode: string | null;
    restored: boolean;
    applied: boolean;
    persistence: 'idle' | 'saving' | 'saved' | 'not-persisted';
    missingModelBytes: number;
}
type EditorPort = Pick<EditorSessionController, 'getSnapshot' | 'updateProject' | 'subscribe'>;
type ControllerPort = Pick<TranscriptionController, 'start' | 'cancel'>;
const busy = new Set<TranscriptionStatus>(['restoring', 'running', 'cancelling', 'clearing']);
const runtimeHash = hashBytes(new TextEncoder().encode(JSON.stringify(runtimeManifest)));
export class EditorTranscriptionService {
    readonly examples: EditorExampleService | null;
    private readonly transport: AuditionTransportPort;
    private readonly editor: EditorPort;
    private readonly separation: EditorSeparationService;
    private readonly gate: EditorProcessingGate;
    private readonly controller: ControllerPort;
    private readonly repository: TranscriptionRepositoryPort;
    private readonly modelBase: string | undefined;
    private readonly listeners = new Set<(snapshot: EditorTranscriptionSnapshot) => void>();
    private generation = 0;
    private io = new AbortController();
    private operation: Promise<void> | null = null;
    private clearing: Promise<void> | null = null;
    private binding: Promise<void> | null = null;
    private saving: Promise<void> = Promise.resolve();
    private audition: Promise<void> | null = null;
    private auditionRevision = 0;
    private pauseRevision = 0;
    private disposed = false;
    private sourceKey = '';
    private readonly cleanup: Array<() => void> = [];
    private state: EditorTranscriptionSnapshot = {
        trackId: null,
        ftResultId: null,
        status: 'idle',
        bundle: null,
        selectedRoles: [...TRANSCRIPTION_ROLES],
        drumBackend: 'webgpu',
        thresholds: {},
        review: defaultReviewSettings(),
        preview: null,
        progress: null,
        message: null,
        errorCode: null,
        restored: false,
        applied: false,
        persistence: 'idle',
        missingModelBytes: 0,
    };
    constructor(
        transport: AuditionTransportPort,
        editor: EditorPort,
        separation: EditorSeparationService,
        gate: EditorProcessingGate,
        options: {
            controller?: ControllerPort;
            repository?: TranscriptionRepositoryPort;
            modelBase?: string;
            decodedSource?: DecodedAudioCopyPort;
            seek?: (seconds: number) => Promise<void>;
        } = {},
    ) {
        this.transport = transport;
        this.editor = editor;
        this.separation = separation;
        this.gate = gate;
        this.controller = options.controller ?? new TranscriptionController();
        this.repository = options.repository ?? new TranscriptionRepository();
        this.modelBase = options.modelBase;
        this.examples =
            options.decodedSource && options.seek
                ? new EditorExampleService({
                      decoded: options.decodedSource,
                      seek: options.seek,
                      transport,
                      editor,
                      separation,
                      gate,
                      getBundle: () => this.state.bundle,
                      verifyAuxiliary: async (bundle, signal) => {
                          const record = await this.repository.restore(bundle.result.identity, signal);
                          if (!record?.bundle.auxiliary || record.bundle.result.id !== bundle.result.id)
                              throw new ProcessingError('source-identity-mismatch', '已有辅助音轨未通过完整性校验。');
                      },
                  })
                : null;
        this.cleanup.push(separation.registerSourceConsumer(() => this.suspend()));
        this.cleanup.push(
            transport.subscribePlayback(snapshot => {
                if (snapshot.state === 'paused') this.pauseRevision++;
            }),
        );
        this.cleanup.push(
            editor.subscribe(() => {
                this.onSource(this.separation.getSnapshot());
                this.refreshApplied();
            }),
        );
        this.cleanup.push(separation.subscribe(snapshot => this.onSource(snapshot)));
    }
    getSnapshot(): EditorTranscriptionSnapshot {
        return {
            ...this.state,
            selectedRoles: [...this.state.selectedRoles],
            thresholds: { ...this.state.thresholds },
            review: structuredClone(this.state.review),
        };
    }
    subscribe(listener: (snapshot: EditorTranscriptionSnapshot) => void): () => void {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }
    private update(patch: Partial<EditorTranscriptionSnapshot>): void {
        if (this.disposed) return;
        const next = { ...this.state, ...patch };
        if ('bundle' in patch || 'review' in patch || 'thresholds' in patch)
            next.preview = next.bundle ? deriveCandidateReview(next.bundle.result, next.review, next.thresholds) : null;
        this.state = next;
        if ('bundle' in patch) this.examples?.refreshSources();
        for (const listener of this.listeners) listener(this.getSnapshot());
    }
    private guard(generation: number, signal: AbortSignal): void {
        checkCancelled(signal);
        if (this.disposed || generation !== this.generation)
            throw new ProcessingError('job-cancelled', '已取消自动标记。');
    }
    private identity(): TranscriptionIdentity | null {
        const ft = this.separation.getSnapshot().result,
            project = this.editor.getSnapshot().project;
        if (!ft || !project || this.editor.getSnapshot().activeTrackId !== ft.source.descriptor.trackId) return null;
        return {
            trackId: ft.source.descriptor.trackId,
            contentHash: project.track.contentHash,
            pcmHash: ft.source.hash,
            ftResultId: ft.source.directory,
            durationSeconds: ft.source.descriptor.durationSeconds,
            modelManifestHash: TRANSCRIPTION_MODEL_HASH,
            runtimeManifestHash: runtimeHash,
            configHash: TRANSCRIPTION_CONFIG_HASH,
            drumBackend: this.state.drumBackend,
            drumConfigHash: drumConfigurationHash(this.state.drumBackend),
            analysisConfigHash: ANALYSIS_CONFIG_HASH,
            selectedRoles: [...this.state.selectedRoles],
        };
    }
    private refreshApplied(): void {
        const project = this.editor.getSnapshot().project,
            bundle = this.state.bundle;
        const applied = !!project && !!bundle && resultAlreadyApplied(project, bundle.result);
        if (applied !== this.state.applied) this.update({ applied });
    }
    private onSource(snapshot: EditorSeparationSnapshot): void {
        const available =
            !!snapshot.result &&
            this.editor.getSnapshot().state === 'ready' &&
            !['restoring', 'running', 'cancelling', 'clearing'].includes(snapshot.status);
        const key = `${snapshot.trackId}:${snapshot.result?.source.directory ?? ''}:${available}`;
        if (key === this.sourceKey) return;
        this.sourceKey = key;
        const generation = ++this.generation;
        this.io.abort();
        this.controller.cancel();
        this.io = new AbortController();
        const signal = this.io.signal;
        this.update({
            trackId: snapshot.trackId,
            ftResultId: available ? snapshot.result!.source.directory : null,
            status: available ? 'restoring' : 'idle',
            bundle: null,
            review: defaultReviewSettings(),
            progress: null,
            message: null,
            errorCode: null,
            restored: false,
            applied: false,
            persistence: 'idle',
        });
        const work = (async () => {
            try {
                await this.operation;
                await this.saving;
                await this.audition;
                this.guard(generation, signal);
                if (!available) return;
                const identity = this.identity();
                if (!identity) {
                    this.update({ status: 'idle' });
                    return;
                }
                const record = await this.repository.restore(identity, signal);
                this.guard(generation, signal);
                if (record)
                    this.update({
                        bundle: record.bundle,
                        thresholds: record.thresholds,
                        review: record.review,
                        selectedRoles: [...record.bundle.result.identity.selectedRoles],
                        status:
                            record.bundle.result.failures.length || record.bundle.result.incompleteDrumRanges?.length
                                ? 'partial'
                                : 'ready',
                        message: record.bundle.result.incompleteDrumRanges?.length
                            ? '部分鼓区间未完成，已隔离其中候选；其余候选可检查。'
                            : null,
                        restored: true,
                        persistence: 'saved',
                    });
                else this.update({ status: 'idle' });
                this.refreshApplied();
                await this.modelSummary();
            } catch (error) {
                if (!this.disposed && generation === this.generation)
                    this.update(
                        signal.aborted
                            ? { status: 'cancelled', errorCode: 'job-cancelled', message: '候选恢复已取消。' }
                            : {
                                  status: 'error',
                                  errorCode: error instanceof ProcessingError ? error.code : 'storage-unavailable',
                                  message: error instanceof Error ? error.message : '无法恢复候选。',
                              },
                    );
            }
        })();
        this.binding = work;
    }
    private async modelSummary(): Promise<void> {
        const generation = this.generation;
        const selected = this.state.selectedRoles;
        const ids = new Set<string>();
        if (selected.includes('drums')) {
            ids.add('adt-encoder');
            ids.add('adt-decoder');
        }
        if (selected.some(role => role !== 'drums')) ids.add('basic-pitch');
        if (selected.some(role => role === 'piano' || role === 'guitar')) ids.add('htdemucs-6s');
        let bytes = 0;
        for (const model of TRANSCRIPTION_MODELS)
            if (ids.has(model.id)) {
                const cached = await databaseGet<Blob>('models', model.sha256);
                if (!(cached instanceof Blob) || cached.size !== model.bytes) bytes += model.bytes;
            }
        if (!this.disposed && generation === this.generation && selected === this.state.selectedRoles)
            this.update({ missingModelBytes: bytes });
    }
    setRoles(roles: TranscriptionRole[]): void {
        if (busy.has(this.state.status)) return;
        if (new Set(roles).size !== roles.length || roles.some(role => !TRANSCRIPTION_ROLES.includes(role)))
            throw new ProcessingError('invalid-request', '无效的分轨选择。');
        this.update({ selectedRoles: TRANSCRIPTION_ROLES.filter(role => roles.includes(role)) });
        void this.modelSummary().catch(() => {});
    }
    setDrumBackend(backend: DrumBackend): void {
        if (busy.has(this.state.status)) return;
        if (!['webgpu', 'wasm'].includes(backend)) throw new ProcessingError('invalid-request', '无效的鼓推理方式。');
        this.update({ drumBackend: backend });
    }
    async start(): Promise<void> {
        if (this.disposed || busy.has(this.state.status) || this.operation) return;
        if (this.examples?.isBusy) {
            this.update({ message: '请先完成或取消声音示例检索。' });
            return;
        }
        const identity = this.identity();
        if (!identity || !identity.selectedRoles.length) {
            this.update({ message: '先完成当前歌曲的 FT 分离，并选择至少一条分析输入。' });
            return;
        }
        const generation = ++this.generation;
        this.io.abort();
        this.io = new AbortController();
        const signal = this.io.signal;
        const previous = this.state.bundle;
        let bundle: TranscriptionBundle | undefined, release: (() => void) | undefined;
        this.update({ status: 'running', progress: null, message: null, errorCode: null, restored: false });
        const work = (async () => {
            try {
                await this.saving;
                this.guard(generation, signal);
                release = this.gate.acquire('transcription');
                const ft = await this.separation.verifyCurrentResult(signal);
                this.guard(generation, signal);
                bundle = await this.controller.start(
                    ft,
                    identity,
                    this.separation.getSnapshot().cacheLimit,
                    event => {
                        if (generation === this.generation && !signal.aborted && event.type === 'progress')
                            this.update({ progress: event });
                    },
                    this.modelBase,
                );
                this.guard(generation, signal);
                if (!bundle.result.completedRoles.length)
                    throw new ProcessingError(
                        'inference-failed',
                        bundle.result.failures.map(failure => `${failure.role}: ${failure.message}`).join('；') ||
                            '所有分析输入均未完成。',
                    );
                const review: ReviewSettings = { ...this.state.review, assignments: {}, duplicateSelections: {} };
                await this.repository.publish(
                    bundle,
                    this.state.thresholds,
                    signal,
                    this.separation.getSnapshot().cacheLimit,
                    review,
                );
                this.guard(generation, signal);
                this.update({
                    bundle,
                    review,
                    status:
                        bundle.result.failures.length || bundle.result.incompleteDrumRanges?.length
                            ? 'partial'
                            : 'ready',
                    persistence: 'saved',
                    message:
                        bundle.result.failures.length || bundle.result.incompleteDrumRanges?.length
                            ? '部分输入未完成；已完成候选可检查，失败项仍需重试。'
                            : null,
                });
                this.refreshApplied();
            } catch (error) {
                if (bundle) await this.repository.discard(bundle.result.id).catch(() => {});
                if (!this.disposed && generation === this.generation) {
                    const cancelled =
                        signal.aborted || (error instanceof ProcessingError && error.code === 'job-cancelled');
                    this.update({
                        status: cancelled ? 'cancelled' : 'error',
                        bundle: previous,
                        errorCode: cancelled
                            ? 'job-cancelled'
                            : error instanceof ProcessingError
                              ? error.code
                              : 'inference-failed',
                        message: cancelled
                            ? '本次分析已取消，上一完整结果保留。'
                            : error instanceof Error
                              ? error.message
                              : '自动标记失败。',
                    });
                }
            } finally {
                release?.();
                if (!this.disposed && generation === this.generation) await this.modelSummary().catch(() => {});
            }
        })();
        this.operation = work;
        await work;
        if (this.operation === work) this.operation = null;
    }
    cancel(): void {
        if (!['running', 'restoring'].includes(this.state.status)) return;
        this.io.abort();
        this.controller.cancel();
        this.update({ status: 'cancelling', message: '正在取消并释放本次分析…' });
    }
    async flushEdits(): Promise<boolean> {
        await this.saving;
        if (this.state.persistence === 'not-persisted') this.queueSave();
        await this.saving;
        const examplesSaved = (await this.examples?.flushEdits()) ?? true;
        return this.state.persistence !== 'not-persisted' && examplesSaved;
    }
    private queueSave(): void {
        const bundle = this.state.bundle;
        if (!bundle) return;
        const generation = this.generation,
            signal = this.io.signal,
            thresholds = { ...this.state.thresholds },
            review = structuredClone(this.state.review);
        this.update({ persistence: 'saving' });
        this.saving = this.saving.then(async () => {
            if (this.disposed || signal.aborted || generation !== this.generation) return;
            try {
                await this.repository.saveEdits(bundle, thresholds, signal, review);
                this.guard(generation, signal);
                this.update({ persistence: 'saved' });
            } catch (error) {
                if (!this.disposed && generation === this.generation && !signal.aborted)
                    this.update({
                        persistence: 'not-persisted',
                        message: error instanceof Error ? error.message : '候选修正未保存；当前内存结果仍可应用。',
                    });
            }
        });
    }
    setThreshold(instrument: NoteInstrument, milliseconds: number): void {
        if (busy.has(this.state.status)) return;
        if (!Number.isFinite(milliseconds) || milliseconds < 0)
            throw new ProcessingError('invalid-request', '长短分界必须是非负毫秒数。');
        this.update({ thresholds: { ...this.state.thresholds, [instrument]: milliseconds } });
        this.queueSave();
    }
    correct(id: string, patch: Parameters<typeof correctCandidate>[2]): void {
        if (!this.state.bundle || busy.has(this.state.status)) return;
        const review = structuredClone(this.state.review);
        if (patch.instrument !== undefined || patch.musicalRole !== undefined) delete review.assignments[id];
        this.update({
            bundle: { ...this.state.bundle, result: correctCandidate(this.state.bundle.result, id, patch) },
            review,
        });
        this.queueSave();
    }
    private changeReview(review: ReviewSettings): void {
        if (!this.state.bundle || busy.has(this.state.status)) return;
        try {
            validateReviewSettings(review, this.state.bundle.result);
            this.update({ review });
            this.queueSave();
        } catch (error) {
            this.update({ message: error instanceof Error ? error.message : '复核设置无效。' });
        }
    }
    setReviewView(view: ReviewSettings['view']): void {
        this.changeReview({ ...this.state.review, view });
    }
    setSensitivity(sensitivity: Sensitivity): void {
        this.changeReview({ ...this.state.review, sensitivity });
    }
    renameSoundGroup(id: string, label: string): void {
        const group = this.state.preview?.groups.find(group => group.id === id);
        if (!group) return;
        this.changeReview({
            ...this.state.review,
            groups: { ...this.state.review.groups, [id]: { label: label.trim(), instrument: group.instrument } },
        });
    }
    assignSoundGroup(candidateId: string, target: string | null): void {
        const candidate = this.state.bundle?.result.candidates.find(candidate => candidate.id === candidateId);
        if (!candidate) return;
        const existing = this.state.preview?.groups.find(
            group => group.id === target && group.instrument === candidate.instrument,
        );
        if (target && !existing) return;
        const id = existing?.id ?? `custom:${crypto.randomUUID()}`;
        const info = existing ?? {
            label: `声音组 ${(this.state.preview?.groups.length ?? 0) + 1}`,
            instrument: candidate.instrument,
        };
        this.changeReview({
            ...this.state.review,
            groups: { ...this.state.review.groups, [id]: { label: info.label, instrument: info.instrument } },
            assignments: { ...this.state.review.assignments, [candidateId]: id },
        });
    }
    selectDuplicates(groupId: string, selectedIds: string[] | null): void {
        const group = this.state.preview?.duplicateGroups.find(group => group.id === groupId);
        if (!group || selectedIds?.some(id => !group.candidateIds.includes(id))) return;
        const selections = { ...this.state.review.duplicateSelections };
        if (selectedIds) selections[groupId] = [...new Set(selectedIds)];
        else delete selections[groupId];
        this.changeReview({ ...this.state.review, duplicateSelections: selections });
    }
    apply(): void {
        if (!this.state.bundle || busy.has(this.state.status)) return;
        const project = this.editor.getSnapshot().project,
            identity = this.identity();
        if (
            this.editor.getSnapshot().state !== 'ready' ||
            !project ||
            !identity ||
            !sameTranscriptionSource(identity, this.state.bundle.result.identity)
        ) {
            this.update({ message: '歌曲或分离结果已改变，本次候选未应用。', errorCode: 'source-identity-mismatch' });
            return;
        }
        try {
            const preview = this.state.preview!;
            const selected = new Set(preview.selectedIds);
            const next =
                this.state.review.view === 'timbres'
                    ? applySoundMarkers(project, this.state.bundle.result, preview)
                    : applyCandidateResult(
                          project,
                          {
                              ...this.state.bundle.result,
                              candidates: this.state.bundle.result.candidates.filter(candidate =>
                                  selected.has(candidate.id),
                              ),
                          },
                          this.state.thresholds,
                      );
            this.editor.updateProject(next, true);
            this.refreshApplied();
            this.update({ message: '候选已一次性添加为新标记轨。人工标记和 tempo 保留。', errorCode: null });
        } catch (error) {
            this.update({
                message: error instanceof Error ? error.message : '候选无法应用。',
                errorCode: error instanceof ProcessingError ? error.code : 'candidate-conflict',
            });
        }
    }
    async listenAuxiliary(role: 'piano' | 'guitar'): Promise<void> {
        const bundle = this.state.bundle;
        if (!bundle?.auxiliary || this.disposed) return;
        const stem = bundle.auxiliary.stems.find(stem => stem.role === role);
        if (!stem) return;
        const generation = this.generation,
            signal = this.io.signal,
            revision = ++this.auditionRevision,
            pauseRevision = this.pauseRevision;
        const work = (async () => {
            try {
                const source = await createStemAuditionSource(
                    {
                        kind: 'auxiliary',
                        directory: bundle.auxiliary!.directory,
                        resultId: bundle.result.id,
                        trackId: bundle.result.identity.trackId,
                        label: role === 'piano' ? '辅助钢琴候选' : '辅助吉他候选',
                        stems: [stem],
                        mutedRoles: [],
                    },
                    signal,
                );
                if (
                    this.disposed ||
                    signal.aborted ||
                    generation !== this.generation ||
                    revision !== this.auditionRevision
                ) {
                    await source.close();
                    return;
                }
                await this.transport.setAuditionSource(source, { play: pauseRevision === this.pauseRevision });
                this.guard(generation, signal);
            } catch (error) {
                if (!this.disposed && generation === this.generation && !signal.aborted)
                    this.update({ message: error instanceof Error ? error.message : '辅助音频试听失败。' });
            }
        })();
        this.audition = work;
        await work;
        if (this.audition === work) this.audition = null;
    }
    async suspend(): Promise<void> {
        ++this.generation;
        ++this.auditionRevision;
        this.io.abort();
        this.controller.cancel();
        await this.examples?.suspend();
        await this.transport.setAuditionSource(null);
        await this.operation;
        await this.clearing;
        await this.binding;
        await this.saving;
        await this.audition;
        this.update({
            status: 'idle',
            bundle: null,
            progress: null,
            restored: false,
            applied: false,
            persistence: 'idle',
        });
    }
    async clear(kind: 'results' | 'models'): Promise<void> {
        if (this.disposed || busy.has(this.state.status)) return;
        await this.suspend();
        if (this.disposed) return;
        this.io = new AbortController();
        this.update({ status: 'clearing', message: null });
        const work = (async () => {
            try {
                if (kind === 'results') {
                    await this.repository.clearAll();
                    await this.examples?.clearAll();
                } else for (const model of TRANSCRIPTION_MODELS) await databaseDelete('models', model.sha256);
                this.update({
                    status: 'idle',
                    message:
                        kind === 'results'
                            ? '辅助音频、候选和声音示例缓存已清理；工程标记保留。'
                            : '新增模型缓存已清理。',
                });
                await this.modelSummary();
            } catch (error) {
                this.update({
                    status: 'error',
                    errorCode: 'cleanup-failed',
                    message: error instanceof Error ? error.message : '清理失败。',
                });
            }
        })();
        this.clearing = work;
        await work;
        if (this.clearing === work) this.clearing = null;
    }
    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        this.cleanup.forEach(cleanup => cleanup());
        await this.examples?.dispose();
        await this.suspend();
        this.listeners.clear();
    }
}
export const editorTranscriptionServiceKey: InjectionKey<EditorTranscriptionService> =
    Symbol('EditorTranscriptionService');
export function useEditorTranscriptionService(): EditorTranscriptionService {
    const service = inject(editorTranscriptionServiceKey);
    if (!service) throw Error('Editor transcription service is missing.');
    return service;
}
