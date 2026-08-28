<template>
    <main class="analyzer-page">
        <DotGridBg />
        <div class="analyzer-content">
            <section class="timeline-toolbar" aria-label="共享时间轴控制">
                <div class="toolbar-summary">
                    <div class="status-row" aria-live="polite">
                        <span :data-state="analysis.state">
                            {{ analysisStateLabel }}
                        </span>
                        <span>{{ activeCards.length }}/4 张活动卡</span>
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

            <section
                ref="masonryRoot"
                class="card-masonry"
                :class="{ 'is-ready': masonryReady }"
                :style="{ height: `${masonryHeight}px` }"
                aria-label="分析卡片工作区"
                data-testid="analyzer-masonry"
            >
                <div
                    v-for="slot in CARD_SLOTS"
                    :key="slot"
                    :ref="masonryItemRef(slot)"
                    class="masonry-item"
                    :data-slot="slot"
                    :style="masonryItemStyle(slot)"
                >
                    <MeydaCard
                        v-if="cardAt(slot)"
                        :slot="slot"
                        :feature-id="cardAt(slot)!.featureId"
                        :disabled-feature-ids="activeFeatureIds"
                        :series="seriesFor(cardAt(slot)!.featureId)"
                        :viewport="viewport"
                        :cursor-seconds="cursorSeconds"
                        :duration-seconds="durationSeconds"
                        :sample-rate="analysis.sampleRate"
                        :exact-value="exactValues[cardAt(slot)!.featureId] ?? null"
                        :analysis-state="analysis.state"
                        @change="replaceCard(slot, $event)"
                        @remove="removeCard(slot)"
                        @seek="seek"
                    />
                    <article v-else class="empty-slot" :data-slot="slot">
                        <div>
                            <p class="slot-number">SLOT {{ slot + 1 }}</p>
                            <h2>添加一张学习卡</h2>
                            <p>
                                21 项 Analyzer 特征均可选择；最多四张且不会重复。
                            </p>
                        </div>
                        <div
                            v-if="activeCards.length < 4"
                            class="feature-choices"
                        >
                            <button
                                v-for="option in availableFeatures"
                                :key="option.id"
                                type="button"
                                @click="addCard(slot, option.id)"
                            >
                                + {{ option.label }}
                            </button>
                        </div>
                    </article>
                </div>
            </section>
        </div>
    </main>
</template>

