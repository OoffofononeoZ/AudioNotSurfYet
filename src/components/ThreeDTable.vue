<template>
    <div
        class="three-d-plot"
        ref="container"
        :style="panelHeight ? { height: chartHeight + 'px' } : undefined"
        :class="{ 'is-slice': slice }"
        :data-view="slice ? 'orthographic' : 'perspective'"
        :data-selected="selected"
        :data-zoom="viewport.zoom"
        :data-start="viewport.startSeconds"
        :data-end="viewport.endSeconds"
        :data-camera-zoom="cameraZoom"
        :aria-busy="building"
        data-testid="three-d-plot">
        <div class="three-d-tools" aria-label="3D 图表工具">
            <div v-if="featureId === 'complexSpectrum'" class="complex-switch" aria-label="复数谱分量">
                <button type="button" :aria-pressed="complexView === 'magnitude'" @click="complexView = 'magnitude'">
                    幅度
                </button>
                <button type="button" :aria-pressed="complexView === 'phase'" @click="complexView = 'phase'">
                    相位
                </button>
            </div>
            <button
                type="button"
                aria-label="放大图表"
                title="放大图表"
                :disabled="!!rendererError"
                @click="zoomCamera(1.2)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <button
                type="button"
                aria-label="缩小图表"
                title="缩小图表"
                :disabled="!!rendererError"
                @click="zoomCamera(1 / 1.2)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
            </button>
            <button
                type="button"
                :aria-label="slice ? '返回3D图表' : '切换伪2D图表'"
                :title="slice ? '返回3D图表' : '切换伪2D图表'"
                :aria-pressed="slice"
                :disabled="!!rendererError"
                @click="toggleSlice">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path :d="slice ? 'M12 3 3 8v9l9 5 9-5V8ZM3 8l9 5 9-5M12 13v9' : 'M4 3v17h17M8 15l4-6 4 3 4-7'" />
                </svg>
            </button>
        </div>
        <div v-if="slice && series" class="slice-selector">
            <span class="slice-axis-title">{{ axisLabel }}</span>
            <div
                ref="rail"
                class="slice-rail"
                role="slider"
                tabindex="0"
                aria-orientation="vertical"
                aria-label="选择图表分量"
                :aria-valuemin="0"
                :aria-valuemax="count - 1"
                :aria-valuenow="selected"
                :aria-valuetext="selectedLabel"
                @pointerdown="beginSelect"
                @pointermove="moveSelect"
                @pointerup="endSelect"
                @pointercancel="endSelect"
                @lostpointercapture="endSelect"
                @keydown="selectKey">
                <span
                    v-for="index in ticks"
                    :key="index"
                    class="slice-tick"
                    :style="{ top: (index / Math.max(1, count - 1)) * 100 + '%' }">
                    {{ tickLabel(index) }}
                </span>
                <span
                    class="slice-arrow"
                    :style="{ top: (selected / Math.max(1, count - 1)) * 100 + '%' }"
                    aria-hidden="true"
                    >▶</span
                >
            </div>
            <input
                class="slice-index"
                type="number"
                aria-label="分量索引"
                :min="0"
                :max="count - 1"
                :value="selected"
                @change="selectIndex(Number(($event.target as HTMLInputElement).value))" />
        </div>
        <div
            ref="stage"
            class="three-d-stage"
            role="application"
            tabindex="0"
            :aria-label="definition.label + '。左键拖动平移，右键拖动旋转，滚轮调整时间范围。方向键定位播放。'"
            @pointerdown="beginPointer"
            @pointermove="movePointer"
            @pointerup="endPointer"
            @pointercancel="cancelPointer"
            @lostpointercapture="cancelPointer"
            @keydown="plotKey"
            @wheel="wheel"
            @contextmenu.prevent>
            <canvas :key="renderKey" ref="canvas" aria-hidden="true" @webglcontextlost="contextLost"></canvas>
            <canvas ref="overlay" class="axis-overlay" aria-hidden="true"></canvas>
        </div>
        <span v-if="building && series && !rendererError" class="building-label" role="status">更新图表…</span>
        <p class="three-d-hint">{{ slice ? '左侧选择分量 · 拖动平移' : '左键平移 · 右键旋转' }} · 滚轮调整时间范围</p>
        <div v-if="rendererError || !series" class="three-d-message" :role="rendererError ? 'alert' : 'status'">
            <template v-if="rendererError"
                ><span>{{ rendererError }}</span
                ><button type="button" @click="retry">重试图表</button></template
            >
            <span v-else>{{
                analysisState === 'error'
                    ? '分析暂不可用，请重试分析。'
                    : analysisState === 'cancelled'
                      ? '分析已取消。'
                      : '正在准备分析…'
            }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import {
    buildThreeDGrid,
    componentAxisLabel,
    componentCount,
    componentLabel,
    exactComponent,
    type ComplexView,
} from '../analysis/threeDData';
import { ThreeDRenderer } from './analyzer/threeDRenderer';
import type { AnalysisSeries, FeatureId, AnalysisCoordinatorState, AnalysisCursorValueResult } from '../analysis/types';
import type { PersistedTimelineViewport } from '../types/session';

const props = defineProps<{
    featureId: FeatureId;
    series: AnalysisSeries | null;
    viewport: PersistedTimelineViewport;
    cursorSeconds: number;
    durationSeconds: number;
    sampleRate: number | null;
    exactValue: AnalysisCursorValueResult | null;
    analysisState: AnalysisCoordinatorState;
    panelHeight?: number;
}>();
const emit = defineEmits<{ seek: [seconds: number]; zoom: [factor: number, anchorSeconds: number] }>();
const definition = computed(() => FEATURE_REGISTRY[props.featureId]);
const canvas = ref<HTMLCanvasElement | null>(null),
    overlay = ref<HTMLCanvasElement | null>(null);
const container = ref<HTMLElement | null>(null),
    chartHeight = ref(320);
const stage = ref<HTMLElement | null>(null),
    rail = ref<HTMLElement | null>(null);
const slice = ref(false),
    selected = ref(0),
    complexView = ref<ComplexView>('magnitude');
const rendererError = ref(''),
    building = ref(false),
    renderKey = ref(0),
    cameraZoom = ref(1);
const count = computed(() => (props.series ? componentCount(props.series) : 1));
const axisLabel = computed(() => (props.series ? componentAxisLabel(props.series) : '分量'));
const selectedLabel = computed(() =>
    props.series ? componentLabel(props.series, selected.value, props.sampleRate ?? 44100) : '',
);
const ticks = computed(() => {
    if (count.value <= 25) return Array.from({ length: count.value }, (_, i) => i);
    const values = Array.from({ length: 7 }, (_, i) => Math.round((i * (count.value - 1)) / 6));
    if (props.featureId === 'wallpaperEngineSpectrum') return [0, 16, 32, 48, 64, 80, 96, 112, 127];
    return values;
});
const tickLabel = (index: number) =>
    props.featureId === 'wallpaperEngineSpectrum'
        ? `${index < 64 ? 'L' : 'R'}${index % 64}`
        : props.featureId === 'chroma'
          ? componentLabel(props.series!, index, props.sampleRate ?? 44100)
          : props.featureId === 'loudness' && index === 24
            ? '总计'
            : String(index);
let renderer: ThreeDRenderer | null = null,
    observer: ResizeObserver | null = null;
let revision = 0,
    disposed = false,
    selectionPointer: number | null = null,
    savedZoom = 1;
let pointer: {
    id: number;
    button: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
} | null = null;

const resize = () => {
    if (props.panelHeight && container.value) {
        // The article is the positioned ancestor; reserve its padding and the panel's 24px handle.
        chartHeight.value = Math.max(220, Math.min(560, props.panelHeight - container.value.offsetTop - 40));
    }
    const rect = stage.value?.getBoundingClientRect();
    if (rect?.width && rect.height) renderer?.resize(rect.width, rect.height, window.devicePixelRatio || 1);
};
const updateCursor = () =>
    renderer?.setCursor(
        props.cursorSeconds,
        selectedLabel.value,
        exactComponent(props.exactValue, selected.value, complexView.value),
    );
const fail = (message: string) => {
    if (disposed || rendererError.value) return;
    rendererError.value = message;
    revision++;
    building.value = false;
    const current = renderer;
    renderer = null;
    current?.dispose();
};
const rebuild = async () => {
    const token = ++revision,
        current = renderer,
        series = props.series;
    if (!current || !series) {
        building.value = false;
        current?.clear();
        return;
    }
    building.value = true;
    const cancelled = () => disposed || token !== revision || renderer !== current;
    try {
        const grid = await buildThreeDGrid(series, props.viewport, {
            view: complexView.value,
            selected: slice.value ? selected.value : null,
            cancelled,
        });
        if (cancelled()) return;
        if (grid) {
            const max = componentCount(series) - 1;
            const tickIndices = [0, Math.floor(max / 2), max];
            const axisTicks = tickIndices.map(index => ({
                index,
                label:
                    series.featureId === 'wallpaperEngineSpectrum' && index === 63
                        ? 'L │ R'
                        : series.featureId === 'chroma'
                          ? componentLabel(series, index, props.sampleRate ?? 44100)
                          : series.featureId === 'loudness' && index === 24
                            ? '总'
                            : String(index),
            }));
            await current.setGrid(
                grid,
                props.featureId === 'loudness',
                componentAxisLabel(series),
                cancelled,
                axisTicks,
            );
        } else current.clear();
        if (!cancelled()) updateCursor();
    } catch (error) {
        if (!cancelled()) fail(error instanceof Error ? error.message : '3D 图表绘制失败。');
    } finally {
        if (!cancelled()) building.value = false;
    }
};
const createRenderer = () => {
    if (disposed || !canvas.value || !overlay.value) return;
    try {
        renderer = new ThreeDRenderer(canvas.value, overlay.value, error =>
            fail(error instanceof Error ? error.message : '3D 图表绘制失败。'),
        );
        renderer.setSliceMode(slice.value);
        renderer.setViewport(props.viewport);
        resize();
        void rebuild();
    } catch (error) {
        fail(error instanceof Error ? error.message : '无法创建 3D 图表，请检查 WebGL。');
    }
};
const contextLost = (event: Event) => {
    event.preventDefault();
    fail('3D 图表的图形上下文已丢失，请重试。');
};
const retry = async () => {
    rendererError.value = '';
    renderKey.value++;
    cameraZoom.value = 1;
    await nextTick();
    createRenderer();
};
const toggleSlice = () => {
    cancelPointer();
    if (!slice.value) {
        savedZoom = cameraZoom.value;
        cameraZoom.value = 1;
    } else cameraZoom.value = savedZoom;
    slice.value = !slice.value;
    renderer?.setSliceMode(slice.value);
    void nextTick(resize);
};
const zoomCamera = (factor: number) => {
    cameraZoom.value = Math.max(0.5, Math.min(3, cameraZoom.value * factor));
    renderer?.zoom(factor);
};
const selectIndex = (value: number) => {
    if (Number.isFinite(value)) selected.value = Math.max(0, Math.min(count.value - 1, Math.round(value)));
};
const selectAt = (event: PointerEvent) => {
    const rect = rail.value?.getBoundingClientRect();
    if (rect?.height) selectIndex(((event.clientY - rect.top) / rect.height) * (count.value - 1));
};
const beginSelect = (event: PointerEvent) => {
    if (event.button !== 0 || selectionPointer !== null) return;
    event.preventDefault();
    selectionPointer = event.pointerId;
    rail.value?.focus({ preventScroll: true });
    rail.value?.setPointerCapture(event.pointerId);
    selectAt(event);
};
const moveSelect = (event: PointerEvent) => {
    if (event.pointerId === selectionPointer) selectAt(event);
};
const endSelect = (event?: PointerEvent) => {
    if (event && event.pointerId !== selectionPointer) return;
    const id = selectionPointer;
    selectionPointer = null;
    if (id !== null && rail.value?.hasPointerCapture(id)) rail.value.releasePointerCapture(id);
};
const selectKey = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 1;
    const values: Record<string, number> = {
        ArrowDown: selected.value + step,
        ArrowRight: selected.value + step,
        ArrowUp: selected.value - step,
        ArrowLeft: selected.value - step,
        Home: 0,
        End: count.value - 1,
        PageDown: selected.value + 10,
        PageUp: selected.value - 10,
    };
    if (event.key in values) {
        event.preventDefault();
        selectIndex(values[event.key]!);
    }
};
const beginPointer = (event: PointerEvent) => {
    if (pointer || !renderer || ![0, 2].includes(event.button)) return;
    event.preventDefault();
    stage.value?.focus({ preventScroll: true });
    pointer = {
        id: event.pointerId,
        button: event.button,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
    };
    stage.value?.setPointerCapture(event.pointerId);
};
const movePointer = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.id) return;
    pointer.moved ||= Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 4;
    if (pointer.moved) {
        if (pointer.button === 0) renderer?.pan(event.clientX - pointer.x, event.clientY - pointer.y);
        else renderer?.rotate(event.clientX - pointer.x, event.clientY - pointer.y);
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
};
const cancelPointer = (event?: PointerEvent) => {
    if (event && pointer?.id !== event.pointerId) return;
    const id = pointer?.id;
    pointer = null;
    if (id !== undefined && stage.value?.hasPointerCapture(id)) stage.value.releasePointerCapture(id);
};
const endPointer = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const seek = !pointer.moved && pointer.button === 0;
    cancelPointer(event);
    const rect = stage.value?.getBoundingClientRect();
    if (seek && rect && renderer && props.durationSeconds > 0)
        emit('seek', renderer.timeAt(event.clientX - rect.left, event.clientY - rect.top));
};
const wheel = (event: WheelEvent) => {
    if (!event.deltaY || event.ctrlKey || event.metaKey || props.durationSeconds <= 0) return;
    const rect = stage.value?.getBoundingClientRect();
    if (!rect || !renderer) return;
    event.preventDefault();
    event.stopPropagation();
    emit(
        'zoom',
        event.deltaY < 0 ? 1.12 : 1 / 1.12,
        renderer.timeAt(event.clientX - rect.left, event.clientY - rect.top),
    );
};
const plotKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
        cancelPointer();
        return;
    }
    const step = Math.max(0.05, Math.min(1, (props.viewport.endSeconds - props.viewport.startSeconds) / 20));
    const values: Record<string, number> = {
        ArrowLeft: props.cursorSeconds - step,
        ArrowRight: props.cursorSeconds + step,
        Home: 0,
        End: props.durationSeconds,
    };
    if (event.key in values) {
        event.preventDefault();
        emit('seek', Math.max(0, Math.min(props.durationSeconds, values[event.key]!)));
    }
};
const blur = () => {
    cancelPointer();
    endSelect();
};
watch(
    () => [
        props.series,
        props.viewport.startSeconds,
        props.viewport.endSeconds,
        slice.value,
        slice.value ? selected.value : null,
        complexView.value,
    ],
    () => {
        renderer?.setViewport(props.viewport);
        void rebuild();
    },
);
watch(() => [props.cursorSeconds, props.exactValue, selectedLabel.value], updateCursor);
watch(
    () => props.series,
    () => selectIndex(selected.value),
);
watch(() => props.panelHeight, resize, { flush: 'post' });
onMounted(() => {
    createRenderer();
    observer = new ResizeObserver(resize);
    if (stage.value) observer.observe(stage.value);
    if (container.value?.offsetParent) observer.observe(container.value.offsetParent);
    window.addEventListener('blur', blur);
});
onBeforeUnmount(() => {
    disposed = true;
    revision++;
    blur();
    observer?.disconnect();
    renderer?.dispose();
    renderer = null;
    window.removeEventListener('blur', blur);
});
</script>

