<template>
    <section class="candidate-timeline" aria-label="候选时间预览">
        <div class="timeline-controls"><label>起点 <input v-model.number="start" type="number" min="0" :max="duration" step="1"> 秒</label><label>窗口 <input v-model.number="span" type="number" min="1" :max="Math.max(1,duration)" step="1"> 秒</label><button type="button" @click="start = Math.max(0,playback.currentTimeSeconds - windowSeconds/2)">查看播放位置</button><span>{{ windowStart.toFixed(2) }} — {{ windowEnd.toFixed(2) }} 秒</span></div>
        <div class="timeline-body">
            <div class="row-labels"><span v-for="row in rows" :key="row.key">{{ row.label }}</span></div>
            <div ref="surface" class="timeline-surface" role="slider" tabindex="0" aria-label="候选预览，跳转当前试听" :aria-valuemin="windowStart" :aria-valuemax="windowEnd" :aria-valuenow="playback.currentTimeSeconds" @click="seekPointer" @keydown="seekKeyboard">
                <canvas ref="canvas" aria-hidden="true" />
                <span v-if="cursor >= 0 && cursor <= 1" class="candidate-cursor" :style="{left:`${cursor*100}%`}" />
            </div>
        </div>
        <p>点击预览跳转试听 · 点为短音或鼓击，线为长音 · 模型时间保持原样</p>
    </section>
</template>
<script setup lang="ts">
import { computed,onBeforeUnmount,onMounted,ref,watch } from 'vue';
import type { MarkerCandidate,NoteThresholds } from '../transcription/candidateTypes';
import { candidateEventKind } from '../transcription/candidates';
import type { PlaybackSnapshot } from '../types/audio';
const props = defineProps<{candidates:readonly MarkerCandidate[];thresholds:NoteThresholds;duration:number;playback:PlaybackSnapshot;active:boolean}>();
const emit = defineEmits<{seek:[seconds:number]}>();
const rows = [{key:'kick',label:'Kick'},{key:'snare',label:'Snare'},{key:'hat',label:'Hat'},{key:'bass',label:'低音'},{key:'vocals',label:'人声'},{key:'piano',label:'钢琴'},{key:'guitar',label:'吉他'},{key:'unknown',label:'未知'}];
const start = ref(0),span = ref(30),canvas = ref<HTMLCanvasElement|null>(null),surface = ref<HTMLDivElement|null>(null);
const windowSeconds = computed(() => Math.max(1,Math.min(props.duration,Number.isFinite(span.value) ? span.value : 30)));
const windowStart = computed(() => Math.max(0,Math.min(Math.max(0,props.duration-windowSeconds.value),Number.isFinite(start.value) ? start.value : 0)));
const windowEnd = computed(() => Math.min(props.duration,windowStart.value+windowSeconds.value));
const cursor = computed(() => (props.playback.currentTimeSeconds-windowStart.value)/windowSeconds.value);
let observer:ResizeObserver|null = null,frame:number|null = null;
function draw():void {
    frame = null;if (!props.active || !canvas.value || !surface.value) return;
    const width = surface.value.clientWidth,height = 192,dpr = Math.min(2,window.devicePixelRatio || 1);
    canvas.value.width = Math.round(width*dpr);canvas.value.height = height*dpr;
    const ctx = canvas.value.getContext('2d');if (!ctx) return;ctx.scale(dpr,dpr);
    ctx.fillStyle = '#0a1510';ctx.fillRect(0,0,width,height);ctx.strokeStyle = '#223b2c';ctx.lineWidth = 1;
    for (let i=1;i<8;i++) { ctx.beginPath();ctx.moveTo(0,i*24);ctx.lineTo(width,i*24);ctx.stroke(); }
    for (let i=0;i<=10;i++) { ctx.beginPath();ctx.moveTo(width*i/10,0);ctx.lineTo(width*i/10,height);ctx.stroke(); }
    const occupied = new Set<string>();
    for (const candidate of props.candidates) {
        if (candidate.deleted || candidate.endSeconds < windowStart.value || candidate.startSeconds > windowEnd.value) continue;
        const row = rows.findIndex(row => row.key === (candidate.kind === 'drum' ? candidate.drum : candidate.instrument));
        if (row < 0) continue;
        const x = Math.max(0,(candidate.startSeconds-windowStart.value)/windowSeconds.value*width),y = row*24+12;
        const range = candidateEventKind(candidate,props.thresholds) === 'range';
        const key = `${row}:${Math.floor(x)}:${range}`;if (!range && occupied.has(key)) continue;occupied.add(key);
        ctx.fillStyle = candidate.kind === 'drum' ? '#e9bc79' : candidate.instrument === 'unknown' ? '#9ca49f' : '#9cdbb4';
        ctx.globalAlpha = .45+candidate.strength*.55;
        if (range) ctx.fillRect(x,y-3,Math.max(2,Math.min(width,(candidate.endSeconds-windowStart.value)/windowSeconds.value*width)-x),6);
        else { ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill(); }
    }
    ctx.globalAlpha = 1;
}
function schedule():void { if (frame === null) frame = requestAnimationFrame(draw); }
function seekPointer(event:MouseEvent):void { const rect = surface.value?.getBoundingClientRect();if (rect?.width) emit('seek',Math.max(0,Math.min(props.duration,windowStart.value+(event.clientX-rect.left)/rect.width*windowSeconds.value))); }
function seekKeyboard(event:KeyboardEvent):void {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;event.preventDefault();
    emit('seek',event.key === 'Home' ? windowStart.value : event.key === 'End' ? windowEnd.value : Math.max(windowStart.value,Math.min(windowEnd.value,props.playback.currentTimeSeconds+(event.key === 'ArrowRight' ? 1 : -1))));
}
watch(() => [props.candidates,props.thresholds,props.duration,props.active,windowStart.value,windowSeconds.value],schedule);
onMounted(() => { observer = new ResizeObserver(schedule);if (surface.value) observer.observe(surface.value);schedule(); });
onBeforeUnmount(() => { observer?.disconnect();if (frame !== null) cancelAnimationFrame(frame); });
</script>
<style scoped>
.candidate-timeline { overflow: hidden; border: 1px solid var(--divider); border-radius: var(--radius-sm); background: var(--surface-1); }
.timeline-controls { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 12px; padding: 12px; color: var(--body); font-size: 12px; }
.timeline-controls label { display: flex; align-items: center; gap: 6px; }
.timeline-controls input { width: 62px; }
.timeline-controls input, .timeline-controls button { min-height: 30px; border: 1px solid var(--divider); border-radius: var(--radius-xs); padding: 4px 8px; background: var(--surface-3); color: var(--ink); font: inherit; }
.timeline-controls button { cursor: pointer; }
.timeline-controls button:hover { background: var(--control-hover); }
.timeline-controls input:focus-visible, .timeline-controls button:focus-visible, .timeline-surface:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: -2px; }
.timeline-controls > span { color: var(--mute); font-size: 11px; font-variant-numeric: tabular-nums; }
.timeline-body { display: flex; border-block: 1px solid var(--divider); }
.row-labels { width: 58px; flex: none; background: var(--surface-3); color: var(--body); font-size: 11px; }
.row-labels span { display: flex; align-items: center; height: 24px; padding-left: 9px; }
.timeline-surface { position: relative; min-width: 0; flex: 1; height: 192px; cursor: crosshair; }
.timeline-surface canvas { display: block; width: 100%; height: 192px; }
.candidate-cursor { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--ink-strong); pointer-events: none; }
.candidate-timeline p { margin: 0; padding: 10px 12px; color: var(--mute); font-size: 11px; line-height: 1.7; }
</style>
