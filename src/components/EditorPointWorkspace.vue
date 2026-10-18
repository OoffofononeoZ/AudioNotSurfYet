<template>
    <section class="point-workspace" data-testid="editor-point-workspace" data-editor-major-region="true" aria-label="标记轨道">
        <header class="marker-toolbar">
            <h2>标记轨道</h2>
            <button ref="addButton" type="button" data-testid="add-marker-lane" :disabled="!editable" :aria-expanded="addMenu" aria-haspopup="menu" @click="addMenu = !addMenu">＋ 轨道</button>
            <button type="button" data-testid="toggle-block-mode" :class="{ active:editing.blocks.mode.value }" :disabled="!editable" :aria-pressed="editing.blocks.mode.value" @click="toggleBlock">区间操作</button>
            <span v-if="!view.editable" class="pause-status" data-testid="marker-playback-status">暂停后编辑</span>
            <span class="marker-span" data-testid="marker-span">{{ view.spanSeconds.toFixed(2) }} 秒</span>
        </header>
        <div class="marker-status" aria-live="polite" data-testid="point-workspace-status">
            <template v-if="editing.pending.value"><span data-testid="marker-pending">待完成范围 · 起点 {{ editing.pending.value.startSeconds.toFixed(3) }} 秒</span><button type="button" data-testid="cancel-pending-range" @click="editing.cancelPending">取消</button><span>{{ message }}</span></template>
            <span v-else>{{ message || preferenceMessage }}</span>
        </div>
        <EditorContextMenu v-if="addMenu" :anchor="addButton" :x="0" :y="30" test-id="editor-add-track-menu" :options="trackOptions" @action="addLane" @close="addMenu = false" />
        <div class="marker-scroll app-scrollbar" @wheel="wheel">
            <EditorMarkerRuler :view="view" />
            <div v-if="!project.lanes.length" class="empty-markers">还没有标记轨道，点击“＋轨道”开始。</div>
            <EditorMarkerLane v-for="lane in project.lanes" :key="lane.id" :project="project" :lane="lane" :view="view" :editable="editable" :setting="setting" :editing="editing" :drawing="drawing" @update-project="applyProject" @status="message = $event" />
        </div>
        <EditorContextMenu v-if="editing.menu.value" :anchor="editing.menu.value.element" :x="editing.menu.value.x" :y="editing.menu.value.y" :test-id="`editor-${editing.menu.value.kind}-menu`" @action="navigateMenu" @close="editing.menu.value = null" />
        <EditorAnalysisOverlay v-if="active !== false" :project="project" :time-view="view" :drawing="drawing" :playback="playback" :analysis="analysis" :series="overlaySeries" :exact-value="overlayExactValue" :overlay-open="overlayOpen"
            @update-project="emit('updateProject',$event,true)" @toggle="emit('toggleOverlay',$event)" @select-feature="emit('selectOverlayFeature',$event)" @retry="emit('retryOverlay')" />
    </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import EditorMarkerLane from './EditorMarkerLane.vue';