<style scoped>
.three-d-plot {
    position: relative;
    height: clamp(320px, 51vh, 560px);
    overflow: hidden;
    border: 1px solid var(--hairline-soft);
    border-radius: 12px;
    background: radial-gradient(ellipse at 55% 70%, var(--glow-accent), transparent 65%), var(--surface-card-soft);
}
.three-d-stage {
    position: absolute;
    inset: 0;
    outline-offset: -3px;
    touch-action: none;
    cursor: grab;
}
.three-d-stage:active {
    cursor: grabbing;
}
.three-d-stage:focus-visible,
button:focus-visible,
.slice-rail:focus-visible,
input:focus-visible {
    outline: 2px solid var(--accent);
}
.three-d-stage canvas {
    position: absolute;
    width: 100%;
    height: 100%;
    inset: 0;
}
.axis-overlay {
    pointer-events: none;
}
.three-d-tools {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    gap: 5px;
    z-index: 2;
}
button {
    display: grid;
    place-items: center;
    border: 1px solid var(--hairline-soft);
    border-radius: 6px;
    background: var(--surface-toolbar);
    color: var(--body);
    cursor: pointer;
    min-width: 32px;
    height: 32px;
}
button:hover,
button[aria-pressed='true'] {
    color: var(--accent);
    background: var(--control-hover);
}
button:disabled {
    opacity: 0.4;
    cursor: default;
}
button svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.complex-switch {
    display: flex;
    gap: 2px;
    margin-right: 5px;
}
.complex-switch button {
    padding: 0 9px;
    font-size: 12px;
}
.three-d-hint {
    position: absolute;
    bottom: 9px;
    right: 13px;
    margin: 0;
    font-size: 10px;
    color: var(--mute);
    pointer-events: none;
}
.building-label {
    position: absolute;
    top: 15px;
    left: 14px;
    color: var(--mute);
    font-size: 11px;
    pointer-events: none;
}
.three-d-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    position: absolute;
    inset: 0;
    background: var(--surface-card-soft);
    color: var(--body);
    z-index: 3;
}
.three-d-message[role='alert'] {
    color: var(--error);
}
.three-d-message button {
    padding: 0 12px;
}
.is-slice .three-d-stage {
    left: 96px;
}
.slice-selector {
    position: absolute;
    inset: 54px auto 42px 12px;
    width: 75px;
    display: flex;
    flex-direction: column;
    color: var(--mute);
    font:
        10px ui-monospace,
        monospace;
}
.slice-axis-title {
    padding-bottom: 14px;
    font-size: 10px;
}
.slice-rail {
    position: relative;
    flex: 1;
    margin: 0 9px 16px 0;
    border-right: 1px solid var(--hairline-soft);
    touch-action: none;
    cursor: ns-resize;
}
.slice-tick {
    position: absolute;
    right: 9px;
    transform: translateY(-50%);
    pointer-events: none;
    white-space: nowrap;
}
.slice-arrow {
    position: absolute;
    right: -7px;
    color: var(--accent);
    transform: translateY(-50%);
    filter: drop-shadow(0 0 4px var(--accent));
    pointer-events: none;
}
.slice-index {
    width: 64px;
    min-width: 0;
    border: 1px solid var(--hairline-soft);
    border-radius: 4px;
    background: var(--surface-1);
    color: var(--ink);
    padding: 4px;
}
@media (max-width: 600px) {
    .three-d-hint {
        display: none;
    }
    .three-d-tools {
        top: 8px;
        right: 8px;
    }
    .is-slice .three-d-stage {
        left: 68px;
    }
    .slice-selector {
        left: 7px;
        width: 56px;
    }
    .slice-index {
        width: 48px;
    }
}
</style>
