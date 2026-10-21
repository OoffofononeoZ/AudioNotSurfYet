import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useAudioSessionService, sha256Blob } from '../../audio/audioSessionService';
import { useEditorSessionController } from '../editorSessionController';
import { createInitialEditorProject } from '../projectCodec';
import type { EditorProjectV2 } from '../types';
import type { LocalAudioInput } from '../../types/audio';
import { parseOsu } from './parseOsu';
import { openOsuArchive, type OsuArchive, type OsuArchiveEntry } from './osuArchive';
import { applyOsuBeatmap, defaultOsuTempoReplacement } from './osuMarkers';
import { DEFAULT_OSU_IMPORT_OPTIONS, type OsuImportApplication } from './osuTypes';
import { pickOsuAudio, pickOsuSource } from './osuFileIO';

export function useOsuImport(
    props: {
        project: EditorProjectV2 | null;
        trackId: string | null;
        apply: (intent: OsuImportApplication) => Promise<boolean>;
    },
    close: () => void,
) {
    const audio = useAudioSessionService(),
        controller = useEditorSessionController();
    const entries = shallowRef<OsuArchiveEntry[]>([]),
        selectedIndex = ref(0),
        sourceName = ref('');
    const selected = computed(() => entries.value[selectedIndex.value]);
    const audioMode = ref<'source' | 'current' | 'file'>('current'),
        currentConfirmed = ref(false);
    const audioName = ref(''),
        options = ref({ ...DEFAULT_OSU_IMPORT_OPTIONS });
    const phase = ref<'idle' | 'reading' | 'preparing' | 'preview' | 'applying'>('idle'),
        error = ref('');
    const intent = shallowRef<OsuImportApplication | null>(null);
    const hasArchive = ref(false),
        busy = computed(() => ['reading', 'preparing', 'applying'].includes(phase.value));
    let archive: OsuArchive | null = null,
        audioInput: LocalAudioInput | null = null;
    let abort: AbortController | null = null,
        operation = 0,
        disposed = false,
        preparedToken: symbol | null = null;
    let tempoTouched = false;
    function invalidate(message = '') {
        ++operation;
        abort?.abort();
        abort = null;
        if (preparedToken) audio.discardPreparedLocalAudio(preparedToken);
        preparedToken = null;
        intent.value = null;
        error.value = message;
        phase.value = 'idle';
    }
    function begin(next: 'reading' | 'preparing') {
        invalidate();
        abort = new AbortController();
        phase.value = next;
        return { revision: operation, signal: abort.signal };
    }
    function valid(revision: number) {
        return !disposed && revision === operation;
    }
    function fail(problem: unknown, revision: number) {
        if (!valid(revision)) return;
        invalidate(problem instanceof Error ? problem.message : String(problem));
    }
    async function chooseSource() {
        const request = begin('reading');
        try {
            const input = await pickOsuSource();
            if (!valid(request.revision)) return;
            if (!input) {
                phase.value = 'idle';
                return;
            }
            archive?.release();
            archive = null;
            entries.value = [];
            sourceName.value = input.file.name;
            audioInput = null;
            audioName.value = '';
            currentConfirmed.value = false;
            if (/\.osz$/i.test(input.file.name)) {
                const loaded = await openOsuArchive(new Uint8Array(await input.file.arrayBuffer()), request.signal);
                if (!valid(request.revision)) {
                    loaded.release();
                    return;
                }
                archive = loaded;
                entries.value = loaded.beatmaps;
                hasArchive.value = true;
                audioMode.value = 'source';
            } else {
                const beatmap = parseOsu(
                    new TextDecoder('utf-8', { fatal: true }).decode(await input.file.arrayBuffer()),
                );
                if (!valid(request.revision)) return;
                entries.value = [
                    {
                        path: input.file.name,
                        beatmap,
                    },
                ];
                hasArchive.value = false;
                audioMode.value = props.project ? 'current' : 'file';
            }
            selectedIndex.value = Math.max(
                0,
                entries.value.findIndex(entry => !!entry.beatmap),
            );
            options.value = {
                ...DEFAULT_OSU_IMPORT_OPTIONS,
                replaceTempo:
                    audioMode.value === 'current' && props.project ? defaultOsuTempoReplacement(props.project) : true,
            };
            tempoTouched = false;
            phase.value = 'idle';
        } catch (problem) {
            fail(problem, request.revision);
        }
    }
    async function chooseAudio() {
        const request = begin('reading');
        try {
            const input = await pickOsuAudio();
            if (!valid(request.revision)) return;
            if (input) {
                audioInput = input;
                audioName.value = input.file.name;
                audioMode.value = 'file';
            }
            phase.value = 'idle';
        } catch (problem) {
            fail(problem, request.revision);
        }
    }
    async function preview() {
        const entry = selected.value,
            beatmap = entry?.beatmap;
        if (!beatmap) {
            error.value = entry?.error || '请先选择谱面。';
            return;
        }
        const request = begin('preparing'),
            expectedProject = props.project;
        try {
            let prepared = null,
                trackId = props.trackId;
            const draft = expectedProject ? null : await controller.readImportDraft();
            let base = expectedProject;
            if (audioMode.value === 'current') {
                if (!base || !trackId) throw Error('请先选择音频。');
                if (archive) {
                    const source = await archive.readAudio(entry.path, beatmap.audioFilename, request.signal);
                    if ((await sha256Blob(new Blob([Uint8Array.from(source.bytes)]))) !== base.track.contentHash)
                        throw Error('当前歌曲与包内原音频不同，请使用包内音频。');
                } else if (!currentConfirmed.value) throw Error('请确认当前歌曲与谱面引用的音频一致。');
            } else {
                let input = audioInput;
                if (audioMode.value === 'source') {
                    if (!archive) throw Error('请另选谱面引用的音频。');
                    const source = await archive.readAudio(entry.path, beatmap.audioFilename, request.signal);
                    input = { file: new File([Uint8Array.from(source.bytes)], source.name) };
                }
                if (!input) throw Error('请选择谱面引用的音频。');
                prepared = await audio.prepareLocalAudio(input, request.signal);
                if (!valid(request.revision)) {
                    audio.discardPreparedLocalAudio(prepared.token);
                    return;
                }
                preparedToken = prepared.token;
                trackId = prepared.track.id;
                const track = {
                    contentHash: prepared.track.trackHash!,
                    fileName: prepared.track.name,
                    durationSeconds: prepared.descriptor.durationSeconds,
                    sampleRate: prepared.descriptor.sampleRate,
                    title: prepared.track.metadata.title,
                    artist: prepared.track.metadata.artist,
                };
                if (base?.track.contentHash !== track.contentHash)
                    base =
                        draft?.project.track.contentHash === track.contentHash
                            ? draft.project
                            : createInitialEditorProject({ track });
            }
            if (!valid(request.revision) || props.project !== expectedProject) return;
            if (!base || !trackId) throw Error('歌曲不可用，请重新选择音频。');
            if (!tempoTouched) options.value.replaceTempo = defaultOsuTempoReplacement(base);
            const project = applyOsuBeatmap(base, beatmap, options.value);
            intent.value = { project, expectedProject, draft, audio: prepared, trackId };
            phase.value = 'preview';
        } catch (problem) {
            fail(problem, request.revision);
        }
    }
    async function apply() {
        const ready = intent.value;
        if (!ready) return;
        phase.value = 'applying';
        error.value = '';
        try {
            if (await props.apply(ready)) {
                preparedToken = null;
                close();
            } else phase.value = 'preview';
        } catch (problem) {
            invalidate(problem instanceof Error ? problem.message : String(problem));
        }
    }
    watch(
        currentConfirmed,
        () => {
            if (!busy.value) invalidate();
        },
        { flush: 'sync' },
    );
    watch(
        [selectedIndex, audioMode],
        () => {
            currentConfirmed.value = false;
            if (!busy.value) {
                invalidate();
                tempoTouched = false;
                options.value.replaceTempo =
                    audioMode.value === 'current' && props.project ? defaultOsuTempoReplacement(props.project) : true;
            }
        },
        { flush: 'sync' },
    );
    watch(
        options,
        () => {
            if (!busy.value) invalidate();
        },
        { deep: true, flush: 'sync' },
    );
    watch(
        () => props.project,
        () => {
            if (phase.value !== 'applying') invalidate('工程已变化，请重新预览谱面。');
        },
        { flush: 'sync' },
    );
    onBeforeUnmount(() => {
        disposed = true;
        invalidate();
        archive?.release();
        archive = null;
        audioInput = null;
    });
    const summary = computed(() => {
        const project = intent.value?.project;
        if (!project) return null;
        const expected = intent.value?.expectedProject;
        const before =
            expected?.track.contentHash === project.track.contentHash
                ? expected.lanes.length
                : intent.value?.draft?.project.track.contentHash === project.track.contentHash
                  ? intent.value.draft.project.lanes.length
                  : 0;
        const added = project.lanes.slice(before);
        const bpms = project.tempoMap.flatMap(s => (s.mode === 'metered' && s.bpm !== null ? [s.bpm] : []));
        return {
            lanes: added.length,
            points: added.filter(l => l.eventKind === 'point').reduce((n, l) => n + l.events.length, 0),
            ranges: added.filter(l => l.eventKind === 'range').reduce((n, l) => n + l.events.length, 0),
            segments: project.tempoMap.length,
            bpm: bpms.length
                ? `${Number(Math.min(...bpms).toFixed(3))}–${Number(Math.max(...bpms).toFixed(3))}`
                : '未设置',
            fileName: project.track.fileName,
        };
    });
    return {
        entries,
        selectedIndex,
        selected,
        sourceName,
        audioMode,
        audioName,
        currentConfirmed,
        options,
        phase,
        error,
        busy,
        hasArchive,
        summary,
        chooseSource,
        chooseAudio,
        preview,
        apply,
        touchTempo: () => {
            tempoTouched = true;
        },
        canApply: computed(() => !!intent.value && phase.value === 'preview'),
    };
}
