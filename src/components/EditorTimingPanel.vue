<template>
    <section class="editor-timing-panel app-scrollbar" data-testid="editor-timing-panel" aria-label="BPM 设置">
        <div class="timing-list">
            <header>
                <h3>Tempo 区间</h3>
                <button type="button" @click="selectCurrent">定位播放区间</button>
            </header>
            <div class="timing-rows app-scrollbar" role="list" aria-label="Tempo 区间列表">
                <div
                    v-for="(segment, index) in project.tempoMap"
                    :key="segment.id"
                    class="timing-row"
                    :class="{ selected: segment.id === selected.id }"
                    role="listitem">
                    <button
                        type="button"
                        class="timing-select"
                        :aria-pressed="segment.id === selected.id"
                        :data-testid="`timing-select-${index}`"
                        @click="emit('select', segment.id)">
                        <span>{{ timestamp(segment.startSeconds) }}</span
                        ><span>{{ segment.mode === 'metered' ? `${segment.bpm ?? '—'} BPM` : '单拍' }}</span>
                    </button>
                    <button
                        type="button"
                        class="timing-seek"
                        :aria-label="`跳转区间 ${index + 1}`"
                        @click="emit('seek', segment.startSeconds)">
                        ↗
                    </button>
                </div>
            </div>
            <footer>
                <button type="button" data-testid="timing-add-boundary" @click="add">在播放位置新增</button
                ><button
                    type="button"
                    :disabled="selectedIndex === 0"
                    data-testid="timing-delete-boundary"
                    @click="remove">
                    删除边界
                </button>
            </footer>
        </div>
        <aside class="timing-assistant" aria-label="BPM 辅助标记">
            <header>
                <h3>当前区间</h3>
                <span>{{ selectedIndex + 1 }} / {{ project.tempoMap.length }}</span>
            </header>
            <label class="timing-field"
                ><span>起点（毫秒）</span
                ><AppNumberInput
                    :model-value="selected.startSeconds * 1000"
                    label="辅助区间起点（毫秒）"
                    :step="1"
                    :disabled="selectedIndex === 0"
                    @update:model-value="setStart"
            /></label>
            <template v-if="selected.mode === 'metered'">
                <label class="timing-field"
                    ><span>BPM</span
                    ><AppNumberInput
                        :model-value="selected.bpm ?? 100"
                        :empty="selected.bpm === null"
                        label="辅助 BPM"
                        :step="0.1"
                        placeholder="100"
                        @update:model-value="setBpm"
                /></label>
            </template>
            <button v-else type="button" @click="restoreMetered">设置为 100 BPM</button>
        </aside>
        <div class="tap-controls">
            <h3>点按节拍</h3>
            <button type="button" class="tap-button" data-testid="timing-tap" @click="tap" @keydown="tapKey">
                点按节拍<span>{{ tapped.count ? `${tapped.count} 次` : 'Tap' }}</span>
            </button>
            <div class="tap-result">
                <strong data-testid="timing-tap-preview">{{
                    tapped.bpm === null ? '点按 8 次后预览' : `${tapped.bpm} BPM`
                }}</strong
                ><span v-if="tapped.bpm !== null && !validTap" class="error">BPM 必须在 20–300 之间</span>
                <div>
                    <button type="button" data-testid="timing-apply-tap" :disabled="!validTap" @click="applyTap">
                        应用到当前区间</button
                    ><button type="button" @click="resetTap">重置</button>
                </div>
            </div>
        </div>
        <p v-if="message" :class="{ error: failed }" role="status" data-testid="timing-status">{{ message }}</p>
    </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AppNumberInput from './controls/AppNumberInput.vue';
