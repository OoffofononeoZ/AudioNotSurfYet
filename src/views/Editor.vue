<template>
    <main class="editor-page" data-testid="editor-page">
        <EditorToolbar :ready="snapshot.state === 'ready'" v-model:workspace="workspace" :persistence="snapshot.persistence" @import="importProject" @export="exportProject" />
        <p v-if="snapshot.state === 'ready' && snapshot.message" role="alert" class="editor-error">{{ snapshot.message }}</p>
        <section class="editor-shell" :class="{ 'editor-state-shell app-scrollbar': snapshot.state !== 'ready' }" :data-testid="snapshot.state === 'ready' ? 'editor-ready' : undefined">
            <section v-if="snapshot.state === 'empty'" class="editor-state" data-testid="editor-empty">
                <h2>先选择一首歌曲</h2>
                <p>可以在底部播放器导入或选择歌曲，再从导航栏 Editor 进入。</p>
            </section>

            <section v-else-if="snapshot.state === 'loading'" class="editor-state" aria-live="polite">
                <h2>正在准备歌曲和草稿…</h2>
            </section>

            <section v-else-if="snapshot.state === 'unavailable'" class="editor-state" data-testid="editor-unavailable">
                <h2>这首歌曲暂时不能编辑</h2>
                <p role="alert">{{ snapshot.message }}</p>
                <p>请在底部播放器恢复文件访问或重新选择相同文件。</p>
                <button
                    v-if="unavailableRecovery.kind === 'offer-current'"
                    type="button"
                    data-testid="editor-edit-current-track"
                    :aria-label="`编辑当前歌曲：${unavailableRecovery.title}`"
                    @click="editCurrentTrack"
                >
                    编辑当前歌曲
                </button>
            </section>

            <section v-else-if="snapshot.state === 'draft-error'" class="editor-state" data-testid="editor-draft-error">
                <h2>保存的 Editor 草稿无法读取</h2>
                <p role="alert">{{ snapshot.message }}</p>
                <button type="button" @click="clearInvalidDraft">清除损坏草稿并新建</button>
            </section>

            <section v-else-if="snapshot.state === 'draft-conflict'" class="editor-state conflict" data-testid="editor-draft-conflict">
                <h2>另一首歌曲已有草稿</h2>
                <p>{{ snapshot.message }}</p>
                <p v-if="snapshot.conflictingDraft">
                    旧工程：{{ snapshot.conflictingDraft.project.track.fileName }}
                </p>
                <p v-if="conflictExported" class="success-message">
                    旧工程已导出；仍需明确选择“覆盖草稿”才能继续。
                </p>
                <div class="button-row">
                    <button type="button" data-testid="export-conflicting-draft" @click="exportConflict">
                        导出旧工程
                    </button>
                    <button type="button" data-testid="overwrite-conflicting-draft" @click="overwriteConflict">
                        覆盖草稿
                    </button>
                    <button type="button" data-testid="cancel-editor-entry" @click="cancelConflict">
                        取消进入
                    </button>
                </div>
            </section>

            <template v-else-if="snapshot.state === 'ready' && snapshot.project">
                <div id="editor-marking-panel" v-show="workspace === 'marking'" class="editor-panel app-scrollbar" role="tabpanel" aria-labelledby="editor-marking-tab" tabindex="0">
                <EditorTimeline
                    :active="workspace === 'marking'"
                    :project="snapshot.project"
                    :playback="playback"
                    :analysis="analysisSnapshot"
                    :buffer-series="bufferSeries"
                    :tempo-estimate-state="snapshot.tempoEstimateState"
                    @update-project="updateProject"
                />

                <EditorPointWorkspace
                    :active="workspace === 'marking'"
                    :project="snapshot.project"
                    :playback="playback"
                    :analysis="analysisSnapshot"
                    :overlay-series="overlaySeries"
                    :overlay-exact-value="overlayExactValue"
                    :overlay-open="snapshot.overlayOpen"
                    @update-project="updateProject"
                    @toggle-overlay="controller.setOverlayOpen($event)"
                    @select-overlay-feature="controller.selectOverlayFeature($event)"
                    @retry-overlay="controller.retryOverlayAnalysis()"
                />
                </div>
                <div id="editor-separation-panel" v-show="workspace === 'separation'" class="editor-panel app-scrollbar" role="tabpanel" aria-labelledby="editor-separation-tab" tabindex="0">
                    <EditorSeparationWorkspace
                        :track-id="snapshot.activeTrackId!"
                        :track-name="snapshot.project.track.fileName"
                        :playback="playback"
                        :active="workspace === 'separation'"
                        @seek="audioSession.seek($event)"
                    />
                </div>

                <div id="editor-transcription-panel" v-show="workspace === 'transcription'" class="editor-panel app-scrollbar" role="tabpanel" aria-labelledby="editor-transcription-tab" tabindex="0">
                    <EditorTranscriptionWorkspace :playback="playback" :duration="snapshot.project.track.durationSeconds" :active="workspace === 'transcription'" @seek="audioSession.seek($event)" />
                </div>

            </template>
        </section>

        <EditorTrackChangeDialog :decision="trackNavigation.decision.value" @confirm="trackNavigation.confirm" @cancel="trackNavigation.cancel" @export="trackNavigation.exportCurrent" />
        <EditorLeaveGuard />
    </main>
