<template>
    <section v-if="result && preview" class="candidate-review" aria-label="候选复核">
        <header class="result-toolbar">
            <div>
                <h3>{{ preview.markers.length }} 个标记 · {{ result.candidates.length }} 个原始候选</h3>
                <span>{{ state.restored ? '本地结果已恢复' : '分析结果' }} · {{ persistenceLabel }}</span>
            </div>
            <button type="button" :disabled="busy || exporting" @click="exportDiagnostics">导出诊断</button>
            <button
                type="button"
                class="primary"
                data-testid="transcription-apply"
                :disabled="busy || state.applied || !preview.markers.length"
                @click="service.apply()">
                <EditorIcon name="plus" />{{ state.applied ? '本结果已应用' : '添加为新标记轨' }}
            </button>
        </header>
        <p v-if="exportMessage" class="notice" role="status">{{ exportMessage }}</p>
        <p class="notice">
            钢琴、吉他属于乐器候选，可能存在串音或无目标时的误检。原始候选保留在音符细节中，筛选与分组无需重新推理。
        </p>
        <p v-if="state.applied" class="notice">更改预览不会修改已添加的标记轨。</p>
        <ul v-if="result.failures.length" class="error" aria-label="未完成输入">
            <li v-for="failure in result.failures" :key="failure.role">
                {{ INSTRUMENT_LABELS[failure.role] }}未完成：{{ failure.message }}（{{ failure.code }}）
            </li>
        </ul>
        <p v-if="result.truncatedDrumSegments.length" class="notice error" data-testid="transcription-truncation">
            以下鼓区间未完成，相关候选已隔离：{{
                result.incompleteDrumRanges
                    ?.map(range => `${range.startSeconds.toFixed(3)}–${range.endSeconds.toFixed(3)}`)
                    .join('、') || result.truncatedDrumSegments.map(time => time.toFixed(3)).join('、')
            }}
            秒。
        </p>
        <div class="review-controls">
            <label
                >结果视图<select
                    :value="state.review.view"
                    :disabled="busy"
                    data-testid="transcription-review-view"
                    aria-label="自动标记结果视图"
                    @change="
                        service.setReviewView(($event.target as HTMLSelectElement).value as ReviewSettings['view'])
                    ">
                    <option value="timbres">主要音色</option>
                    <option value="notes">音符细节</option>
                </select></label
            >
            <label
                >筛选<select
                    :value="state.review.sensitivity"
                    :disabled="busy"
                    data-testid="transcription-sensitivity"
                    aria-label="自动标记灵敏度"
                    @change="service.setSensitivity(($event.target as HTMLSelectElement).value as Sensitivity)">
                    <option value="conservative">保守</option>
                    <option value="balanced">平衡</option>
                    <option value="sensitive">高灵敏度</option>
                </select></label
            >
            <span>当前保留 {{ preview.selectedIds.length }} 个原始候选</span>
        </div>
        <div class="audition-tools">
            <span
                >当前试听：{{ playback.audition?.label ?? '原曲'
                }}{{ playback.state === 'buffering' ? ' · 等待数据' : '' }}</span
            >
            <button type="button" @click="separation.toggleAudition()">
                {{
                    playback.audition?.kind === 'ft' && ['playing', 'buffering'].includes(playback.state)
                        ? '暂停 FT 试听'
                        : '试听 FT 分轨'
                }}
            </button>
            <button
                v-if="state.bundle?.auxiliary"
                type="button"
                data-testid="transcription-listen-piano"
                @click="service.listenAuxiliary('piano')">
                试听辅助钢琴
            </button>
            <button
                v-if="state.bundle?.auxiliary"
                type="button"
                data-testid="transcription-listen-guitar"
                @click="service.listenAuxiliary('guitar')">
                试听辅助吉他
            </button>
            <button type="button" @click="separation.returnToOriginal()">返回原曲</button>
        </div>
        <div class="thresholds" role="group" aria-label="音符长短分界">
            <label v-for="instrument in noteInstruments" :key="instrument"
                ><span>{{ INSTRUMENT_LABELS[instrument] }}</span
                ><AppNumberInput
                    :model-value="state.thresholds[instrument] ?? 300"
                    :label="`${INSTRUMENT_LABELS[instrument]}长短分界毫秒`"
                    :min="0"
                    :step="10"
                    :disabled="busy"
                    @update:model-value="service.setThreshold(instrument, $event)" /><small>ms</small></label
            >
        </div>
        <EditorCandidateTimeline
            :markers="preview.markers"
            :duration="duration"
            :playback="playback"
            :active="active"
            @seek="emit('seek', $event)" />
        <EditorDuplicateReview
            :groups="preview.duplicateGroups"
            :candidates="result.candidates"
            :busy="busy"
            @seek="emit('seek', $event)" />
        <div v-if="state.review.view === 'timbres'" class="sound-groups" aria-label="声音分组">
            <label v-for="group in preview.groups" :key="group.id"
                ><input
                    :value="group.label"
                    maxlength="80"
                    :aria-label="`声音组名称 ${group.id}`"
                    :disabled="busy"
                    @change="service.renameSoundGroup(group.id, ($event.target as HTMLInputElement).value)" /><span
                    >{{ group.selectedCount }}/{{ group.rawCount }} 个候选</span
                ><button type="button" @click="showGroup(group.id)">查看原始候选</button></label
            >
            <p v-if="!preview.markers.length" class="notice">
                当前筛选或重复复核没有可应用的标记，可调整筛选或检查音符细节。
            </p>
        </div>
        <template v-else>
            <div class="review-filters">
                <label
                    >乐器<select v-model="instrumentFilter" aria-label="候选乐器筛选">
                        <option value="all">全部</option>
                        <option v-for="instrument in instruments" :key="instrument" :value="instrument">
                            {{ INSTRUMENT_LABELS[instrument] }}
                        </option>
                    </select></label
                >
                <label
                    >鼓类别<select v-model="drumFilter" aria-label="鼓候选类别筛选">
                        <option value="all">全部</option>
                        <option v-for="category in DRUM_CATEGORIES" :key="category" :value="category">
                            {{ DRUM_LABELS[category] }}
                        </option>
                    </select></label
                >
                <label
                    >声音组<select v-model="groupFilter" aria-label="候选声音组筛选">
                        <option value="all">全部</option>
                        <option v-for="group in preview.groups" :key="group.id" :value="group.id">
                            {{ group.label }}
                        </option>
                    </select></label
                >
                <label><input v-model="showDeleted" type="checkbox" />显示已删除</label>
                <span>{{ filtered.length }} 个 · 第 {{ safePage + 1 }}/{{ pageCount }} 页</span
                ><button type="button" :disabled="!safePage" @click="page = safePage - 1">上一页</button
                ><button type="button" :disabled="safePage + 1 >= pageCount" @click="page = safePage + 1">
                    下一页
                </button>
            </div>
            <div class="candidate-table app-scrollbar">
                <table data-testid="transcription-candidates">
                    <thead>
                        <tr>
                            <th>试听</th>
                            <th>原始时间（秒）</th>
                            <th>类别 / 音高</th>
                            <th>乐器修正</th>
                            <th>音乐角色</th>
                            <th>声音组</th>
                            <th>标记</th>
                            <th>模型 / 声学证据</th>
                            <th>处理</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="candidate in pageCandidates"
                            :key="candidate.id"
                            :data-candidate-id="candidate.id"
                            :class="{ deleted: candidate.deleted }">
                            <td>
                                <button
                                    type="button"
                                    :aria-label="`跳转候选 ${candidate.startSeconds.toFixed(3)} 秒`"
                                    @click="emit('seek', candidate.startSeconds)">
                                    <EditorIcon name="right" />
                                </button>
                            </td>
                            <td>{{ candidate.startSeconds.toFixed(3) }} — {{ candidate.endSeconds.toFixed(3) }}</td>
                            <td>
                                <template v-if="candidate.kind === 'drum'"
                                    ><select
                                        :value="candidate.drum"
                                        :disabled="busy"
                                        aria-label="修正鼓类别"
                                        @change="
                                            service.correct(candidate.id, {
                                                drum: ($event.target as HTMLSelectElement).value as DrumCategory,
                                            })
                                        ">
                                        <option v-for="category in DRUM_CATEGORIES" :key="category" :value="category">
                                            {{ DRUM_LABELS[category] }}
                                        </option></select
                                    ><small>声音 {{ candidate.customPitch }}</small></template
                                ><template v-else
                                    >{{ pitchLabel(candidate.pitch) }} <small>{{ candidate.pitch }}</small></template
                                >
                            </td>
                            <td>
                                <select
                                    v-if="candidate.kind === 'note'"
                                    :value="candidate.instrument"
                                    :disabled="busy"
                                    aria-label="修正候选乐器"
                                    @change="
                                        service.correct(candidate.id, {
                                            instrument: ($event.target as HTMLSelectElement).value as NoteInstrument,
                                        })
                                    ">
                                    <option v-for="instrument in noteInstruments" :key="instrument" :value="instrument">
                                        {{ INSTRUMENT_LABELS[instrument] }}
                                    </option></select
                                ><span v-else>鼓</span>
                            </td>
                            <td>
                                <select
                                    v-if="candidate.kind === 'note'"
                                    :value="candidate.musicalRole ?? ''"
                                    :disabled="busy"
                                    aria-label="修正候选音乐角色"
                                    @change="
                                        service.correct(candidate.id, {
                                            musicalRole: (($event.target as HTMLSelectElement).value || null) as
                                                'lead' | 'other' | null,
                                        })
                                    ">
                                    <option value="">
                                        {{
                                            candidate.inferredRole
                                                ? `自动：${candidate.inferredRole === 'lead' ? '主旋律候选' : '其他声部'}`
                                                : '未指定'
                                        }}
                                    </option>
                                    <option value="lead">主旋律候选</option>
                                    <option value="other">其他声部</option></select
                                ><small v-if="candidate.kind === 'note' && candidate.roleEvidence"
                                    >路径覆盖 {{ candidate.roleEvidence.coverage.toFixed(2) }} · 判别余量
                                    {{ candidate.roleEvidence.margin.toFixed(2) }}</small
                                >
                            </td>
                            <td>
                                <select
                                    :value="soundGroup(candidate, state.review).id"
                                    :disabled="busy"
                                    aria-label="候选声音组"
                                    @change="
                                        service.assignSoundGroup(
                                            candidate.id,
                                            ($event.target as HTMLSelectElement).value === 'new'
                                                ? null
                                                : ($event.target as HTMLSelectElement).value,
                                        )
                                    ">
                                    <option
                                        v-for="group in preview.groups.filter(
                                            group => group.instrument === candidate.instrument,
                                        )"
                                        :key="group.id"
                                        :value="group.id">
                                        {{ group.label }}
                                    </option>
                                    <option value="new">新声音组</option>
                                </select>
                            </td>
                            <td>
                                {{ candidateEventKind(candidate, state.thresholds) === 'point' ? '点' : '区间'
                                }}<small>{{ preview.excluded[candidate.id] ?? '已选中' }}</small>
                            </td>
                            <td>
                                {{
                                    candidate.kind === 'drum'
                                        ? `velocity ${Math.round(candidate.strength * 127)}`
                                        : `激活 ${candidate.strength.toFixed(2)}`
                                }}<small>{{ candidate.source.inputRole }} / {{ candidate.source.model }}</small
                                ><small v-if="candidate.acoustics"
                                    >局部显著性 {{ candidate.acoustics.salience.toFixed(2) }} · 起音
                                    {{ candidate.acoustics.onset.toFixed(2) }} · RMS
                                    {{ candidate.acoustics.rms.toFixed(4) }}</small
                                >
                            </td>
                            <td>
                                <button
                                    type="button"
                                    :disabled="busy"
                                    :aria-label="candidate.deleted ? '恢复候选' : '删除候选'"
                                    @click="service.correct(candidate.id, { deleted: !candidate.deleted })">
                                    {{ candidate.deleted ? '恢复' : '删除' }}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <p v-if="!filtered.length" class="notice">当前筛选没有候选。</p>
            </div>
        </template>
    </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { PlaybackSnapshot } from '../types/audio';
