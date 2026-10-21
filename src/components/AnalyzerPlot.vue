<template>
    <div
        ref="plotElement"
        class="plot"
        :class="{ 'plot-structured': isStructuredFeature }"
        :data-zoom="viewport.zoom"
        :data-start="viewport.startSeconds"
        :data-end="viewport.endSeconds"
        role="application"
        tabindex="0"
        :aria-label="definition.label + ' 分析图表。滚轮缩放，点击或使用方向键定位播放游标。'"
        @click="handlePlotClick"
        @keydown="handlePlotKeydown"
        @wheel="handlePlotWheel">
        <canvas ref="staticCanvas" aria-hidden="true"></canvas>
        <canvas ref="cursorCanvas" aria-hidden="true"></canvas>
        <div v-if="!series && !rendererError" class="plot-message">
            <span v-if="analysisState === 'error'">分析暂不可用，请重试分析。</span>
            <span v-else-if="analysisState === 'cancelled'">分析已取消。</span>
            <span v-else>{{ analysisState === 'ready' ? '等待此卡数据…' : '正在准备分析…' }}</span>
        </div>
        <div v-if="rendererError" class="plot-message plot-error">
            <p>{{ rendererError }}</p>
            <button type="button" @click.stop="retryRenderer">重试此卡</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import { canvasXToTime } from '../analysis/timelineViewport';
import { analysisCanvasRenderer, prepareCanvasSurface, type EditorRenderRequest } from '../analysis/canvasRenderer';
import type { AnalysisCoordinatorState, AnalysisCursorValueResult, AnalysisSeries, FeatureId } from '../analysis/types';
import type { PersistedTimelineViewport } from '../types/session';

const props = defineProps<{
    featureId: FeatureId;
    series: AnalysisSeries | null;
    viewport: PersistedTimelineViewport;
    cursorSeconds: number;
    durationSeconds: number;
    exactValue: AnalysisCursorValueResult | null;
    analysisState: AnalysisCoordinatorState;
}>();
const emit = defineEmits<{
    seek: [seconds: number];
    zoom: [factor: number, anchorSeconds: number];
}>();
const definition = computed(() => FEATURE_REGISTRY[props.featureId]);
const isStructuredFeature = computed(
    () =>
        props.featureId === 'wallpaperEngineSpectrum' ||
        props.featureId === 'loudness' ||
        props.featureId === 'complexSpectrum',
);
const staticCanvas = ref<HTMLCanvasElement | null>(null);
const cursorCanvas = ref<HTMLCanvasElement | null>(null);
const plotElement = ref<HTMLElement | null>(null);
const rendererError = ref<string | null>(null);
const renderRevision = ref(0);
let resizeObserver: ResizeObserver | null = null;

const handlePlotWheel = (event: WheelEvent) => {
    if (event.deltaY === 0 || event.ctrlKey || event.metaKey || props.durationSeconds <= 0) return;
    const rect = plotElement.value?.getBoundingClientRect();
    if (!rect?.width || (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    emit(
        'zoom',
        event.deltaY < 0 ? 1.12 : 1 / 1.12,
        canvasXToTime(event.clientX - rect.left, props.viewport, rect.width),
    );
};
const handlePlotClick = (event: MouseEvent) => {
    const rect = plotElement.value?.getBoundingClientRect();
    if (!rect) return;
    emit('seek', canvasXToTime(event.clientX - rect.left, props.viewport, rect.width));
};

const handlePlotKeydown = (event: KeyboardEvent) => {
    const span = props.viewport.endSeconds - props.viewport.startSeconds;
    const step = Math.max(0.05, Math.min(1, span / 20));
    let target: number | null = null;
    if (event.key === 'ArrowLeft') {
        target = props.cursorSeconds - step;
    } else if (event.key === 'ArrowRight') {
        target = props.cursorSeconds + step;
    } else if (event.key === 'Home') {
        target = 0;
    } else if (event.key === 'End') {
        target = props.durationSeconds;
    }
    if (target === null) return;
    event.preventDefault();
    emit('seek', Math.max(0, Math.min(props.durationSeconds, target)));
};

const canvasMetrics = () => {
    const rect = plotElement.value?.getBoundingClientRect();
    return {
        width: Math.max(1, Math.round(rect?.width ?? 1)),
        height: Math.max(1, Math.round(rect?.height ?? 1)),
        dpr: Math.max(1, window.devicePixelRatio || 1),
    };
};

const renderRequest = (): EditorRenderRequest => {
    const metrics = canvasMetrics();
    return {
        feature: definition.value,
        series: props.series,
        viewport: props.viewport,
        durationSeconds: props.durationSeconds,
        widthCssPixels: metrics.width,
        heightCssPixels: metrics.height,
        devicePixelRatio: metrics.dpr,
    };
};

const prepareCanvas = (canvas: HTMLCanvasElement) => {
    const metrics = canvasMetrics();
    return prepareCanvasSurface(canvas, metrics.width, metrics.height, metrics.dpr);
};

const drawStatic = () => {
    const canvas = staticCanvas.value;
    if (!canvas) return;
    analysisCanvasRenderer.drawStatic(renderRequest(), prepareCanvas(canvas));
};

const drawCursor = () => {
    const canvas = cursorCanvas.value;
    if (!canvas) return;
    analysisCanvasRenderer.drawCursor(renderRequest(), props.cursorSeconds, props.exactValue, prepareCanvas(canvas));
};

const render = async () => {
    await nextTick();
    if (disposed) return;
    try {
        drawStatic();
        drawCursor();
        rendererError.value = null;
    } catch (error) {
        rendererError.value = error instanceof Error ? error.message : '此卡 renderer 出错。';
    }
};

const retryRenderer = () => {
    renderRevision.value += 1;
    void render();
};

watch(
    () => [
        props.series,
        props.viewport.startSeconds,
        props.viewport.endSeconds,
        props.viewport.zoom,
        props.featureId,
        renderRevision.value,
    ],
    () => {
        void render();
    },
    { deep: false },
);

watch(
    () => [props.cursorSeconds, props.exactValue],
    () => {
        try {
            drawCursor();
        } catch (error) {
            rendererError.value = error instanceof Error ? error.message : '游标层 renderer 出错。';
        }
    },
    { deep: false },
);

let disposed = false;
onMounted(async () => {
    await nextTick();
    if (disposed) return;
    resizeObserver = new ResizeObserver(() => void render());
    if (plotElement.value) resizeObserver.observe(plotElement.value);
    void render();
});
onBeforeUnmount(() => {
    disposed = true;
    resizeObserver?.disconnect();
    resizeObserver = null;
});
</script>

<style scoped>
.plot {
    border: 1px solid var(--hairline-soft);
    border-radius: 12px;
    cursor: crosshair;
    height: 250px;
    overflow: hidden;
    position: relative;
}

.plot.plot-structured {
    height: 320px;
}

.plot canvas {
    inset: 0;
    position: absolute;
}

.plot-message {
    align-items: center;
    background: var(--surface-card-soft);
    color: var(--body);
    display: flex;
    flex-direction: column;
    gap: 12px;
    inset: 0;
    justify-content: center;
    padding: 20px;
    position: absolute;
    text-align: center;
}

.plot-error {
    color: var(--error);
}

.plot:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
button {
    color: var(--ink);
    background: var(--surface-1);
    border: 1px solid var(--hairline);
    border-radius: 6px;
    padding: 6px 9px;
    cursor: pointer;
}
button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
</style>
