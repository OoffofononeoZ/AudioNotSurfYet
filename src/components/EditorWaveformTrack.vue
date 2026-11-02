<template>
    <div
        ref="stage"
        class="timeline-stage"
        data-testid="editor-timeline"
        :data-view-start="viewport.startSeconds"
        :data-view-end="viewport.endSeconds"
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
        @keydown="onStageKeydown">
        <canvas ref="waveformCanvas" class="timeline-canvas" aria-hidden="true" />
        <canvas ref="gridCanvas" class="timeline-canvas grid-canvas" aria-hidden="true" />
        <canvas ref="cursorCanvas" class="timeline-canvas cursor-canvas" aria-hidden="true" />
        <div class="waveform-actions">
            <button
                type="button"
                class="waveform-icon"
                aria-label="查看播放位置"
                title="查看播放位置"
                data-testid="editor-reveal-playback"
                @pointerdown.stop
                @click.stop="revealPlayback">
                <EditorIcon name="locate" />
            </button>
            <button
                type="button"
                class="add-boundary"
                data-testid="add-tempo-boundary"
                aria-label="添加分段"
                title="添加分段"
                @pointerdown.stop
                @click.stop="emit('addBoundary')">
                <EditorIcon name="plus" />
            </button>
        </div>

        <EditorContextMenu
            v-if="quickMenu"
            :anchor="stage"
            :x="quickMenu.x"
            :y="quickMenu.y"
            test-id="editor-timeline-menu"
            waveform
            @action="
                $event === 'reset' ? resetViewport() : $event === 'center' ? menuCenter() : menuSeek($event === 'play')
            "
            @close="quickMenu = null" />
    </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { EditorProjectV2 } from '../editor/types';
import type { PlaybackSnapshot } from '../types/audio';
import type { PersistedTimelineViewport } from '../types/session';
import type { RenderAnalysisSeries } from '../analysis/windowTypes';
import { waveformPeak } from '../analysis/plotPeaks';
import { plotColumns } from '../analysis/renderGeometry';
import { useAudioSessionService } from '../audio/audioSessionService';
import { useEditorGrid } from '../editor/useEditorGrid';
import { divisorColour, divisorHeight } from '../editor/beatSnap';
import { EDITOR_CONTEXT_PAN_THRESHOLD_PX } from '../editor/editorConfig';
import {
    centerEditorViewport,
    editorWaveformVerticalGeometry,
    editorTimeToX,
    editorXToTime,
    panEditorViewportByPixels,
    panEditorViewportByRatio,
    zoomEditorViewportAtX,
} from '../editor/timeline';
import EditorIcon from './EditorIcon.vue';
import EditorContextMenu from './EditorContextMenu.vue';
const props = defineProps<{
    project: EditorProjectV2;
    playback: PlaybackSnapshot;
    viewport: PersistedTimelineViewport;
    series: RenderAnalysisSeries | null;
    active?: boolean;
    boundaryDragging: boolean;
}>();
const emit = defineEmits<{
    updateViewport: [viewport: PersistedTimelineViewport, immediate: boolean];
    resetViewport: [];
    addBoundary: [];
    resize: [size: { width: number; height: number; dpr: number }];
}>();
const audioSession = useAudioSessionService();
const { setting: beatSnap, generateTempoGrid } = useEditorGrid();
const viewport = computed(() => props.viewport);
const durationSeconds = computed(() => props.project.track.durationSeconds);
const stage = ref<HTMLDivElement | null>(null);
const waveformCanvas = ref<HTMLCanvasElement | null>(null);
const gridCanvas = ref<HTMLCanvasElement | null>(null);
const cursorCanvas = ref<HTMLCanvasElement | null>(null);
const size = reactive({ width: 0, height: 0, dpr: 1 });
let resizeObserver: ResizeObserver | null = null;
const updateViewport = (viewport: PersistedTimelineViewport, immediate: boolean) =>
    emit('updateViewport', viewport, immediate);
const resetViewport = () => emit('resetViewport');
const revealPlayback = () =>
    updateViewport(
        centerEditorViewport(viewport.value, props.project.track.durationSeconds, props.playback.currentTimeSeconds),
        true,
    );
const zoomBy = (factor: number, anchorX = size.width / 2, immediate = true) => {
    updateViewport(
        zoomEditorViewportAtX(
            viewport.value,
            durationSeconds.value,
            viewport.value.zoom * factor,
            anchorX,
            size.width,
            1,
        ),
        immediate,
    );
};
const panBy = (ratio: number) =>
    updateViewport(panEditorViewportByRatio(viewport.value, durationSeconds.value, ratio), true);

const canvasPoint = (event: PointerEvent | WheelEvent): { x: number; y: number } => {
    const bounds = stage.value?.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(bounds?.width ?? 0, event.clientX - (bounds?.left ?? 0))),
        y: Math.max(0, event.clientY - (bounds?.top ?? 0)),
    };
};

