<template>
    <main class="analyzer-page">
        <DotGridBg />
        <div class="analyzer-content">
            <header class="page-header">
                <div>
                    <p class="kicker">Analyzer learning workspace · M7</p>
                    <h1>把声音看成三种互相联动的证据</h1>
                    <p>
                        RMS 看响度变化，Amplitude Spectrum 看频率分布，
                        Chroma 看十二音级。四个槽位共享同一视口和播放游标。
                    </p>
                </div>
                <div class="status-stack" aria-live="polite">
                    <span :data-state="analysis.state">
                        {{ analysisStateLabel }}
                    </span>
                    <span>{{ activeCards.length }}/3 张 M7 活动卡</span>
                    <span v-if="sessionStore.persistence.state === 'not-persisted'">
                        当前工作区未持久化
                    </span>
                </div>
            </header>

            <section class="timeline-toolbar" aria-label="共享时间轴控制">
                <div>
                    <strong>共享视口</strong>
                    <span>
                        {{ formatTime(viewport.startSeconds) }}
                        –
                        {{ formatTime(viewport.endSeconds) }}
                    </span>
                    <span>游标 {{ formatTime(cursorSeconds) }}</span>
                    <span>{{ viewport.zoom.toFixed(1) }}×</span>
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

            <section class="card-grid" aria-label="分析卡片工作区">
                <template v-for="slot in CARD_SLOTS" :key="slot">
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
                            <h2 v-if="activeCards.length >= 3">
                                为后续特征保留
                            </h2>
                            <h2 v-else>添加一张学习卡</h2>
                            <p v-if="activeCards.length >= 3">
                                M7 最多三张唯一活动卡。Energy 与其他特征将在
                                M8 后续里程碑开放。
                            </p>
                            <p v-else>
                                从尚未使用的 M7 特征中选择；重复特征不会出现。
                            </p>
                        </div>
                        <div
                            v-if="activeCards.length < 3"
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
                </template>
            </section>
        </div>
    </main>
</template>

<script setup lang="ts">
import {
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
    type AnalysisCursorValueResult,
    type AnalysisSeries,
    type M7FeatureId,
} from '../analysis/types';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import type {
    ActiveAnalysisCard,
    PersistedTimelineViewport,
} from '../types/session';

const CARD_SLOTS = [0, 1, 2, 3] as const;
const DEFAULT_CARDS: ActiveAnalysisCard[] = M7_FEATURE_IDS.map(
    (featureId, slot) => ({
        slot: slot as 0 | 1 | 2,
        featureId,
    }),
);

const sessionStore = useAudioSessionStore();
const audioSession = useAudioSessionService();
const analysisCoordinator = useAnalysisCoordinator();
const seriesRevision = ref(0);
const exactValues = reactive<
    Partial<Record<M7FeatureId, AnalysisCursorValueResult>>
>({});
let unsubscribeCoordinator: (() => void) | null = null;
let cursorTimer: ReturnType<typeof setTimeout> | null = null;
let lastCursorRequestAt = 0;
let initializationPromise: Promise<void> | null = null;
let workspaceBootstrapped = false;

const analysis = computed(() => sessionStore.analysis);
const activeCards = computed(() =>
    [...sessionStore.analysisWorkspace.activeCards]
        .filter((card): card is ActiveAnalysisCard & {
            featureId: M7FeatureId;
        } =>
            (M7_FEATURE_IDS as readonly string[]).includes(card.featureId))
        .sort((left, right) => left.slot - right.slot));
