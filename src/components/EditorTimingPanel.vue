<template>
    <section class="editor-timing-panel" data-testid="editor-timing-panel" aria-label="手动定时">
        <div class="timing-list">
            <header><h3>Tempo 区间</h3><button type="button" @click="selectCurrent">定位播放区间</button></header>
            <div class="timing-rows app-scrollbar" role="list" aria-label="Tempo 区间列表">
                <div v-for="(segment,index) in project.tempoMap" :key="segment.id" class="timing-row" :class="{ selected: segment.id === selected.id }" role="listitem">
                    <button type="button" class="timing-select" :aria-pressed="segment.id === selected.id" :data-testid="`timing-select-${index}`" @click="emit('select',segment.id)">
                        <span>{{ timestamp(segment.startSeconds) }}</span><span>{{ segment.mode === 'metered' ? `${segment.bpm ?? '—'} BPM` : '单拍' }}</span><span>{{ segment.mode === 'metered' ? `${segment.meter.numerator}/${segment.meter.denominator}` : '—' }}</span>
                    </button>
                    <button type="button" :aria-label="`跳转区间 ${index + 1}`" @click="emit('seek',segment.startSeconds)">↗</button>
                </div>
            </div>
            <footer><button type="button" data-testid="timing-add-boundary" @click="add">在播放位置新增</button><button type="button" :disabled="selectedIndex === 0" data-testid="timing-delete-boundary" @click="remove">删除边界</button></footer>
        </div>
        <aside class="timing-assistant" aria-label="BPM 辅助标记">
            <header><h3>BPM 辅助标记</h3><span>{{ selectedIndex + 1 }} / {{ project.tempoMap.length }}</span></header>
            <div class="beat-phase" aria-label="当前区间节拍位置">
                <i v-for="beat in beatCount" :key="beat" :class="{ active: phase === beat - 1, downbeat: beat === 1 }" />
                <span>{{ selected.mode === 'metered' && selected.bpm !== null ? `${selected.bpm} BPM` : '尚无节拍网格' }}</span>
            </div>
            <label class="timing-field"><span>起点（毫秒）</span><AppNumberInput :model-value="selected.startSeconds * 1000" label="辅助区间起点（毫秒）" :step="1" :disabled="selectedIndex === 0" @update:model-value="setStart" /></label>
            <template v-if="selected.mode === 'metered'">
                <label class="timing-field"><span>BPM</span><AppNumberInput :model-value="selected.bpm ?? 100" :empty="selected.bpm === null" label="辅助 BPM" :step=".1" placeholder="100" @update:model-value="setBpm" /></label>
                <div class="timing-field"><span>拍号</span><div class="meter-fields"><AppNumberInput :model-value="selected.meter.numerator" label="辅助拍号分子" :min="1" :max="32" @update:model-value="setMeter($event,selected.mode === 'metered' ? selected.meter.denominator : 4)" /><span>/</span><AppSelect :model-value="selected.meter.denominator" label="辅助拍号分母" :options="denominators" @update:model-value="setMeter(selected.mode === 'metered' ? selected.meter.numerator : 4,Number($event))" /></div></div>
            </template>
            <button v-else type="button" @click="restoreMetered">设置为 100 BPM · 4/4</button>
            <div class="tap-controls">
                <button type="button" class="tap-button" data-testid="timing-tap" @click="tap" @keydown="tapKey">点按节拍<span>{{ tapped.count ? `${tapped.count} 次` : 'Tap' }}</span></button>
                <div class="tap-result"><strong data-testid="timing-tap-preview">{{ tapped.bpm === null ? '点按 8 次后预览' : `${tapped.bpm} BPM` }}</strong><span v-if="tapped.bpm !== null && !validTap" class="error">BPM 必须在 20–300 之间</span><div><button type="button" data-testid="timing-apply-tap" :disabled="!validTap" @click="applyTap">应用到当前区间</button><button type="button" @click="resetTap">重置</button></div></div>
            </div>
            <p v-if="message" :class="{ error: failed }" role="status" data-testid="timing-status">{{ message }}</p>
        </aside>
    </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AppSelect from './controls/AppSelect.vue';