import EditorMarkerRuler from './EditorMarkerRuler.vue';
import EditorAnalysisOverlay from './EditorAnalysisOverlay.vue';
import EditorContextMenu from './EditorContextMenu.vue';
import { useAudioSessionService } from '../audio/audioSessionService';
import { useEditorGrid } from '../editor/useEditorGrid';
import { useMarkerTimeView } from '../editor/useMarkerTimeView';
import { useMarkerEditing } from '../editor/useMarkerEditing';
import { createMarkerDrawing } from '../editor/markerDrawing';
import { createPointLane } from '../editor/pointAnnotations';
import { createRangeLane } from '../editor/rangeAnnotations';
import type { EditorProjectV1 } from '../editor/types';
import type { PlaybackSnapshot } from '../types/audio';
import type { AnalysisCoordinatorSnapshot, AnalysisCursorValueResult, AnalysisSeries, FeatureId } from '../analysis/types';
const props = defineProps<{ active?: boolean; project: EditorProjectV1; playback: PlaybackSnapshot; analysis: AnalysisCoordinatorSnapshot; overlaySeries: AnalysisSeries | null; overlayExactValue: AnalysisCursorValueResult | null; overlayOpen: boolean }>();
const emit = defineEmits<{ updateProject: [project: EditorProjectV1, immediate: boolean]; retryOverlay: []; toggleOverlay: [enabled: boolean]; selectOverlayFeature: [featureId: FeatureId] }>();
const audioSession = useAudioSessionService();
const { setting } = useEditorGrid();
const { view, message:preferenceMessage, zoom } = useMarkerTimeView(() => props.project.track.contentHash, () => props.project.track.durationSeconds, () => props.playback);
const editable = computed(() => props.active !== false && view.value.editable);
const message = ref(''), addMenu = ref(false), addButton = ref<HTMLButtonElement | null>(null);
const drawing = createMarkerDrawing();
const trackOptions = [{ id:'point',label:'点标记',testId:'add-point-lane' }, { id:'range',label:'范围标记',testId:'add-range-lane' }];
function applyProject(value: EditorProjectV1) { if (editable.value) emit('updateProject',value,true); }
const editing = useMarkerEditing(() => props.project, () => view.value, () => props.active !== false, () => setting.value, applyProject, value => message.value = value);
function addLane(kind: string) { if (editable.value) applyProject((kind === 'range' ? createRangeLane : createPointLane)(props.project)); }
function toggleBlock() { editing.cancel(); editing.cancelPending(); editing.blocks.toggle(); }
function wheel(event: WheelEvent) {
    if (event.ctrlKey || event.metaKey || !(event.target as HTMLElement).closest('.marker-surface,.marker-ruler-time,.marker-lane-time-header')) return;
    event.preventDefault(); if (!editing.drag.value) zoom(event.deltaY);
}
function navigateMenu(action: string) {
    const time = editing.menu.value?.time; editing.menu.value = null;
    if (time === undefined) return;
    void audioSession.seek(time).then(() => action === 'play' && props.playback.state !== 'playing' ? audioSession.togglePlayback() : undefined);
}
function escape(event: KeyboardEvent) { if (props.active !== false && event.key === 'Escape') { editing.cancel(); editing.cancelPending(); editing.blocks.clear(); addMenu.value = false; } }
watch(editable, () => { addMenu.value = false; });
onMounted(() => window.addEventListener('keydown',escape));
onBeforeUnmount(() => { drawing.dispose(); window.removeEventListener('keydown',escape); });
</script>
<style scoped>
.point-workspace { --marker-management-width:224px; display:flex; flex:1; flex-direction:column; min-height:0; min-width:0; overflow:hidden; background:var(--canvas); }
.marker-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:8px; padding:6px 14px; min-height:42px; background:var(--surface-2); }
.marker-toolbar h2 { margin:0 8px 0 0; font-size:12px; font-weight:500; }
.marker-toolbar button,.marker-status button { min-height:28px; padding:4px 10px; border:1px solid transparent; border-radius:4px; color:var(--body); background:var(--editor-control); font-size:12px; cursor:pointer; }
.marker-toolbar button.active { border-color:var(--accent-soft); color:var(--accent-soft); background:var(--control-active); }
button:focus-visible { outline:2px solid var(--accent-soft); outline-offset:1px; }button:disabled { opacity:.35; cursor:default; }
.marker-span { margin-left:auto; font:11px ui-monospace,monospace; color:var(--muted); }.pause-status { color:var(--body); font-size:11px; }
.marker-status { display:flex; align-items:center; flex-wrap:wrap; gap:8px; min-height:24px; padding:0 14px; color:var(--muted); font-size:11px; }
.marker-status button { min-height:22px; padding:1px 6px; }
.marker-scroll { flex:1; min-height:0; overflow:auto; overscroll-behavior:contain; }
.empty-markers { padding:36px 20px; text-align:center; color:var(--muted); font-size:12px; }
@container(max-width:700px) { .point-workspace { --marker-management-width:160px; } }
</style>
