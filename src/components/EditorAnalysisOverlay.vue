<template>
    <Teleport to="body">
        <div
            class="analysis-overlay-host"
            :data-open="overlayOpen && featureId ? 'true' : 'false'"
            data-testid="editor-analysis-overlay-host"
            aria-label="Editor 分析叠加层">
            <template v-if="overlayOpen && featureId">
                <div class="overlay-backdrop" data-testid="editor-overlay-backdrop" aria-hidden="true" />
                <canvas ref="staticCanvas" class="overlay-canvas static" aria-hidden="true" />
                <canvas ref="cursorCanvas" class="overlay-canvas cursor" aria-hidden="true" />

                <section
                    class="analysis-overlay-panel"
                    :style="panelStyle"
                    :data-feature-id="featureId"
                    :data-analysis-state="analysis.state"
                    :data-renderer-error="overlayError ? 'true' : 'false'"
                    :data-sample-step="displaySeries?.sampleStepSeconds"
                    :data-detail-pending="detailPending"
                    data-testid="editor-analysis-overlay-panel">
                    <div class="overlay-copy" aria-live="polite">
                        <strong>{{ project.workspace.overlay.stemRole ?? '原曲' }} · {{ definition?.label }}</strong>
                        <span data-testid="editor-overlay-exact-summary">{{ exactSummary }}</span>
                        <span v-if="analysis.state !== 'ready'">{{ stateLabel }}</span>
                        <span v-if="analysis.cacheState === 'not-persisted'">当前分析缓存未持久化</span>
                    </div>

                    <div v-if="overlayError" class="overlay-error" role="alert">
                        <span>{{ overlayError }}</span>
                        <button type="button" data-testid="editor-overlay-retry" @click="retry">重试</button>
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
                        @keydown="handleKeydown($event, handle.id)">
                        <span aria-hidden="true">↕</span>
                    </button>
                </section>
            </template>

            <Teleport to="body">
                <div ref="controls" class="overlay-controls" data-testid="editor-overlay-controls">
                    <div class="overlay-toggle-group">
                        <button
                            ref="toggleButton"
                            type="button"
                            class="editor-icon-button overlay-toggle"
                            :aria-label="overlayOpen ? '关闭叠加层' : '打开叠加层'"
                            :title="overlayOpen ? '关闭叠加层' : '打开叠加层'"
                            :aria-pressed="overlayOpen"
                            data-testid="editor-overlay-toggle"
                            @click="toggleOverlay">
                            <EditorIcon name="overlay" />
                        </button>
                        <button
                            type="button"
                            class="editor-icon-button overlay-menu-toggle"
                            aria-label="选择叠加特征"
                            title="选择叠加特征"
                            aria-haspopup="menu"
                            :aria-expanded="menuOpen"
                            aria-controls="editor-overlay-feature-menu"
                            data-testid="editor-overlay-menu-toggle"
                            @click="toggleMenu">
                            <EditorIcon name="features" />
                        </button>
                    </div>

                    <div
                        v-if="menuOpen"
                        id="editor-overlay-feature-menu"
                        class="overlay-feature-menu app-scrollbar"
                        role="group"
                        aria-label="选择声音特征"
                        data-testid="editor-overlay-feature-menu">
                        <AnalysisSourceCascader
                            :feature-id="featureId"
                            :stem-role="project.workspace.overlay.stemRole"
                            @select="selectFeature" />
                    </div>
                </div>
            </Teleport>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { analysisCanvasRenderer, type EditorRenderRequest } from '../analysis/canvasRenderer';
import { useAnalysisWindow } from '../editor/useAnalysisWindow';
import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import EditorIcon from './EditorIcon.vue';
import AnalysisSourceCascader from './AnalysisSourceCascader.vue';
import type { AnalysisInput } from '../analysis/sources';
import type { AnalysisCoordinatorSnapshot, AnalysisCursorValueResult, AnalysisSeries } from '../analysis/types';
import {
    EDITOR_OVERLAY_KEYBOARD_COARSE_STEP,
    EDITOR_OVERLAY_KEYBOARD_STEP,
    editorOverlayExactSummary,
    moveEditorOverlayHandle,
    normalizeEditorOverlayBounds,
    type EditorOverlayBounds,
    type EditorOverlayHandle,
} from '../editor/overlay';
import type { EditorProjectV2 } from '../editor/types';
import type { PlaybackSnapshot } from '../types/audio';
import type { MarkerTimeView } from '../editor/markerTimeView';
import type { MarkerDrawing } from '../editor/markerDrawing';

