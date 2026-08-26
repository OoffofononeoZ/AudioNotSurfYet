<template>
    <section class="editor-timeline-panel" aria-label="Editor 时间轴">
        <header class="timeline-heading">
            <div>
                <p class="timeline-kicker">E2 · Timeline / Tempo</p>
                <h2>波形与节拍地图</h2>
                <p data-testid="editor-viewport-state">{{ formatTime(viewport.startSeconds) }} — {{ formatTime(viewport.endSeconds) }} · {{ viewport.zoom.toFixed(1) }}×</p>
            </div>
            <div class="timeline-controls" aria-label="共享视口控制">
                <button type="button" data-testid="editor-pan-back" @click="panBy(-0.25)">← 25%</button>
                <button type="button" data-testid="editor-zoom-out" :disabled="viewport.zoom <= 1" @click="zoomBy(0.5)">−</button>
                <button type="button" data-testid="editor-reset-viewport" @click="resetViewport">重置</button>
                <button type="button" data-testid="editor-zoom-in" :disabled="viewport.zoom >= 64" @click="zoomBy(2)">+</button>
                <button type="button" data-testid="editor-pan-forward" @click="panBy(0.25)">25% →</button>
            </div>
        </header>

        <div
            ref="stage"
            class="timeline-stage"
            data-testid="editor-timeline"
            tabindex="0"
            role="application"
            aria-label="歌曲波形；点击跳转，滚轮缩放，右键拖动平移"
            @contextmenu.prevent
            @dragstart.prevent
            @wheel="onWheel"
            @pointerdown="onStagePointerDown"
            @pointermove="onStagePointerMove"
            @pointerup="onStagePointerUp"
            @pointercancel="clearPointer"
            @lostpointercapture="clearPointer"
            @keydown="onStageKeydown"
        >
            <canvas ref="waveformCanvas" class="timeline-canvas" aria-hidden="true" />
            <canvas ref="gridCanvas" class="timeline-canvas grid-canvas" aria-hidden="true" />
            <canvas ref="cursorCanvas" class="timeline-canvas cursor-canvas" aria-hidden="true" />
            <span class="fixed-boundary boundary-start" aria-hidden="true">0</span>
            <button
                v-for="segment in internalSegments"
                :key="segment.id"
                type="button"
                class="tempo-boundary"
                :style="{ left: `${timeToPercent(segment.startSeconds)}%` }"
                :aria-label="`移动 ${formatTime(segment.startSeconds)} 的 Tempo 边界`"
                :data-testid="`tempo-boundary-${segment.id}`"
                :data-time-seconds="segment.startSeconds"
                @pointerdown.stop="beginBoundaryDrag($event, segment.id)"
                @pointermove.stop="moveBoundaryDrag"
                @pointerup.stop="endBoundaryDrag"
                @pointercancel.stop="cancelBoundaryDrag"
                @keydown="onBoundaryKeydown($event, segment.id)"
            >
                <span aria-hidden="true">◆</span>
            </button>
            <button
                type="button"
                class="tempo-boundary add-boundary"
                data-testid="add-tempo-boundary"
                aria-label="新增 Tempo 边界"
                @click.stop="insertBoundaryAtPreferredTime"
            >
                <span aria-hidden="true">＋</span>
            </button>
            <span class="fixed-boundary boundary-end" aria-hidden="true">{{ formatTime(durationSeconds) }}</span>

            <div
                v-if="quickMenu"
                class="timeline-menu"
                role="menu"
                :style="{ left: `${quickMenu.x}px`, top: `${quickMenu.y}px` }"
                data-testid="editor-timeline-menu"
            >
                <button type="button" role="menuitem" @click="menuSeek(false)">跳到此处</button>
                <button type="button" role="menuitem" @click="menuSeek(true)">从此处播放</button>
                <button type="button" role="menuitem" @click="menuCenter">将此处居中</button>
            </div>
        </div>

        <div class="timeline-status" aria-live="polite">
            <span data-testid="editor-buffer-state">{{ bufferStateLabel }}</span>
            <span data-testid="editor-tempo-estimate-state">{{ estimateStateLabel }}</span>
            <span>游标 {{ formatTime(playback.currentTimeSeconds) }}</span>
        </div>

        <div class="tempo-segments" data-testid="tempo-segments">
            <article v-for="(segment, index) in project.tempoMap" :key="segment.id" class="tempo-segment">
                <header>
                    <strong>区间 {{ index + 1 }}</strong>
                    <span>{{ formatTime(segment.startSeconds) }} — {{ formatTime(segmentEnd(index)) }}</span>
                </header>
                <template v-if="segment.mode === 'metered'">
                    <label>
                        BPM
                        <input
                            inputmode="decimal"
                            :value="tempoBpmDrafts[segment.id] ?? segment.bpm ?? ''"
                            placeholder="100"
                            :data-testid="`tempo-bpm-${index}`"
                            @focus="clearError(segment.id)"
                            @input="captureBpmDraft(segment.id, $event)"
                            @blur="commitBpm(segment.id, $event)"
                            @keydown.enter.prevent="commitBpm(segment.id, $event)"
                        >
                    </label>
                    <label>
                        拍号
                        <span class="meter-inputs">
                            <input
                                inputmode="numeric"
                                :value="tempoNumeratorDrafts[segment.id] ?? segment.meter.numerator"
                                :aria-label="`区间 ${index + 1} 拍号分子`"
                                @input="captureNumeratorDraft(segment.id, $event)"
                                @blur="commitMeter(segment.id, $event, segment.meter.denominator)"
                                @keydown.enter.prevent="commitMeter(segment.id, $event, segment.meter.denominator)"
                            >
                            /
                            <select
                                :value="segment.meter.denominator"
                                :aria-label="`区间 ${index + 1} 拍号分母`"
                                @change="commitMeter(segment.id, segment.meter.numerator, $event)"
                            >
                                <option v-for="value in meterDenominators" :key="value" :value="value">{{ value }}</option>
                            </select>
                        </span>
                    </label>
                    <span class="tempo-source">{{ sourceLabel(segment.bpmSource) }}</span>
                </template>
                <template v-else>
                    <p class="single-beat">单拍区间：不显示拍号和内部节拍线。</p>
                    <button type="button" @click="restoreMetered(segment.id)">切回 4/4 · 100 BPM</button>
                </template>
                <p v-if="tempoErrors[segment.id]" class="tempo-error" role="alert">
                    {{ tempoErrors[segment.id] }}
                </p>
            </article>
        </div>

        <div class="annotation-grid" data-testid="editor-e2-grid" aria-label="E2 节拍网格预览">
            <p>标记 lane 将在 E3 接入；这里先验证贯穿式 Tempo 网格与共享时间坐标。</p>
        </div>
    </section>