</template>

<script setup lang="ts">
import {
    computed,
    onBeforeUnmount,
    ref,
    shallowRef,
    watch,
} from 'vue';
import {
    useRoute,
    useRouter,
} from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAudioSessionService } from '../audio/audioSessionService';
import EditorToolbar from '../components/EditorToolbar.vue';
import EditorLeaveGuard from '../components/EditorLeaveGuard.vue';
import '../editor/controls.css';
import '../editor/marking.css';
import { provideEditorGrid } from '../editor/useEditorGrid';
import { resolveEditorUnavailableRecovery } from '../editor/routeRecovery';
import { useEditorSessionController } from '../editor/editorSessionController';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import EditorTimeline from '../components/EditorTimeline.vue';
import EditorPointWorkspace from '../components/EditorPointWorkspace.vue';
import EditorSeparationWorkspace from '../components/EditorSeparationWorkspace.vue';
import EditorTranscriptionWorkspace from '../components/EditorTranscriptionWorkspace.vue';
import EditorTrackChangeDialog from '../components/EditorTrackChangeDialog.vue';
import { useEditorTrackNavigation } from '../editor/useEditorTrackNavigation';
import { useEditorSeparationService } from '../processing/editorSeparationService';
import type {
    AnalysisCursorValueResult,
    FeatureId,
} from '../analysis/types';
import type { EditorProjectV1 } from '../editor/types';

const route = useRoute();
const router = useRouter();
const audioSession = useAudioSessionService();
const sessionStore = useAudioSessionStore();
const controller = useEditorSessionController();
const separationService = useEditorSeparationService();
const trackNavigation = useEditorTrackNavigation(controller, audioSession, separationService, router);
const workspace = ref<'marking'|'separation'|'transcription'>('marking');
const snapshot = shallowRef(controller.getSnapshot());
provideEditorGrid(() => snapshot.value.project?.track.contentHash);
const unsubscribe = controller.subscribe((next) => {
    snapshot.value = next;
});
const analysisSnapshot = shallowRef(controller.getAnalysisSnapshot());
const unsubscribeAnalysis = controller.subscribeAnalysis((next) => {
    analysisSnapshot.value = next;
});
const bufferSeries = computed(() => {
    void analysisSnapshot.value.generation;
    void analysisSnapshot.value.readyFeatureIds;
    return controller.getAnalysisSeries('buffer');
});
const overlayFeatureId = computed<FeatureId | null>(() =>
    snapshot.value.project?.workspace.overlay.featureId ?? null);