const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey || pointer.value || props.boundaryDragging) return;
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
        updateViewport(
            panEditorViewportByPixels(active.startViewport, durationSeconds.value, x - active.startX, size.width),
            false,
        );
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
            x: point.x,
            y: point.y,
            timeSeconds: editorXToTime(point.x, viewport.value, size.width),
        };
    }
    clearPointer();
};

const clearPointer = () => {
    const held = pointer.value;
    pointer.value = null;
    if (held && stage.value?.hasPointerCapture(held.id)) stage.value.releasePointerCapture(held.id);
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

let drawFrame: number | null = null;
let staticDirty = false;
function scheduleDraw(full = true) {
    staticDirty ||= full;
    if (props.active === false || drawFrame !== null) return;
    drawFrame = requestAnimationFrame(() => {
        drawFrame = null;
        if (staticDirty) {
            staticDirty = false;
            drawStatic();
        } else drawCursor();
    });
}
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
    const series = props.series;
    if (series?.payload.kind === 'waveform-envelope') {
        const columns = plotColumns(series, viewport.value, size.width, size.dpr, durationSeconds.value);
        const { centerY, amplitude } = editorWaveformVerticalGeometry(size.height);
        waveform.beginPath();
        for (const column of columns) {
            const x = (column.left + column.right) / 2;
            const value = waveformPeak(series.payload, column.startIndex, column.endIndex);
            waveform.moveTo(x, centerY - value.max * amplitude);
            waveform.lineTo(x, centerY - value.min * amplitude);
        }
        waveform.strokeStyle = '#65ffa9';
        waveform.globalAlpha = 0.9;
        waveform.lineWidth = Math.max(
            1 / size.dpr,
            (size.width * series.sampleStepSeconds) / (viewport.value.endSeconds - viewport.value.startSeconds),
        );
        waveform.stroke();
        waveform.globalAlpha = 1;
    }
    grid.clearRect(0, 0, size.width, size.height);
    for (const line of generateTempoGrid(props.project.tempoMap, durationSeconds.value, viewport.value, size.width)) {
        const x = editorTimeToX(line.timeSeconds, viewport.value, size.width);
        grid.beginPath();
        const tickHeight = size.height * (line.kind === 'beat' ? 1 : divisorHeight(line.divisor));
        grid.moveTo(Math.round(x) + 0.5, (size.height - tickHeight) / 2);
        grid.lineTo(Math.round(x) + 0.5, (size.height + tickHeight) / 2);
        grid.strokeStyle = divisorColour(line.divisor);
        grid.globalAlpha = line.kind === 'beat' ? 0.85 : 0.45;
        grid.lineWidth = 1;
        grid.stroke();
    }
    grid.globalAlpha = 1;
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
    () => [props.series, props.project.tempoMap, props.viewport, size.width, size.height, size.dpr],
    () => scheduleDraw(),
    { deep: true },
);
watch(beatSnap, () => scheduleDraw());
watch(
    () => props.playback.currentTimeSeconds,
    () => scheduleDraw(false),
);
watch(
    () => [props.active, props.project.track.contentHash],
    () => {
        clearPointer();
        quickMenu.value = null;
        if (props.active !== false) void nextTick(scheduleDraw);
    },
);
onMounted(() => {
    resizeObserver = new ResizeObserver(([entry]) => {
        const bounds = entry?.contentRect;
        size.width = Math.max(1, bounds?.width ?? 1);
        size.height = Math.max(1, bounds?.height ?? 1);
        size.dpr = Math.max(1, window.devicePixelRatio || 1);
        emit('resize', { ...size });
        scheduleDraw();
    });
    if (stage.value) resizeObserver.observe(stage.value);
    window.addEventListener('blur', clearPointer);
});
onBeforeUnmount(() => {
    clearPointer();
    resizeObserver?.disconnect();
    if (drawFrame !== null) cancelAnimationFrame(drawFrame);
    window.removeEventListener('blur', clearPointer);
});
</script>
<style scoped>
.timeline-stage {
    position: relative;
    z-index: 1;
    flex: 1;
    min-height: var(--editor-timeline-stage-height);
    overflow: hidden;
    border: 0;
    border-radius: 0;
    background: linear-gradient(180deg, var(--editor-stage-top), var(--editor-stage-bottom));
    cursor: crosshair;
    touch-action: none;
    user-select: none;
}
.timeline-canvas {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.grid-canvas {
    z-index: 2;
}
.cursor-canvas {
    z-index: 3;
}
.waveform-actions {
    position: absolute;
    z-index: 8;
    top: 5px;
    right: 6px;
    display: flex;
    gap: 4px;
}
.waveform-actions button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    min-width: 30px;
    min-height: 30px;
    padding: 6px;
    border: 0;
    background: var(--editor-control-strong);
    cursor: pointer;
}
.waveform-actions svg {
    width: 18px;
    height: 18px;
}
</style>