</template>

<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from 'vue';
import type { AnalysisCoordinatorSnapshot, AnalysisSeries } from '../analysis/types';
import { visibleSampleRange, waveformEnvelopeAt } from '../analysis/rendererData';
import { useAudioSessionService } from '../audio/audioSessionService';
import type { PlaybackSnapshot } from '../types/audio';
import type { PersistedTimelineViewport } from '../types/session';
import {
    EDITOR_CONTEXT_PAN_THRESHOLD_PX,
} from '../editor/editorConfig';
import {
    applyBpmInput,
    applyMeterInput,
    cloneTempoSegment,
    generateTempoGrid,
    insertTempoBoundary,
    moveTempoBoundary,
    segmentAtTime,
    segmentEndSeconds,
    selectVisibleSubdivision,
    snapEditorTime,
} from '../editor/tempoMap';
import {
    centerEditorViewport,
    editorTimeToX,
    editorXToTime,
    normalizeEditorViewport,
    panEditorViewportByPixels,
    panEditorViewportByRatio,
    resetEditorViewport,
    zoomEditorViewportAtX,
} from '../editor/timeline';
import type { EditorProjectV1, TempoSegmentV1 } from '../editor/types';
import type { EditorSessionSnapshot } from '../editor/types';

const props = defineProps<{
    project: EditorProjectV1;
    playback: PlaybackSnapshot;
    analysis: AnalysisCoordinatorSnapshot;
    bufferSeries: AnalysisSeries | null;
    tempoEstimateState?: EditorSessionSnapshot['tempoEstimateState'];
}>();

