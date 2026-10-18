<template>
    <div ref="surface" class="marker-surface" :class="{ 'is-readonly': !view.editable, 'is-block-mode': editing.blocks.mode.value }"
        :data-testid="`${lane.eventKind === 'point' ? 'marker' : 'range'}-surface-${lane.id}-${innerClassId}`"
        :data-candidate-seconds="currentCandidate?.timeSeconds" :data-view-start="view.startSeconds" :data-view-end="view.endSeconds"
        :data-lane-id="lane.id" :data-inner-class-id="innerClassId" tabindex="0" role="application"
        :aria-label="`${lane.name} 标记区域；暂停后在播放线右侧编辑，回车创建，右键标记删除`"
        @focus="editing.focus(row, surface?.clientWidth ?? 0)" @keydown="editing.key($event,row)"
        @pointerdown="editing.down($event,row)" @pointermove="editing.move($event,row)" @pointerup="editing.up"
        @pointercancel="editing.cancel" @lostpointercapture="editing.cancel" @contextmenu="editing.context($event,row)" @dragstart.prevent>
        <canvas ref="canvas" class="marker-grid-canvas" aria-hidden="true" />
        <span v-if="block" class="marker-block-selection" :class="{ 'is-preview': editing.blocks.preview.value }" :style="intervalStyle(block.startSeconds,block.endSeconds)" aria-hidden="true" />
        <span v-if="currentCandidate" class="marker-candidate" :style="{ left: percent(currentCandidate.timeSeconds) }" aria-hidden="true" />
        <span v-if="pendingPreview" class="marker-pending-preview" :style="intervalStyle(pendingPreview.start,pendingPreview.end)" aria-hidden="true" />
        <template v-for="event in events" :key="event.id">
            <button v-if="'atSeconds' in event" type="button" class="marker-event marker-point" :class="{ selected: editing.selected.value === event.id }"
                :style="{ left:percent(event.atSeconds) }" :data-testid="`point-marker-${event.id}`" :data-event-id="event.id" :data-time-seconds="event.atSeconds"
                :tabindex="markerEventReachable(view,event) ? 0 : -1" :aria-label="`点标记 ${event.atSeconds.toFixed(3)} 秒`" :title="`${event.atSeconds.toFixed(3)} 秒`" @focus="selectEvent(event)" />
            <template v-else>
                <button type="button" class="marker-event marker-range" :class="{ selected: editing.selected.value === event.id }"
                    :style="intervalStyle(event.startSeconds,event.endSeconds)" :data-testid="`range-marker-${event.id}`" :data-event-id="event.id"
                    :data-start-seconds="event.startSeconds" :data-end-seconds="event.endSeconds" :tabindex="markerEventReachable(view,event) ? 0 : -1"
                    :aria-label="`范围 ${event.startSeconds.toFixed(3)} 至 ${event.endSeconds.toFixed(3)} 秒`" :title="`${event.startSeconds.toFixed(3)} — ${event.endSeconds.toFixed(3)} 秒`" @focus="selectEvent(event)" />
                <button v-for="endpoint in (['start','end'] as const)" v-show="markerEventReachable(view,event) && endpointVisible(endpoint === 'start' ? event.startSeconds : event.endSeconds)" :key="endpoint"
                    type="button" class="marker-endpoint" :class="{ selected: editing.selected.value === event.id }" :style="{ left:percent(endpoint === 'start' ? event.startSeconds : event.endSeconds) }"
                    :data-testid="`range-${endpoint}-handle-${event.id}`" :data-event-id="event.id" :data-endpoint="endpoint"
                    :aria-label="`${endpoint === 'start' ? '起点' : '终点'} ${event.id}`" :title="`${endpoint === 'start' ? '起点' : '终点'} ${(endpoint === 'start' ? event.startSeconds : event.endSeconds).toFixed(3)} 秒`" @focus="selectEvent(event)" />
            </template>
        </template>
        <span v-if="editing.preview.value?.error && editing.same(editing.drag.value,row)" class="marker-move-hint" role="status">{{ editing.preview.value.error }}</span>
    </div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { markerEventReachable, type MarkerTimeView } from '../editor/markerTimeView';