import AppNumberInput from './controls/AppNumberInput.vue';
import { applyBpmInput, applyMeterInput, insertTempoBoundary, moveTempoBoundary, removeTempoBoundary, segmentAtTime } from '../editor/tempoMap';
import { normalizeEditorSeconds } from '../editor/projectCodec';
import { TapTempoEstimator } from '../editor/tapTempo';
import type { EditorProjectV1, MeterDenominator, TempoSegmentV1 } from '../editor/types';
import type { PlaybackSnapshot } from '../types/audio';
const props = defineProps<{ project: EditorProjectV1; playback: PlaybackSnapshot; selectedId: string | null }>();
const emit = defineEmits<{ select: [id: string]; seek: [seconds: number]; updateProject: [project: EditorProjectV1, immediate: boolean] }>();
const selectedIndex = computed(() => Math.max(0, props.project.tempoMap.findIndex(segment => segment.id === props.selectedId)));
const selected = computed(() => props.project.tempoMap[selectedIndex.value]!);
const denominators = [1, 2, 4, 8, 16, 32].map(value => ({ value, label: String(value) }));
const beatCount = computed(() => selected.value.mode === 'metered' ? selected.value.meter.numerator : 1);
const phase = computed(() => {
    const segment = selected.value, time = props.playback.currentTimeSeconds - segment.startSeconds;
    const end = props.project.tempoMap[selectedIndex.value + 1]?.startSeconds ?? props.project.track.durationSeconds;
    return segment.mode === 'metered' && segment.bpm !== null && time >= 0 && props.playback.currentTimeSeconds < end
        ? Math.floor(time / (60 / segment.bpm)) % segment.meter.numerator : -1;
});
const message = ref(''), failed = ref(false);
const estimator = new TapTempoEstimator(), tapped = ref<{ count: number; bpm: number | null }>({ count: 0, bpm: null });
const validTap = computed(() => tapped.value.bpm !== null && tapped.value.bpm >= 20 && tapped.value.bpm <= 300);
let timer: ReturnType<typeof setTimeout> | null = null;
function resetTap() { if (timer) clearTimeout(timer); timer = null; estimator.reset(); tapped.value = { count: 0, bpm: null }; }
function tap() { tapped.value = estimator.tap(performance.now()); if (timer) clearTimeout(timer); timer = setTimeout(resetTap, 4000); }
function tapKey(event: KeyboardEvent) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault(); if (!event.repeat) tap();
}
const timestamp = (time: number) => `${Math.floor(time / 60)}:${(time % 60).toFixed(3).padStart(6, '0')}`;
function publish(tempoMap: TempoSegmentV1[], text: string) { emit('updateProject', { ...props.project, tempoMap }, true); failed.value = false; message.value = text; }
function replace(segment: TempoSegmentV1, text: string) { publish(props.project.tempoMap.map(item => item.id === segment.id ? segment : item), text); }
function fail(text: string) { failed.value = true; message.value = text; }
function selectCurrent() { emit('select', segmentAtTime(props.project.tempoMap, props.playback.currentTimeSeconds).id); }
function add() {
    const time = normalizeEditorSeconds(props.playback.currentTimeSeconds);
    const map = insertTempoBoundary(props.project.tempoMap, time, () => crypto.randomUUID());
    if (map.length === props.project.tempoMap.length || time >= props.project.track.durationSeconds) { fail('请选择歌曲内尚无边界的位置。'); return; }
    publish(map, '已新增 Tempo 边界。'); emit('select', map.find(segment => segment.startSeconds === time)!.id);
}
function remove() {
    if (selectedIndex.value === 0) return;
    const previous = props.project.tempoMap[selectedIndex.value - 1]!;
    publish(removeTempoBoundary(props.project.tempoMap, selected.value.id), '已删除边界，前一区间向右延伸。'); emit('select', previous.id);
}
function setStart(milliseconds: number) {
    if (selectedIndex.value === 0) return;
    const time = normalizeEditorSeconds(milliseconds / 1000);
    const previous = props.project.tempoMap[selectedIndex.value - 1]!.startSeconds;
    const next = props.project.tempoMap[selectedIndex.value + 1]?.startSeconds ?? props.project.track.durationSeconds;
    if (!Number.isFinite(time) || time <= previous || time >= next) { fail('起点必须位于相邻边界之间。'); return; }
    publish(moveTempoBoundary(props.project.tempoMap, selected.value.id, time, props.project.track.durationSeconds), '区间起点已保存。');
}
function setBpm(value: number) {
    const result = applyBpmInput(selected.value, String(value));
    if (!result.ok) { fail(result.message); return; }
    replace(result.segment, 'BPM 已保存，已有标记时间保持不变。');
}
function setMeter(numerator: number, denominator: number) {
    const result = applyMeterInput(selected.value, numerator, denominator as MeterDenominator);
    if (!result.ok) { fail(result.message); return; }
    replace(result.segment, '拍号已保存。');
}
function restoreMetered() { replace({ id: selected.value.id, startSeconds: selected.value.startSeconds, mode: 'metered', bpm: 100, bpmSource: 'user', meter: { numerator: 4, denominator: 4 } }, '已设置为 100 BPM · 4/4。'); }
function applyTap() {
    if (!validTap.value) return;
    const base = selected.value.mode === 'metered' ? selected.value : { id: selected.value.id, startSeconds: selected.value.startSeconds, mode: 'metered' as const, bpm: null, bpmSource: 'unset' as const, meter: { numerator: 4, denominator: 4 as const } };
    const result = applyBpmInput(base, String(tapped.value.bpm));
    if (result.ok) replace(result.segment, '点按 BPM 已应用，已有标记时间保持不变。');
}
watch(() => [selected.value.id, props.project.projectId], () => { resetTap(); message.value = ''; failed.value = false; });
onBeforeUnmount(resetTap);
</script>
<style scoped>
.editor-timing-panel { display:grid; grid-template-columns:minmax(220px,1fr) 350px; border-top:1px solid var(--divider); background:#080e0b; font-size:12px; }
header { display:flex; align-items:center; justify-content:space-between; min-height:42px; padding:6px 14px; border-bottom:1px solid var(--divider); gap:8px; }
h3 { margin:0; font-size:12px; font-weight:500; } header>span { color:var(--muted); font-size:11px; }
.timing-list { min-width:0; display:flex; flex-direction:column; }
.timing-rows { overflow:auto; max-height:280px; flex:1; min-height:100px; }
.timing-row { display:flex; align-items:center; border-left:2px solid transparent; border-bottom:1px solid var(--divider); }
.timing-row.selected { border-left-color:var(--accent-soft); background:var(--control-active); }
.timing-select { display:grid; grid-template-columns:minmax(70px,1fr) minmax(75px,1fr) 40px; gap:8px; flex:1; text-align:left; padding:10px 12px; background:transparent; border:0; font-variant-numeric:tabular-nums; }
footer { display:flex; gap:8px; padding:12px 14px; border-top:1px solid var(--divider); }
.timing-assistant { border-left:1px solid var(--divider); min-width:0; padding-bottom:12px; }
.timing-field { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:38px; margin:4px 14px; color:var(--body); }
.timing-field :deep(.app-number-input),.timing-field :deep(.app-select) { width:150px; font-size:12px; }
.meter-fields { display:flex; align-items:center; gap:6px; width:150px; }
.meter-fields :deep(.app-number-input),.meter-fields :deep(.app-select) { width:64px; }
.beat-phase { display:flex; align-items:center; flex-wrap:wrap; gap:4px; padding:14px; min-height:16px; }
.beat-phase i { width:7px; height:7px; border-radius:50%; background:var(--divider); }
.beat-phase i.active { background:var(--accent-soft); box-shadow:0 0 8px #86edb54d; }
.beat-phase i.downbeat { width:10px; height:10px; }
.beat-phase span { margin-left:auto; font-size:11px; color:var(--muted); }
.tap-controls { display:flex; gap:12px; padding:14px 14px 4px; align-items:center; border-top:1px solid var(--divider); margin-top:12px; }
.tap-button { display:flex; flex:none; flex-direction:column; align-items:center; justify-content:center; gap:6px; border-radius:50%; width:78px; height:78px; border-color:var(--hairline-focus); color:var(--accent-soft); }
.tap-button span { font-size:10px; color:var(--muted); }.tap-button:active { background:var(--control-active); }
.tap-result { display:grid; gap:10px; min-width:0; }.tap-result strong { font-weight:500; font-variant-numeric:tabular-nums; }.tap-result>div { display:flex; gap:5px; flex-wrap:wrap; }
button { min-height:28px; padding:4px 8px; border:1px solid var(--divider); border-radius:4px; color:var(--body); background:var(--editor-control); font:inherit; cursor:pointer; }
button:hover:not(:disabled) { background:var(--control-active); color:var(--ink); }button:focus-visible { outline:2px solid var(--accent-soft); outline-offset:2px; }button:disabled { opacity:.35; cursor:default; }
p { margin:8px 14px 0; font-size:11px; line-height:1.6; color:var(--body); }.error { color:var(--error); font-size:11px; }
@media(max-width:900px) { .editor-timing-panel { grid-template-columns:minmax(0,1fr); }.timing-assistant { border-left:0; border-top:1px solid var(--divider); } }
@media(prefers-reduced-motion:reduce) { .beat-phase i.active { box-shadow:none; } }
</style>