const emit = defineEmits<{
    updateProject: [project: EditorProjectV1, immediate: boolean];
}>();

const audioSession = useAudioSessionService();
const stage = ref<HTMLDivElement | null>(null);
const waveformCanvas = ref<HTMLCanvasElement | null>(null);
const gridCanvas = ref<HTMLCanvasElement | null>(null);
const cursorCanvas = ref<HTMLCanvasElement | null>(null);
const size = reactive({ width: 0, height: 0, dpr: 1 });
const tempoErrors = reactive<Record<string, string>>({});
const tempoBpmDrafts = reactive<Record<string, string>>({});
const tempoNumeratorDrafts = reactive<Record<string, string>>({});
const meterDenominators = [1, 2, 4, 8, 16, 32] as const;
const createId = () => crypto.randomUUID();
let resizeObserver: ResizeObserver | null = null;

const viewport = computed(() => normalizeEditorViewport(
    props.project.workspace.viewport,
    props.project.track.durationSeconds,
));
const durationSeconds = computed(() => props.project.track.durationSeconds);
const internalSegments = computed(() => props.project.tempoMap.slice(1).filter(
    (segment) => segment.startSeconds >= viewport.value.startSeconds
        && segment.startSeconds <= viewport.value.endSeconds,
));

const bufferStateLabel = computed(() => {
    if (props.bufferSeries?.payload.kind === 'waveform-envelope') return '波形已就绪';
    if (props.analysis.state === 'error') return '波形不可用，Tempo 仍可手动编辑';
    return '正在准备波形…';
});
const estimateStateLabel = computed(() => ({
    idle: 'BPM 等待估计',
    estimating: '正在估计 BPM…',
    reliable: `BPM 已自动填入${props.project.tempoMap[0]?.mode === 'metered' ? `：${props.project.tempoMap[0].bpm}` : ''}`,
    'low-confidence': 'BPM 置信度不足，请手动输入',
    unavailable: 'BPM 自动估计不可用，请手动输入',
}[props.tempoEstimateState
    ?? (props.project.tempoMap[0]?.mode === 'metered'
        && props.project.tempoMap[0].bpmSource === 'estimated'
        ? 'reliable'
        : 'idle')] ?? 'BPM 可手动输入'));

