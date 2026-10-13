<template>
    <main class="analyzer-page">
        <DotGridBg :style="{ position: 'absolute', inset: '0', opacity: '0.25' }" />
        <div class="analyzer-content">
            <div class="analyzer-status" aria-live="polite">
                <span :data-state="analysis.state">{{ analysisStateLabel }}</span>
                <span>{{ activeFeatureQueue.length }}/4 项</span>                <span v-if="sessionStore.persistence.state === 'not-persisted'">当前工作区未持久化</span>
                <button v-if="analysis.error?.recoverable" type="button" @click="retryAnalysis">重试分析</button>
            </div>
            <p v-if="analysis.error" class="analysis-error" role="alert">{{ analysis.error.message }}</p>
            <div :ref="setWorkspace" class="analyzer-workspace" data-testid="analyzer-workspace">
                <section v-show="activeFeatureQueue.length > 0" class="pinned-panel"
                    :style="{ height: height + 'px' }" aria-label="置顶分析" data-testid="analyzer-pinned">
                    <div ref="pinnedScroll" class="pinned-scroll app-scrollbar">
                        <div ref="pinnedBody" class="feature-list">
                            <MeydaCard v-for="featureId in pinnedFeatureIds" :key="featureId"
                                :data-testid="'analyzer-card-' + featureId" :feature-id="featureId"
                                :expanded="true" :description-expanded="!!descriptionExpanded[featureId]"
                                :series="seriesFor(featureId)" :viewport="viewport" :cursor-seconds="cursorSeconds"
                                :duration-seconds="durationSeconds" :sample-rate="analysis.sampleRate"
                                :exact-value="exactValues[featureId] ?? null" :analysis-state="analysis.state"
                                @toggle="toggleCard(featureId)" @toggle-description="toggleDescription(featureId)"
                                @seek="seek" @zoom="zoomAt" />
                        </div>
                    </div>
                    <button ref="resizeHandle" type="button" role="separator" aria-orientation="horizontal"
                        aria-label="调整置顶分析区高度" aria-controls="analyzer-original-list" v-bind="ariaValues"
                        :disabled="!canResize" class="pinned-resize-handle" :class="{ 'is-dragging': dragging }"
                        data-testid="analyzer-height-handle"
                        @pointerdown="beginDrag" @pointermove="moveDrag" @pointerup="endDrag"
                        @pointercancel="cancelDrag" @lostpointercapture="cancelDrag" @keydown="handleKeydown">
                        <span aria-hidden="true"></span>
                    </button>
                </section>
                <section id="analyzer-original-list" ref="originalList" class="original-list app-scrollbar"
                    :inert="listHidden" aria-label="特征列表" data-testid="analyzer-original">
                    <MeydaCard v-for="featureId in originalFeatureIds" :key="featureId"
                        :data-testid="'analyzer-card-' + featureId" :feature-id="featureId"
                        :expanded="false" :description-expanded="!!descriptionExpanded[featureId]"
                        :series="seriesFor(featureId)" :viewport="viewport" :cursor-seconds="cursorSeconds"
                        :duration-seconds="durationSeconds" :sample-rate="analysis.sampleRate"
                        :exact-value="exactValues[featureId] ?? null" :analysis-state="analysis.state"
                        @toggle="toggleCard(featureId)" @toggle-description="toggleDescription(featureId)"
                        @seek="seek" @zoom="zoomAt" />
                </section>
            </div>
        </div>
    </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import DotGridBg from '../components/DotGridBg.vue';
import MeydaCard from '../components/MeydaCard.vue';
import { usePinnedPanel } from '../components/analyzer/usePinnedPanel';
import { useAudioSessionService } from '../audio/audioSessionService';
import { toggleActiveFeature } from '../analysis/activeFeatureQueue';
import { useAnalysisCoordinator } from '../analysis/analysisCoordinator';
import { normalizeTimelineViewport, resetTimelineViewport, zoomTimelineViewport } from '../analysis/timelineViewport';
import { FEATURE_IDS, type AnalysisCursorValueResult, type AnalysisSeries, type FeatureId, type M10FeatureId } from '../analysis/types';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import type { PersistedTimelineViewport } from '../types/session';