import { useEditorTranscriptionService } from '../transcription/editorTranscriptionService';
import type { EditorTranscriptionSnapshot } from '../transcription/editorTranscriptionService';
import { useEditorSeparationService } from '../processing/editorSeparationService';
import { INSTRUMENT_LABELS } from '../transcription/candidateTypes';
import type { CandidateInstrument, DrumCategory, NoteInstrument } from '../transcription/candidateTypes';
import { candidateEventKind } from '../transcription/candidates';
import { soundGroup } from '../transcription/reviewSettings';
import type { ReviewSettings, Sensitivity } from '../transcription/reviewSettings';
import { DRUM_CATEGORIES, DRUM_LABELS } from '../transcription/drumVocabulary';
import { usePlatformPorts } from '../platform/platformPorts';
import { transcriptionDiagnosticReport } from '../transcription/drumDiagnostics';
import EditorCandidateTimeline from './EditorCandidateTimeline.vue';
import EditorDuplicateReview from './EditorDuplicateReview.vue';
import EditorIcon from './EditorIcon.vue';
import AppNumberInput from './controls/AppNumberInput.vue';
const props = defineProps<{
    state: EditorTranscriptionSnapshot;
    playback: PlaybackSnapshot;
    duration: number;
    active: boolean;
}>();
const emit = defineEmits<{ seek: [seconds: number] }>();
const service = useEditorTranscriptionService(),
    separation = useEditorSeparationService();
