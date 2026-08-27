<template>
    <div
        ref="host"
        class="analysis-overlay-host"
        :style="hostStyle"
        data-testid="editor-analysis-overlay-host"
        aria-label="Editor 分析叠加层"
    >
        <section
            class="analysis-overlay-panel"
            :class="{ 'has-feature': featureId }"
            :style="panelStyle"
            :data-feature-id="featureId ?? 'none'"
            :data-analysis-state="analysis.state"
            :data-renderer-error="overlayError ? 'true' : 'false'"
            data-testid="editor-analysis-overlay-panel"
        >
            <div class="overlay-controls">
                <label>
                    <span>声音特征</span>
                    <select
                        :value="featureId ?? ''"
                        data-testid="editor-overlay-feature"
                        @change="selectFeature"
                    >
                        <option value="">关闭叠加</option>
                        <option
                            v-for="option in featureOptions"
                            :key="option.id"
                            :value="option.id"
                        >
                            {{ option.label }}
                        </option>
                    </select>
                </label>
            </div>

            <template v-if="featureId">
                <canvas ref="staticCanvas" class="overlay-canvas static" aria-hidden="true" />
                <canvas ref="cursorCanvas" class="overlay-canvas cursor" aria-hidden="true" />

                <div class="overlay-copy" aria-live="polite">
                    <strong>{{ definition?.label }}</strong>
                    <span data-testid="editor-overlay-exact-summary">{{ exactSummary }}</span>
                    <span v-if="analysis.state !== 'ready'">{{ stateLabel }}</span>
                </div>

                <div v-if="overlayError" class="overlay-error" role="alert">
                    <span>{{ overlayError }}</span>
                    <button type="button" data-testid="editor-overlay-retry" @click="retry">
                        重试
                    </button>
                </div>

                <button
                    v-for="handle in handles"
                    :key="handle.id"
                    type="button"
                    class="overlay-handle"
                    :class="handle.id"
                    :aria-label="handle.label"
                    :data-testid="`editor-overlay-handle-${handle.id}`"
                    @pointerdown="beginHandleDrag($event, handle.id)"
                    @pointermove="moveHandleDrag"
                    @pointerup="finishHandleDrag"
                    @pointercancel="cancelHandleDrag"
                    @lostpointercapture="cancelHandleDrag"
                    @keydown="handleKeydown($event, handle.id)"
                >
                    <span aria-hidden="true">↕</span>
                </button>
            </template>
        </section>
    </div>
</template>

<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from 'vue';
import {
    analysisCanvasRenderer,
    prepareCanvasSurface,
    type EditorRenderRequest,
} from '../analysis/canvasRenderer';
import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import type {
    AnalysisCoordinatorSnapshot,
    AnalysisCursorValueResult,
    AnalysisSeries,
    FeatureId,
} from '../analysis/types';
import { FEATURE_IDS } from '../analysis/types';
import {
    EDITOR_OVERLAY_KEYBOARD_COARSE_STEP,
    EDITOR_OVERLAY_KEYBOARD_STEP,
    editorOverlayExactSummary,
    moveEditorOverlayHandle,
    normalizeEditorOverlayBounds,
    type EditorOverlayBounds,
    type EditorOverlayHandle,
} from '../editor/overlay';
import type { EditorProjectV1 } from '../editor/types';
import type { PlaybackSnapshot } from '../types/audio';

const props = defineProps<{
    project: EditorProjectV1;
    playback: PlaybackSnapshot;
    analysis: AnalysisCoordinatorSnapshot;
    series: AnalysisSeries | null;
    exactValue: AnalysisCursorValueResult | null;
}>();

const emit = defineEmits<{
    updateProject: [project: EditorProjectV1, immediate: boolean];
    retry: [];
}>();

const host = ref<HTMLElement | null>(null);
const staticCanvas = ref<HTMLCanvasElement | null>(null);
const cursorCanvas = ref<HTMLCanvasElement | null>(null);
const rendererError = ref<string | null>(null);
const renderRevision = ref(0);
const hostRect = ref({ left: 340, top: 150, width: 420, height: 160 });
let resizeObserver: ResizeObserver | null = null;

const featureId = computed(() => props.project.workspace.overlay.featureId);
const definition = computed(() => featureId.value
    ? FEATURE_REGISTRY[featureId.value]
    : null);
const featureOptions = FEATURE_IDS.map((id) => ({
    id,
    label: FEATURE_REGISTRY[id].label,
}));
const bounds = computed(() => normalizeEditorOverlayBounds(
    props.project.workspace.overlay,
));
const exactSummary = computed(() => featureId.value
    ? editorOverlayExactSummary(featureId.value, props.exactValue)
    : '');
const stateLabel = computed(() => ({
    idle: '等待分析',
    copying: '正在准备音频',
    analyzing: `分析中 ${Math.round(props.analysis.progress * 100)}%`,
    ready: '分析就绪',
    cancelled: '分析已取消',
    error: props.analysis.error?.message ?? '分析失败',
    disposed: '分析已释放',
})[props.analysis.state]);
const overlayError = computed(() => rendererError.value
    ?? (props.analysis.state === 'error'
        ? props.analysis.error?.message ?? '叠加分析失败。'
        : null));

