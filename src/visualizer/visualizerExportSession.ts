import type { AudioPlaybackCheckpoint } from '../audio/audioEngine';
import type { AudioSessionService, ExportTransportLease } from '../audio/audioSessionService';
import type { DecodedAudioCopyPort } from '../analysis/pcm';
import type { DecodedAudioDescriptor } from '../types/audio';
import type { VisualizerProjectV5 } from './compositionTypes';
import type { VisualizerBindingRuntimeSnapshot, VisualizerSessionState } from './types';
import type { VisualizerRendererStatus, VisualizerResolvedParameter } from './rendererTypes';
import type { VisualizerExportSurfaceLease } from './visualizerRendererHost';
import { visualizerRendererDiagnostics as diagnostics } from './visualizerRendererHost';
import { createExportArtifact, type ExportArtifact } from './exportArtifact';
import { getVisualizerExportPreset, probeVisualizerExport } from './exportPresets';
import {
    VisualizerExportError,
    type VisualizerExportCapability,
    type VisualizerExportPreset,
    type VisualizerExportState,
} from './exportTypes';
import { runOfflineExport } from './offlineExport';
import { assertExportAudio } from './offlineExportAudio';
import { type VisualizerVideoFileGateway, visualizerVideoFileName } from './videoFileIO';

export interface VisualizerExportTarget {
    getStatus(): VisualizerRendererStatus;
    acquireExportSurface(width: number, height: number): VisualizerExportSurfaceLease;
}
export interface VisualizerExportContext {
    state: VisualizerSessionState | 'unsupported-draft';
    activeTrackId: string | null;
    project: VisualizerProjectV5 | null;
    bindingRuntime: VisualizerBindingRuntimeSnapshot;
    configurationIssues: readonly string[];
}
export interface VisualizerExportSessionOptions {
    audioSession: AudioSessionService;
    source?: DecodedAudioCopyPort;
    readContext(): VisualizerExportContext;
    prepareFrame(time: number, signal: AbortSignal): Promise<void>;
    resolveValues(time: number): readonly VisualizerResolvedParameter[];
    onState(state: VisualizerExportState): void;
    videoGateway: VisualizerVideoFileGateway;
    probeCapability?: (preset: VisualizerExportPreset) => Promise<VisualizerExportCapability>;
    createArtifact?: typeof createExportArtifact;
    runExport?: typeof runOfflineExport;
    now?: () => number;
}

const active = (state: VisualizerExportState) => ['preparing', 'exporting', 'finalizing'].includes(state.status);

/** Owns the exclusive transport, manual renderer lease, export task and ready OPFS file. */
export class VisualizerExportSession {
    private readonly options: VisualizerExportSessionOptions;
    private state: VisualizerExportState = { status: 'idle' };
    private target: VisualizerExportTarget | null = null;
    private abortController: AbortController | null = null;
    private task: Promise<void> | null = null;
    private ready: { file: File; artifact: ExportArtifact; name: string } | null = null;
    private saveTask: Promise<'saved' | 'cancelled'> | null = null;
    private restoreAllowed = true;
    private disposed = false;