const result = computed(() => props.state.bundle?.result ?? null),
    preview = computed(() => props.state.preview);
const busy = computed(() => ['restoring', 'running', 'cancelling', 'clearing'].includes(props.state.status));
const noteInstruments: NoteInstrument[] = ['bass', 'vocals', 'piano', 'guitar', 'other', 'unknown'],
    instruments: CandidateInstrument[] = ['drums', ...noteInstruments];
const instrumentFilter = ref<CandidateInstrument | 'all'>('all'),
    drumFilter = ref<DrumCategory | 'all'>('all'),
    groupFilter = ref('all'),
    showDeleted = ref(false),
    page = ref(0);
const filtered = computed(() =>
    (result.value?.candidates ?? [])
        .filter(
            candidate =>
                (showDeleted.value || !candidate.deleted) &&
                (instrumentFilter.value === 'all' || candidate.instrument === instrumentFilter.value) &&
                (drumFilter.value === 'all' || (candidate.kind === 'drum' && candidate.drum === drumFilter.value)) &&
                (groupFilter.value === 'all' || soundGroup(candidate, props.state.review).id === groupFilter.value),
        )
        .sort((a, b) => a.startSeconds - b.startSeconds),
);
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / 100))),
    safePage = computed(() => Math.min(page.value, pageCount.value - 1));
