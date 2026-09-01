<template>
    <main class="analyzer-page">
        <DotGridBg />
        <div ref="analyzerContent" class="analyzer-content">
            <section class="timeline-toolbar" aria-label="共享时间轴控制">
                <div class="toolbar-summary">
                    <div class="status-row" aria-live="polite">
                        <span :data-state="analysis.state">
                            {{ analysisStateLabel }}
                        </span>
                        <span>{{ activeFeatureQueue.length }}/4 张展开卡</span>
                        <span v-if="activeFeatureQueue.length === 0">
                            展开卡片开始分析
                        </span>
                        <span v-if="sessionStore.persistence.state === 'not-persisted'">
                            当前工作区未持久化
                        </span>
                    </div>
                    <div class="viewport-summary">
                        <strong>共享视口</strong>
                        <span>
                            {{ formatTime(viewport.startSeconds) }}
                            –
                            {{ formatTime(viewport.endSeconds) }}
                        </span>
                        <span>游标 {{ formatTime(cursorSeconds) }}</span>
                        <span>{{ viewport.zoom.toFixed(1) }}×</span>
                    </div>
                </div>
                <div class="toolbar-actions">
                    <button
                        type="button"
                        aria-label="向前平移四分之一视口"
                        @click="pan(-1)"
                    >
                        ← 25%
                    </button>
                    <button
                        type="button"
                        aria-label="缩小时间轴"
                        :disabled="viewport.zoom <= 1"
                        @click="zoom(0.5)"
                    >
                        −
                    </button>
                    <button type="button" @click="resetViewport">重置</button>
                    <button
                        type="button"
                        aria-label="放大时间轴"
                        :disabled="viewport.zoom >= 64"
                        @click="zoom(2)"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        aria-label="向后平移四分之一视口"
                        @click="pan(1)"
                    >
                        25% →
                    </button>
                    <button
                        type="button"
                        data-testid="reset-feature-order"
                        :disabled="isFeatureOrderDefault"
                        @click="resetFeatureOrder"
                    >
                        恢复默认排序
                    </button>
                    <button
                        v-if="analysis.error?.recoverable"
                        type="button"
                        @click="retryAnalysis"
                    >
                        重试分析
                    </button>
                </div>
            </section>

            <p v-if="analysis.error" class="analysis-error" role="alert">
                {{ analysis.error.message }}
            </p>

            <p
                class="visually-hidden"
                aria-live="polite"
                aria-atomic="true"
                data-testid="reorder-announcement"
            >
                {{ reorderAnnouncement }}
            </p>

            <section
                ref="masonryRoot"
                class="card-masonry"
                :class="{ 'is-ready': masonryReady }"
                :style="{ height: `${masonryHeight}px` }"
                aria-label="分析卡片工作区"
                data-testid="analyzer-masonry"
            >
                <div
                    v-for="(featureId, orderIndex) in featureOrder"
                    :key="featureId"
                    :ref="masonryItemRef(featureId)"
                    class="masonry-item"
                    :class="masonryItemClasses(featureId)"
                    :data-slot="featureId"
                    :data-order-index="orderIndex"
                    :data-testid="`analyzer-card-${featureId}`"
                    :style="masonryItemStyle(featureId)"
                >
                    <MeydaCard
                        :feature-id="featureId"
                        :expanded="isExpanded(featureId)"
                        :series="seriesFor(featureId)"
                        :viewport="viewport"
                        :cursor-seconds="cursorSeconds"
                        :duration-seconds="durationSeconds"
                        :sample-rate="analysis.sampleRate"
                        :exact-value="exactValues[featureId] ?? null"
                        :analysis-state="analysis.state"
                        @toggle="toggleCard(featureId)"
                        @seek="seek"
                    >
                        <template #header-action>
                            <div
                                class="reorder-control"
                                :data-reorder-control="featureId"
                            >
                                <button
                                    :ref="reorderHandleRef(featureId)"
                                    type="button"
                                    class="reorder-handle"
                                    :class="{
                                        'is-active': dragState?.sourceId === featureId,
                                    }"
                                    :aria-label="`排序 ${featureLabel(featureId)}，当前位置 ${orderIndex + 1}/${featureOrder.length}`"
                                    aria-haspopup="menu"
                                    :aria-expanded="openOrderMenu === featureId"
                                    :data-testid="`reorder-handle-${featureId}`"
                                    @click.stop="handleReorderHandleClick(featureId)"
                                    @keydown="handleReorderHandleKeydown($event, featureId)"
                                    @pointerdown="handleDragPointerDown($event, featureId)"
                                    @pointermove="handleDragPointerMove"
                                    @pointerup="handleDragPointerUp"
                                    @pointercancel="cancelDrag"
                                    @lostpointercapture="handleLostPointerCapture"
                                >
                                    <span class="grip-icon" aria-hidden="true">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </span>
                                </button>
                                <div
                                    v-if="openOrderMenu === featureId"
                                    class="reorder-menu"
                                    role="menu"
                                    :aria-label="`${featureLabel(featureId)} 排序操作`"
                                    :data-testid="`reorder-menu-${featureId}`"
                                >
                                    <button
                                        type="button"
                                        role="menuitem"
                                        :disabled="orderIndex === 0"
                                        @click.stop="applyOrderAction(featureId, 'up')"
                                    >
                                        上移
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        :disabled="orderIndex === featureOrder.length - 1"
                                        @click.stop="applyOrderAction(featureId, 'down')"
                                    >
                                        下移
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        :disabled="orderIndex === 0"
                                        @click.stop="applyOrderAction(featureId, 'first')"
                                    >
                                        置顶
                                    </button>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        :disabled="orderIndex === featureOrder.length - 1"
                                        @click.stop="applyOrderAction(featureId, 'last')"
                                    >
                                        置底
                                    </button>
                                </div>
                            </div>
                        </template>
                    </MeydaCard>
                </div>
            </section>

            <div
                v-if="dragState?.active"
                class="drag-ghost"
                :style="dragGhostStyle"
                aria-hidden="true"
                data-testid="reorder-drag-ghost"
            >
                {{ featureLabel(dragState.sourceId) }}
            </div>
        </div>
    </main>