const sessionStore = useAudioSessionStore();
const audioSession = useAudioSessionService();
const analysisCoordinator = useAnalysisCoordinator();
const analysisLease = analysisCoordinator.acquireConsumer('analyzer');
const seriesRevision = ref(0);
const exactValues = reactive<Partial<Record<M10FeatureId, AnalysisCursorValueResult>>>({});
const CURSOR_REQUEST_INTERVAL_MS = 40;
let unsubscribeCoordinator: (() => void) | null = null;
let cursorTimer: ReturnType<typeof setTimeout> | null = null;
let lastCursorRequestAt = 0;
let initializationPromise: Promise<void> | null = null;
let workspaceBootstrapped = false;
const pendingViewport = ref<PersistedTimelineViewport | null>(null);
let zoomFrame: number | null = null;
let zoomTrackId: string | null = null;
const analysis = computed(() => sessionStore.analysis);
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
        pendingViewport.value ?? sessionStore.analysisWorkspace.viewport,
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

const pinnedFeatureIds = computed(() => [...activeFeatureQueue.value].reverse());
const originalFeatureIds = computed(() => FEATURE_IDS.filter(id => !activeFeatureQueue.value.includes(id)));
const descriptionExpanded = reactive<Partial<Record<FeatureId, boolean>>>({});
const toggleDescription = (id: FeatureId) => { descriptionExpanded[id] = !descriptionExpanded[id]; };
const { workspace: workspaceElement, pinnedBody, pinnedScroll, originalList, resizeHandle, height, canResize, listHidden,
    ariaValues, dragging, beginDrag, moveDrag, endDrag, cancelDrag, handleKeydown
} = usePinnedPanel(computed(() => activeFeatureQueue.value.length));
const setWorkspace = (element: unknown) => { workspaceElement.value = element instanceof HTMLElement ? element : null; };
const seriesFor = (featureId: M10FeatureId): AnalysisSeries | null => {
    void seriesRevision.value;
    return analysisLease.getSeries(featureId);
};
const persistWorkspace = (patch: {
    featureQueue?: readonly FeatureId[];
    nextViewport?: PersistedTimelineViewport | null;
} = {}) => audioSession.updateAnalysisWorkspace({
    activeFeatureQueue: [
        ...(patch.featureQueue ?? activeFeatureQueue.value),
    ],
    featureOrder: [...FEATURE_IDS],
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

// Keep the remaining original list anchored while one row transfers between regions.
const captureListAnchor = (movingId: FeatureId) => {
    const list = originalList.value;
    if (!list) return null;
    const top = list.getBoundingClientRect().top;
    const items = [...list.querySelectorAll<HTMLElement>('[data-feature-id]')];
    const anchor = items.find(item => item.dataset.featureId !== movingId
        && item.getBoundingClientRect().bottom > top);
    return anchor ? { id: anchor.dataset.featureId!, offset: anchor.getBoundingClientRect().top - top } : null;
};
const restoreListAnchor = (anchor: ReturnType<typeof captureListAnchor>) => {
    const list = originalList.value;
    if (!list || !anchor) return;
    const item = list.querySelector<HTMLElement>('[data-feature-id="' + anchor.id + '"]');
    if (item) list.scrollTop += item.getBoundingClientRect().top - list.getBoundingClientRect().top - anchor.offset;
};
const toggleCard = (featureId: FeatureId) => {
    const anchor = captureListAnchor(featureId);
    const transition = toggleActiveFeature(activeFeatureQueue.value, featureId);
    void applyFeatureQueue(transition.queue);
    void nextTick(() => {
        restoreListAnchor(anchor);
        if (transition.expanded && pinnedScroll.value) pinnedScroll.value.scrollTop = 0;
        const root = transition.expanded ? pinnedBody.value : originalList.value;
        const button = root?.querySelector<HTMLButtonElement>('[data-feature-id="' + featureId + '"] .toggle-card');
        if (!transition.expanded && listHidden.value) {
            (pinnedBody.value?.querySelector<HTMLButtonElement>('.toggle-card') ?? resizeHandle.value)?.focus({ preventScroll: true });
        } else button?.focus({ preventScroll: true });
    });
};
const flushZoom = () => {
    if (zoomFrame !== null) cancelAnimationFrame(zoomFrame);
    zoomFrame = null;
    const next = pendingViewport.value;
    pendingViewport.value = null;
    if (next && zoomTrackId === sessionStore.currentTrackId) void persistWorkspace({ nextViewport: next });
};
const zoomAt = (factor: number, anchorSeconds: number) => {
    zoomTrackId = sessionStore.currentTrackId;
    pendingViewport.value = zoomTimelineViewport(viewport.value, durationSeconds.value,
        viewport.value.zoom * factor, anchorSeconds);
    if (zoomFrame === null) zoomFrame = requestAnimationFrame(flushZoom);
};
watch(() => sessionStore.currentTrackId, () => {
    if (zoomFrame !== null) cancelAnimationFrame(zoomFrame);
    zoomFrame = null;
    pendingViewport.value = null;
}, { flush: 'sync' });
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
                || sessionStore.analysisWorkspace.featureOrder.some((id, index) => id !== FEATURE_IDS[index])
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

onMounted(() => {
    unsubscribeCoordinator = analysisLease.subscribe(() => {
        seriesRevision.value += 1;
        requestExactValues(false);
    });
});
onBeforeUnmount(() => {
    flushZoom();
    unsubscribeCoordinator?.();
    if (cursorTimer) clearTimeout(cursorTimer);
    analysisLease.release();
});
</script>

<style scoped>
.analyzer-page { position: relative; height: 100dvh; min-width: 0; overflow: hidden;
    background: radial-gradient(circle at 20% 10%, var(--glow-accent), transparent 28%), var(--canvas);
    color: var(--ink); z-index: var(--layer-content); }
.analyzer-content { position: relative; display: flex; flex-direction: column; box-sizing: border-box;
    height: 100%; padding: 64px max(24px, calc((100% - 1760px) / 2)) 70px; }
.analyzer-status { display: flex; flex-wrap: wrap; align-items: center; flex: none;
    gap: 6px 16px; padding: 0 8px 12px; color: var(--mute); font-size: 0.72rem; }
.analyzer-status [data-state="ready"] { color: var(--accent-deep); }
.analyzer-status button { background: transparent; border: 0; color: var(--accent); cursor: pointer; }
.analysis-error { flex: none; color: var(--error); font-size: 0.8rem; margin: 0 8px 12px; }
.analyzer-workspace { display: flex; flex: 1; flex-direction: column; min-height: 0; min-width: 0; }
.pinned-panel { display: flex; flex-direction: column; flex: none; min-height: 0; min-width: 0; overflow: hidden; }
.pinned-scroll { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; overflow-anchor: none; }
.feature-list { min-width: 0; }
.original-list { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; overflow-anchor: none; }
.pinned-resize-handle { position: relative; display: grid; place-items: center; flex: none; width: 100%; height: 24px;
    border: 0; padding: 0; color: var(--mute); background: transparent; cursor: row-resize; touch-action: none; user-select: none; }
.pinned-resize-handle span { width: 36px; height: 3px; border-radius: 3px; background: currentColor; }
.pinned-resize-handle::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
    background: linear-gradient(90deg, #0000, var(--main-color), #0000); pointer-events: none; }
.pinned-resize-handle:hover, .pinned-resize-handle.is-dragging { color: var(--accent); background: var(--control-hover); }
.pinned-resize-handle:disabled { opacity: 0.35; cursor: default; }
.pinned-resize-handle:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (max-width: 767px) {
    .analyzer-content { padding: 64px 12px 150px; }
}
</style>