const pageCandidates = computed(() => filtered.value.slice(safePage.value * 100, (safePage.value + 1) * 100));
watch([instrumentFilter, drumFilter, groupFilter, showDeleted, () => result.value?.id], () => {
    page.value = 0;
});
function showGroup(id: string): void {
    groupFilter.value = id;
    instrumentFilter.value = 'all';
    drumFilter.value = 'all';
    service.setReviewView('notes');
}
function pitchLabel(pitch: number): string {
    return `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}
const persistenceLabel = computed(
    () =>
        ({ idle: '尚未保存', saving: '保存修正中', saved: '候选已保存', 'not-persisted': '修正未保存' })[
            props.state.persistence
        ],
);
const transfers = usePlatformPorts().transfers,
    exporting = ref(false),
    exportMessage = ref(''),
    exportAbort = new AbortController();
onBeforeUnmount(() => exportAbort.abort());
async function exportDiagnostics(): Promise<void> {
    if (!result.value || exporting.value) return;
    const current = result.value;
    exporting.value = true;
    exportMessage.value = '';
    try {
        const report = { ...transcriptionDiagnosticReport(current), review: props.state.review };
        const saved = await transfers.save(
            'analysis-report',
            'audiosurf-transcription-diagnostics.json',
            new TextEncoder().encode(JSON.stringify(report, null, 2)),
            exportAbort.signal,
        );
        if (result.value?.id === current.id) exportMessage.value = saved === 'saved' ? '诊断已保存。' : '已取消保存。';
    } catch (error) {
        if (result.value?.id === current.id)
            exportMessage.value = error instanceof Error ? error.message : '诊断保存失败。';
    } finally {
        exporting.value = false;
    }
}
</script>
<style scoped>
.candidate-review {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 20px;
    border: 1px solid var(--divider);
    border-radius: var(--radius-sm);
    padding: 18px;
    background: var(--surface-1);
}
.result-toolbar,
.review-controls,
.audition-tools,
.review-filters {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}
.result-toolbar > div {
    flex: 1;
    min-width: 180px;
}
h3 {
    margin: 0 0 6px;
    font-size: 16px;
    color: var(--ink);
}
.result-toolbar span,
.review-controls > span,
.sound-groups span {
    font-size: 11px;
    color: var(--mute);
}
button,
select,
input {
    font: inherit;
    color: var(--ink);
    background: var(--surface-3);
    border: 1px solid var(--divider);
    border-radius: var(--radius-xs);
    min-height: 32px;
    padding: 5px 9px;
    max-width: 100%;
}
button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
}
button svg {
    width: 15px;
    height: 15px;
}
button:hover {
    background: var(--control-hover);
}
button:disabled {
    opacity: 0.45;
    cursor: default;
}
button.primary {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 2px;
}
input[type='checkbox'] {
    min-height: auto;
    accent-color: var(--accent);
}
label {
    display: flex;
    align-items: center;
    gap: 8px;
}
.notice {
    margin: 0;
    color: var(--mute);
    font-size: 12px;
    line-height: 1.8;
    overflow-wrap: anywhere;
}
.error {
    color: var(--danger, #efaaa2);
}
.audition-tools > span {
    width: 100%;
    color: var(--body);
}
.thresholds {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}
.thresholds label {
    font-size: 11px;
    color: var(--body);
}
.thresholds :deep(.app-number-input) {
    width: 80px;
}
.thresholds small {
    color: var(--mute);
}
.sound-groups {
    display: grid;
    gap: 8px;
}
.sound-groups label {
    display: flex;
    flex-wrap: wrap;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider);
}
.sound-groups input {
    width: 200px;
}
.review-filters > span {
    color: var(--mute);
    font-size: 11px;
}
.candidate-table {
    overflow: auto;
    max-height: 480px;
    border: 1px solid var(--divider);
    border-radius: var(--radius-xs);
}
table {
    width: 100%;
    border-collapse: collapse;
    min-width: 1060px;
    font-size: 11px;
}
th,
td {
    text-align: left;
    padding: 10px 8px;
    border-bottom: 1px solid var(--divider);
    vertical-align: middle;
    font-variant-numeric: tabular-nums;
}
th {
    position: sticky;
    top: 0;
    background: var(--surface-2);
    color: var(--body);
    z-index: 1;
    white-space: nowrap;
}
td small {
    display: block;
    color: var(--mute);
    font-size: 10px;
    line-height: 1.6;
    max-width: 260px;
}
td select {
    max-width: 170px;
    font-size: 11px;
}
td:nth-child(2) {
    white-space: nowrap;
}
.deleted {
    opacity: 0.45;
}
@media (max-width: 700px) {
    .candidate-review {
        padding: 12px;
    }
    .result-toolbar > div {
        width: 100%;
        flex-basis: 100%;
    }
    .sound-groups input {
        flex: 1;
        min-width: 100px;
    }
    .thresholds {
        gap: 8px;
    }
}
</style>
