<template>
    <section class="editor-timeline-panel app-scrollbar" aria-label="Editor 时间轴" data-editor-major-region="true">
        <header class="timeline-heading">
            <div class="timeline-titleline">
                <span class="timeline-kicker">Timeline / Tempo</span>
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

        <div class="timeline-layout-row waveform-row">
            <div class="timeline-track-rail">
                <strong>歌曲总览</strong>
                <span>波形 / 播放游标</span>
            </div>
            <div class="timeline-class-rail">
                <strong>共享时间轴</strong>
                <span>Tempo / 网格</span>
            </div>
            <div class="timeline-time-column" data-testid="tempo-segments">
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
                    <button
                        type="button"
                        class="add-boundary"
                        data-testid="add-tempo-boundary"
                        aria-label="新增 Tempo 边界"
                        @click.stop="insertBoundaryAtPreferredTime"
                    >
                        <span aria-hidden="true">＋</span>
                    </button>

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

                <div class="tempo-guide-layer" aria-hidden="true">
                    <span
                        v-for="guide in visibleTempoGuides"
                        :key="guide.id"
                        class="tempo-boundary-guide"
                        :style="{ left: `${timeToPercent(guide.timeSeconds)}%` }"
                        :data-time-seconds="guide.timeSeconds"
                    />
                </div>

                <div
                    ref="tempoStage"
                    class="tempo-lane-stage"
                    data-testid="editor-tempo-lane"
                    tabindex="0"
                    aria-label="节拍边界与 BPM 区间；内部边界可右键或按 Delete 删除"
                    @contextmenu.prevent
                >
                    <article
                        v-for="entry in visibleTempoSegments"
                        :key="entry.segment.id"
                        class="tempo-segment"
                        :class="`tempo-segment--${segmentPresentation(entry.index)}`"
                        :style="segmentStyle(entry.index)"
                        :data-testid="`tempo-segment-${entry.index}`"
                        :data-presentation="segmentPresentation(entry.index)"
                        role="group"
                        :aria-label="segmentAccessibleLabel(entry.segment, entry.index)"
                        :title="segmentAccessibleLabel(entry.segment, entry.index)"
                    >
                        <div v-if="segmentPresentation(entry.index) === 'full'" class="tempo-segment-content tempo-segment-full">
                            <template v-if="entry.segment.mode === 'metered'">
                                <label class="tempo-compact-field">
                                    <input
                                        class="tempo-compact-control tempo-bpm-input"
                                        inputmode="decimal"
                                        :value="tempoBpmDrafts[entry.segment.id] ?? entry.segment.bpm ?? ''"
                                        placeholder="100"
                                        :aria-label="`区间 ${entry.index + 1} BPM`"
                                        :aria-invalid="Boolean(tempoErrors[entry.segment.id])"
                                        :aria-describedby="tempoErrors[entry.segment.id] ? `tempo-error-${entry.segment.id}` : undefined"
                                        :data-testid="`tempo-bpm-${entry.index}`"
                                        @focus="clearError(entry.segment.id)"
                                        @input="captureBpmDraft(entry.segment.id, $event)"
                                        @blur="commitBpm(entry.segment.id, $event)"
                                        @keydown.enter.prevent="commitBpm(entry.segment.id, $event)"
                                    >
                                    <span aria-hidden="true">BPM</span>
                                </label>
                                <span class="tempo-compact-separator" aria-hidden="true">·</span>
                                <span class="meter-inputs">
                                    <input
                                        class="tempo-compact-control tempo-meter-numerator"
                                        inputmode="numeric"
                                        :value="tempoNumeratorDrafts[entry.segment.id] ?? entry.segment.meter.numerator"
                                        :aria-label="`区间 ${entry.index + 1} 拍号分子`"
                                        :aria-invalid="Boolean(tempoErrors[entry.segment.id])"
                                        @input="captureNumeratorDraft(entry.segment.id, $event)"
                                        @blur="commitMeter(entry.segment.id, $event, entry.segment.meter.denominator)"
                                        @keydown.enter.prevent="commitMeter(entry.segment.id, $event, entry.segment.meter.denominator)"
                                    >
                                    <span aria-hidden="true">/</span>
                                    <span class="tempo-meter-denominator-shell">
                                        <select
                                            class="tempo-compact-control tempo-meter-denominator"
                                            :value="entry.segment.meter.denominator"
                                            :aria-label="`区间 ${entry.index + 1} 拍号分母`"
                                            @change="commitMeter(entry.segment.id, entry.segment.meter.numerator, $event)"
                                        >
                                            <option v-for="value in meterDenominators" :key="value" :value="value">{{ value }}</option>
                                        </select>
                                    </span>
                                </span>
                            </template>
                            <template v-else>
                                <span class="single-beat">单拍</span>
                                <button
                                    type="button"
                                    class="tempo-compact-action"
                                    @click="restoreMetered(entry.segment.id)"
                                >切回 4/4</button>
                            </template>
                        </div>
                        <div v-else-if="segmentPresentation(entry.index) === 'summary'" class="tempo-segment-content tempo-segment-summary">
                            {{ segmentSummary(entry.segment) }}
                        </div>
                        <span
                            v-if="tempoErrors[entry.segment.id]"
                            :id="`tempo-error-${entry.segment.id}`"
                            class="sr-only"
                        >{{ tempoErrors[entry.segment.id] }}</span>
                    </article>

                    <span
                        v-for="boundary in fixedBoundaries"
                        :key="boundary.id"
                        class="tempo-lane-boundary tempo-lane-boundary--fixed"
                        :class="boundary.edge ? `tempo-lane-boundary--${boundary.edge}` : ''"
                        :style="{ left: `${timeToPercent(boundary.timeSeconds)}%` }"
                        :data-testid="boundary.id"
                        :data-time-seconds="boundary.timeSeconds"
                        aria-hidden="true"
                    >
                        <span class="boundary-caret">^</span>
                        <span class="boundary-time">{{ formatTime(boundary.timeSeconds) }}</span>
                    </span>
                    <button
                        v-for="segment in internalSegments"
                        :key="segment.id"
                        type="button"
                        class="tempo-lane-boundary"
                        :style="{ left: `${timeToPercent(segment.startSeconds)}%` }"
                        :aria-label="`${formatTime(segment.startSeconds)} 的 Tempo 边界；可拖动，右键或 Delete 删除`"
                        :data-testid="`tempo-boundary-${segment.id}`"
                        :data-time-seconds="segment.startSeconds"
                        @contextmenu.stop.prevent="removeBoundary(segment.id)"
                        @pointerdown.stop="beginBoundaryDrag($event, segment.id)"
                        @pointermove.stop="moveBoundaryDrag"
                        @pointerup.stop="endBoundaryDrag"
                        @pointercancel.stop="cancelBoundaryDrag"
                        @keydown="onBoundaryKeydown($event, segment.id)"
                    >
                        <span class="boundary-caret" aria-hidden="true">^</span>
                        <span class="boundary-time">{{ formatTime(segment.startSeconds) }}</span>
                    </button>

                    <div class="tempo-measure" aria-hidden="true">
                        <span ref="fullMeasure" class="tempo-segment-content tempo-segment-full">
                            <label class="tempo-compact-field">
                                <input class="tempo-compact-control tempo-bpm-input" value="300.000">
                                <span>BPM</span>
                            </label>
                            <span class="tempo-compact-separator">·</span>
                            <span class="meter-inputs">
                                <input class="tempo-compact-control tempo-meter-numerator" value="32">
                                <span>/</span>
                                <span class="tempo-meter-denominator-shell">
                                    <select class="tempo-compact-control tempo-meter-denominator"><option>32</option></select>
                                </span>
                            </span>
                        </span>
                        <span ref="summaryMeasure" class="tempo-segment-content tempo-segment-summary">300 BPM · 32/32</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="timeline-status" aria-live="polite">
            <span data-testid="editor-buffer-state">{{ bufferStateLabel }}</span>
            <span data-testid="editor-tempo-estimate-state">{{ estimateStateLabel }}</span>
            <span>游标 {{ formatTime(playback.currentTimeSeconds) }}</span>
            <span v-if="tempoLiveMessage" data-testid="tempo-live-message">{{ tempoLiveMessage }}</span>
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
    removeTempoBoundary,
    resolveTempoSegmentPresentation,
    segmentAtTime,
    segmentEndSeconds,
    selectVisibleSubdivision,
    snapEditorTime,
} from '../editor/tempoMap';
import {
    centerEditorViewport,
    editorWaveformVerticalGeometry,
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
const tempoStage = ref<HTMLDivElement | null>(null);
const fullMeasure = ref<HTMLElement | null>(null);
const summaryMeasure = ref<HTMLElement | null>(null);
const waveformCanvas = ref<HTMLCanvasElement | null>(null);
const gridCanvas = ref<HTMLCanvasElement | null>(null);
const cursorCanvas = ref<HTMLCanvasElement | null>(null);
const size = reactive({ width: 0, height: 0, dpr: 1 });
const tempoErrors = reactive<Record<string, string>>({});
const tempoBpmDrafts = reactive<Record<string, string>>({});
const tempoNumeratorDrafts = reactive<Record<string, string>>({});
const tempoLiveMessage = ref('');
const presentationWidths = reactive({ full: 420, summary: 112 });
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
const visibleTempoSegments = computed(() => props.project.tempoMap
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment, index }) => segment.startSeconds < viewport.value.endSeconds
        && segmentEndSeconds(props.project.tempoMap, index, durationSeconds.value)
            > viewport.value.startSeconds));