const activeFeatureIds = computed<M7FeatureId[]>(() =>
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
    M7_FEATURE_IDS
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

const seriesFor = (featureId: M7FeatureId): AnalysisSeries | null => {
    void seriesRevision.value;
    return analysisCoordinator.getSeries(featureId);
};

const formatTime = (seconds: number): string => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${(safe % 60).toFixed(2).padStart(5, '0')}`;
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
    await analysisCoordinator.setActiveFeatures(
        sorted.map((card) => card.featureId),
    );
    await persist;
    for (const key of Object.keys(exactValues) as M7FeatureId[]) {
        if (!sorted.some((card) => card.featureId === key)) {
            delete exactValues[key];
        }
    }
    requestExactValues(true);
};

const addCard = (
    slot: 0 | 1 | 2 | 3,
    featureId: M7FeatureId,
) => {
    if (
        activeCards.value.length >= 3
        || activeFeatureIds.value.includes(featureId)
    ) return;
    void applyCards([...activeCards.value, { slot, featureId }]);
};

const replaceCard = (
    slot: 0 | 1 | 2 | 3,
    featureId: M7FeatureId,
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
    await analysisCoordinator.retry();
    requestExactValues(true);
};

const performExactRequests = async () => {
    if (analysis.value.state !== 'ready') return;
    lastCursorRequestAt = performance.now();
    const generation = analysis.value.generation;
    await Promise.all(activeFeatureIds.value.map(async (featureId) => {
        const result = await analysisCoordinator.requestCursorValue(
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
    if (immediate || elapsed >= 34) {
        void performExactRequests();
        return;
    }
    cursorTimer = setTimeout(() => {
        cursorTimer = null;
        void performExactRequests();
    }, 34 - elapsed);
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
            await analysisCoordinator.setActiveFeatures(M7_FEATURE_IDS);
            await persist;
        } else {
            await analysisCoordinator.setActiveFeatures(
                activeFeatureIds.value,
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
    unsubscribeCoordinator = analysisCoordinator.subscribe(() => {
        seriesRevision.value += 1;
        requestExactValues(false);
    });
});

onBeforeUnmount(() => {
    unsubscribeCoordinator?.();
    unsubscribeCoordinator = null;
    if (cursorTimer) clearTimeout(cursorTimer);
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
}

.analyzer-content {
    height: 100dvh;
    overflow-y: auto;
    padding: 104px max(24px, calc((100vw - 1760px) / 2)) 150px;
    position: relative;
    scrollbar-width: thin;
}

.page-header {
    align-items: end;
    display: flex;
    gap: 32px;
    justify-content: space-between;
    margin-bottom: 24px;
}

.page-header h1 {
    font-size: clamp(1.8rem, 4vw, 3.6rem);
    font-weight: 650;
    letter-spacing: -0.05em;
    line-height: 1;
    margin: 8px 0 14px;
    max-width: 900px;
}

.page-header p {
    color: #9eb4a7;
    line-height: 1.6;
    margin: 0;
    max-width: 780px;
}

.kicker {
    color: #7dffb3 !important;
    font-size: 0.75rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
}

.status-stack {
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    gap: 6px;
}

.status-stack span {
    background: rgba(10, 24, 16, 0.82);
    border: 1px solid rgba(125, 255, 179, 0.22);
    border-radius: 999px;
    color: #a8c5b3;
    font-size: 0.72rem;
    padding: 6px 10px;
}

.status-stack span[data-state="ready"] {
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
    margin-bottom: 18px;
    padding: 13px 15px;
    position: sticky;
    top: 86px;
    z-index: 5;
}

.timeline-toolbar > div:first-child {
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
}

button:hover:not(:disabled) {
    border-color: #7dffb3;
}

button:disabled {
    cursor: not-allowed;
    opacity: 0.38;
}

button:focus-visible {
    outline: 3px solid #f8ff87;
    outline-offset: 3px;
}

.analysis-error {
    background: rgba(89, 22, 22, 0.55);
    border: 1px solid rgba(255, 130, 130, 0.5);
    border-radius: 12px;
    color: #ffd6d6;
    margin: 0 0 18px;
    padding: 12px 14px;
}

.card-grid {
    display: grid;
    gap: 18px;
    grid-template-columns: 1fr;
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

@media (min-width: 1280px) {
    .card-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 820px) {
    .analyzer-content {
        padding-left: 14px;
        padding-right: 14px;
    }

    .page-header,
    .timeline-toolbar,
    .empty-slot {
        align-items: stretch;
        flex-direction: column;
    }

    .status-stack {
        align-items: flex-start;
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