    constructor(options: VisualizerExportSessionOptions) {
        this.options = options;
    }
    getState(): VisualizerExportState {
        return { ...this.state };
    }
    isLocked(): boolean {
        return active(this.state);
    }
    hasUnresolvedOutput(): boolean {
        return this.isLocked() || this.state.status === 'ready';
    }
    getReadyFileForDiagnostics(): File | null {
        return this.ready?.file ?? null;
    }
    attachTarget(target: VisualizerExportTarget): () => void {
        if (this.target && this.target !== target) throw new VisualizerExportError('export-busy', '已有导出渲染目标。');
        this.target = target;
        return () => {
            if (this.target !== target) return;
            this.target = null;
            this.abortController?.abort(new VisualizerExportError('renderer-unavailable', '导出渲染目标已离开页面。'));
        };
    }
    notifyRendererStatus(status: VisualizerRendererStatus): void {
        if (!this.isLocked()) return;
        if (status.state === 'recovering' || status.state === 'error')
            this.abortController?.abort(
                new VisualizerExportError(
                    status.state === 'recovering' ? 'context-lost' : 'renderer-unavailable',
                    status.message ?? '导出渲染器不可用。',
                ),
            );
    }
    async notifyIdentityChange(): Promise<void> {
        this.restoreAllowed = false;
        this.abortController?.abort(new VisualizerExportError('identity-changed', '导出期间歌曲或路由身份发生变化。'));
        await this.task;
        await this.discard();
    }
    start(): Promise<void> {
        if (this.disposed) return Promise.reject(new VisualizerExportError('renderer-unavailable', '导出会话已释放。'));
        if (this.isLocked()) return Promise.reject(new VisualizerExportError('export-busy', '导出已经在进行。'));
        if (this.ready) return Promise.reject(new VisualizerExportError('output-pending', '请先保存或丢弃当前 WebM。'));
        this.abortController = new AbortController();
        this.restoreAllowed = true;
        diagnostics.exportFramesDone = 0;
        diagnostics.exportTotalFrames = 0;
        diagnostics.lastExportError = '';
        this.setState({ status: 'preparing' });
        const task = this.perform(this.abortController.signal);
        this.task = task;
        const clear = () => {
            if (this.task === task) {
                this.task = null;
                this.abortController = null;
            }
        };
        void task.then(clear, clear);
        return task;
    }
    private async perform(signal: AbortSignal): Promise<void> {
        let artifact: ExportArtifact | null = null,
            surface: VisualizerExportSurfaceLease | null = null;
        let transport: ExportTransportLease | null = null,
            checkpoint: AudioPlaybackCheckpoint | null = null;
        let file: File | null = null,
            failure: unknown,
            fileName = '';
        let expectedAudio: DecodedAudioDescriptor | null = null;
        const source = this.options.source;
        diagnostics.activeExportJobs++;
        diagnostics.exportStarts++;
        diagnostics.exportStage = 'preparing';
        const now = this.options.now ?? (() => performance.now());
        let lastProgress = -Infinity;
        try {
            const context = this.options.readContext(),
                project = context.project;
            const currentAudio = source?.getDecodedAudioDescriptor();
            if (
                !project ||
                !currentAudio ||
                currentAudio.trackId !== context.activeTrackId ||
                !['ready', 'not-persisted'].includes(context.state)
            )
                throw new VisualizerExportError('track-mismatch', '当前歌曲或工程身份不可导出。');
            const descriptor = (expectedAudio = { ...currentAudio });
            const bindings = context.bindingRuntime;
            if (
                (bindings.activeInputs?.length ?? bindings.activeFeatureIds.length) &&
                (bindings.analysisState !== 'ready' ||
                    (bindings.activeInputs
                        ? bindings.activeInputs.some(
                              input =>
                                  !bindings.readyInputs?.some(
                                      ready => ready.featureId === input.featureId && ready.stemRole === input.stemRole,
                                  ),
                          )
                        : bindings.activeFeatureIds.some(id => !bindings.readyFeatureIds.includes(id))))
            )
                throw new VisualizerExportError('analysis-not-ready', '活动分析尚未全部就绪。');
            if (context.configurationIssues.length)
                throw new VisualizerExportError('binding-invalid', context.configurationIssues[0]!);
            const target = this.target;
            if (!target || !['ready', 'neutral'].includes(target.getStatus().state))
                throw new VisualizerExportError('renderer-unavailable', '导出渲染器尚未就绪。');
            const preset = getVisualizerExportPreset(project.output.resolution, project.output.frameRate);
            const capability = await (this.options.probeCapability ?? probeVisualizerExport)(preset);
            signal.throwIfAborted();
            if (!capability.available || !capability.codec)
                throw new VisualizerExportError(
                    'export-unsupported',
                    capability.reason ?? '当前设备不支持所选导出配置。',
                );
            assertExportAudio(source!, descriptor);
            checkpoint = this.options.audioSession.capturePlaybackCheckpoint(descriptor.trackId);
            transport = this.options.audioSession.acquireExportTransport(descriptor.trackId);
            transport.pause();
            surface = target.acquireExportSurface(preset.width, preset.height);
            artifact = await (this.options.createArtifact ?? createExportArtifact)();
            signal.throwIfAborted();
            fileName = visualizerVideoFileName({
                fileName: project.track.fileName,
                templateId: 'composition',
                resolution: preset.resolution,
                frameRate: preset.frameRate,
            });
            file = await (this.options.runExport ?? runOfflineExport)({
                source: source!,
                descriptor,
                preset,
                audioVideoOffsetMs: project.output.audioVideoOffsetMs,
                codec: capability.codec,
                canvas: surface.canvas,
                artifact,
                signal,
                prepareFrame: async (time, taskSignal) => {
                    await this.options.prepareFrame(time, taskSignal);
                    taskSignal.throwIfAborted();
                    const invalid = this.options.resolveValues(time).find(value => value.state !== 'ready');
                    if (invalid)
                        throw new VisualizerExportError(
                            'binding-invalid',
                            invalid.message ?? '导出帧的参数输入尚未就绪。',
                        );
                },
                renderFrame: time => surface!.renderAtTime(time),
                onProgress: (framesDone, totalFrames) => {
                    diagnostics.exportFramesDone = framesDone;
                    diagnostics.exportTotalFrames = totalFrames;
                    if (now() - lastProgress < 100 && framesDone !== totalFrames) return;
                    lastProgress = now();
                    this.setState({ status: 'exporting', framesDone, totalFrames });
                },
                onFinalizing: () => this.setState({ status: 'finalizing' }),
            });
            signal.throwIfAborted();
            assertExportAudio(source!, descriptor);
            if (!file.size) throw new VisualizerExportError('empty-output', '离线编码没有生成有效数据。');
        } catch (error) {
            failure = error;
        } finally {
            try {
                surface?.release();
            } catch (error) {
                failure ??= error;
            }
            try {
                transport?.release();
            } catch (error) {
                failure ??= error;
            }
            const current = source?.getDecodedAudioDescriptor();
            if (
                checkpoint &&
                this.restoreAllowed &&
                current?.trackId === checkpoint.trackId &&
                current.revision === expectedAudio?.revision
            ) {
                try {
                    await this.options.audioSession.restorePlaybackCheckpoint(checkpoint);
                } catch (error) {
                    failure ??= error;
                }
            }
            diagnostics.activeExportJobs--;
        }
        if (!failure && file && source && expectedAudio) {
            try {
                assertExportAudio(source, expectedAudio);
            } catch (error) {
                failure = error;
            }
        }
        if (signal.aborted) failure = signal.reason;
        if (failure || !file || !artifact) {
            diagnostics.exportAborts++;
            try {
                await artifact?.discard();
            } catch (error) {
                failure ??= error;
            }
            if (failure instanceof DOMException && failure.name === 'AbortError') {
                this.setState({ status: 'idle' });
                return;
            }
            const error =
                failure instanceof VisualizerExportError
                    ? failure
                    : new VisualizerExportError(
                          failure instanceof DOMException && failure.name === 'QuotaExceededError'
                              ? 'storage-full'
                              : 'encode-failed',
                          failure instanceof Error ? failure.message : '离线导出失败。',
                      );
            diagnostics.lastExportError = error.message;
            this.setState({ status: 'error', code: error.code, message: error.message });
            return;
        }
        this.ready = { file, artifact, name: fileName };
        diagnostics.readyExportFiles++;
        diagnostics.exportFinalizes++;
        this.setState({ status: 'ready', mimeType: 'video/webm', byteLength: file.size });
    }
    async cancel(restore = true): Promise<void> {
        this.restoreAllowed = restore;
        this.abortController?.abort();
        await this.task;
    }
    save(): Promise<'saved' | 'cancelled'> {
        if (this.saveTask) return this.saveTask;
        const ready = this.ready;
        if (!ready) return Promise.reject(new VisualizerExportError('empty-output', '没有可保存的 WebM。'));
        diagnostics.exportSaveAttempts++;
        const task = this.options.videoGateway.save(ready.name, ready.file).then(async result => {
            if (result === 'saved' && this.ready === ready) await this.discard();
            return result;
        });
        this.saveTask = task;
        void task.then(
            () => {
                this.saveTask = null;
            },
            () => {
                this.saveTask = null;
            },
        );
        return task;
    }
    async discard(): Promise<void> {
        const ready = this.ready;
        if (ready) {
            this.ready = null;
            diagnostics.readyExportFiles--;
            await ready.artifact.discard();
        }
        if (!this.isLocked()) this.setState({ status: 'idle' });
    }
    resetError(): void {
        if (this.state.status === 'error') this.setState({ status: 'idle' });
    }
    async handlePageHide(): Promise<void> {
        await this.cancel(false);
        await this.discard();
    }
    async dispose(): Promise<void> {
        if (this.disposed) return;
        await this.cancel(false);
        await this.discard();
        this.disposed = true;
        this.target = null;
    }
    private setState(state: VisualizerExportState): void {
        this.state = state;
        diagnostics.exportStage = state.status;
        if (!this.disposed) this.options.onState({ ...state });
    }
}