const fixedBoundaries = computed(() => [
    { id: 'tempo-boundary-start', timeSeconds: 0, edge: 'start' as const },
    {
        id: 'tempo-boundary-end',
        timeSeconds: durationSeconds.value,
        edge: 'end' as const,
    },
].filter((boundary) => boundary.timeSeconds >= viewport.value.startSeconds
    && boundary.timeSeconds <= viewport.value.endSeconds));
const visibleTempoGuides = computed(() => [
    ...fixedBoundaries.value.map((boundary) => ({
        id: `guide-${boundary.id}`,
        timeSeconds: boundary.timeSeconds,
    })),
    ...internalSegments.value.map((segment) => ({
        id: `guide-${segment.id}`,
        timeSeconds: segment.startSeconds,
    })),
]);

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
const segmentPixelBounds = (index: number) => {
    const segment = props.project.tempoMap[index];
    if (!segment) return { left: 0, width: 0 };
    const start = Math.max(segment.startSeconds, viewport.value.startSeconds);
    const end = Math.min(segmentEnd(index), viewport.value.endSeconds);
    const left = Math.max(0, editorTimeToX(start, viewport.value, size.width));
    const right = Math.min(size.width, editorTimeToX(end, viewport.value, size.width));
    return { left, width: Math.max(0, right - left) };
};
const segmentStyle = (index: number) => {
    const bounds = segmentPixelBounds(index);
    return {
        left: `${bounds.left / Math.max(1, size.width) * 100}%`,
        width: `${bounds.width / Math.max(1, size.width) * 100}%`,
    };
};
const segmentPresentation = (index: number) => resolveTempoSegmentPresentation(
    Math.max(0, segmentPixelBounds(index).width - 52),
    presentationWidths.full,
    presentationWidths.summary,
);
const segmentSummary = (segment: TempoSegmentV1) => segment.mode === 'single-beat'
    ? '单拍'
    : `${segment.bpm ?? '—'} BPM · ${segment.meter.numerator}/${segment.meter.denominator}`;
