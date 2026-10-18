<template>
    <section class="transcription-workspace" data-testid="editor-transcription" :data-state="state.status" aria-label="自动标记候选">
        <section class="transcription-intro" aria-labelledby="transcription-title">
            <div class="intro-heading">
                <div class="intro-icon"><EditorIcon name="features" /></div>
                <div><h2 id="transcription-title">自动标记</h2><p>选择分析输入，生成并复核标记候选。</p></div>
            </div>
            <div class="input-section">
                <h3>分析输入</h3>
                <div class="input-options" role="group" aria-label="自动标记分析输入">
                    <label v-for="role in TRANSCRIPTION_ROLES" :key="role" :class="{ 'is-selected': state.selectedRoles.includes(role) }">
                        <input type="checkbox" :checked="state.selectedRoles.includes(role)" :disabled="busy" @change="toggleRole(role)">
                        <span><strong>{{ INSTRUMENT_LABELS[role] }}</strong><small>{{ role === 'drums' ? 'ADT_STR' : 'Basic Pitch' }}{{ role === 'piano' || role === 'guitar' ? ' · 辅助分离' : ' · FT' }}</small></span>
                    </label>
                </div>
            </div>
            <footer class="task-actions">
                <span>待下载模型 {{ formatBytes(state.missingModelBytes) }}</span>
                <button v-if="!busy" type="button" class="primary" data-testid="transcription-start" :disabled="!state.ftResultId || !state.selectedRoles.length" @click="service.start()"><EditorIcon name="plus" />{{ result ? '重新分析' : '生成候选' }}</button>
                <button v-else type="button" data-testid="transcription-cancel" :disabled="['cancelling','clearing'].includes(state.status)" @click="service.cancel()">{{ state.status === 'cancelling' ? '取消中…' : '取消分析' }}</button>
            </footer>
        </section>

        <div v-if="busy" class="task-progress" role="status" data-testid="transcription-progress">
            <div><strong>{{ phaseLabel }}</strong><span v-if="state.progress">{{ state.progress.role }} · {{ state.progress.completedUnits }}<template v-if="state.progress.totalUnits !== null"> / {{ state.progress.totalUnits }}</template> · {{ clockTime(state.progress.elapsedMs/1000) }}</span></div>
            <progress v-if="state.progress?.totalUnits" :value="state.progress.completedUnits" :max="state.progress.totalUnits" /><progress v-else />
        </div>
        <p v-if="state.message" class="task-message" :class="{'error':state.status === 'error' || !!state.errorCode}" :role="state.errorCode ? 'alert' : 'status'" data-testid="transcription-message">{{ state.message }}</p>

        <section v-if="result" class="candidate-review" aria-label="候选复核">
            <header class="result-toolbar">
                <div><h3>{{ result.candidates.filter(c => !c.deleted).length }} 个候选</h3><span>{{ state.restored ? '本地结果已恢复' : '分析结果' }} · {{ persistenceLabel }}</span></div>
                <button type="button" class="primary" data-testid="transcription-apply" :disabled="busy || state.applied || !result.candidates.some(c => !c.deleted)" @click="service.apply()"><EditorIcon name="plus" />{{ state.applied ? '本结果已应用' : '添加为新标记轨' }}</button>
            </header>
            <p class="notice">钢琴、吉他属于乐器候选，可能存在串音或无目标时的误检。短音与长音由分界值决定，改变分界无需重新推理。</p>
            <ul v-if="result.failures.length" class="failures" aria-label="未完成输入"><li v-for="failure in result.failures" :key="failure.role">{{ INSTRUMENT_LABELS[failure.role] }}未完成：{{ failure.message }}（{{ failure.code }}）</li></ul>
            <p v-if="result.truncatedDrumSegments.length" class="notice error" data-testid="transcription-truncation">鼓解码达到 token 上限，以下片段未完整完成：{{ result.truncatedDrumSegments.map(t=>t.toFixed(3)).join('、') }} 秒。</p>
            <div class="audition-tools">
                <span>当前试听：{{ playback.audition?.label ?? '原曲' }}{{ playback.state === 'buffering' ? ' · 等待数据' : '' }}</span>
                <button type="button" @click="separation.toggleAudition()">{{ playback.audition?.kind === 'ft' && ['playing','buffering'].includes(playback.state) ? '暂停 FT 试听' : '试听 FT 分轨' }}</button>
                <button v-if="state.bundle?.auxiliary" type="button" data-testid="transcription-listen-piano" @click="service.listenAuxiliary('piano')">试听辅助钢琴</button>
                <button v-if="state.bundle?.auxiliary" type="button" data-testid="transcription-listen-guitar" @click="service.listenAuxiliary('guitar')">试听辅助吉他</button>
                <button type="button" @click="separation.returnToOriginal()">返回原曲</button>
            </div>
            <div class="thresholds" role="group" aria-label="音符长短分界">
                <label v-for="instrument in noteInstruments" :key="instrument"><span>{{ INSTRUMENT_LABELS[instrument] }}</span><AppNumberInput :model-value="state.thresholds[instrument] ?? 300" :label="`${INSTRUMENT_LABELS[instrument]}长短分界毫秒`" :min="0" :step="10" :disabled="busy" @update:model-value="setThreshold(instrument,$event)" /><small>ms</small></label>
            </div>
            <EditorCandidateTimeline :candidates="filtered" :thresholds="state.thresholds" :duration="duration" :playback="playback" :active="active" @seek="emit('seek',$event)" />
            <div class="review-filters">
                <label>乐器 <select v-model="instrumentFilter" aria-label="候选乐器筛选"><option value="all">全部</option><option v-for="instrument in instruments" :key="instrument" :value="instrument">{{ INSTRUMENT_LABELS[instrument] }}</option></select></label>
                <label>鼓类别 <select v-model="drumFilter" aria-label="鼓候选类别筛选"><option value="all">全部</option><option v-for="category in drumCategories" :key="category" :value="category">{{ category }}</option></select></label>
                <label><input v-model="showDeleted" type="checkbox">显示已删除</label>
                <div class="review-pagination"><span>{{ filtered.length }} 个 · 第 {{ safePage+1 }}/{{ pageCount }} 页</span><button type="button" :disabled="safePage === 0" @click="page = safePage-1">上一页</button><button type="button" :disabled="safePage+1 >= pageCount" @click="page = safePage+1">下一页</button></div>
            </div>
            <div class="candidate-table app-scrollbar">
                <table data-testid="transcription-candidates">
                    <thead><tr><th>试听</th><th>原始时间（秒）</th><th>类别 / 音高</th><th>乐器修正</th><th>标记</th><th>强度 / 来源</th><th>处理</th></tr></thead>
                    <tbody>
                        <tr v-for="candidate in pageCandidates" :key="candidate.id" :data-candidate-id="candidate.id" :class="{deleted:candidate.deleted}">
                            <td><button type="button" class="seek-candidate" :aria-label="`跳转候选 ${candidate.startSeconds.toFixed(3)} 秒`" @click="emit('seek',candidate.startSeconds)"><EditorIcon name="right" /></button></td>
                            <td class="candidate-time">{{ candidate.startSeconds.toFixed(3) }} — {{ candidate.endSeconds.toFixed(3) }}</td>
                            <td><select v-if="candidate.kind === 'drum'" :value="candidate.drum" :disabled="busy" aria-label="修正鼓类别" @change="correctDrum(candidate.id,$event)"><option v-for="category in drumCategories" :key="category" :value="category">{{ category }}</option></select><template v-else>{{ pitchLabel(candidate.pitch) }} <small>{{ candidate.pitch }}</small></template></td>
                            <td><select v-if="candidate.kind === 'note'" :value="candidate.instrument" :disabled="busy" aria-label="修正候选乐器" @change="correctInstrument(candidate.id,$event)"><option v-for="instrument in noteInstruments" :key="instrument" :value="instrument">{{ INSTRUMENT_LABELS[instrument] }}</option></select><span v-else>鼓</span><small v-if="hints.has(candidate.id)" class="duplicate-hint">跨乐器疑似重复</small></td>
                            <td><span class="candidate-kind">{{ candidateEventKind(candidate,state.thresholds) === 'point' ? '点' : '区间' }}</span></td>
                            <td>{{ Math.round(candidate.strength*100) }}% <small>{{ candidate.source.inputRole }} / {{ candidate.source.model }}</small></td>
                            <td><button type="button" :disabled="busy" :aria-label="candidate.deleted ? '恢复候选' : '删除候选'" @click="service.correct(candidate.id,{deleted:!candidate.deleted})">{{ candidate.deleted ? '恢复' : '删除' }}</button></td>
                        </tr>
                    </tbody>
                </table>
                <p v-if="!filtered.length" class="notice empty-filter">当前筛选没有候选。</p>
            </div>
        </section>
        <section v-else-if="!busy" class="candidate-empty" aria-label="暂无自动标记候选">
            <EditorIcon name="overlay" /><h3>尚无标记候选</h3>
            <p>{{ state.ftResultId ? '选择分析输入后，点击“生成候选”。' : '请先在「音轨分离」完成当前歌曲的分离。' }}</p>
        </section>

        <section class="cache-panel" aria-label="自动标记缓存">
            <div class="cache-tools"><div><h3>缓存</h3><p>工程标记保留；缓存不自动驱逐。</p></div><button type="button" :disabled="busy" @click="pendingClear = 'results'">清理辅助音频与候选缓存</button><button type="button" :disabled="busy" @click="pendingClear = 'models'">清理新增模型缓存</button></div>
            <div v-if="pendingClear" class="cache-confirm" role="group" aria-label="确认清理自动标记缓存"><span>{{ pendingClear === 'results' ? '删除全部自动标记候选与辅助音频？' : '删除新增模型缓存？下次分析需重新下载。' }}</span><button type="button" :disabled="busy" data-testid="transcription-confirm-clear" @click="confirmClear">确认清理</button><button type="button" @click="pendingClear = null">取消</button></div>
        </section>
    </section>