const props = defineProps<{
    project: EditorProjectV2;
    timeView: MarkerTimeView;
    drawing: MarkerDrawing;
    playback: PlaybackSnapshot;
    analysis: AnalysisCoordinatorSnapshot;
    series: AnalysisSeries | null;
    exactValue: AnalysisCursorValueResult | null;
    overlayOpen: boolean;
}>();

const emit = defineEmits<{
    updateProject: [project: EditorProjectV2, immediate: boolean];
    toggle: [enabled: boolean];
    selectFeature: [input: AnalysisInput];
    retry: [];
}>();

interface PlotRect {
    left: number;
    width: number;
}

const controls = ref<HTMLElement | null>(null);
const toggleButton = ref<HTMLButtonElement | null>(null);
const staticCanvas = ref<HTMLCanvasElement | null>(null);
const cursorCanvas = ref<HTMLCanvasElement | null>(null);
const rendererError = ref<string | null>(null);
const renderRevision = ref(0);
const menuOpen = ref(false);
const plotRect = ref<PlotRect>({ left: 340, width: 420 });
let resizeObserver: ResizeObserver | null = null;
let disposed = false;

const featureId = computed(() => props.project.workspace.overlay.featureId);
const definition = computed(() => (featureId.value ? FEATURE_REGISTRY[featureId.value] : null));
const bounds = computed(() => normalizeEditorOverlayBounds(props.project.workspace.overlay));
const exactSummary = computed(() =>
    featureId.value ? editorOverlayExactSummary(featureId.value, props.exactValue) : '',
);
const stateLabel = computed(
    () =>
        ({
            idle: '等待分析',
            copying: '正在准备音频',
            analyzing: `分析中 ${Math.round(props.analysis.progress * 100)}%`,
            ready: '分析就绪',
            cancelled: '分析已取消',
            error: props.analysis.error?.message ?? '分析失败',
            disposed: '分析已释放',
        })[props.analysis.state],
);
const overlayError = computed(
    () =>
        rendererError.value ??
        (props.analysis.state === 'error' ? (props.analysis.error?.message ?? '叠加分析失败。') : null),
);
const panelStyle = computed(() => {
    const viewportWidth = Math.max(1, window.innerWidth);
    const left = Math.max(0, plotRect.value.left);
    const right = Math.min(viewportWidth, plotRect.value.left + plotRect.value.width);
    return {
        left: `${left}px`,
        top: `${bounds.value.topRatio * 100}vh`,
        width: `${Math.max(1, right - left)}px`,
        height: `${bounds.value.heightRatio * 100}vh`,
    };
});

const handles: Array<{ id: EditorOverlayHandle; label: string }> = [
    { id: 'top', label: '调整叠加层顶部边界' },
    { id: 'move', label: '上下移动叠加层' },
    { id: 'bottom', label: '调整叠加层底部边界' },
];

const geometryTargets = () => {
    const ruler = document.querySelector<HTMLElement>('.marker-ruler-time');
    return ruler ? [ruler] : [];
};

const measurePlot = () => {
    const targets = geometryTargets();
    if (targets.length === 0) return;
    const rects = targets.map(target => target.getBoundingClientRect());
    const left = Math.min(...rects.map(rect => rect.left));
    const right = Math.max(...rects.map(rect => rect.right));
    plotRect.value = {
        left,
        width: Math.max(1, right - left),
    };
};

const observeGeometryTargets = () => {
    if (!resizeObserver) return;
    resizeObserver.disconnect();
    geometryTargets().forEach(target => resizeObserver?.observe(target));
};

const metrics = () => ({
    viewportWidth: Math.max(1, Math.round(window.innerWidth)),
    viewportHeight: Math.max(1, Math.round(window.innerHeight)),
    plotWidth: Math.max(1, Math.round(plotRect.value.width)),
    panelTop: Math.round(bounds.value.topRatio * window.innerHeight),
    panelHeight: Math.max(1, Math.round(bounds.value.heightRatio * window.innerHeight)),
    dpr: Math.max(1, window.devicePixelRatio || 1),
});

const { series: displaySeries, pending: detailPending } = useAnalysisWindow(() => ({
    stemRole: props.project.workspace.overlay.stemRole,
    series: props.series,
    generation: props.analysis.generation,
    startSeconds: props.timeView.startSeconds,
    endSeconds: props.timeView.endSeconds,
    durationSeconds: props.project.track.durationSeconds,
    sampleRate: props.analysis.sampleRate ?? props.project.track.sampleRate ?? 0,
    pixels: plotRect.value.width * Math.max(1, window.devicePixelRatio || 1),
    enabled: props.overlayOpen && props.analysis.state === 'ready',
}));