const measurePresentationWidths = () => {
    presentationWidths.full = Math.ceil(fullMeasure.value?.scrollWidth ?? 420);
    presentationWidths.summary = Math.ceil(summaryMeasure.value?.scrollWidth ?? 112);
};

const replaceTempoSegment = (next: TempoSegmentV1) => {
    emit('updateProject', {
        ...props.project,
        tempoMap: props.project.tempoMap.map((segment) =>
            segment.id === next.id ? next : segment),
    }, true);
};
const clearError = (id: string) => {
    delete tempoErrors[id];
    tempoLiveMessage.value = '';
};
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
        tempoLiveMessage.value = result.message;
        return;
    }
    delete tempoErrors[id];
    delete tempoBpmDrafts[id];
    tempoLiveMessage.value = 'BPM 已保存。';
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
        tempoLiveMessage.value = result.message;
        return;
    }
    delete tempoErrors[id];
    delete tempoNumeratorDrafts[id];
    tempoLiveMessage.value = '拍号已保存。';
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
    tempoLiveMessage.value = '区间已切回 4/4 · 100 BPM。';
};
const sourceLabel = (source: 'unset' | 'estimated' | 'user') => ({
    unset: '等待输入或自动估计',
    estimated: '自动估计',
    user: '用户输入',
}[source]);
const segmentAccessibleLabel = (segment: TempoSegmentV1, index: number) =>
    segment.mode === 'single-beat'
        ? `区间 ${index + 1}，单拍`
        : `区间 ${index + 1}，${segment.bpm ?? '未设置'} BPM，拍号 ${segment.meter.numerator}/${segment.meter.denominator}，${sourceLabel(segment.bpmSource)}`;

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
    tempoLiveMessage.value = '已新增 Tempo 边界。';
    emit('updateProject', { ...props.project, tempoMap }, true);
};