const overlaySeries = computed(() => {
    void analysisSnapshot.value.generation;
    void analysisSnapshot.value.readyFeatureIds;
    return snapshot.value.overlayOpen && overlayFeatureId.value
        ? controller.getAnalysisSeries(overlayFeatureId.value)
        : null;
});
const overlayExactValue = ref<AnalysisCursorValueResult | null>(null);
const CURSOR_REQUEST_INTERVAL_MS = 40;
let cursorTimer: ReturnType<typeof setTimeout> | null = null;
let lastCursorRequestAt = 0;
let cursorRequestRevision = 0;
const conflictExported = ref(false);
const historyBack = window.history.state?.back;
const returnPath = typeof historyBack === 'string'
    && !historyBack.startsWith('/editor')
    ? historyBack
    : '/';

const playback = computed(() => sessionStore.playback);
const unavailableRecovery = computed(() => resolveEditorUnavailableRecovery({
    routeTrackId: routeTrackId(),
    queue: sessionStore.queue,
    currentTrackId: sessionStore.currentTrackId,
    playback: playback.value,
    persistenceState: sessionStore.persistence.state,
}));
let lastAutoRetrySignature: string | null = null;
let pendingAutoRetrySignature: string | null = null;
let autoRetryInFlight = false;

const runPendingAutoRetry = async (signature: string) => {
    pendingAutoRetrySignature = signature;
    if (autoRetryInFlight) return;
    autoRetryInFlight = true;
    try {
        while (pendingAutoRetrySignature) {
            const pending = pendingAutoRetrySignature;
            pendingAutoRetrySignature = null;
            if (pending === lastAutoRetrySignature) continue;
            const decision = unavailableRecovery.value;
            if (
                snapshot.value.state !== 'unavailable'
                || decision.kind !== 'retry-route'
                || decision.signature !== pending
            ) {
                continue;
            }
            lastAutoRetrySignature = pending;
            await controller.enter(decision.trackId);
        }
    } finally {
        autoRetryInFlight = false;
    }
};

const performOverlayCursorRequest = async () => {
    const featureId = overlayFeatureId.value;
    if (
        !snapshot.value.overlayOpen
        || snapshot.value.state !== 'ready'
        || !featureId
        || analysisSnapshot.value.state !== 'ready'
        || !analysisSnapshot.value.readyFeatureIds.includes(featureId)
    ) {
        overlayExactValue.value = null;
        return;
    }
    lastCursorRequestAt = performance.now();
    const revision = ++cursorRequestRevision;
    const generation = analysisSnapshot.value.generation;
    const result = await controller.requestAnalysisCursorValue(
        featureId,
        playback.value.currentTimeSeconds,
    );
    if (
        revision === cursorRequestRevision
        && snapshot.value.overlayOpen
        && featureId === overlayFeatureId.value
        && generation === analysisSnapshot.value.generation
    ) {
        overlayExactValue.value = result;
    }
};

const requestOverlayCursorValue = (immediate = false) => {
    if (cursorTimer) {
        clearTimeout(cursorTimer);
        cursorTimer = null;
    }
    if (!snapshot.value.overlayOpen) {
        cursorRequestRevision += 1;
        overlayExactValue.value = null;
        return;
    }
    const elapsed = performance.now() - lastCursorRequestAt;
    if (immediate || elapsed >= CURSOR_REQUEST_INTERVAL_MS) {
        void performOverlayCursorRequest();
        return;
    }
    cursorTimer = setTimeout(() => {
        cursorTimer = null;
        void performOverlayCursorRequest();
    }, CURSOR_REQUEST_INTERVAL_MS - elapsed);
};
const routeTrackId = () => {
    const value = route.params.trackId;
    return typeof value === 'string' && value.length > 0 ? value : null;
};

watch(
    () => route.params.trackId,
    () => {
        conflictExported.value = false;
        lastAutoRetrySignature = null;
        pendingAutoRetrySignature = null;
        if (sessionStore.persistence.state !== 'restoring') {
            void trackNavigation.enter(routeTrackId());
        }
    },
    { immediate: true },
);

watch(
    () => snapshot.value.state === 'unavailable'
        && unavailableRecovery.value.kind === 'retry-route'
        ? unavailableRecovery.value.signature
        : null,
    (signature) => {
        if (signature) void runPendingAutoRetry(signature);
    },
    { flush: 'post' },
);

