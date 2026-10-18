<template>
    <div class="marker-ruler" data-testid="marker-ruler">
        <div class="ruler-management">时间 <span>{{ view.spanSeconds.toFixed(2) }} 秒</span></div>
        <div class="marker-ruler-time" data-testid="marker-ruler-time" :data-view-start="view.startSeconds" :data-view-end="view.endSeconds" :data-cursor-seconds="view.cursorSeconds">
            <span v-for="tick in ticks" :key="tick.time" :style="{ left:`${tick.ratio * 100}%` }">{{ tick.time.toFixed(1) }}<i /></span>
            <b aria-hidden="true" />
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import type { MarkerTimeView } from '../editor/markerTimeView';
const props = defineProps<{ view: MarkerTimeView }>();
const ticks = computed(() => {
    const view = props.view, step = view.spanSeconds > 5 ? 2 : view.spanSeconds > 2 ? 1 : .2;
    const ticks = [];
    for (let time = Math.ceil(Math.max(0,view.startSeconds) / step) * step; time <= Math.min(view.endSeconds,view.durationSeconds); time += step) ticks.push({ time,ratio:(time - view.startSeconds) / view.spanSeconds });
    return ticks;
});
</script>
<style scoped>
.marker-ruler { position:sticky; z-index:20; top:0; display:grid; grid-template-columns:var(--marker-management-width,224px) minmax(180px,1fr); min-width:340px; height:28px; background:#152019; border-bottom:1px solid var(--hairline); }
.ruler-management { display:flex; align-items:center; justify-content:space-between; padding:0 12px; color:var(--muted); font-size:10px; }
.marker-ruler-time { position:relative; overflow:hidden; color:var(--body); font:10px ui-monospace,monospace; }
.marker-ruler-time>span { position:absolute; top:3px; transform:translateX(-50%); }.marker-ruler-time i { position:absolute; left:50%; top:15px; height:8px; border-left:1px solid var(--muted); }
.marker-ruler-time b { position:absolute; left:15%; top:0; bottom:0; width:1px; background:#b7dfcf; }.marker-ruler-time b::after { content:''; position:absolute; top:0; left:-3px; border-top:5px solid #b7dfcf; border-inline:3px solid transparent; }
</style>