const renderRequest = (): EditorRenderRequest => {
    const feature = definition.value;
    if (!feature) throw new Error('尚未选择叠加特征。');
    const size = metrics();
    return {
        feature,
        series: displaySeries.value,
        viewport: props.timeView,
        durationSeconds: props.project.track.durationSeconds,
        widthCssPixels: size.plotWidth,
        heightCssPixels: size.panelHeight,
        devicePixelRatio: size.dpr,
    };
};

const drawLayer = (canvas: HTMLCanvasElement, draw: (target: CanvasRenderingContext2D) => void) => {
    const size = metrics();
    const backingWidth = Math.max(1, Math.round(size.viewportWidth * size.dpr));
    const backingHeight = Math.max(1, Math.round(size.viewportHeight * size.dpr));
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    const target = canvas.getContext('2d');
    if (!target) throw new Error('浏览器未提供 Canvas 2D context。');
    target.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    target.clearRect(0, 0, size.viewportWidth, size.viewportHeight);
    target.save();
    target.translate(plotRect.value.left, size.panelTop);
    target.beginPath();
    target.rect(0, 0, size.plotWidth, size.panelHeight);
    target.clip();
    try {
        draw(target);
    } finally {
        target.restore();
    }
};

const drawStatic = () => {
    if (!props.overlayOpen || !featureId.value || !staticCanvas.value) return;
    const request = renderRequest();
    drawLayer(staticCanvas.value, target => {
        analysisCanvasRenderer.drawStatic(request, target);
    });
};

const drawCursor = () => {
    if (!props.overlayOpen || !featureId.value || !cursorCanvas.value) return;
    const request = renderRequest();
    drawLayer(cursorCanvas.value, target => {
        analysisCanvasRenderer.drawCursor(request, props.playback.currentTimeSeconds, props.exactValue, target);
    });
};

const render = async () => {
    if (!props.overlayOpen || !featureId.value) return;
    await nextTick();
    if (disposed) return;
    try {
        measurePlot();
        drawStatic();
        drawCursor();
        rendererError.value = null;
    } catch (error) {
        rendererError.value = error instanceof Error ? error.message : '叠加层 renderer 出错。';
    }
};

const renderFrame = () => {
    void render();
};
const scheduleGeometryRender = () => {
    props.drawing.request(renderFrame);
};

const applyBounds = (next: EditorOverlayBounds, immediate: boolean) => {
    emit(
        'updateProject',
        {
            ...props.project,
            workspace: {
                ...props.project.workspace,
                overlay: {
                    ...props.project.workspace.overlay,
                    ...normalizeEditorOverlayBounds(next),
                },
            },
        },
        immediate,
    );
};

const focusFirstMenuItem = () =>
    void nextTick(() => {
        controls.value?.querySelector<HTMLElement>('.el-cascader-node')?.focus();
    });

const openMenu = () => {
    menuOpen.value = true;
    focusFirstMenuItem();
};

const toggleOverlay = () => {
    if (props.overlayOpen) {
        menuOpen.value = false;
        emit('toggle', false);
        return;
    }
    if (!featureId.value) {
        openMenu();
        return;
    }
    emit('toggle', true);
};

const toggleMenu = () => {
    menuOpen.value = !menuOpen.value;
    if (menuOpen.value) focusFirstMenuItem();
};

const selectFeature = (value: AnalysisInput) => {
    emit('selectFeature', value);
    menuOpen.value = false;
    void nextTick(() => toggleButton.value?.focus());
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
        (event.clientY - state.startY) / Math.max(1, window.innerHeight),
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
    const step = event.shiftKey ? EDITOR_OVERLAY_KEYBOARD_COARSE_STEP : EDITOR_OVERLAY_KEYBOARD_STEP;
    applyBounds(moveEditorOverlayHandle(bounds.value, handle, event.key === 'ArrowUp' ? -step : step), true);
};

const retry = () => {
    renderRevision.value += 1;
    rendererError.value = null;
    emit('retry');
    scheduleGeometryRender();
};

const onDocumentPointerDown = (event: PointerEvent) => {
    if (!menuOpen.value || controls.value?.contains(event.target as Node)) return;
    menuOpen.value = false;
};

const onWindowKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !menuOpen.value) return;
    event.preventDefault();
    menuOpen.value = false;
    toggleButton.value?.focus();
};

watch(
    () => [
        props.overlayOpen,
        featureId.value,
        displaySeries.value,
        props.timeView,
        bounds.value.topRatio,
        bounds.value.heightRatio,
        props.analysis.generation,
        renderRevision.value,
        props.project.lanes.length,
    ],
    () =>
        void nextTick(() => {
            observeGeometryTargets();
            scheduleGeometryRender();
        }),
    { deep: true },
);
watch(
    () => [props.playback.currentTimeSeconds, props.exactValue],
    () => {
        scheduleGeometryRender();
    },
);
watch(
    () => props.overlayOpen,
    open => {
        if (!open) rendererError.value = null;
    },
);