const hostStyle = computed(() => ({
    left: `${hostRect.value.left}px`,
    top: `${hostRect.value.top}px`,
    width: `${hostRect.value.width}px`,
    height: `${hostRect.value.height}px`,
}));
const panelStyle = computed(() => ({
    top: `${bounds.value.topRatio * 100}%`,
    height: `${bounds.value.heightRatio * 100}%`,
}));

const handles: Array<{ id: EditorOverlayHandle; label: string }> = [
    { id: 'top', label: '调整叠加层顶部边界' },
    { id: 'move', label: '上下移动叠加层' },
    { id: 'bottom', label: '调整叠加层底部边界' },
];

const measureHost = () => {
    const element = host.value;
    const workspace = element?.parentElement;
    if (!element || !workspace) return;
    const workspaceBounds = workspace.getBoundingClientRect();
    const surfaces = Array.from(
        workspace.querySelectorAll<HTMLElement>('.marker-surface'),
    );
    if (surfaces.length === 0) {
        hostRect.value = {
            left: Math.min(340, Math.max(0, workspaceBounds.width - 240)),
            top: 132,
            width: Math.max(220, workspaceBounds.width - 364),
            height: 160,
        };
        return;
    }
    const rects = surfaces.map((surface) => surface.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    hostRect.value = {
        left: left - workspaceBounds.left,
        top: top - workspaceBounds.top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
    };
};

const observeGeometryTargets = () => {
    const workspace = host.value?.parentElement;
    if (!workspace || !resizeObserver) return;
    resizeObserver.disconnect();
    resizeObserver.observe(workspace);
    workspace.querySelectorAll<HTMLElement>('.marker-surface')
        .forEach((surface) => resizeObserver?.observe(surface));
};

const canvasMetrics = () => ({
    width: Math.max(1, Math.round(hostRect.value.width)),
    height: Math.max(1, Math.round(
        hostRect.value.height * bounds.value.heightRatio,
    )),
    dpr: Math.max(1, window.devicePixelRatio || 1),
});

const renderRequest = (): EditorRenderRequest => {
    const feature = definition.value;
    if (!feature) throw new Error('尚未选择叠加特征。');
    const metrics = canvasMetrics();
    return {
        feature,
        series: props.series,
        viewport: props.project.workspace.viewport,
        widthCssPixels: metrics.width,
        heightCssPixels: metrics.height,
        devicePixelRatio: metrics.dpr,
    };
};

const prepare = (canvas: HTMLCanvasElement) => {
    const metrics = canvasMetrics();
    return prepareCanvasSurface(canvas, metrics.width, metrics.height, metrics.dpr);
};

const drawStatic = () => {
    if (!featureId.value || !staticCanvas.value) return;
    analysisCanvasRenderer.drawStatic(renderRequest(), prepare(staticCanvas.value));
};
const drawCursor = () => {
    if (!featureId.value || !cursorCanvas.value) return;
    analysisCanvasRenderer.drawCursor(
        renderRequest(),
        props.playback.currentTimeSeconds,
        props.exactValue,
        prepare(cursorCanvas.value),
    );
};

const render = async () => {
    await nextTick();
    try {
        measureHost();
        drawStatic();
        drawCursor();
        rendererError.value = null;
    } catch (error) {
        rendererError.value = error instanceof Error
            ? error.message
            : '叠加层 renderer 出错。';
    }
};

const applyBounds = (next: EditorOverlayBounds, immediate: boolean) => {
    emit('updateProject', {
        ...props.project,
        workspace: {
            ...props.project.workspace,
            overlay: {
                ...props.project.workspace.overlay,
                ...normalizeEditorOverlayBounds(next),
            },
        },
    }, immediate);
};

const selectFeature = (event: Event) => {
    const value = (event.target as HTMLSelectElement).value;
    emit('updateProject', {
        ...props.project,
        workspace: {
            ...props.project.workspace,
            overlay: {
                ...props.project.workspace.overlay,
                featureId: value === '' ? null : value as FeatureId,
            },
        },
    }, true);
};

interface DragState {
    pointerId: number;
    handle: EditorOverlayHandle;
    element: HTMLButtonElement;
    startY: number;
    startBounds: EditorOverlayBounds;
    latestBounds: EditorOverlayBounds;
}
const drag = ref<DragState | null>(null);

const beginHandleDrag = (event: PointerEvent, handle: EditorOverlayHandle) => {
    if (event.button !== 0) return;
    const element = event.currentTarget as HTMLButtonElement;
    drag.value = {
        pointerId: event.pointerId,
        handle,
        element,
        startY: event.clientY,
        startBounds: bounds.value,
        latestBounds: bounds.value,
    };
    element.setPointerCapture(event.pointerId);
};

const moveHandleDrag = (event: PointerEvent) => {
    const state = drag.value;
    if (!state || state.pointerId !== event.pointerId) return;
    state.latestBounds = moveEditorOverlayHandle(
        state.startBounds,
        state.handle,
        (event.clientY - state.startY) / Math.max(1, hostRect.value.height),
    );
    applyBounds(state.latestBounds, false);
};

const clearDrag = () => {
    const state = drag.value;
    drag.value = null;
    if (state?.element.hasPointerCapture(state.pointerId)) {
        state.element.releasePointerCapture(state.pointerId);
    }
};

const finishHandleDrag = (event: PointerEvent) => {
    const state = drag.value;
    if (!state || state.pointerId !== event.pointerId) return;
    applyBounds(state.latestBounds, true);
    clearDrag();
};

const cancelHandleDrag = () => {
    const state = drag.value;
    if (!state) return;
    applyBounds(state.startBounds, true);
    clearDrag();
};

const handleKeydown = (event: KeyboardEvent, handle: EditorOverlayHandle) => {
    if (event.key === 'Escape') {
        event.preventDefault();
        cancelHandleDrag();
        return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const step = event.shiftKey
        ? EDITOR_OVERLAY_KEYBOARD_COARSE_STEP
        : EDITOR_OVERLAY_KEYBOARD_STEP;
    applyBounds(moveEditorOverlayHandle(
        bounds.value,
        handle,
        event.key === 'ArrowUp' ? -step : step,
    ), true);
};

const retry = () => {
    renderRevision.value += 1;
    rendererError.value = null;
    emit('retry');
    void render();
};

watch(
    () => [
        featureId.value,
        props.series,
        props.project.workspace.viewport,
        bounds.value.topRatio,
        bounds.value.heightRatio,
        props.analysis.generation,
        renderRevision.value,
        props.project.lanes.length,
    ],
    () => void nextTick(() => {
        observeGeometryTargets();
        void render();
    }),
    { deep: true },
);
watch(
    () => [props.playback.currentTimeSeconds, props.exactValue],
    () => {
        try {
            drawCursor();
        } catch (error) {
            rendererError.value = error instanceof Error
                ? error.message
                : '叠加游标 renderer 出错。';
        }
    },
);

onMounted(() => {
    resizeObserver = new ResizeObserver(() => void render());
    observeGeometryTargets();
    window.addEventListener('blur', cancelHandleDrag);
    void render();
});
onBeforeUnmount(() => {
    cancelHandleDrag();
    resizeObserver?.disconnect();
    resizeObserver = null;
    window.removeEventListener('blur', cancelHandleDrag);
});
</script>

<style scoped>
.analysis-overlay-host {
    position: absolute;
    z-index: 8;
    pointer-events: none;
}
.analysis-overlay-panel {
    position: absolute;
    left: 0;
    right: 0;
    min-height: 42px;
    overflow: visible;
    border: 1px solid rgba(101, 255, 169, .42);
    border-radius: 13px;
    background: rgba(2, 8, 5, .28);
    box-shadow: 0 8px 28px rgba(0, 0, 0, .2);
    transition: top 120ms ease, height 120ms ease;
}
.overlay-controls {
    position: absolute;
    z-index: 12;
    left: 8px;
    top: 7px;
    pointer-events: auto;
}
.overlay-controls label { display: grid; gap: 2px; color: #dffff0; font-size: .68rem; }
.overlay-controls select {
    max-width: 170px;
    border: 1px solid rgba(101, 255, 169, .58);
    border-radius: 8px;
    padding: 5px 7px;
    color: #effff6;
    background: rgba(4, 20, 11, .96);
}
.overlay-controls select:focus-visible,
.overlay-handle:focus-visible,
.overlay-error button:focus-visible { outline: 2px solid #f8ff87; outline-offset: 2px; }
.overlay-canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.overlay-canvas.static { opacity: .72; }
.overlay-canvas.cursor { opacity: .9; }
.overlay-copy {
    position: absolute;
    z-index: 10;
    right: 9px;
    top: 7px;
    display: grid;
    justify-items: end;
    max-width: 46%;
    color: rgba(235, 255, 244, .9);
    font: .68rem ui-monospace, monospace;
    pointer-events: none;
}
.overlay-copy strong { color: #fff; }
.overlay-error {
    position: absolute;
    z-index: 14;
    inset: 8px 8px auto 188px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    color: #ffd3ce;
    pointer-events: none;
}
.overlay-error button { pointer-events: auto; border: 1px solid #ff9389; border-radius: 7px; color: #fff; background: #481713; }
.overlay-handle {
    position: absolute;
    z-index: 13;
    left: -17px;
    width: 34px;
    height: 26px;
    padding: 0;
    border: 1px solid rgba(101, 255, 169, .8);
    border-radius: 10px;
    color: #effff6;
    background: rgba(4, 20, 11, .96);
    cursor: ns-resize;
    pointer-events: auto;
    touch-action: none;
}
.overlay-handle.top { top: -13px; }
.overlay-handle.move { top: 50%; transform: translateY(-50%); }
.overlay-handle.bottom { bottom: -13px; }
@media (prefers-reduced-motion: reduce) {
    .analysis-overlay-panel { transition: none; }
}
</style>