<script setup lang="ts">
import {
    type ComponentPublicInstance,
    computed,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from 'vue';
import DotGridBg from '../components/DotGridBg.vue';
import MeydaCard from '../components/MeydaCard.vue';
import { useAudioSessionService } from '../audio/audioSessionService';
import { useAnalysisCoordinator } from '../analysis/analysisCoordinator';
import { FEATURE_REGISTRY } from '../analysis/featureRegistry';
import {
    panTimelineViewport,
    normalizeTimelineViewport,
    resetTimelineViewport,
    zoomTimelineViewport,
} from '../analysis/timelineViewport';
import {
    M7_FEATURE_IDS,
    M10_AVAILABLE_FEATURE_IDS,
    type AnalysisCursorValueResult,
    type AnalysisSeries,
    type M10FeatureId,
} from '../analysis/types';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import {
    calculateMasonryLayout,
    type MasonryPlacement,
} from '../utils/masonryLayout';
import type {
    ActiveAnalysisCard,
    PersistedTimelineViewport,
} from '../types/session';

const CARD_SLOTS = [0, 1, 2, 3] as const;
type CardSlot = (typeof CARD_SLOTS)[number];
const MASONRY_GAP = 18;
const MASONRY_WIDE_QUERY = '(min-width: 1280px)';
const DEFAULT_CARDS: ActiveAnalysisCard[] = M7_FEATURE_IDS.map(
    (featureId, slot) => ({
        slot: slot as 0 | 1 | 2,
        featureId,
    }),
);

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
    Partial<Record<CardSlot, MasonryPlacement<CardSlot>>>
>({});
const masonryItems = new Map<CardSlot, HTMLElement>();
let masonryRootObserver: ResizeObserver | null = null;
let masonryItemObserver: ResizeObserver | null = null;
let masonryMediaQuery: MediaQueryList | null = null;
let masonryFrame: number | null = null;
let lastMasonryRootWidth = -1;

const analysis = computed(() => sessionStore.analysis);
const activeCards = computed(() =>
    [...sessionStore.analysisWorkspace.activeCards]
        .filter((card): card is ActiveAnalysisCard & {
            featureId: M10FeatureId;
        } =>
            (M10_AVAILABLE_FEATURE_IDS as readonly string[]).includes(
                card.featureId,
            ))
        .sort((left, right) => left.slot - right.slot));
const activeFeatureIds = computed<M10FeatureId[]>(() =>
    activeCards.value.map((card) => card.featureId));
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
const availableFeatures = computed(() =>
    M10_AVAILABLE_FEATURE_IDS
        .filter((id) => !activeFeatureIds.value.includes(id))
        .map((id) => ({ id, label: FEATURE_REGISTRY[id].label })));
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

const cardAt = (slot: 0 | 1 | 2 | 3) =>
    activeCards.value.find((card) => card.slot === slot);

const seriesFor = (featureId: M10FeatureId): AnalysisSeries | null => {
    void seriesRevision.value;
    return analysisLease.getSeries(featureId);
};

const formatTime = (seconds: number): string => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${(safe % 60).toFixed(2).padStart(5, '0')}`;
};

const masonryItemStyle = (slot: CardSlot) => {
    const placement = masonryPlacements[slot];
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
    const elements = CARD_SLOTS.map((slot) => masonryItems.get(slot));
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
        items: CARD_SLOTS.map((slot, index) => ({
            id: slot,
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
    slot: CardSlot,
    element: Element | ComponentPublicInstance | null,
) => {
    const previous = masonryItems.get(slot);
    if (previous === element) return;
    if (previous) masonryItemObserver?.unobserve(previous);
    if (element instanceof HTMLElement) {
        masonryItems.set(slot, element);
        masonryItemObserver?.observe(element);
    } else {
        masonryItems.delete(slot);
    }
    if (typeof window !== 'undefined') scheduleMasonryLayout();
};

const masonryItemRefSetters = new Map<
    CardSlot,
    (element: Element | ComponentPublicInstance | null) => void
>();
const masonryItemRef = (slot: CardSlot) => {
    let setter = masonryItemRefSetters.get(slot);
    if (!setter) {
        setter = (element) => registerMasonryItem(slot, element);
        masonryItemRefSetters.set(slot, setter);
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

const persistWorkspace = (
    cards: ActiveAnalysisCard[],
    nextViewport: PersistedTimelineViewport | null,
) => audioSession.updateAnalysisWorkspace({
    activeCards: cards,
    viewport: nextViewport,
});

const applyCards = async (cards: ActiveAnalysisCard[]) => {
    const sorted = [...cards].sort((left, right) => left.slot - right.slot);
    const persist = persistWorkspace(
        sorted,
        durationSeconds.value > 0 ? viewport.value : null,
    );
    await analysisLease.setActiveFeatures(
        sorted.map((card) => card.featureId),
    );
    await persist;
    for (const key of Object.keys(exactValues) as M10FeatureId[]) {
        if (!sorted.some((card) => card.featureId === key)) {
            delete exactValues[key];
        }
    }
    requestExactValues(true);
};

const addCard = (
    slot: 0 | 1 | 2 | 3,
    featureId: M10FeatureId,
) => {
    if (
        activeCards.value.length >= 4
        || activeFeatureIds.value.includes(featureId)
    ) return;
    void applyCards([...activeCards.value, { slot, featureId }]);
};

const replaceCard = (
    slot: 0 | 1 | 2 | 3,
    featureId: M10FeatureId,
) => {
    if (
        activeFeatureIds.value.includes(featureId)
        && cardAt(slot)?.featureId !== featureId
    ) return;
    void applyCards(
        activeCards.value.map((card) =>
            card.slot === slot ? { slot, featureId } : card),
    );
};

const removeCard = (slot: 0 | 1 | 2 | 3) => {
    void applyCards(
        activeCards.value.filter((card) => card.slot !== slot),
    );
};

const setViewport = (nextViewport: PersistedTimelineViewport) => {
    void persistWorkspace(activeCards.value, nextViewport);
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
            const persist = persistWorkspace(DEFAULT_CARDS, initialViewport);
            await analysisLease.setActiveFeatures(M7_FEATURE_IDS);
            await persist;
        } else {
            const restoredCards = activeCards.value;
            if (
                restoredCards.length
                !== sessionStore.analysisWorkspace.activeCards.length
            ) {
                await persistWorkspace(
                    restoredCards,
                    sessionStore.analysisWorkspace.viewport,
                );
            }
            await analysisLease.setActiveFeatures(
                restoredCards.map((card) => card.featureId),
            );
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
            void persistWorkspace(activeCards.value, repaired);
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
    setupMasonryLayout();
    unsubscribeCoordinator = analysisLease.subscribe(() => {
        seriesRevision.value += 1;
        requestExactValues(false);
    });
});

onBeforeUnmount(() => {
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

.card-masonry:not(.is-ready) .masonry-item {
    visibility: hidden;
}

.masonry-item > * {
    width: 100%;
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