const formatTime = (seconds: number): string => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${(safe % 60).toFixed(3).padStart(6, '0')}`;
};

const updateViewport = (next: PersistedTimelineViewport, immediate: boolean) => {
    emit('updateProject', {
        ...props.project,
        workspace: { ...props.project.workspace, viewport: next },
    }, immediate);
};

const zoomBy = (factor: number, anchorX = size.width / 2, immediate = true) => {
    updateViewport(zoomEditorViewportAtX(
        viewport.value,
        durationSeconds.value,
        viewport.value.zoom * factor,
        anchorX,
        size.width,
    ), immediate);
};
const panBy = (ratio: number) => updateViewport(panEditorViewportByRatio(
    viewport.value,
    durationSeconds.value,
    ratio,
), true);
const resetViewport = () => updateViewport(resetEditorViewport(durationSeconds.value), true);

const canvasPoint = (event: PointerEvent | WheelEvent): { x: number; y: number } => {
    const bounds = stage.value?.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(bounds?.width ?? 0, event.clientX - (bounds?.left ?? 0))),
        y: Math.max(0, event.clientY - (bounds?.top ?? 0)),
    };
};

const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const { x } = canvasPoint(event);
    zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, x, false);
};

interface PointerState {
    id: number;
    startX: number;
    lastX: number;
    startViewport: PersistedTimelineViewport;
    button: number;
    moved: boolean;
}
const pointer = ref<PointerState | null>(null);
const quickMenu = ref<{ x: number; y: number; timeSeconds: number } | null>(null);

const onStagePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.button !== 2) return;
    if ((event.target as HTMLElement).closest('button, input, select')) return;
    quickMenu.value = null;
    const { x } = canvasPoint(event);
    pointer.value = {
        id: event.pointerId,
        startX: x,
        lastX: x,
        startViewport: viewport.value,
        button: event.button,
        moved: false,
    };
    stage.value?.setPointerCapture(event.pointerId);
};

const onStagePointerMove = (event: PointerEvent) => {
    const active = pointer.value;
    if (!active || active.id !== event.pointerId || active.button !== 2) return;
    const { x } = canvasPoint(event);
    if (Math.abs(x - active.startX) >= EDITOR_CONTEXT_PAN_THRESHOLD_PX) {
        active.moved = true;
    }
    if (active.moved) {
        updateViewport(panEditorViewportByPixels(
            active.startViewport,
            durationSeconds.value,
            x - active.startX,
            size.width,
        ), false);
    }
    active.lastX = x;
};

const onStagePointerUp = (event: PointerEvent) => {
    const active = pointer.value;
    if (!active || active.id !== event.pointerId) return;
    const point = canvasPoint(event);
    if (active.button === 0) {
        void audioSession.seek(editorXToTime(point.x, viewport.value, size.width));
    } else if (active.moved) {
        updateViewport(viewport.value, true);
    } else {
        quickMenu.value = {
            x: Math.min(point.x, Math.max(0, size.width - 170)),
            y: Math.min(point.y, Math.max(0, size.height - 118)),
            timeSeconds: editorXToTime(point.x, viewport.value, size.width),
        };
    }
    clearPointer();
};

const clearPointer = () => {
    pointer.value = null;
};

const menuSeek = (play: boolean) => {
    const time = quickMenu.value?.timeSeconds;
    quickMenu.value = null;
    if (time === undefined) return;
    void audioSession.seek(time).then(() => {
        if (play && props.playback.state !== 'playing') {
            return audioSession.togglePlayback();
        }
        return undefined;
    });
};
const menuCenter = () => {
    const time = quickMenu.value?.timeSeconds;
    quickMenu.value = null;
    if (time === undefined) return;
    updateViewport(centerEditorViewport(viewport.value, durationSeconds.value, time), true);
};

const onStageKeydown = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 5 : 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        void audioSession.seek(props.playback.currentTimeSeconds + direction * step);
    } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        void audioSession.seek(event.key === 'Home' ? 0 : durationSeconds.value);
    } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomBy(2);
    } else if (event.key === '-') {
        event.preventDefault();
        zoomBy(0.5);
    } else if (event.key === '[' || event.key === ']') {
        event.preventDefault();
        panBy(event.key === '[' ? -0.25 : 0.25);
    } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        quickMenu.value = {
            x: size.width / 2,
            y: size.height / 2,
            timeSeconds: (viewport.value.startSeconds + viewport.value.endSeconds) / 2,
        };
    } else if (event.key === 'Escape') {
        quickMenu.value = null;
        clearPointer();
    }
};

const timeToPercent = (seconds: number) =>
    editorTimeToX(seconds, viewport.value, Math.max(1, size.width))
    / Math.max(1, size.width) * 100;
const segmentEnd = (index: number) => segmentEndSeconds(
    props.project.tempoMap,
    index,
    durationSeconds.value,
);

const replaceTempoSegment = (next: TempoSegmentV1) => {
    emit('updateProject', {
        ...props.project,
        tempoMap: props.project.tempoMap.map((segment) =>
            segment.id === next.id ? next : segment),
    }, true);
};
const clearError = (id: string) => { delete tempoErrors[id]; };
const captureBpmDraft = (id: string, event: Event) => {
    tempoBpmDrafts[id] = (event.target as HTMLInputElement).value;
};
const captureNumeratorDraft = (id: string, event: Event) => {
    tempoNumeratorDrafts[id] = (event.target as HTMLInputElement).value;
};
const commitBpm = (id: string, event: Event) => {
    const segment = props.project.tempoMap.find((entry) => entry.id === id);
    if (!segment) return;
    const input = tempoBpmDrafts[id] ?? (event.target as HTMLInputElement).value;
    if (input.trim() === '') return;
    const result = applyBpmInput(segment, input);
    if (!result.ok) {
        tempoErrors[id] = result.message;
        return;
    }
    delete tempoErrors[id];
    delete tempoBpmDrafts[id];
    replaceTempoSegment(result.segment);
};
const commitMeter = (id: string, first: Event | number, second: Event | number) => {
    const segment = props.project.tempoMap.find((entry) => entry.id === id);
    if (!segment) return;
    const read = (value: Event | number) => typeof value === 'number'
        ? value
        : Number((value.target as HTMLInputElement | HTMLSelectElement).value);
    const numerator = typeof first === 'number'
        ? first
        : Number(tempoNumeratorDrafts[id]
            ?? (first.target as HTMLInputElement).value);
    const result = applyMeterInput(segment, numerator, read(second));
    if (!result.ok) {
        tempoErrors[id] = result.message;
        return;
    }
    delete tempoErrors[id];
    delete tempoNumeratorDrafts[id];
    replaceTempoSegment(result.segment);
};
const restoreMetered = (id: string) => {
    const segment = props.project.tempoMap.find((entry) => entry.id === id);
    if (!segment) return;
    replaceTempoSegment({
        id,
        startSeconds: segment.startSeconds,
        mode: 'metered',
        bpm: 100,
        bpmSource: 'user',
        meter: { numerator: 4, denominator: 4 },
    });
};
const sourceLabel = (source: 'unset' | 'estimated' | 'user') => ({
    unset: '等待输入或自动估计',
    estimated: '自动估计',
    user: '用户输入',
}[source]);

const preferredBoundaryTime = () => {
    const cursor = props.playback.currentTimeSeconds;
    const raw = Number.isFinite(cursor) && cursor > 0 && cursor < durationSeconds.value
        ? cursor
        : (viewport.value.startSeconds + viewport.value.endSeconds) / 2;
    return snapEditorTime(
        raw,
        props.project.tempoMap,
        viewport.value,
        size.width,
        durationSeconds.value,
    );
};
const insertBoundaryAtPreferredTime = () => {
    const tempoMap = insertTempoBoundary(
        props.project.tempoMap,
        preferredBoundaryTime(),
        createId,
    );
    if (tempoMap.length === props.project.tempoMap.length) return;
    emit('updateProject', { ...props.project, tempoMap }, true);
};

const boundaryDrag = ref<{ id: string; pointerId: number; original: TempoSegmentV1[] } | null>(null);
const beginBoundaryDrag = (event: PointerEvent, id: string) => {
    boundaryDrag.value = {
        id,
        pointerId: event.pointerId,
        original: props.project.tempoMap.map(cloneTempoSegment),
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};
const moveBoundaryDrag = (event: PointerEvent) => {
    const drag = boundaryDrag.value;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { x } = canvasPoint(event);
    const raw = editorXToTime(x, viewport.value, size.width);
    const snapped = snapEditorTime(
        raw,
        props.project.tempoMap,
        viewport.value,
        size.width,
        durationSeconds.value,
    );
    const tempoMap = moveTempoBoundary(
        props.project.tempoMap,
        drag.id,
        snapped,
        durationSeconds.value,
    );
    emit('updateProject', { ...props.project, tempoMap }, false);
};
const endBoundaryDrag = () => {
    if (!boundaryDrag.value) return;
    boundaryDrag.value = null;
    emit('updateProject', props.project, true);
};
const cancelBoundaryDrag = () => {
    const drag = boundaryDrag.value;
    if (!drag) return;
    boundaryDrag.value = null;
    emit('updateProject', { ...props.project, tempoMap: drag.original }, true);
};
const onBoundaryKeydown = (event: KeyboardEvent, id: string) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const segment = props.project.tempoMap.find((entry) => entry.id === id);
    if (!segment) return;
    const active = segmentAtTime(props.project.tempoMap, segment.startSeconds - 1e-6);
    const step = active.mode === 'metered' && active.bpm !== null
        ? 60 / active.bpm / selectVisibleSubdivision(60 / active.bpm, viewport.value, size.width)
        : (viewport.value.endSeconds - viewport.value.startSeconds) * (event.shiftKey ? 0.05 : 0.01);
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    emit('updateProject', {
        ...props.project,
        tempoMap: moveTempoBoundary(
            props.project.tempoMap,
            id,
            segment.startSeconds + step * direction,
            durationSeconds.value,
        ),
    }, true);
};

const configureCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return null;
    const dpr = size.dpr;
    const width = Math.max(1, Math.round(size.width * dpr));
    const height = Math.max(1, Math.round(size.height * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const context = canvas.getContext('2d');
    context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return context;
};

const drawStatic = () => {
    const waveform = configureCanvas(waveformCanvas.value);
    const grid = configureCanvas(gridCanvas.value);
    if (!waveform || !grid || size.width <= 0 || size.height <= 0) return;
    waveform.clearRect(0, 0, size.width, size.height);
    const series = props.bufferSeries;
    if (series?.payload.kind === 'waveform-envelope') {
        const range = visibleSampleRange(series, viewport.value);
        const center = size.height * 0.31;
        const amplitude = size.height * 0.24;
        waveform.beginPath();
        for (let index = range.startIndex; index < range.endIndex; index += 1) {
            const x = editorTimeToX(index * series.sampleStepSeconds, viewport.value, size.width);
            const value = waveformEnvelopeAt(series.payload, index);
            waveform.moveTo(x, center - value.max * amplitude);
            waveform.lineTo(x, center - value.min * amplitude);
        }
        waveform.strokeStyle = '#65ffa9';
        waveform.globalAlpha = 0.9;
        waveform.lineWidth = Math.max(1, size.width / Math.max(1, range.endIndex - range.startIndex));
        waveform.stroke();
        waveform.globalAlpha = 1;
    }
    grid.clearRect(0, 0, size.width, size.height);
    for (const line of generateTempoGrid(props.project.tempoMap, durationSeconds.value, viewport.value)) {
        const x = editorTimeToX(line.timeSeconds, viewport.value, size.width);
        grid.beginPath();
        grid.moveTo(Math.round(x) + 0.5, 0);
        grid.lineTo(Math.round(x) + 0.5, size.height);
        grid.strokeStyle = line.kind === 'measure'
            ? 'rgba(255,255,255,0.82)'
            : 'rgba(255,255,255,0.25)';
        grid.lineWidth = 1;
        grid.stroke();
    }
    drawCursor();
};

const drawCursor = () => {
    const cursor = configureCanvas(cursorCanvas.value);
    if (!cursor || size.width <= 0 || size.height <= 0) return;
    cursor.clearRect(0, 0, size.width, size.height);
    const time = props.playback.currentTimeSeconds;
    if (time >= viewport.value.startSeconds && time <= viewport.value.endSeconds) {
        const x = editorTimeToX(time, viewport.value, size.width);
        cursor.beginPath();
        cursor.moveTo(Math.round(x) + 0.5, 0);
        cursor.lineTo(Math.round(x) + 0.5, size.height);
        cursor.strokeStyle = '#fff';
        cursor.lineWidth = 1.5;
        cursor.stroke();
    }
};

watch(
    () => [props.bufferSeries, props.project.tempoMap, props.project.workspace.viewport, size.width, size.height, size.dpr],
    () => void nextTick(drawStatic),
    { deep: true },
);
watch(
    () => props.playback.currentTimeSeconds,
    () => void nextTick(drawCursor),
);

onMounted(() => {
    resizeObserver = new ResizeObserver(([entry]) => {
        const bounds = entry?.contentRect;
        size.width = Math.max(1, bounds?.width ?? 1);
        size.height = Math.max(1, bounds?.height ?? 1);
        size.dpr = Math.max(1, window.devicePixelRatio || 1);
    });
    if (stage.value) resizeObserver.observe(stage.value);
    window.addEventListener('blur', clearPointer);
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    window.removeEventListener('blur', clearPointer);
});
</script>

<style scoped>
.editor-timeline-panel {
    margin-top: 20px;
    border: 1px solid rgba(72, 255, 151, 0.28);
    border-radius: 24px;
    padding: 24px;
    background: rgba(3, 12, 8, 0.88);
}
.timeline-heading,
.timeline-controls,
.timeline-status,
.tempo-segment header,
.meter-inputs {
    display: flex;
    align-items: center;
}
.timeline-heading { justify-content: space-between; gap: 20px; }
.timeline-heading h2 { margin: 4px 0 6px; }
.timeline-kicker { color: #65ffa9; letter-spacing: .12em; text-transform: uppercase; }
.timeline-controls { flex-wrap: wrap; gap: 8px; }
button,
input,
select {
    border: 1px solid rgba(101, 255, 169, .48);
    border-radius: 10px;
    padding: 8px 11px;
    color: #effff6;
    background: rgba(7, 24, 15, .94);
}
button:focus-visible,
input:focus-visible,
select:focus-visible { outline: 2px solid #65ffa9; outline-offset: 2px; }
button:disabled { opacity: .4; }
.timeline-stage {
    position: relative;
    height: 320px;
    margin-top: 18px;
    overflow: hidden;
    border: 1px solid rgba(101,255,169,.3);
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(12,35,23,.9), rgba(2,8,5,.96));
    cursor: crosshair;
    touch-action: none;
    user-select: none;
}
.timeline-canvas { position: absolute; inset: 0; pointer-events: none; }
.grid-canvas { z-index: 2; }
.cursor-canvas { z-index: 3; }
.fixed-boundary,
.tempo-boundary { position: absolute; z-index: 5; top: 6px; }
.boundary-start { left: 8px; }
.boundary-end { right: 8px; }
.tempo-boundary { transform: translateX(-50%); padding: 4px 7px; cursor: ew-resize; }
.add-boundary { left: calc(100% - 78px); top: 36px; border-radius: 999px; cursor: pointer; }
.timeline-menu {
    position: absolute;
    z-index: 10;
    display: grid;
    min-width: 165px;
    padding: 6px;
    border: 1px solid rgba(101,255,169,.5);
    border-radius: 12px;
    background: rgba(2, 10, 6, .98);
    box-shadow: 0 14px 40px rgba(0,0,0,.5);
}
.timeline-menu button { border: 0; text-align: left; }
.timeline-status { flex-wrap: wrap; gap: 16px; padding: 12px 2px 0; color: #a9c7b6; }
.tempo-segments { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 18px; }
.tempo-segment { border: 1px solid rgba(101,255,169,.2); border-radius: 14px; padding: 14px; background: rgba(4,17,10,.78); }
.tempo-segment header { justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.tempo-segment label { display: grid; grid-template-columns: 70px 1fr; align-items: center; gap: 8px; margin-top: 8px; }
.meter-inputs { gap: 6px; }
.meter-inputs input { width: 70px; }
.tempo-source,
.single-beat { display: block; margin-top: 10px; color: #a9c7b6; }
.tempo-error { margin-top: 8px; color: #ffb0a8; }
.annotation-grid {
    min-height: 180px;
    margin-top: 18px;
    border: 1px dashed rgba(101,255,169,.32);
    border-radius: 14px;
    padding: 18px;
    color: #8aa797;
    background: rgba(0,0,0,.18);
}
@media (max-width: 760px) {
    .timeline-heading { align-items: flex-start; flex-direction: column; }
    .timeline-stage { height: 280px; }
}
@media (prefers-reduced-motion: reduce) {
    * { scroll-behavior: auto !important; transition: none !important; }
}
</style>
                                @input="captureNumeratorDraft(segment.id, $event)"