import {
    applyBpmInput,
    insertTempoBoundary,
    moveTempoBoundary,
    removeTempoBoundary,
    segmentAtTime,
} from '../editor/tempoMap';
import { normalizeEditorSeconds } from '../editor/projectCodec';
import { TapTempoEstimator } from '../editor/tapTempo';
import type { EditorProjectV1, TempoSegmentV1 } from '../editor/types';
import type { PlaybackSnapshot } from '../types/audio';
const props = defineProps<{ project: EditorProjectV1; playback: PlaybackSnapshot; selectedId: string | null }>();
const emit = defineEmits<{
    select: [id: string];
    seek: [seconds: number];
    updateProject: [project: EditorProjectV1, immediate: boolean];
}>();
const selectedIndex = computed(() =>
    Math.max(
        0,
        props.project.tempoMap.findIndex(segment => segment.id === props.selectedId),
    ),
);
const selected = computed(() => props.project.tempoMap[selectedIndex.value]!);
const message = ref(''),
    failed = ref(false);
const estimator = new TapTempoEstimator(),
    tapped = ref<{ count: number; bpm: number | null }>({ count: 0, bpm: null });
const validTap = computed(() => tapped.value.bpm !== null && tapped.value.bpm >= 20 && tapped.value.bpm <= 300);
let timer: ReturnType<typeof setTimeout> | null = null;
function resetTap() {
    if (timer) clearTimeout(timer);
    timer = null;
    estimator.reset();
    tapped.value = { count: 0, bpm: null };
}
function tap() {
    tapped.value = estimator.tap(performance.now());
    if (timer) clearTimeout(timer);
    timer = setTimeout(resetTap, 4000);
}
function tapKey(event: KeyboardEvent) {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) tap();
}
const timestamp = (time: number) => `${Math.floor(time / 60)}:${(time % 60).toFixed(3).padStart(6, '0')}`;
function publish(tempoMap: TempoSegmentV1[], text: string) {
    emit('updateProject', { ...props.project, tempoMap }, true);
    failed.value = false;
    message.value = text;
}
function replace(segment: TempoSegmentV1, text: string) {
    publish(
        props.project.tempoMap.map(item => (item.id === segment.id ? segment : item)),
        text,
    );
}
function fail(text: string) {
    failed.value = true;
    message.value = text;
}
function selectCurrent() {
    emit('select', segmentAtTime(props.project.tempoMap, props.playback.currentTimeSeconds).id);
}
function add() {
    const time = normalizeEditorSeconds(props.playback.currentTimeSeconds);
    const map = insertTempoBoundary(props.project.tempoMap, time, () => crypto.randomUUID());
    if (map.length === props.project.tempoMap.length || time >= props.project.track.durationSeconds) {
        fail('请选择歌曲内尚无边界的位置。');
        return;
    }
    publish(map, '已新增 Tempo 边界。');
    emit('select', map.find(segment => segment.startSeconds === time)!.id);
}
function remove() {
    if (selectedIndex.value === 0) return;
    const previous = props.project.tempoMap[selectedIndex.value - 1]!;
    publish(removeTempoBoundary(props.project.tempoMap, selected.value.id), '已删除边界，前一区间向右延伸。');
    emit('select', previous.id);
}
function setStart(milliseconds: number) {
    if (selectedIndex.value === 0) return;
    const time = normalizeEditorSeconds(milliseconds / 1000);
    const previous = props.project.tempoMap[selectedIndex.value - 1]!.startSeconds;
    const next = props.project.tempoMap[selectedIndex.value + 1]?.startSeconds ?? props.project.track.durationSeconds;
    if (!Number.isFinite(time) || time <= previous || time >= next) {
        fail('起点必须位于相邻边界之间。');
        return;
    }
    publish(
        moveTempoBoundary(props.project.tempoMap, selected.value.id, time, props.project.track.durationSeconds),
        '区间起点已保存。',
    );
}
function setBpm(value: number) {
    const result = applyBpmInput(selected.value, String(value));
    if (!result.ok) {
        fail(result.message);
        return;
    }
    replace(result.segment, 'BPM 已保存，已有标记时间保持不变。');
}
function restoreMetered() {
    replace(
        {
            id: selected.value.id,
            startSeconds: selected.value.startSeconds,
            mode: 'metered',
            bpm: 100,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        },
        '已设置为 100 BPM。',
    );
}
function applyTap() {
    if (!validTap.value) return;
    const base =
        selected.value.mode === 'metered'
            ? selected.value
            : {
                  id: selected.value.id,
                  startSeconds: selected.value.startSeconds,
                  mode: 'metered' as const,
                  bpm: null,
                  bpmSource: 'unset' as const,
                  meter: { numerator: 4, denominator: 4 as const },
              };
    const result = applyBpmInput(base, String(tapped.value.bpm));
    if (result.ok) replace(result.segment, '点按 BPM 已应用，已有标记时间保持不变。');
}
watch(
    () => [selected.value.id, props.project.projectId],
    () => {
        resetTap();
        message.value = '';
        failed.value = false;
    },
);
onBeforeUnmount(resetTap);
</script>
<style scoped>
.editor-timing-panel {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
    max-height: min(280px, 35cqh);
    overflow: auto;
    border-top: 1px solid var(--divider);
    background: #080e0b;
    font-size: 12px;
}
header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 42px;
    padding: 6px 14px;
    border-bottom: 1px solid var(--divider);
    gap: 8px;
}
h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
}
header > span {
    color: var(--muted);
    font-size: 11px;
}
.timing-list {
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.timing-rows {
    flex: 1;
    min-height: 0;
}
.timing-row {
    display: flex;
    align-items: center;
    border-left: 2px solid transparent;
    border-bottom: 1px solid var(--divider);
}
.timing-row.selected {
    border-left-color: var(--accent-soft);
    background: var(--control-active);
}
.timing-select {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    min-width: 0;
    gap: 8px;
    flex: 1;
    text-align: left;
    padding: 10px 12px;
    background: transparent;
    border: 0;
    font-variant-numeric: tabular-nums;
}
.timing-seek {
    flex: none;
    margin-right: 8px;
}
footer {
    display: flex;
    gap: 8px;
    padding: 12px 14px;
    border-top: 1px solid var(--divider);
}
.timing-assistant {
    border-left: 1px solid var(--divider);
    min-width: 0;
    padding-bottom: 12px;
}
.timing-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 38px;
    margin: 4px 14px;
    color: var(--body);
}
.timing-field :deep(.app-number-input),
.timing-field :deep(.app-select) {
    width: 150px;
    font-size: 12px;
}
.tap-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 14px;
    align-items: center;
    min-width: 0;
}
.tap-controls h3 {
    width: 100%;
    margin: 0 0 4px;
}
.tap-button {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 4px;
    width: 100%;
    height: 36px;
    border-color: var(--hairline-focus);
    color: var(--accent-soft);
}
.tap-button span {
    font-size: 10px;
    color: var(--muted);
}
.tap-button:active {
    background: var(--control-active);
}
.tap-result {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
}
.tap-result strong {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
}
.tap-result > div {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
}
button {
    min-height: 28px;
    padding: 4px 8px;
    border: 1px solid var(--divider);
    border-radius: 4px;
    color: var(--body);
    background: var(--editor-control);
    font: inherit;
    cursor: pointer;
}
button:hover:not(:disabled) {
    background: var(--control-active);
    color: var(--ink);
}
button:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 2px;
}
button:disabled {
    opacity: 0.35;
    cursor: default;
}
p {
    grid-column: 1/-1;
    margin: 8px 14px 0;
    font-size: 11px;
    line-height: 1.6;
    color: var(--body);
}
.error {
    color: var(--error);
    font-size: 11px;
}
@container (max-width:759px) {
    .editor-timing-panel {
        grid-template-columns: minmax(0, 1fr);
    }
    .timing-assistant,
    .tap-controls {
        border-left: 0;
        border-top: 1px solid var(--divider);
    }
}
@media (prefers-reduced-motion: reduce) {
    .beat-phase i.active {
        box-shadow: none;
    }
}
</style>