watch(
    () => sessionStore.persistence.state,
    (state, previous) => {
        if (previous === 'restoring' && state !== 'restoring') {
            void controller.enter(routeTrackId());
        }
    },
);

watch(
    () => [
        overlayFeatureId.value,
        snapshot.value.overlayOpen,
        analysisSnapshot.value.generation,
        analysisSnapshot.value.state,
    ],
    () => {
        cursorRequestRevision += 1;
        overlayExactValue.value = null;
        requestOverlayCursorValue(true);
    },
);

watch(
    () => playback.value.currentTimeSeconds,
    () => requestOverlayCursorValue(playback.value.state !== 'playing'),
);



const editCurrentTrack = async () => {
    const decision = unavailableRecovery.value;
    if (decision.kind !== 'offer-current') return;
    lastAutoRetrySignature = null;
    pendingAutoRetrySignature = null;
    await router.replace({
        name: 'editor',
        params: { trackId: decision.trackId },
    });
};

const importProject = async () => {
    try {
        const result = await controller.importProject('json-v1');
        if (result === 'imported') ElMessage.success('工程已导入并写入本地草稿。');
    } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '工程导入失败。');
    }
};

const exportProject = async () => {
    try {
        const result = await controller.exportProject('json-v1');
        if (result === 'saved') ElMessage.success('工程已导出。');
    } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '工程导出失败。');
    }
};

const exportConflict = async () => {
    try {
        conflictExported.value = await controller.exportConflictingDraft()
            === 'saved';
    } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '旧工程导出失败。');
    }
};

const overwriteConflict = async () => {
    await controller.overwriteConflictingDraft();
};

const cancelConflict = async () => {
    const result = await controller.cancelConflictingEntry();
    if (result.kind === 'restored-old') {
        await router.replace({ name: 'editor', params: { trackId: result.trackId } });
    } else {
        await router.replace(returnPath);
    }
};

const clearInvalidDraft = () => void controller.clearInvalidDraftAndCreate();
const updateProject = (
    project: EditorProjectV1,
    immediate: boolean,
) => controller.updateProject(project, immediate);

onBeforeUnmount(() => {
    cursorRequestRevision += 1;
    if (cursorTimer) clearTimeout(cursorTimer);
    unsubscribe();
    unsubscribeAnalysis();
});
</script>

<style scoped>
.editor-page {
    --editor-control-height: 30px;
    --editor-control-radius: 4px;
    --editor-flyout-radius: 8px;
    display: flex;
    flex-direction: column;
    height: calc(100dvh - var(--app-player-inset, 80px));
    min-height: 0;
    overflow: hidden;
    padding: 0;
    color: var(--ink);
    font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
    background: var(--canvas);
}
.editor-shell { flex: 1; display: flex; flex-direction: column; width: 100%; min-width: 0; min-height: 0; overflow: hidden; }
.editor-panel { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
#editor-marking-panel { container-type:size; display:flex; flex-direction:column; overflow:hidden; }
#editor-marking-panel :deep(.editor-timeline-panel) { flex:none; overflow-x:auto; }
.editor-panel:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: -2px; }
.editor-state-shell { overflow: auto; overscroll-behavior: contain; }
.editor-panel :deep(.stem-workspace) { padding-top: 0; }
.editor-state { margin: 20px; border: 1px solid var(--hairline); border-radius: 4px; padding: 24px; background: var(--surface-2); }
.editor-state h2 { margin: 0 0 12px; font-size: 17px; }
.editor-state p { margin: 8px 0; color: var(--body); line-height: 1.65; font-size: 13px; }
.button-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
button { box-sizing: border-box; min-height: 30px; border: 1px solid var(--hairline-focus); border-radius: 4px; padding: 4px 10px; color: var(--ink); background: var(--editor-control); }
button:hover { background: var(--editor-control-hover); }
button:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; }
.editor-error { margin: 0; padding: 6px 14px; border-bottom: 1px solid var(--error-hairline); color: var(--error); font-size: 12px; line-height: 1.5; }
.editor-state .success-message { color: var(--accent-soft); }
</style>