const removeBoundary = (id: string) => {
    const index = props.project.tempoMap.findIndex((segment) => segment.id === id);
    if (index <= 0) {
        tempoLiveMessage.value = index === 0
            ? '歌曲开始边界不可删除。'
            : 'Tempo 边界不存在。';
        return;
    }
    const removed = props.project.tempoMap[index]!;
    const tempoMap = removeTempoBoundary(props.project.tempoMap, id);
    delete tempoErrors[id];
    delete tempoBpmDrafts[id];
    delete tempoNumeratorDrafts[id];
    if (boundaryDrag.value?.id === id) boundaryDrag.value = null;
    tempoLiveMessage.value = `已删除 ${formatTime(removed.startSeconds)} 的 Tempo 边界，前一区间已向右延伸。`;
    emit('updateProject', { ...props.project, tempoMap }, true);
    void nextTick(() => tempoStage.value?.focus());
};

const boundaryDrag = ref<{ id: string; pointerId: number; original: TempoSegmentV1[] } | null>(null);
const beginBoundaryDrag = (event: PointerEvent, id: string) => {
    if (event.button !== 0) return;
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
    if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeBoundary(id);
        return;
    }
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
        const { centerY, amplitude } = editorWaveformVerticalGeometry(
            size.height,
        );
        waveform.beginPath();
        for (let index = range.startIndex; index < range.endIndex; index += 1) {
            const x = editorTimeToX(index * series.sampleStepSeconds, viewport.value, size.width);
            const value = waveformEnvelopeAt(series.payload, index);
            waveform.moveTo(x, centerY - value.max * amplitude);
            waveform.lineTo(x, centerY - value.min * amplitude);
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
    () => [props.project.tempoMap, size.width],
    () => void nextTick(measurePresentationWidths),
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
        void nextTick(measurePresentationWidths);
    });
    if (stage.value) resizeObserver.observe(stage.value);
    void nextTick(measurePresentationWidths);
    window.addEventListener('blur', clearPointer);
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    window.removeEventListener('blur', clearPointer);
});
</script>