</template>
<script setup lang="ts">
import { computed,onBeforeUnmount,ref,shallowRef,watch } from 'vue';
import type { PlaybackSnapshot } from '../types/audio';
import { useEditorTranscriptionService } from '../transcription/editorTranscriptionService';
import { useEditorSeparationService } from '../processing/editorSeparationService';
import { TRANSCRIPTION_ROLES,INSTRUMENT_LABELS } from '../transcription/candidateTypes';
import type { CandidateInstrument,DrumCategory,NoteInstrument,TranscriptionRole } from '../transcription/candidateTypes';
import { candidateEventKind,crossInstrumentHints } from '../transcription/candidates';
import { clockTime,formatBytes } from '../processing/presentation';
import EditorCandidateTimeline from './EditorCandidateTimeline.vue';
import EditorIcon from './EditorIcon.vue';
import AppNumberInput from './controls/AppNumberInput.vue';
defineProps<{playback:PlaybackSnapshot;duration:number;active:boolean}>();
const emit = defineEmits<{seek:[seconds:number]}>();
const service = useEditorTranscriptionService(),separation = useEditorSeparationService(),state = shallowRef(service.getSnapshot());
const unsubscribe = service.subscribe(snapshot => { state.value = snapshot; });onBeforeUnmount(unsubscribe);
const noteInstruments:NoteInstrument[] = ['bass','vocals','piano','guitar','unknown'],instruments:CandidateInstrument[] = ['drums',...noteInstruments],drumCategories:DrumCategory[] = ['kick','snare','hat'];
const result = computed(() => state.value.bundle?.result ?? null),busy = computed(() => ['restoring','running','cancelling','clearing'].includes(state.value.status));
const instrumentFilter = ref<CandidateInstrument|'all'>('all'),drumFilter = ref<DrumCategory|'all'>('all'),showDeleted = ref(false),page = ref(0),pendingClear = ref<'results'|'models'|null>(null);
const filtered = computed(() => (result.value?.candidates ?? []).filter(c => (showDeleted.value || !c.deleted) && (instrumentFilter.value === 'all' || c.instrument === instrumentFilter.value) && (drumFilter.value === 'all' || c.kind === 'drum' && c.drum === drumFilter.value)).sort((a,b)=>a.startSeconds-b.startSeconds));
const hints = computed(() => crossInstrumentHints(result.value?.candidates ?? [])),pageCount = computed(() => Math.max(1,Math.ceil(filtered.value.length/100))),safePage = computed(() => Math.min(page.value,pageCount.value-1));
const pageCandidates = computed(() => filtered.value.slice(safePage.value*100,(safePage.value+1)*100));
watch([instrumentFilter,drumFilter,showDeleted,() => result.value?.id],() => { page.value = 0; });
const persistenceLabel = computed(() => ({idle:'尚未保存',saving:'保存修正中',saved:'候选已保存','not-persisted':'修正未保存'})[state.value.persistence]);
const phaseLabel = computed(() => state.value.status === 'restoring' ? '校验并恢复候选' : state.value.status === 'cancelling' ? '取消并释放分析' : state.value.status === 'clearing' ? '清理缓存' : ({'model-download':'下载模型','model-verify':'校验模型','model-load':'载入模型','drum-preprocess':'鼓频谱处理','drum-encoder':'编码鼓片段','drum-decode':'解码鼓击打','drum-segments':'鼓片段完成','pitch-inference':'识别音符','pitch-decode':'整理音符候选','auxiliary-input':'准备辅助分离','auxiliary-inference':'分析钢琴与吉他','auxiliary-persist':'保存辅助音频'}[state.value.progress?.phase ?? ''] ?? state.value.progress?.phase ?? '准备分析'));
function toggleRole(role:TranscriptionRole):void { service.setRoles(state.value.selectedRoles.includes(role) ? state.value.selectedRoles.filter(r=>r!==role) : [...state.value.selectedRoles,role]); }
function setThreshold(instrument:NoteInstrument,value:number):void { if (Number.isFinite(value) && value >= 0) service.setThreshold(instrument,value); }
function correctDrum(id:string,event:Event):void { service.correct(id,{drum:(event.target as HTMLSelectElement).value as DrumCategory}); }
function correctInstrument(id:string,event:Event):void { service.correct(id,{instrument:(event.target as HTMLSelectElement).value as NoteInstrument}); }
function pitchLabel(pitch:number):string { return `${['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][pitch%12]}${Math.floor(pitch/12)-1}`; }
async function confirmClear():Promise<void> { const kind = pendingClear.value;if (!kind) return;pendingClear.value = null;await service.clear(kind); }
</script>
<style scoped>
.transcription-workspace { width: 100%; max-width: 1480px; margin: 0 auto; color: var(--ink); font-size: 12px; }
.transcription-intro, .candidate-review, .cache-panel { overflow: hidden; border: 1px solid var(--divider); border-radius: var(--radius-md); background: var(--surface-card-strong); }
.intro-heading { display: flex; align-items: flex-start; gap: 16px; padding: 28px 28px 24px; }
.intro-icon { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border: 1px solid var(--hairline-soft); border-radius: var(--radius-sm); color: var(--accent-soft); background: var(--surface-chip); }
.intro-icon svg { width: 22px; height: 22px; }
h2 { margin: 0; font-size: 22px; line-height: 28px; font-weight: 500; }
h3 { margin: 0; font-size: 13px; font-weight: 500; }
.intro-heading p { margin: 8px 0 0; color: var(--body); font-size: 13px; line-height: 1.65; }
.input-section { padding: 0 28px 28px; }
.input-section h3 { margin-bottom: 12px; color: var(--body); font-size: 12px; }
.input-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 8px; }
.input-options label { display: flex; align-items: center; gap: 10px; padding: 14px 12px; border: 1px solid var(--divider); border-radius: var(--radius-sm); background: var(--surface-3); cursor: pointer; }
.input-options label:hover { border-color: var(--hairline); }
.input-options label.is-selected { border-color: var(--hairline-focus); background: var(--control-active); }
.input-options strong { display: block; font-weight: 500; }
.input-options small { display: block; margin-top: 5px; color: var(--mute); font-size: 10px; }
input[type='checkbox'] { flex: none; width: 14px; height: 14px; margin: 0; accent-color: var(--accent-soft); }
button, select { box-sizing: border-box; min-height: 32px; border: 1px solid var(--divider); border-radius: var(--radius-xs); padding: 6px 10px; background: var(--surface-1); color: var(--ink); font: inherit; font-size: 12px; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
button svg { width: 16px; height: 16px; }
button:hover:not(:disabled), select:hover:not(:disabled) { border-color: var(--hairline); background: var(--control-hover); }
button:disabled, input:disabled, select:disabled { opacity: .45; cursor: default; }
button.primary { border-color: transparent; background: var(--accent-soft); color: var(--on-accent); }
button.primary:hover:not(:disabled) { background: var(--accent-bright); }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; }
.task-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid var(--divider); background: var(--surface-3); }
.task-actions > span { margin-right: auto; color: var(--mute); font-size: 11px; }
.task-actions button { min-height: 34px; }
.task-progress { margin-top: 16px; padding: 20px; border: 1px solid var(--divider); border-radius: var(--radius-md); background: var(--surface-3); }
.task-progress > div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; }
.task-progress strong { font-weight: 500; }
.task-progress span { color: var(--mute); }
.task-progress progress { display: block; width: 100%; height: 5px; margin-top: 16px; accent-color: var(--accent-soft); }
.task-message { margin: 16px 0; padding: 12px 16px; border-left: 2px solid var(--hairline-focus); background: var(--surface-3); color: var(--body); line-height: 1.7; overflow-wrap: anywhere; }
.notice { margin: 16px 0; color: var(--body); line-height: 1.7; }
.error, .failures { color: var(--error); }
.task-message.error { border-color: var(--error-hairline); }
.candidate-review { margin-top: 20px; padding: 24px; }
.result-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding-bottom: 20px; border-bottom: 1px solid var(--divider); }
.result-toolbar h3 { font-size: 18px; }
.result-toolbar span { display: block; margin-top: 6px; color: var(--mute); font-size: 11px; }
.failures { padding-left: 20px; line-height: 1.8; }
.audition-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 20px 0; }
.audition-tools > span { flex-basis: 100%; margin-bottom: 4px; color: var(--body); }
.thresholds { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px 0; margin-bottom: 8px; border-top: 1px solid var(--divider); }
.thresholds label { display: flex; align-items: center; gap: 8px; color: var(--body); }
.thresholds label .app-number-input { --app-control-width: 100px; }
.thresholds small { color: var(--mute); font-size: 11px; }
.review-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 20px 0 12px; }
.review-filters label { display: flex; align-items: center; gap: 8px; color: var(--body); }
.review-pagination { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-left: auto; }
.review-pagination > span { color: var(--mute); font-size: 11px; }
.candidate-table { max-height: 520px; overflow: auto; overscroll-behavior: contain; border: 1px solid var(--divider); border-radius: var(--radius-sm); }
table { border-collapse: collapse; width: 100%; text-align: left; white-space: nowrap; font-size: 12px; }
th { position: sticky; top: 0; z-index: 1; background: var(--surface-3); color: var(--mute); font-size: 11px; font-weight: 500; }
td, th { padding: 12px; border-bottom: 1px solid var(--divider); }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: var(--surface-chip); }
td small { display: block; margin-top: 4px; color: var(--mute); font-size: 10px; }
td small.duplicate-hint { color: var(--warning); }
.candidate-time { font-variant-numeric: tabular-nums; }
.candidate-kind { color: var(--accent-soft); }
.seek-candidate { width: 30px; min-height: 30px; padding: 6px; }
.deleted { opacity: .45; }
.empty-filter { padding: 0 16px; }
.candidate-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 176px; padding: 24px; margin: 20px 0; text-align: center; }
.candidate-empty > svg { width: 28px; height: 28px; margin-bottom: 16px; color: var(--mute); }
.candidate-empty h3 { font-size: 14px; color: var(--body); }
.candidate-empty p { margin: 8px 0 0; color: var(--mute); line-height: 1.7; }
.cache-panel { margin-top: 20px; padding: 20px 24px; }
.cache-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.cache-tools > div { margin-right: auto; }
.cache-tools p { margin: 6px 0 0; color: var(--mute); font-size: 11px; line-height: 1.7; }
.cache-confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--divider); }
.cache-confirm > span { flex: 1 1 240px; color: var(--body); line-height: 1.7; }
@media (max-width: 700px) {
    .intro-heading { padding: 20px; gap: 12px; }
    .input-section { padding: 0 20px 20px; }
    .task-actions { padding: 16px 20px; }
    .candidate-review { padding: 16px; }
    .review-pagination { width: 100%; margin-left: 0; }
    .review-pagination > span { margin-right: auto; }
    .cache-panel { padding: 20px; }
    .cache-tools > div { flex-basis: 100%; margin-bottom: 8px; }
}
</style>
