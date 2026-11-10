import type { DecodedAudioCopyPort } from '../../analysis/pcm';
import type { AuditionTransportPort } from '../../audio/auditionTypes';
import type { EditorSessionController } from '../../editor/editorSessionController';
import type { EditorProcessingGate } from '../../processing/editorProcessingGate';
import type { EditorSeparationService } from '../../processing/editorSeparationService';
import { createStemAuditionSource } from '../../processing/stemAuditionSource';
import { checkCancelled, ProcessingError } from '../../processing/modelManifest';
import type { TranscriptionBundle } from '../workerProtocol';
import { ExampleController } from './controller';
import { ExampleRepository } from './repository';
import { availableExampleSources } from './sources';
import { applyExampleMatches } from './applyMatches';
import { exampleHash, queryIdentity, validateExampleProfile } from './types';
import type { ExampleMatch, ExampleProfile, ExampleSearchResult, ExampleSource, SoundExample } from './types';

type EditorPort = Pick<EditorSessionController, 'getSnapshot' | 'subscribe' | 'updateProject'>;
export interface ExampleSnapshot {
    sources: ExampleSource[];
    profiles: ExampleProfile[];
    profile: ExampleProfile | null;
    status: 'idle' | 'restoring' | 'searching' | 'ready' | 'cancelled' | 'error';
    persistence: 'idle' | 'saving' | 'saved' | 'not-persisted';
    progress: { phase: string; done: number; total: number } | null;
    summary: Omit<ExampleSearchResult, 'matches'> | null;
    message: string | null;
    selection: Omit<SoundExample, 'id' | 'polarity'> | null;
}
export interface ExampleServiceOptions {
    decoded: DecodedAudioCopyPort;
    transport: AuditionTransportPort;
    editor: EditorPort;
    separation: EditorSeparationService;
    gate: EditorProcessingGate;
    getBundle: () => TranscriptionBundle | null;
    verifyAuxiliary: (bundle: TranscriptionBundle, signal: AbortSignal) => Promise<void>;
    seek: (seconds: number) => Promise<void>;
    repository?: ExampleRepository;
    controller?: Pick<ExampleController, 'search' | 'cancel'>;
}
export class EditorExampleService {
    private readonly options: ExampleServiceOptions;
    private readonly repository: ExampleRepository;
    private readonly controller: Pick<ExampleController, 'search' | 'cancel'>;
    private readonly listeners = new Set<(snapshot: ExampleSnapshot) => void>();
    private readonly cleanup: Array<() => void> = [];
    private state: ExampleSnapshot = {
        sources: [],
        profiles: [],
        profile: null,
        status: 'idle',
        persistence: 'idle',
        progress: null,
        summary: null,
        message: null,
        selection: null,
    };
    private generation = 0;
    private songKey = '';
    private io = new AbortController();
    private queryIo: AbortController | null = null;
    private operation: Promise<void> | null = null;
    private binding: Promise<void> = Promise.resolve();
    private saving: Promise<void> = Promise.resolve();
    private audition: Promise<void> = Promise.resolve();
    private auditionRevision = 0;
    private pauseRevision = 0;
    private disposed = false;
    private preferredProfileId: string | null = null;
    constructor(options: ExampleServiceOptions) {
        this.options = options;
        this.repository = options.repository ?? new ExampleRepository();
        this.controller = options.controller ?? new ExampleController(options.decoded);
        this.cleanup.push(options.editor.subscribe(() => this.refreshSources()));
        this.cleanup.push(options.separation.subscribe(() => this.refreshSources()));
        this.cleanup.push(
            options.transport.subscribePlayback(snapshot => {
                if (snapshot.state === 'paused') this.pauseRevision++;
            }),
        );
    }
    getSnapshot(): ExampleSnapshot {
        return structuredClone(this.state);
    }
    get isBusy(): boolean {
        return this.state.status === 'searching' || this.state.status === 'restoring';
    }
    subscribe(listener: (state: ExampleSnapshot) => void): () => void {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        return () => this.listeners.delete(listener);
    }
    private update(patch: Partial<ExampleSnapshot>): void {
        if (this.disposed) return;
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners) listener(this.getSnapshot());
    }
    private guard(generation: number, signal: AbortSignal): void {
        checkCancelled(signal);
        if (this.disposed || generation !== this.generation)
            throw new ProcessingError('job-cancelled', '声音示例操作已取消。');
    }
    refreshSources(): void {
        if (this.disposed) return;
        const sources = availableExampleSources(
            this.options.editor.getSnapshot(),
            this.options.decoded,
            this.options.separation.getSnapshot(),
            this.options.getBundle(),
        );
        const original = sources[0],
            key = original ? `${original.songHash}:${exampleHash(original.descriptor)}` : '';
        if (key === this.songKey) {
            if (JSON.stringify(sources) !== JSON.stringify(this.state.sources)) {
                this.update({ sources });
                const preferred = this.state.profiles.find(p => p.id === this.preferredProfileId);
                if (preferred && sources.some(s => s.key === preferred.sourceKey)) {
                    this.preferredProfileId = null;
                    this.activate(preferred, false);
                }
                if (this.state.profile && !sources.some(s => s.key === this.state.profile!.sourceKey)) {
                    this.cancel();
                    const currentProfile = this.state.profile.id;
                    void (this.operation ?? Promise.resolve()).then(() => {
                        if (
                            this.state.profile?.id === currentProfile &&
                            original &&
                            !this.state.sources.some(s => s.key === this.state.profile!.sourceKey)
                        )
                            this.selectSource(original.key);
                    });
                }
            }
            return;
        }
        this.songKey = key;
        this.preferredProfileId = null;
        const generation = ++this.generation;
        this.cancel();
        this.io.abort();
        this.io = new AbortController();
        ++this.auditionRevision;
        const signal = this.io.signal;
        this.update({
            sources,
            profiles: [],
            profile: null,
            status: original ? 'restoring' : 'idle',
            message: null,
            persistence: 'idle',
            progress: null,
            summary: null,
            selection: null,
        });
        this.binding = (async () => {
            if (!original) return;
            try {
                const profiles = await this.repository.profiles(original.songHash, signal);
                this.guard(generation, signal);
                this.update({ profiles, status: 'idle' });
                const preferred = [...profiles].sort((a, b) => (b.lastSelectedAt ?? 0) - (a.lastSelectedAt ?? 0))[0];
                if (preferred?.lastSelectedAt) this.preferredProfileId = preferred.id;
                if (preferred?.lastSelectedAt && this.state.sources.some(s => s.key === preferred.sourceKey)) {
                    this.preferredProfileId = null;
                    this.activate(preferred, false);
                } else this.selectSource(original.key, false);
            } catch (error) {
                if (generation === this.generation && !signal.aborted)
                    this.update({
                        status: 'error',
                        message: error instanceof Error ? error.message : '示例恢复失败。',
                    });
            }
        })();
    }
    selectSource(sourceKey: string, persist = true): void {
        if (this.disposed || this.state.status === 'searching' || this.state.status === 'restoring') return;
        const source = this.state.sources.find(s => s.key === sourceKey);
        if (!source) return;
        const profile = this.state.profiles.find(p => p.sourceKey === sourceKey);
        if (persist) this.preferredProfileId = null;
        this.activate(profile ?? this.newProfile(source), persist);
    }
    private activate(profile: ExampleProfile, persist: boolean): void {
        ++this.auditionRevision;
        this.update({ profile, status: profile.matches.length ? 'ready' : 'idle', message: null, summary: null });
        if (persist) this.changeProfile({ ...profile, lastSelectedAt: Date.now() });
    }
    private newProfile(source: ExampleSource): ExampleProfile {
        return {
            version: 1,
            id: crypto.randomUUID(),
            songHash: source.songHash,
            sourceKey: source.key,
            label: '声音示例',
            durationSeconds: this.options.editor.getSnapshot().project!.track.durationSeconds,
            examples: [],
            threshold: 0.82,
            negativeMargin: 0.04,
            matches: [],
            queryHash: null,
        };
    }
    createGroup(label = '新声音组'): void {
        const source = this.currentSource();
        if (!source || this.state.status === 'searching') return;
        this.preferredProfileId = null;
        this.changeProfile({ ...this.newProfile(source), label, lastSelectedAt: Date.now() });
    }
    selectGroup(id: string): void {
        if (this.state.status === 'searching') return;
        const profile = this.state.profiles.find(p => p.id === id);
        if (profile && this.state.sources.some(s => s.key === profile.sourceKey)) {
            this.preferredProfileId = null;
            this.activate(profile, true);
        }
    }
    setSelection(selection: Omit<SoundExample, 'id' | 'polarity'>): void {
        const p = this.state.profile;
        if (!p) return;
        try {
            validateExampleProfile({ ...p, examples: [{ ...selection, id: 'selection', polarity: 'positive' }] });
            this.update({ selection });
        } catch (error) {
            this.update({ message: error instanceof Error ? error.message : '选区无效。' });
        }
    }
    private currentSource(): ExampleSource | undefined {
        return this.state.sources.find(s => s.key === this.state.profile?.sourceKey);
    }
    private changeProfile(profile: ExampleProfile): void {
        if (this.disposed || this.state.status === 'searching') return;
        try {
            this.preferredProfileId = null;
            profile = {
                ...profile,
                lastSelectedAt: Math.max(Date.now(), ...this.state.profiles.map(p => (p.lastSelectedAt ?? 0) + 1)),
            };
            validateExampleProfile(profile);
            const profiles = this.state.profiles.filter(p => p.id !== profile.id);
            profiles.push(profile);
            this.update({ profile, profiles, message: null });
            this.queueSave(profile);
        } catch (error) {
            this.update({ message: error instanceof Error ? error.message : '声音示例无效。' });
        }
    }
    editSettings(patch: Partial<Pick<ExampleProfile, 'label' | 'threshold' | 'negativeMargin'>>): void {
        const profile = this.state.profile;
        if (!profile) return;
        const changesQuery = patch.threshold !== undefined || patch.negativeMargin !== undefined;
        this.changeProfile({ ...profile, ...patch, ...(changesQuery ? { matches: [], queryHash: null } : {}) });
    }
    addExample(example: Omit<SoundExample, 'id'>): void {
        const profile = this.state.profile;
        if (!profile) return;
        this.changeProfile({
            ...profile,
            examples: [...profile.examples, { ...example, id: crypto.randomUUID() }],
            matches: [],
            queryHash: null,
        });
    }
    removeExample(id: string): void {
        const p = this.state.profile;
        if (p)
            this.changeProfile({ ...p, examples: p.examples.filter(e => e.id !== id), matches: [], queryHash: null });
    }
    correctMatch(id: string, patch: Partial<Pick<ExampleMatch, 'selected' | 'startSeconds' | 'endSeconds'>>): void {
        const p = this.state.profile;
        if (!p) return;
        this.changeProfile({
            ...p,
            matches: p.matches.map(m =>
                m.id === id
                    ? {
                          ...m,
                          ...patch,
                          ...(m.kind === 'point' && patch.startSeconds !== undefined
                              ? { endSeconds: patch.startSeconds }
                              : {}),
                      }
                    : m,
            ),
        });
    }
    private queueSave(profile: ExampleProfile): void {
        const generation = this.generation,
            signal = this.io.signal,
            copy = structuredClone(profile);
        this.update({ persistence: 'saving' });
        this.saving = this.saving.then(async () => {
            if (this.disposed || signal.aborted || generation !== this.generation) return;
            try {
                await this.repository.save(copy, signal, this.options.separation.getSnapshot().cacheLimit);
                this.guard(generation, signal);
                this.update({ persistence: 'saved' });
            } catch (error) {
                if (!signal.aborted && generation === this.generation)
                    this.update({
                        persistence: 'not-persisted',
                        message: error instanceof Error ? error.message : '示例尚未保存。',
                    });
            }
        });
    }
    private async verify(source: ExampleSource, signal: AbortSignal): Promise<void> {
        checkCancelled(signal);
        const current = this.state.sources.find(s => s.key === source.key);
        if (!current || this.options.editor.getSnapshot().project?.track.contentHash !== source.songHash)
            throw new ProcessingError('source-identity-mismatch', '检索来源已经改变。');
        if (source.kind === 'original') {
            if (JSON.stringify(source.descriptor) !== JSON.stringify(this.options.decoded.getDecodedAudioDescriptor()))
                throw new ProcessingError('source-identity-mismatch', '原曲解码已改变。');
        } else if (source.kind === 'ft') {
            const ft = await this.options.separation.verifyCurrentResult(signal);
            if (ft.source.directory !== source.directory)
                throw new ProcessingError('source-identity-mismatch', 'FT 结果已改变。');
        } else {
            const bundle = this.options.getBundle();
            if (!bundle || bundle.result.id !== source.resultId)
                throw new ProcessingError('source-identity-mismatch', '辅助音轨已改变。');
            await this.options.verifyAuxiliary(bundle, signal);
        }
        checkCancelled(signal);
    }
    async search(): Promise<void> {
        const source = this.currentSource(),
            profile = this.state.profile;
        if (!source || !profile || this.disposed || this.operation || this.state.status === 'restoring') return;
        if (!profile.examples.some(example => example.polarity === 'positive')) {
            this.update({ message: '至少添加一个正例。' });
            return;
        }
        const generation = this.generation,
            queryIo = new AbortController();
        this.queryIo = queryIo;
        const signal = queryIo.signal;
        let release: (() => void) | undefined;
        this.update({ status: 'searching', progress: { phase: '校验检索来源', done: 0, total: 1 }, message: null });
        const work = (async () => {
            try {
                release = this.options.gate.acquire('transcription');
                await this.saving;
                await this.verify(source, signal);
                this.guard(generation, signal);
                const result = await this.controller.search(
                    source,
                    structuredClone(profile),
                    this.options.separation.getSnapshot().cacheLimit,
                    signal,
                    event => {
                        if (!signal.aborted && generation === this.generation) this.update({ progress: event });
                    },
                );
                this.guard(generation, signal);
                await this.verify(source, signal);
                this.guard(generation, signal);
                const next: ExampleProfile = { ...profile, matches: result.matches, queryHash: queryIdentity(profile) };
                this.update({
                    status: 'ready',
                    progress: null,
                    summary: {
                        coarseCandidates: result.coarseCandidates,
                        refinedCandidates: result.refinedCandidates,
                        elapsedMs: result.elapsedMs,
                        indexRestored: result.indexRestored,
                    },
                });
                this.changeProfile(next);
                await this.saving;
            } catch (error) {
                if (generation === this.generation && !this.disposed)
                    this.update({
                        status: signal.aborted ? 'cancelled' : 'error',
                        progress: null,
                        message: signal.aborted
                            ? '声音检索已取消，原有示例和工程保留。'
                            : error instanceof Error
                              ? error.message
                              : '声音检索失败。',
                    });
            } finally {
                release?.();
                if (this.queryIo === queryIo) this.queryIo = null;
            }
        })();
        this.operation = work;
        await work;
        if (this.operation === work) this.operation = null;
    }
    cancel(): void {
        this.queryIo?.abort();
        this.controller.cancel();
    }
    apply(): void {
        if (!this.state.profile || this.state.status === 'searching' || this.disposed) return;
        const project = this.options.editor.getSnapshot().project;
        if (!project || this.options.editor.getSnapshot().state !== 'ready' || !this.currentSource()) return;
        try {
            const result = applyExampleMatches(project, this.state.profile);
            if (result.added) this.options.editor.updateProject(result.project, true);
            this.update({ message: `已添加 ${result.added} 个标记，跳过 ${result.skipped} 个已表示的候选。` });
        } catch (error) {
            this.update({ message: error instanceof Error ? error.message : '检索候选无法应用。' });
        }
    }
    async listen(seconds: number): Promise<void> {
        const source = this.currentSource();
        if (!source || this.disposed) return;
        const generation = this.generation,
            signal = this.io.signal,
            revision = ++this.auditionRevision,
            pauseRevision = this.pauseRevision;
        this.audition = (async () => {
            try {
                await this.verify(source, signal);
                this.guard(generation, signal);
                if (revision !== this.auditionRevision) return;
                const lease =
                    source.kind === 'original'
                        ? null
                        : await createStemAuditionSource(
                              {
                                  kind: source.kind,
                                  directory: source.directory!,
                                  resultId: source.resultId!,
                                  trackId: source.trackId,
                                  label: source.label,
                                  mutedRoles: [],
                                  stems: [
                                      {
                                          role: source.role,
                                          frames: source.frames,
                                          sampleRate: source.sampleRate,
                                          left: source.left!,
                                          right: source.right!,
                                      },
                                  ],
                              },
                              signal,
                          );
                if (signal.aborted || generation !== this.generation || revision !== this.auditionRevision) {
                    await lease?.close();
                    return;
                }
                const shouldPlay = this.pauseRevision === pauseRevision;
                await this.options.transport.setAuditionSource(lease, { play: false });
                this.guard(generation, signal);
                if (revision !== this.auditionRevision) return;
                await this.options.seek(seconds);
                this.guard(generation, signal);
                if (shouldPlay && revision === this.auditionRevision) await this.options.transport.play();
            } catch (error) {
                if (!signal.aborted && generation === this.generation)
                    this.update({ message: error instanceof Error ? error.message : '试听失败。' });
            }
        })();
        await this.audition;
    }
    async clearIndex(): Promise<void> {
        const source = this.currentSource();
        if (!source || this.operation) return;
        const generation = this.generation;
        try {
            await this.repository.clearIndex(source.key);
            if (generation === this.generation) this.update({ message: '当前来源的声学索引已清理；示例和工程保留。' });
        } catch (error) {
            if (generation === this.generation)
                this.update({ message: error instanceof Error ? error.message : '索引清理失败。' });
        }
    }
    async flushEdits(): Promise<boolean> {
        await this.saving;
        if (this.state.persistence === 'not-persisted' && this.state.profile) this.queueSave(this.state.profile);
        await this.saving;
        return this.state.persistence !== 'not-persisted';
    }
    async suspend(): Promise<void> {
        this.cancel();
        ++this.auditionRevision;
        await this.operation;
        await this.binding;
        await this.saving;
        await this.audition;
    }
    async clearAll(): Promise<void> {
        await this.suspend();
        await this.repository.clearAll();
        this.songKey = '';
        this.refreshSources();
    }
    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.cleanup.forEach(fn => fn());
        this.io.abort();
        await this.suspend();
        this.disposed = true;
        this.listeners.clear();
    }
}