import { useMarkerSurfaceDrawing } from '../editor/useMarkerSurfaceDrawing';
import type { MarkerEditing } from '../editor/useMarkerEditing';
import type { MarkerDrawing } from '../editor/markerDrawing';
import type { EditorBeatSnapSetting } from '../editor/beatSnap';
import type { EditorLaneV1, EditorProjectV1, PointEventV1, RangeEventV1 } from '../editor/types';
const props = defineProps<{ project: EditorProjectV1; lane: EditorLaneV1; innerClassId: string; view: MarkerTimeView; setting: EditorBeatSnapSetting; editing: MarkerEditing; drawing: MarkerDrawing }>();
const surface = ref<HTMLElement | null>(null), canvas = ref<HTMLCanvasElement | null>(null);
const row = computed(() => ({ laneId: props.lane.id, innerClassId: props.innerClassId }));
const visible = useMarkerSurfaceDrawing(surface, canvas, () => props.project, () => props.view, () => props.setting, props.drawing);
const percent = (time: number) => `${(time - props.view.startSeconds) / props.view.spanSeconds * 100}%`;
const intervalStyle = (start: number, end: number) => ({ left:percent(Math.max(props.view.startSeconds,start)), width:`${Math.max(0,Math.min(props.view.endSeconds,end) - Math.max(props.view.startSeconds,start)) / props.view.spanSeconds * 100}%` });
const currentCandidate = computed(() => props.editing.same(props.editing.candidate.value,row.value) ? props.editing.candidate.value : null);
const block = computed(() => { const selection = props.editing.blocks.preview.value ?? props.editing.blocks.selection.value; return props.editing.same(selection,row.value) ? selection : null; });
const pendingPreview = computed(() => {
    const pending = props.editing.pending.value, candidate = currentCandidate.value;
    return props.editing.same(pending,row.value) && candidate && candidate.timeSeconds > pending!.startSeconds ? { start:pending!.startSeconds,end:candidate.timeSeconds } : null;
});
const events = computed(() => !visible.value ? [] : props.lane.events.filter(event => event.innerClassId === props.innerClassId).map(event => props.editing.displayEvent(event)).filter(event => 'atSeconds' in event
    ? event.atSeconds >= props.view.startSeconds && event.atSeconds <= props.view.endSeconds
    : event.endSeconds > props.view.startSeconds && event.startSeconds < props.view.endSeconds));
watch(events,next=>{
    const focused = document.activeElement as HTMLElement | null;
    if (focused?.closest('.marker-surface') === surface.value && focused?.dataset.eventId && !next.some(event=>event.id === focused.dataset.eventId)) {
        void nextTick(()=>surface.value?.focus({preventScroll:true}));
    }
});
const endpointVisible = (time: number) => props.view.editable && time >= props.view.cursorSeconds && time <= Math.min(props.view.endSeconds,props.view.durationSeconds);
function selectEvent(event: PointEventV1 | RangeEventV1) { if (markerEventReachable(props.view,event)) props.editing.selected.value = event.id; }
</script>
<style scoped>
.marker-surface { position:relative; height:48px; min-width:0; overflow:hidden; background:#0c1511; cursor:crosshair; touch-action:none; user-select:none; }
.marker-surface::before { content:''; position:absolute; z-index:7; inset:0 auto 0 0; width:15%; background:#0004; pointer-events:none; }
.marker-surface::after { content:''; position:absolute; z-index:8; top:0; bottom:0; left:15%; width:1px; background:#b7dfcf; pointer-events:none; }
.marker-surface.is-readonly { cursor:default; }.marker-surface.is-block-mode { cursor:cell; }
.marker-surface:focus-visible { outline:1px solid var(--accent-soft); outline-offset:-1px; }
.marker-grid-canvas { position:absolute; width:100%; height:100%; inset:0; pointer-events:none; }
.marker-event { position:absolute; z-index:4; top:50%; height:16px; min-height:0; padding:0; border:0; border-radius:2px; transform:translateY(-50%); cursor:ew-resize; }
.marker-point { width:10px; background:#9cceb7; transform:translate(-50%,-50%); }
.marker-range { min-width:2px; background:#789bb2; }
.marker-event:is(:hover,:focus-visible,.selected) { outline:2px solid #c7eee0; outline-offset:2px; }
.marker-endpoint { position:absolute; top:50%; z-index:6; width:10px; height:24px; padding:0; border:0; border-radius:2px; background:#c0d0df; opacity:0; transform:translate(-50%,-50%); cursor:ew-resize; }
.marker-surface:hover .marker-endpoint,.marker-endpoint:is(:focus-visible,.selected) { opacity:.9; }
.marker-endpoint:focus-visible { outline:2px solid var(--accent-soft); outline-offset:1px; }
.marker-candidate { position:absolute; top:8px; bottom:8px; width:1px; background:var(--accent-soft); opacity:.6; pointer-events:none; }
.marker-block-selection { position:absolute; inset-block:2px; z-index:2; background:#96b9d426; border-block:1px solid #96b9d499; pointer-events:none; }
.marker-block-selection.is-preview { border-style:dashed; }
.marker-pending-preview { position:absolute; z-index:3; top:16px; height:16px; border:1px dashed #a8c6dd; background:#789bb244; pointer-events:none; }
.marker-move-hint { position:absolute; z-index:10; right:4px; top:1px; max-width:90%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; padding:2px 4px; color:var(--error); background:var(--surface-2); font-size:10px; }
</style>