</template>

<script setup lang="ts">
import {
    type ComponentPublicInstance,
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from 'vue';
import DotGridBg from '../components/DotGridBg.vue';
import MeydaCard from '../components/MeydaCard.vue';
import { useAudioSessionService } from '../audio/audioSessionService';
import { toggleActiveFeature } from '../analysis/activeFeatureQueue';
import { useAnalysisCoordinator } from '../analysis/analysisCoordinator';
import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import {
    defaultFeatureOrder,
    findFeatureDropTarget,
    insertFeatureOrder,
    isDefaultFeatureOrder,
    moveFeatureOrder,
    type FeatureDropTarget,
    type FeatureOrderAction,
} from '../analysis/featureOrder';
import {
    panTimelineViewport,
    normalizeTimelineViewport,
    resetTimelineViewport,
    zoomTimelineViewport,
} from '../analysis/timelineViewport';
import {
    FEATURE_IDS,
    type AnalysisCursorValueResult,
    type AnalysisSeries,
    type FeatureId,
    type M10FeatureId,
} from '../analysis/types';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import {
    calculateMasonryLayout,
    type MasonryPlacement,
} from '../utils/masonryLayout';
import type { PersistedTimelineViewport } from '../types/session';

const MASONRY_GAP = 18;
const MASONRY_WIDE_QUERY = '(min-width: 1280px)';
const DRAG_START_THRESHOLD = 6;
const AUTO_SCROLL_EDGE = 48;
const AUTO_SCROLL_MAX = 16;

interface ReorderDragState {
    pointerId: number;
    sourceId: FeatureId;
    handle: HTMLElement;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    active: boolean;
    candidate: FeatureDropTarget | null;
}

const sessionStore = useAudioSessionStore();
const audioSession = useAudioSessionService();
const analysisCoordinator = useAnalysisCoordinator();
const analysisLease = analysisCoordinator.acquireConsumer('analyzer');
const seriesRevision = ref(0);
const exactValues = reactive<
    Partial<Record<M10FeatureId, AnalysisCursorValueResult>>
>({});
const CURSOR_REQUEST_INTERVAL_MS = 40;
let unsubscribeCoordinator: (() => void) | null = null;
let cursorTimer: ReturnType<typeof setTimeout> | null = null;
let lastCursorRequestAt = 0;
let initializationPromise: Promise<void> | null = null;
let workspaceBootstrapped = false;
const masonryRoot = ref<HTMLElement | null>(null);
const masonryHeight = ref(0);
const masonryReady = ref(false);
const masonryPlacements = reactive<
    Partial<Record<FeatureId, MasonryPlacement<FeatureId>>>
>({});
const masonryItems = new Map<FeatureId, HTMLElement>();
let masonryRootObserver: ResizeObserver | null = null;
let masonryItemObserver: ResizeObserver | null = null;
let masonryMediaQuery: MediaQueryList | null = null;
let masonryFrame: number | null = null;
let lastMasonryRootWidth = -1;
const analyzerContent = ref<HTMLElement | null>(null);
const openOrderMenu = ref<FeatureId | null>(null);
const reorderAnnouncement = ref('');
const dragState = ref<ReorderDragState | null>(null);
const reorderHandles = new Map<FeatureId, HTMLElement>();
let dragFrame: number | null = null;
let suppressHandleClick = false;
let suppressHandleClickTimer: number | null = null;

const analysis = computed(() => sessionStore.analysis);
const featureOrder = computed<FeatureId[]>(() =>
    sessionStore.analysisWorkspace.featureOrder);
const isFeatureOrderDefault = computed(() =>
    isDefaultFeatureOrder(featureOrder.value));
const activeFeatureQueue = computed<M10FeatureId[]>(() =>
    sessionStore.analysisWorkspace.activeFeatureQueue.filter(
        (featureId): featureId is M10FeatureId =>
            (FEATURE_IDS as readonly string[]).includes(featureId),
    ));
const activeFeatureIds = activeFeatureQueue;
const durationSeconds = computed(() =>
    Math.max(0, sessionStore.playback.durationSeconds || 0));
const cursorSeconds = computed(() =>
    Math.max(
        0,
        Math.min(
            durationSeconds.value,
            sessionStore.playback.currentTimeSeconds || 0,
        ),
    ));
const viewport = computed<PersistedTimelineViewport>(() =>
    normalizeTimelineViewport(
        sessionStore.analysisWorkspace.viewport,
        durationSeconds.value,
    ));
const analysisStateLabel = computed(() => {
    const labels = {
        idle: '等待音频',
        copying: '正在复制音频',
        analyzing: `分析中 ${Math.round(analysis.value.progress * 100)}%`,
        ready: analysis.value.cacheState === 'hit'
            ? '分析就绪 · cache hit'
            : '分析就绪',
        cancelled: '分析已取消',
        error: '分析需要处理',
        disposed: '分析已释放',
    } as const;
    return labels[analysis.value.state];
});
const dragGhostStyle = computed(() => ({
    left: `${(dragState.value?.currentX ?? 0) + 12}px`,
    top: `${(dragState.value?.currentY ?? 0) + 12}px`,
}));

const featureLabel = (featureId: FeatureId) =>
    FEATURE_REGISTRY[featureId].label;

const isExpanded = (featureId: FeatureId) =>
    activeFeatureQueue.value.includes(featureId);

const seriesFor = (featureId: M10FeatureId): AnalysisSeries | null => {
    void seriesRevision.value;
    return analysisLease.getSeries(featureId);
};

const formatTime = (seconds: number): string => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${(safe % 60).toFixed(2).padStart(5, '0')}`;
};

const reorderHandleRefSetters = new Map<
    FeatureId,
    (element: Element | ComponentPublicInstance | null) => void
>();
const reorderHandleRef = (featureId: FeatureId) => {
    let setter = reorderHandleRefSetters.get(featureId);
    if (!setter) {
        setter = (element) => {
            if (element instanceof HTMLElement) {
                reorderHandles.set(featureId, element);
            } else {
                reorderHandles.delete(featureId);
            }
        };
        reorderHandleRefSetters.set(featureId, setter);
    }
    return setter;
};

const masonryItemClasses = (featureId: FeatureId) => ({
    'is-drag-source': dragState.value?.active
        && dragState.value.sourceId === featureId,
    'is-drop-before': dragState.value?.active
        && dragState.value.candidate?.featureId === featureId
        && dragState.value.candidate.edge === 'before',
    'is-drop-after': dragState.value?.active
        && dragState.value.candidate?.featureId === featureId
        && dragState.value.candidate.edge === 'after',
    'has-open-reorder-menu': openOrderMenu.value === featureId,
});

const masonryItemStyle = (featureId: FeatureId) => {
    const placement = masonryPlacements[featureId];
    return {
        width: placement ? `${placement.width}px` : '100%',
        transform: placement
            ? `translate3d(${placement.left}px, ${placement.top}px, 0)`
            : 'translate3d(0, 0, 0)',
    };
};

const performMasonryLayout = () => {
    masonryFrame = null;
    const root = masonryRoot.value;
    const order = featureOrder.value;
    const elements = order.map((featureId) =>
        masonryItems.get(featureId));
    if (!root || elements.some((element) => !element)) return;
    const containerWidth = root.getBoundingClientRect().width;
    const columnCount: 1 | 2 = masonryMediaQuery?.matches ? 2 : 1;
    const columnWidth = Math.max(
        0,
        (containerWidth - MASONRY_GAP * (columnCount - 1)) / columnCount,
    );
    for (const element of elements) {
        element!.style.width = `${columnWidth}px`;
    }
    const layout = calculateMasonryLayout({
        containerWidth,
        columnCount,
        gap: MASONRY_GAP,
        items: order.map((featureId, index) => ({
            id: featureId,
            height: elements[index]!.getBoundingClientRect().height,
        })),
    });
    for (const placement of layout.placements) {
        masonryPlacements[placement.id] = placement;
    }
    masonryHeight.value = layout.height;
    masonryReady.value = true;
    lastMasonryRootWidth = containerWidth;
};

const scheduleMasonryLayout = () => {
    if (masonryFrame !== null) return;
    masonryFrame = window.requestAnimationFrame(performMasonryLayout);
};

const registerMasonryItem = (
    featureId: FeatureId,
    element: Element | ComponentPublicInstance | null,
) => {
    const previous = masonryItems.get(featureId);
    if (previous === element) return;
    if (previous) masonryItemObserver?.unobserve(previous);
    if (element instanceof HTMLElement) {
        masonryItems.set(featureId, element);
        masonryItemObserver?.observe(element);
    } else {
        masonryItems.delete(featureId);
    }
    if (typeof window !== 'undefined') scheduleMasonryLayout();
};

const masonryItemRefSetters = new Map<
    FeatureId,
    (element: Element | ComponentPublicInstance | null) => void
>();
const masonryItemRef = (featureId: FeatureId) => {
    let setter = masonryItemRefSetters.get(featureId);
    if (!setter) {
        setter = (element) => registerMasonryItem(featureId, element);
        masonryItemRefSetters.set(featureId, setter);
    }
    return setter;
};

const setupMasonryLayout = () => {
    const root = masonryRoot.value;
    if (!root) return;
    masonryMediaQuery = window.matchMedia(MASONRY_WIDE_QUERY);
    masonryRootObserver = new ResizeObserver(([entry]) => {
        const width = entry?.contentRect.width ?? 0;
        if (Math.abs(width - lastMasonryRootWidth) > 0.5) {
            scheduleMasonryLayout();
        }
    });
    masonryItemObserver = new ResizeObserver(() => scheduleMasonryLayout());
    masonryRootObserver.observe(root);
    for (const element of masonryItems.values()) {
        masonryItemObserver.observe(element);
    }
    masonryMediaQuery.addEventListener('change', scheduleMasonryLayout);
    scheduleMasonryLayout();
};

const disposeMasonryLayout = () => {
    masonryRootObserver?.disconnect();
    masonryItemObserver?.disconnect();
    masonryMediaQuery?.removeEventListener('change', scheduleMasonryLayout);
    masonryRootObserver = null;
    masonryItemObserver = null;
    masonryMediaQuery = null;
    if (masonryFrame !== null) window.cancelAnimationFrame(masonryFrame);
    masonryFrame = null;
};

const persistWorkspace = (patch: {
    featureQueue?: readonly FeatureId[];
    nextViewport?: PersistedTimelineViewport | null;
    nextFeatureOrder?: readonly FeatureId[];
} = {}) => audioSession.updateAnalysisWorkspace({
    activeFeatureQueue: [
        ...(patch.featureQueue ?? activeFeatureQueue.value),
    ],
    featureOrder: [
        ...(patch.nextFeatureOrder ?? featureOrder.value),
    ],
    viewport: patch.nextViewport === undefined
        ? sessionStore.analysisWorkspace.viewport
        : patch.nextViewport,
});

const applyFeatureQueue = async (featureQueue: FeatureId[]) => {
    const nextQueue = [...featureQueue];
    const persist = persistWorkspace({
        featureQueue: nextQueue,
        nextViewport: durationSeconds.value > 0 ? viewport.value : null,
    });
    for (const key of Object.keys(exactValues) as M10FeatureId[]) {
        if (!nextQueue.includes(key)) {
            delete exactValues[key];
        }
    }
    await analysisLease.setActiveFeatures(nextQueue);
    await persist;
    requestExactValues(true);
};

const toggleCard = (featureId: FeatureId) => {
    const transition = toggleActiveFeature(
        activeFeatureQueue.value,
        featureId,
    );
    void applyFeatureQueue(transition.queue);
};

const setViewport = (nextViewport: PersistedTimelineViewport) => {
    void persistWorkspace({ nextViewport });
};

const zoom = (factor: number) => {
    setViewport(zoomTimelineViewport(
        viewport.value,
        durationSeconds.value,
        viewport.value.zoom * factor,
        cursorSeconds.value,
    ));
};

const pan = (direction: -1 | 1) => {
    setViewport(panTimelineViewport(
        viewport.value,
        durationSeconds.value,
        direction,
    ));
};

const resetViewport = () => {
    setViewport(resetTimelineViewport(durationSeconds.value));
};

const focusReorderHandle = (featureId: FeatureId) => {
    void nextTick(() => reorderHandles.get(featureId)?.focus());
};

const announceFeaturePosition = (
    featureId: FeatureId,
    order: readonly FeatureId[],
) => {
    reorderAnnouncement.value = `${featureLabel(featureId)} 已移动到第 ${
        order.indexOf(featureId) + 1
    } 项，共 ${order.length} 项。`;
};

const commitFeatureOrder = (
    nextOrder: FeatureId[],
    sourceId: FeatureId,
    focusHandle = true,
) => {
    if (nextOrder.every((featureId, index) =>
        featureId === featureOrder.value[index])) return;
    void persistWorkspace({ nextFeatureOrder: nextOrder });
    announceFeaturePosition(sourceId, nextOrder);
    void nextTick(() => {
        scheduleMasonryLayout();
        if (focusHandle) reorderHandles.get(sourceId)?.focus();
    });
};

const resetFeatureOrder = () => {
    const nextOrder = defaultFeatureOrder();
    if (isFeatureOrderDefault.value) return;
    openOrderMenu.value = null;
    void persistWorkspace({ nextFeatureOrder: nextOrder });
    reorderAnnouncement.value = '已恢复默认特征顺序。';
    void nextTick(scheduleMasonryLayout);
};

const applyOrderAction = (
    featureId: FeatureId,
    action: FeatureOrderAction,
) => {
    commitFeatureOrder(
        moveFeatureOrder(featureOrder.value, featureId, action),
        featureId,
    );
};

const closeOrderMenu = (returnFocus = false) => {
    const featureId = openOrderMenu.value;
    openOrderMenu.value = null;
    if (returnFocus && featureId) focusReorderHandle(featureId);
};

const handleReorderHandleClick = (featureId: FeatureId) => {
    if (suppressHandleClick) {
        suppressHandleClick = false;
        if (suppressHandleClickTimer !== null) {
            window.clearTimeout(suppressHandleClickTimer);
            suppressHandleClickTimer = null;
        }
        return;
    }
    openOrderMenu.value = openOrderMenu.value === featureId
        ? null
        : featureId;
};

const armHandleClickSuppression = () => {
    suppressHandleClick = true;
    if (suppressHandleClickTimer !== null) {
        window.clearTimeout(suppressHandleClickTimer);
        suppressHandleClickTimer = null;
    }
    suppressHandleClick = false;
    suppressHandleClickTimer = window.setTimeout(() => {
        suppressHandleClick = false;
        suppressHandleClickTimer = null;
    }, 0);
};

const handleReorderHandleKeydown = (
    event: KeyboardEvent,
    featureId: FeatureId,
) => {
    if (event.altKey) {
        const action = {
            ArrowUp: 'up',
            ArrowDown: 'down',
            Home: 'first',
            End: 'last',
        }[event.key] as FeatureOrderAction | undefined;
        if (action) {
            event.preventDefault();
            applyOrderAction(featureId, action);
            return;
        }
    }
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openOrderMenu.value = openOrderMenu.value === featureId
            ? null
            : featureId;
        return;
    }
    if (event.key === 'Escape' && openOrderMenu.value === featureId) {
        event.preventDefault();
        closeOrderMenu(true);
    }
};

const cancelDragFrame = () => {
    if (dragFrame !== null) window.cancelAnimationFrame(dragFrame);
    dragFrame = null;
};

const releaseDragCapture = (state: ReorderDragState) => {
    try {
        if (state.handle.hasPointerCapture(state.pointerId)) {
            state.handle.releasePointerCapture(state.pointerId);
        }
    } catch {
        // Pointer capture may already be gone after blur or native cancellation.
    }
};

const clearDrag = (returnFocus = false) => {
    const state = dragState.value;
    if (!state) return;
    dragState.value = null;
    cancelDragFrame();
    releaseDragCapture(state);
    if (returnFocus) focusReorderHandle(state.sourceId);
};

const cancelActiveDrag = (returnFocus = true) => {
    const wasActive = dragState.value?.active ?? false;
    clearDrag(returnFocus);
    if (wasActive) armHandleClickSuppression();
};

const performDragFrame = () => {
    dragFrame = null;
    const state = dragState.value;
    const root = masonryRoot.value;
    if (!state || !root) return;
    if (!state.active) {
        const distance = Math.hypot(
            state.currentX - state.startX,
            state.currentY - state.startY,
        );
        if (distance < DRAG_START_THRESHOLD) return;
        state.active = true;
        openOrderMenu.value = null;
    }

    const rootRect = root.getBoundingClientRect();
    const sourceRect = masonryItems.get(state.sourceId)
        ?.getBoundingClientRect();
    const overSource = sourceRect
        && state.currentX >= sourceRect.left
        && state.currentX <= sourceRect.right
        && state.currentY >= sourceRect.top
        && state.currentY <= sourceRect.bottom;
    state.candidate = overSource
        ? null
        : findFeatureDropTarget(
            state.currentX,
            state.currentY,
            rootRect,
            featureOrder.value.flatMap((featureId) => {
                const rect = masonryItems.get(featureId)
                    ?.getBoundingClientRect();
                return rect
                    ? [{
                        id: featureId,
                        left: rect.left,
                        top: rect.top,
                        right: rect.right,
                        bottom: rect.bottom,
                    }]
                    : [];
            }),
            state.sourceId,
        );

    const scroller = analyzerContent.value;
    if (!scroller) return;
    const scrollRect = scroller.getBoundingClientRect();
    let scrollDelta = 0;
    if (state.currentY < scrollRect.top + AUTO_SCROLL_EDGE) {
        const proximity = Math.max(
            0,
            1 - (state.currentY - scrollRect.top) / AUTO_SCROLL_EDGE,
        );
        scrollDelta = -AUTO_SCROLL_MAX * proximity;
    } else if (
        state.currentY > scrollRect.bottom - AUTO_SCROLL_EDGE
    ) {
        const proximity = Math.max(
            0,
            1 - (scrollRect.bottom - state.currentY) / AUTO_SCROLL_EDGE,
        );
        scrollDelta = AUTO_SCROLL_MAX * proximity;
    }
    if (scrollDelta !== 0) {
        const previousScrollTop = scroller.scrollTop;
        scroller.scrollTop += scrollDelta;
        if (scroller.scrollTop !== previousScrollTop) scheduleDragFrame();
    }
};

const scheduleDragFrame = () => {
    if (dragFrame !== null) return;
    dragFrame = window.requestAnimationFrame(performDragFrame);
};

const handleDragPointerDown = (
    event: PointerEvent,
    featureId: FeatureId,
) => {
    if (event.button !== 0 || dragState.value) return;
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;
    dragState.value = {
        pointerId: event.pointerId,
        sourceId: featureId,
        handle,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        active: false,
        candidate: null,
    };
    handle.setPointerCapture(event.pointerId);
};

const handleDragPointerMove = (event: PointerEvent) => {
    const state = dragState.value;
    if (!state || state.pointerId !== event.pointerId) return;
    state.currentX = event.clientX;
    state.currentY = event.clientY;
    if (state.active) event.preventDefault();
    scheduleDragFrame();
};

const handleDragPointerUp = (event: PointerEvent) => {
    let state = dragState.value;
    if (!state || state.pointerId !== event.pointerId) return;
    state.currentX = event.clientX;
    state.currentY = event.clientY;
    cancelDragFrame();
    performDragFrame();
    state = dragState.value;
    if (!state) return;
    const active = state.active;
    const candidate = state.candidate;
    const sourceId = state.sourceId;
    clearDrag();
    if (!active) return;
    armHandleClickSuppression();
    if (candidate) {
        commitFeatureOrder(
            insertFeatureOrder(
                featureOrder.value,
                sourceId,
                candidate.featureId,
                candidate.edge,
            ),
            sourceId,
        );
    } else {
        focusReorderHandle(sourceId);
    }
};

const cancelDrag = (event?: Event) => {
    if (
        event
        && 'pointerId' in event
        && dragState.value
        && event.pointerId !== dragState.value.pointerId
    ) return;
    cancelActiveDrag(true);
};

const handleLostPointerCapture = (event: PointerEvent) => {
    if (dragState.value?.pointerId === event.pointerId) cancelActiveDrag(true);
};

const handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (dragState.value) {
        event.preventDefault();
        cancelActiveDrag(true);
    } else if (openOrderMenu.value) {
        event.preventDefault();
        closeOrderMenu(true);
    }
};

const handleGlobalPointerDown = (event: PointerEvent) => {
    const featureId = openOrderMenu.value;
    if (!featureId) return;
    const control = event.target instanceof Element
        ? event.target.closest('[data-reorder-control]')
        : null;
    if (control?.getAttribute('data-reorder-control') !== featureId) {
        closeOrderMenu(true);
    }
};

const seek = async (seconds: number) => {
    await audioSession.seek(seconds);
    requestExactValues(true);
};

const retryAnalysis = async () => {
    await analysisLease.setActiveFeatures(activeFeatureIds.value);
    requestExactValues(true);
};

const performExactRequests = async () => {
    if (analysis.value.state !== 'ready') return;
    lastCursorRequestAt = performance.now();
    const generation = analysis.value.generation;
    await Promise.all(activeFeatureIds.value.map(async (featureId) => {
        const result = await analysisLease.requestCursorValue(
            featureId,
            cursorSeconds.value,
        );
        if (
            result
            && analysis.value.generation === generation
            && activeFeatureIds.value.includes(featureId)
        ) {
            exactValues[featureId] = result;
        }
    }));
};

const requestExactValues = (immediate = false) => {
    if (cursorTimer) {
        clearTimeout(cursorTimer);
        cursorTimer = null;
    }
    const elapsed = performance.now() - lastCursorRequestAt;
    if (immediate || elapsed >= CURSOR_REQUEST_INTERVAL_MS) {
        void performExactRequests();
        return;
    }
    cursorTimer = setTimeout(() => {
        cursorTimer = null;
        void performExactRequests();
    }, CURSOR_REQUEST_INTERVAL_MS - elapsed);
};

const initializeWorkspace = async () => {
    if (workspaceBootstrapped) return;
    if (initializationPromise) return initializationPromise;
    if (sessionStore.persistence.state === 'restoring') return;
    workspaceBootstrapped = true;
    initializationPromise = (async () => {
        if (!sessionStore.analysisWorkspace.initialized) {
            const initialViewport = durationSeconds.value > 0
                ? resetTimelineViewport(durationSeconds.value)
                : null;
            const persist = persistWorkspace({
                featureQueue: [],
                nextViewport: initialViewport,
            });
            await analysisLease.setActiveFeatures([]);
            await persist;
        } else {
            const restoredQueue = activeFeatureQueue.value;
            if (
                restoredQueue.length
                !== sessionStore.analysisWorkspace.activeFeatureQueue.length
            ) {
                await persistWorkspace({ featureQueue: restoredQueue });
            }
            await analysisLease.setActiveFeatures(restoredQueue);
        }
        requestExactValues(true);
    })().catch((error) => {
        workspaceBootstrapped = false;
        throw error;
    }).finally(() => {
        initializationPromise = null;
    });
    return initializationPromise;
};

watch(
    () => sessionStore.persistence.state,
    (state) => {
        if (state !== 'restoring') void initializeWorkspace();
    },
    { immediate: true },
);

watch(
    () => ({
        trackId: sessionStore.currentTrackId,
        duration: durationSeconds.value,
    }),
    ({ duration }) => {
        if (
            !sessionStore.analysisWorkspace.initialized
            || !Number.isFinite(duration)
            || duration <= 0
        ) return;
        const repaired = normalizeTimelineViewport(
            sessionStore.analysisWorkspace.viewport,
            duration,
        );
        const current = sessionStore.analysisWorkspace.viewport;
        if (
            !current
            || current.startSeconds !== repaired.startSeconds
            || current.endSeconds !== repaired.endSeconds
            || current.zoom !== repaired.zoom
        ) {
            void persistWorkspace({ nextViewport: repaired });
        }
    },
);

watch(
    () => sessionStore.playback.currentTimeSeconds,
    () => requestExactValues(false),
);

watch(
    () => sessionStore.playback.state,
    (state, previous) => {
        if (state !== 'playing' || previous === 'playing') {
            requestExactValues(true);
        }
    },
);

watch(
    () => featureOrder.value.join('|'),
    () => void nextTick(scheduleMasonryLayout),
);

onMounted(() => {
    setupMasonryLayout();
    window.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('blur', cancelDrag);
    document.addEventListener('pointerdown', handleGlobalPointerDown, true);
    unsubscribeCoordinator = analysisLease.subscribe(() => {
        seriesRevision.value += 1;
        requestExactValues(false);
    });
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
    window.removeEventListener('blur', cancelDrag);
    document.removeEventListener('pointerdown', handleGlobalPointerDown, true);
    clearDrag();
    if (suppressHandleClickTimer !== null) {
        window.clearTimeout(suppressHandleClickTimer);
    }
    disposeMasonryLayout();
    unsubscribeCoordinator?.();
    unsubscribeCoordinator = null;
    if (cursorTimer) clearTimeout(cursorTimer);
    analysisLease.release();
});
</script>

<style scoped>
.analyzer-page {
    background:
        radial-gradient(circle at 20% 10%, rgba(59, 255, 141, 0.12), transparent 28%),
        #020403;
    color: #f2fff7;
    min-height: 100dvh;
    overflow: hidden;
    position: relative;
    z-index: var(--layer-content);
}

.analyzer-content {
    box-sizing: border-box;
    height: 100dvh;
    overflow-y: auto;
    padding:
        0
        max(24px, calc((100vw - 1760px) / 2))
        150px;
    position: relative;
    scrollbar-width: thin;
}

.status-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.status-row span {
    background: rgba(10, 24, 16, 0.82);
    border: 1px solid rgba(125, 255, 179, 0.22);
    border-radius: 999px;
    color: #a8c5b3;
    font-size: 0.72rem;
    padding: 6px 10px;
}

.status-row span[data-state="ready"] {
    color: #7dffb3;
}

.timeline-toolbar {
    align-items: center;
    backdrop-filter: blur(18px);
    background: rgba(6, 15, 10, 0.86);
    border: 1px solid rgba(125, 255, 179, 0.24);
    border-radius: 16px;
    display: flex;
    gap: 18px;
    justify-content: space-between;
    margin:
        calc(var(--app-header-height) + 24px)
        0
        18px;
    padding: 13px 15px;
    position: sticky;
    top: calc(var(--app-header-height) + var(--app-sticky-gap));
    z-index: var(--layer-sticky);
}

.toolbar-summary {
    align-items: flex-start;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.viewport-summary {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.timeline-toolbar span {
    color: #91a99a;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
}

.toolbar-actions,
.feature-choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

button {
    background: #0b1710;
    border: 1px solid rgba(125, 255, 179, 0.34);
    border-radius: 9px;
    color: #effff5;
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
    min-height: 36px;
    padding: 7px 11px;
    transition:
        background-color 120ms ease,
        border-color 120ms ease,
        box-shadow 120ms ease,
        color 120ms ease,
        transform 80ms ease;
}

@media (hover: hover) and (pointer: fine) {
    button:hover:not(:disabled) {
        background: #10261a;
        border-color: #7dffb3;
    }
}

button:active:not(:disabled) {
    background: #173624;
    border-color: #b5ffd2;
    box-shadow: inset 0 0 0 1px rgba(181, 255, 210, 0.3);
    transform: translateY(1px);
}

button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
}

button:focus-visible {
    outline: 3px solid #f8ff87;
    outline-offset: 3px;
}

button:focus:not(:focus-visible) {
    outline: none;
}

.analysis-error {
    background: rgba(89, 22, 22, 0.55);
    border: 1px solid rgba(255, 130, 130, 0.5);
    border-radius: 12px;
    color: #ffd6d6;
    margin: 0 0 18px;
    padding: 12px 14px;
}

.visually-hidden {
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
}

.card-masonry {
    min-height: 220px;
    position: relative;
    width: 100%;
}

.masonry-item {
    left: 0;
    position: absolute;
    top: 0;
}

.masonry-item.has-open-reorder-menu {
    z-index: 4;
}

.masonry-item.is-drag-source {
    opacity: 0.42;
}

.masonry-item.is-drop-before::before,
.masonry-item.is-drop-after::after {
    background: #f8ff87;
    border-radius: 999px;
    box-shadow: 0 0 0 3px rgba(248, 255, 135, 0.2);
    content: '';
    height: 3px;
    left: 8px;
    pointer-events: none;
    position: absolute;
    right: 8px;
    z-index: 6;
}

.masonry-item.is-drop-before::before {
    top: -6px;
}

.masonry-item.is-drop-after::after {
    bottom: -6px;
}

.card-masonry:not(.is-ready) .masonry-item {
    visibility: hidden;
}

.masonry-item > * {
    width: 100%;
}

.reorder-control {
    position: relative;
}

.reorder-handle {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    min-width: 36px;
    padding: 7px 9px;
    touch-action: none;
}

.reorder-handle.is-active {
    border-color: #f8ff87;
    color: #f8ff87;
}

.grip-icon {
    display: grid;
    gap: 3px;
    width: 15px;
}

.grip-icon span {
    background: currentColor;
    border-radius: 999px;
    display: block;
    height: 2px;
    width: 100%;
}

.reorder-menu {
    background: rgba(5, 14, 9, 0.98);
    border: 1px solid rgba(125, 255, 179, 0.42);
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    display: grid;
    gap: 6px;
    grid-template-columns: repeat(2, minmax(72px, 1fr));
    padding: 8px;
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    width: max-content;
    z-index: 8;
}

.reorder-menu button {
    min-width: 72px;
}

.drag-ghost {
    background: rgba(11, 23, 16, 0.96);
    border: 1px solid #7dffb3;
    border-radius: 10px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    color: #effff5;
    font-size: 0.78rem;
    max-width: min(260px, calc(100vw - 32px));
    overflow: hidden;
    padding: 9px 12px;
    pointer-events: none;
    position: fixed;
    text-overflow: ellipsis;
    white-space: nowrap;
    z-index: 30;
}

.empty-slot {
    align-items: center;
    background:
        linear-gradient(135deg, rgba(125, 255, 179, 0.04), transparent);
    border: 1px dashed rgba(125, 255, 179, 0.28);
    border-radius: 18px;
    color: #9eb4a7;
    display: flex;
    justify-content: space-between;
    min-height: 220px;
    padding: 24px;
}

.empty-slot h2 {
    color: #effff5;
    font-size: 1.1rem;
    margin: 5px 0 8px;
}

.empty-slot p {
    line-height: 1.55;
    margin: 0;
    max-width: 520px;
}

.slot-number {
    color: #7dffb3 !important;
    font-size: 0.68rem;
    letter-spacing: 0.16em;
}

@media (max-width: 820px) {
    .analyzer-content {
        padding-left: 14px;
        padding-right: 14px;
    }

    .timeline-toolbar,
    .empty-slot {
        align-items: stretch;
        flex-direction: column;
    }

}

@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        scroll-behavior: auto !important;
        transition-duration: 0.001ms !important;
    }
}
</style>
