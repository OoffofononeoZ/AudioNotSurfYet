<template>
    <div class="marker-ruler" data-testid="marker-ruler">
        <div class="ruler-management">
            时间 <span>{{ view.spanSeconds.toFixed(2) }} 秒</span>
        </div>
        <div
            class="marker-ruler-time"
            :class="{ 'is-dragging': dragging, 'is-disabled': !available }"
            data-testid="marker-ruler-time"
            :data-view-start="view.startSeconds"
            :data-view-end="view.endSeconds"
            :data-cursor-seconds="view.cursorSeconds"
            :data-dragging="dragging"
            :aria-disabled="!available"
            tabindex="0"
            role="group"
            aria-label="轨道时间；按住左键拖动刻度，左拖前进，右拖后退"
            @pointerdown="down"
            @pointermove="move"
            @pointerup="up"
            @pointercancel="cancel"
            @lostpointercapture="lostCapture"
            @dragstart.prevent>
            <span v-for="tick in ticks" :key="tick.time" :style="{ left: `${tick.ratio * 100}%` }"
                >{{ tick.time.toFixed(1) }}<i
            /></span>
            <b aria-hidden="true" />
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { MarkerTimeView } from '../editor/markerTimeView';
import { useAudioSessionService } from '../audio/audioSessionService';
import { MarkerRulerScrubber } from '../editor/markerRulerScrubber';
const props = defineProps<{ view: MarkerTimeView; active: boolean; trackId: string | null }>();
const emit = defineEmits<{ dragging: [value: boolean] }>();
const audio = useAudioSessionService();
const available = computed(() => props.active && Boolean(props.trackId) && !audio.playbackPolicy.state.exportLocked);
const dragging = ref(false),
    pointer = shallowRef<{ id: number; element: HTMLElement } | null>(null);
const scrubber = new MarkerRulerScrubber({
    available: () => available.value && props.trackId === audio.getPlaybackSnapshot().trackId,
    playback: () => audio.getPlaybackSnapshot(),
    seek: seconds => audio.seek(seconds),
    requestFrame: callback => requestAnimationFrame(callback),
    cancelFrame: id => cancelAnimationFrame(id),
    changed: value => {
        dragging.value = value;
        emit('dragging', value);
    },
});
function release() {
    const held = pointer.value;
    pointer.value = null;
    if (held?.element.hasPointerCapture(held.id)) held.element.releasePointerCapture(held.id);
}
function down(event: PointerEvent) {
    if (event.button !== 0 || pointer.value) return;
    const element = event.currentTarget as HTMLElement;
    if (!scrubber.begin(event.clientX, props.view.spanSeconds, element.getBoundingClientRect().width)) return;
    event.preventDefault();
    element.focus({ preventScroll: true });
    pointer.value = { id: event.pointerId, element };
    element.setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
    if (event.pointerId === pointer.value?.id) scrubber.move(event.clientX);
}
function up(event: PointerEvent) {
    if (event.button !== 0 || event.pointerId !== pointer.value?.id) return;
    scrubber.end(event.clientX);
    release();
}
function cancel() {
    scrubber.cancel();
    release();
}
function lostCapture() {
    if (pointer.value) cancel();
}
function escape(event: KeyboardEvent) {
    if (event.key === 'Escape' && scrubber.hasGesture) {
        event.preventDefault();
        cancel();
    }
}
function visibility() {
    if (document.hidden) cancel();
}
watch(() => [props.active, props.trackId, audio.playbackPolicy.state.exportLocked], cancel, { flush: 'sync' });
let unsubscribePlayback = () => {},
    unsubscribeDiscontinuity = () => {};
onMounted(() => {
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', escape);
    document.addEventListener('visibilitychange', visibility);
    unsubscribePlayback = audio.subscribePlayback(() => {
        scrubber.reconcile();
        if (!scrubber.hasGesture) release();
    });
    unsubscribeDiscontinuity = audio.subscribePlaybackDiscontinuity(() => {
        scrubber.discontinuity();
        if (!scrubber.hasGesture) release();
    });
});
onBeforeUnmount(() => {
    cancel();
    unsubscribePlayback();
    unsubscribeDiscontinuity();
    window.removeEventListener('blur', cancel);
    window.removeEventListener('keydown', escape);
    document.removeEventListener('visibilitychange', visibility);
});
const ticks = computed(() => {
    const view = props.view,
        step = view.spanSeconds > 5 ? 2 : view.spanSeconds > 2 ? 1 : 0.2;
    const ticks = [];
    for (
        let time = Math.ceil(Math.max(0, view.startSeconds) / step) * step;
        time <= Math.min(view.endSeconds, view.durationSeconds);
        time += step
    )
        ticks.push({ time, ratio: (time - view.startSeconds) / view.spanSeconds });
    return ticks;
});
</script>
<style scoped>
.marker-ruler {
    position: sticky;
    z-index: 20;
    top: 0;
    display: grid;
    grid-template-columns: var(--marker-management-width, 224px) minmax(180px, 1fr);
    min-width: 340px;
    height: 28px;
    background: #152019;
    border-bottom: 1px solid var(--hairline);
}
.ruler-management {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    color: var(--muted);
    font-size: 10px;
}
.marker-ruler-time {
    position: relative;
    overflow: hidden;
    color: var(--body);
    font:
        10px ui-monospace,
        monospace;
    cursor: grab;
    touch-action: none;
}
.marker-ruler-time.is-dragging {
    cursor: grabbing;
}
.marker-ruler-time.is-disabled {
    cursor: default;
}
.marker-ruler-time > span {
    position: absolute;
    top: 3px;
    transform: translateX(-50%);
}
.marker-ruler-time i {
    position: absolute;
    left: 50%;
    top: 15px;
    height: 8px;
    border-left: 1px solid var(--muted);
}
.marker-ruler-time b {
    position: absolute;
    left: 15%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: #b7dfcf;
}
.marker-ruler-time b::after {
    content: '';
    position: absolute;
    top: 0;
    left: -3px;
    border-top: 5px solid #b7dfcf;
    border-inline: 3px solid transparent;
}
</style>