onMounted(() => {
    resizeObserver = new ResizeObserver(scheduleGeometryRender);
    observeGeometryTargets();
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    window.addEventListener('keydown', onWindowKeydown);
    window.addEventListener('blur', cancelHandleDrag);
    window.addEventListener('resize', scheduleGeometryRender);
    window.addEventListener('scroll', scheduleGeometryRender, true);
    scheduleGeometryRender();
});
onBeforeUnmount(() => {
    menuOpen.value = false;
    cancelHandleDrag();
    disposed = true;
    props.drawing.remove(renderFrame);
    resizeObserver?.disconnect();
    resizeObserver = null;
    document.removeEventListener('pointerdown', onDocumentPointerDown, true);
    window.removeEventListener('keydown', onWindowKeydown);
    window.removeEventListener('blur', cancelHandleDrag);
    window.removeEventListener('resize', scheduleGeometryRender);
    window.removeEventListener('scroll', scheduleGeometryRender, true);
});
</script>

<style scoped>
.analysis-overlay-host {
    position: fixed;
    z-index: 80;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    pointer-events: none;
}
.overlay-backdrop {
    position: absolute;
    inset: 0;
    background: var(--overlay-backdrop);
    pointer-events: none;
}
.analysis-overlay-panel {
    position: absolute;
    z-index: 82;
    min-height: 42px;
    border-top: 1px solid var(--overlay-divider);
    border-bottom: 1px solid var(--overlay-divider);
    border-radius: 0;
    background: transparent;
    transition:
        top 120ms ease,
        height 120ms ease;
    pointer-events: none;
}
.overlay-controls {
    position: fixed;
    z-index: 86;
    top: 15px;
    right: 60px;
    pointer-events: auto;
}
.overlay-toggle-group {
    display: flex;
    gap: 4px;
}
.overlay-feature-menu {
    position: absolute;
    top: 100%;
    right: 0;
    display: grid;
    width: min(480px, calc(100vw - 24px));
    max-height: min(520px, calc(100dvh - var(--app-player-inset, 80px) - 64px));
    margin-top: 6px;
    overflow-y: auto;
    border: 1px solid var(--overlay-hairline-soft);
    border-radius: 8px;
    padding: 4px;
    background: var(--overlay-menu);
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.48);
}
.overlay-feature-menu button {
    display: flex;
    justify-content: space-between;
    min-height: 30px;
    border: 0;
    border-radius: 4px;
    padding: 5px 8px;
    color: var(--ink);
    background: transparent;
    text-align: left;
}
.overlay-feature-menu button:hover,
.overlay-feature-menu button[aria-checked='true'] {
    background: var(--marker-fill);
}
.overlay-toggle:focus-visible,
.overlay-menu-toggle:focus-visible,
.overlay-feature-menu button:focus-visible,
.overlay-handle:focus-visible,
.overlay-error button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
.overlay-canvas {
    position: fixed;
    z-index: 81;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    pointer-events: none;
}
.overlay-canvas.static {
    opacity: 0.72;
}
.overlay-canvas.cursor {
    opacity: 0.9;
}
.overlay-copy {
    position: absolute;
    z-index: 83;
    right: 9px;
    top: 7px;
    display: grid;
    justify-items: end;
    max-width: 46%;
    color: var(--overlay-copy);
    font:
        0.68rem ui-monospace,
        monospace;
    text-shadow: 0 1px 2px #000;
    pointer-events: none;
}
.overlay-copy strong {
    color: var(--ink-strong);
}
.overlay-error {
    position: absolute;
    z-index: 84;
    inset: 8px 8px auto 52px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    color: var(--error);
    pointer-events: none;
}
.overlay-error button {
    min-height: 30px;
    border: 1px solid var(--error);
    border-radius: 4px;
    color: var(--ink-strong);
    background: var(--error-surface);
    pointer-events: auto;
}
.overlay-handle {
    position: absolute;
    z-index: 85;
    left: 0;
    width: 34px;
    height: 26px;
    padding: 0;
    border: 1px solid var(--overlay-hairline-strong);
    border-radius: 4px;
    color: var(--ink);
    background: var(--overlay-panel-strong);
    cursor: ns-resize;
    pointer-events: auto;
    touch-action: none;
}
.overlay-handle.top {
    top: -13px;
}
.overlay-handle.move {
    top: 50%;
    transform: translateY(-50%);
}
.overlay-handle.bottom {
    bottom: -13px;
}
@media (prefers-reduced-motion: reduce) {
    .analysis-overlay-panel {
        transition: none;
    }
}
</style>