<style scoped>
.editor-timeline-panel {
    margin-top: 1px;
    border-top: 1px solid var(--hairline);
    border-bottom: 1px solid var(--hairline);
    border-radius: 0;
    padding: 0;
    background: var(--editor-panel-mid);
    --editor-lane-name-width: 152px;
    --editor-inner-class-width: 144px;
}
.timeline-heading,
.timeline-titleline,
.timeline-controls,
.timeline-status,
.tempo-compact-field,
.meter-inputs {
    display: flex;
    align-items: center;
}
.timeline-heading {
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--divider);
}
.timeline-titleline { min-width: 0; gap: 10px; }
.timeline-heading h2 { margin: 0; font-size: .96rem; white-space: nowrap; }
.timeline-titleline p { margin: 0; color: var(--body); font-size: .76rem; white-space: nowrap; }
.timeline-kicker { color: var(--accent-soft); font-size: .68rem; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
.timeline-controls { flex-wrap: wrap; gap: 8px; }
button,
input,
select {
    min-height: var(--editor-control-height, 30px);
    border: 1px solid var(--hairline-focus);
    border-radius: var(--editor-control-radius, 4px);
    padding: 4px 9px;
    color: var(--ink);
    background: var(--editor-control-strong);
}
button:focus-visible,
input:focus-visible,
select:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; }
button:disabled { opacity: .4; }
.timeline-layout-row {
    display: grid;
    grid-template-columns: var(--editor-lane-name-width) var(--editor-inner-class-width) minmax(420px, 1fr);
    min-width: 760px;
    margin-top: 0;
}
.timeline-track-rail,
.timeline-class-rail {
    display: grid;
    align-content: center;
    gap: 3px;
    padding: 8px;
    border-right: 1px solid var(--divider);
    border-right: 0;
    color: var(--body);
    background: var(--editor-rail);
}
.timeline-track-rail { border-right: 1px solid var(--divider); border-radius: 0; }
.timeline-class-rail { border-right: 1px solid var(--divider); }
.timeline-track-rail strong,
.timeline-class-rail strong { color: var(--ink); }
.timeline-time-column {
    position: relative;
    min-width: 0;
    --editor-timeline-stage-height: 88px;
}
.timeline-stage {
    position: relative;
    z-index: 1;
    height: var(--editor-timeline-stage-height);
    overflow: hidden;
    border: 0;
    border-radius: 0;
    background: linear-gradient(180deg, var(--editor-stage-top), var(--editor-stage-bottom));
    cursor: crosshair;
    touch-action: none;
    user-select: none;
}
.timeline-canvas { position: absolute; inset: 0; pointer-events: none; }
.grid-canvas { z-index: 2; }
.cursor-canvas { z-index: 3; }
.add-boundary {
    position: absolute;
    z-index: 5;
    top: 50%;
    right: 8px;
    min-width: 32px;
    transform: translateY(-50%);
    cursor: pointer;
}
.timeline-menu {
    position: absolute;
    z-index: 10;
    display: grid;
    min-width: 165px;
    padding: 6px;
    border: 1px solid var(--hairline-focus);
    border-radius: var(--editor-flyout-radius, 8px);
    background: var(--editor-menu);
    box-shadow: 0 14px 40px rgba(0,0,0,.5);
}
.timeline-menu button { border: 0; text-align: left; }
.timeline-status {
    box-sizing: border-box;
    flex-wrap: nowrap;
    gap: 14px;
    width: 100%;
    min-width: 760px;
    height: 28px;
    min-height: 28px;
    overflow: hidden;
    padding: 4px 8px;
    border-top: 1px solid var(--divider);
    color: var(--body);
    font-size: .76rem;
    white-space: nowrap;
}
.tempo-guide-layer {
    position: absolute;
    z-index: 6;
    top: calc(var(--editor-timeline-stage-height) - 12px);
    right: 0;
    left: 0;
    height: 12px;
    overflow: hidden;
    pointer-events: none;
}
.tempo-boundary-guide {
    position: absolute;
    bottom: 0;
    width: 1px;
    height: 12px;
    background: var(--hairline-focus);
    transform: translateX(-.5px);
}
.tempo-lane-stage {
    position: relative;
    z-index: 5;
    height: 28px;
    min-width: 0;
    overflow: hidden;
    background: var(--editor-lane-deep);
    user-select: none;
}
.tempo-lane-stage:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: -2px; }
.tempo-segment {
    position: absolute;
    z-index: 2;
    top: 0;
    bottom: 0;
    overflow: hidden;
}
.tempo-segment-content {
    position: absolute;
    top: 10px;
    left: 26px;
    right: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: max-content;
    height: 18px;
    color: var(--ink);
    font-size: 11px;
    line-height: 1;
    white-space: nowrap;
}
.tempo-compact-field { gap: 3px; margin: 0; white-space: nowrap; }
.meter-inputs { gap: 2px; }
.tempo-compact-control {
    box-sizing: border-box;
    min-height: 18px;
    height: 18px;
    border: 0;
    border-bottom: 1px solid transparent;
    border-radius: 0;
    padding: 0 2px;
    color: var(--ink);
    background: transparent;
    font: inherit;
    line-height: 17px;
    text-align: center;
}
.tempo-compact-control:hover,
.tempo-compact-control:focus-visible,
.tempo-compact-control[aria-invalid='true'] {
    border-bottom-color: var(--accent-soft);
}
.tempo-compact-control:focus-visible {
    outline: 0;
}
.tempo-bpm-input { width: 52px; }
.tempo-meter-numerator { width: 28px; }
.tempo-meter-denominator-shell {
    position: relative;
    display: inline-flex;
    flex: 0 0 42px;
    width: 42px;
    height: 18px;
}
.tempo-meter-denominator-shell::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 4px;
    width: 5px;
    height: 5px;
    border-right: 1px solid var(--body);
    border-bottom: 1px solid var(--body);
    pointer-events: none;
    transform: translateY(-70%) rotate(45deg);
}
.tempo-meter-denominator {
    width: 42px;
    padding: 0 15px 0 3px;
    appearance: none;
    -webkit-appearance: none;
    text-align: center;
    text-align-last: center;
}
.tempo-compact-separator { color: var(--mute); }
.tempo-compact-action {
    min-height: 18px;
    height: 18px;
    border: 0;
    border-bottom: 1px solid transparent;
    border-radius: 0;
    padding: 0 2px;
    background: transparent;
    color: var(--body);
    font: inherit;
    line-height: 17px;
}
.tempo-compact-action:hover,
.tempo-compact-action:focus-visible {
    border-bottom-color: var(--accent-soft);
    outline: 0;
}
.single-beat,
.tempo-segment-summary { color: var(--body); white-space: nowrap; }
.tempo-lane-boundary {
    position: absolute;
    z-index: 5;
    top: 0;
    bottom: 0;
    width: 28px;
    min-width: 0;
    min-height: 0;
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
    color: var(--accent-soft);
    transform: translateX(-50%);
    cursor: ew-resize;
}
.tempo-lane-boundary:hover,
.tempo-lane-boundary:focus-visible { color: var(--accent-bright); background: transparent; }
.tempo-lane-boundary--fixed { pointer-events: none; }
.boundary-caret {
    position: absolute;
    top: 0;
    left: 50%;
    font-size: 12px;
    font-weight: 800;
    line-height: 10px;
    transform: translateX(-50%);
}
.boundary-time {
    position: absolute;
    top: 11px;
    left: 50%;
    color: var(--ink);
    font-size: 10px;
    line-height: 10px;
    white-space: nowrap;
    transform: translateX(-50%);
}
.tempo-lane-boundary--start .boundary-time { transform: translateX(2px); }
.tempo-lane-boundary--end .boundary-time { transform: translateX(calc(-100% - 2px)); }
.tempo-measure {
    position: absolute;
    left: -100000px;
    top: -100000px;
    visibility: hidden;
    pointer-events: none;
}
.tempo-measure .tempo-segment-content {
    position: static;
    width: max-content;
    padding-inline: 4px;
}
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (max-width: 900px) {
    .timeline-heading { align-items: flex-start; flex-wrap: wrap; }
    .timeline-titleline { flex-wrap: wrap; }
    .timeline-time-column { --editor-timeline-stage-height: 72px; }
    .editor-timeline-panel { overflow-x: auto; }
}
@media (prefers-reduced-motion: reduce) {
    * { scroll-behavior: auto !important; transition: none !important; }
}
</style>
