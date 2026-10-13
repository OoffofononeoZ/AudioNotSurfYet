<template>
    <main class="editor-page" data-testid="editor-page">
        <section class="editor-shell">
            <header v-if="snapshot.state !== 'ready'" class="editor-heading">
                <div>
                    <p class="kicker">Editor · 逆向制曲</p>
                    <h1>逆向制曲工程</h1>
                    <p>在不修改原音频的前提下，为歌曲建立可恢复、可导出的时间标注工程。</p>
                </div>
                <span class="state-badge" :data-state="snapshot.state">
                    {{ stateLabel }}
                </span>
            </header>

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
                <section
                    class="editor-workbench-toolbar"
                    data-testid="editor-ready"
                    data-editor-major-region="true"
                >
                    <div class="editor-toolbar-primary" data-testid="editor-workbench-toolbar-primary">
                        <div class="toolbar-identity">
                            <span class="kicker">EDITOR</span>
                            <h2>{{ snapshot.project.track.title || snapshot.project.track.fileName }}</h2>
                            <span class="track-meta">
                                {{ snapshot.project.track.artist || 'unknown' }} ·
                                {{ formatTime(playback.durationSeconds) }}
                            </span>
                        </div>
                        <p class="persistence-state" :data-state="snapshot.persistence" aria-live="polite">
                            <span class="toolbar-state">{{ stateLabel }}</span>
                            <span aria-hidden="true">·</span>
                            <span>{{ persistenceLabel }}</span>
                        </p>
                    </div>
                    <div class="editor-toolbar-secondary" data-testid="editor-workbench-toolbar-secondary">
                        <div class="transport" aria-label="Editor 播放控制">
                            <button type="button" data-testid="editor-playback-toggle" @click="togglePlayback">
                                {{ ['playing','buffering'].includes(playback.state) ? '暂停' : '播放' }}
                            </button>
                            <span class="time-readout" data-testid="editor-current-time">
                                {{ formatTime(playback.currentTimeSeconds) }} / {{ formatTime(playback.durationSeconds) }}
                            </span>
                            <span class="repeat-badge" data-testid="editor-repeat-state">单曲循环</span>
                        </div>
                        <div class="project-actions">
                            <label>
                                <span>格式</span>
                                <select v-model="codecId" aria-label="工程格式">
                                    <option v-for="codec in codecs" :key="codec.id" :value="codec.id">
                                        {{ codec.label }}
                                    </option>
                                </select>
                            </label>
                            <button type="button" data-testid="import-editor-project" @click="importProject">
                                导入工程
                            </button>
                            <button type="button" data-testid="export-editor-project" @click="exportProject">
                                导出工程
                            </button>
                        </div>
                    </div>
                    <p v-if="snapshot.message" role="alert" class="error-message">{{ snapshot.message }}</p>
                </section>

                <nav class="editor-workspace-switch" aria-label="Editor工作区">
                    <div role="tablist" aria-label="工作区选择" @keydown="switchWorkspaceFromKeyboard">
                        <button id="editor-marking-tab" type="button" role="tab" aria-controls="editor-marking-panel" :aria-selected="workspace === 'marking'" :tabindex="workspace === 'marking' ? 0 : -1" data-testid="editor-marking-tab" @click="workspace = 'marking'">标记编辑</button>
                        <button id="editor-separation-tab" type="button" role="tab" aria-controls="editor-separation-panel" :aria-selected="workspace === 'separation'" :tabindex="workspace === 'separation' ? 0 : -1" data-testid="editor-separation-tab" @click="workspace = 'separation'">音轨分离 <span class="workspace-new">FT</span></button>
                        <button id="editor-transcription-tab" type="button" role="tab" aria-controls="editor-transcription-panel" :aria-selected="workspace === 'transcription'" :tabindex="workspace === 'transcription' ? 0 : -1" data-testid="editor-transcription-tab" @click="workspace = 'transcription'">自动标记</button>
                    </div>
                    <span v-if="workspace !== 'separation'" class="workspace-context">{{ workspace === 'marking' ? '时间标记 · 节拍地图' : '模型候选 · 检查 · 应用' }}</span>
                </nav>
                <div id="editor-marking-panel" v-show="workspace === 'marking'" role="tabpanel" aria-labelledby="editor-marking-tab">
                <EditorTimeline
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
                <div id="editor-separation-panel" v-show="workspace === 'separation'" role="tabpanel" aria-labelledby="editor-separation-tab">
                    <EditorSeparationWorkspace
                        :track-id="snapshot.activeTrackId!"
                        :track-name="snapshot.project.track.fileName"
                        :playback="playback"
                        :active="workspace === 'separation'"
                        @seek="audioSession.seek($event)"
                    />
                </div>

                <div id="editor-transcription-panel" v-show="workspace === 'transcription'" role="tabpanel" aria-labelledby="editor-transcription-tab">
                    <EditorTranscriptionWorkspace :playback="playback" :duration="snapshot.project.track.durationSeconds" :active="workspace === 'transcription'" @seek="audioSession.seek($event)" />
                </div>

            </template>
        </section>

        <dialog
            ref="leaveDialog"
            class="editor-leave-dialog"
            data-testid="editor-leave-dialog"
            aria-labelledby="editor-leave-dialog-title"
            aria-describedby="editor-leave-dialog-description"
            @cancel="onLeaveDialogCancel"
            @click="onLeaveDialogBackdropClick"
        >
            <button
                type="button"
                class="leave-dialog-close"
                aria-label="关闭并留在当前页面"
                data-testid="editor-leave-close"
                @click="finishLeaveDecision(false)"
            >×</button>
            <h2 id="editor-leave-dialog-title">离开 Editor？</h2>
            <p id="editor-leave-dialog-description">
                如果之后用其他歌曲进入 Editor，当前单草稿可能被覆盖。建议先导出工程。
            </p>
            <label class="leave-dialog-preference">
                <input v-model="suppressFutureLeaveWarning" type="checkbox" data-testid="editor-leave-suppress">
                <span>之后不再显示普通离页提示</span>
            </label>
            <div class="leave-dialog-actions">
                <button
                    ref="leaveStayButton"
                    type="button"
                    class="leave-stay"
                    data-testid="editor-leave-stay"
                    @click="finishLeaveDecision(false)"
                >留在此页</button>
                <button
                    type="button"
                    class="leave-confirm"
                    data-testid="editor-leave-confirm"
                    @click="confirmLeave"
                >仍然离开</button>
            </div>
        </dialog>
    </main>
</template>

<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    ref,
    shallowRef,
    watch,
} from 'vue';
import {
    onBeforeRouteLeave,
    useRoute,
    useRouter,
} from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAudioSessionService } from '../audio/audioSessionService';
import { EditorFormatCodecRegistry } from '../editor/projectCodec';
import { resolveEditorUnavailableRecovery } from '../editor/routeRecovery';
import { useEditorSessionController } from '../editor/editorSessionController';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import EditorTimeline from '../components/EditorTimeline.vue';
import EditorPointWorkspace from '../components/EditorPointWorkspace.vue';
import EditorSeparationWorkspace from '../components/EditorSeparationWorkspace.vue';
import EditorTranscriptionWorkspace from '../components/EditorTranscriptionWorkspace.vue';
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
const workspace = ref<'marking'|'separation'|'transcription'>('marking');
function switchWorkspaceFromKeyboard(event: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = ['marking','separation','transcription'] as const;
    workspace.value = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[2]
        : tabs[(tabs.indexOf(workspace.value)+(event.key === 'ArrowRight' ? 1 : 2))%tabs.length]!;
    document.getElementById(`editor-${workspace.value}-tab`)?.focus();
}
const snapshot = shallowRef(controller.getSnapshot());
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
const codecRegistry = new EditorFormatCodecRegistry();
const codecs = codecRegistry.list();
const codecId = ref('json-v1');
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

const stateLabel = computed(() => ({
    empty: '等待歌曲',
    loading: '正在载入',
    ready: snapshot.value.restoredFromDraft ? '草稿已恢复' : '工程已就绪',
    'draft-conflict': '需要处理旧草稿',
    unavailable: '歌曲不可用',
    'draft-error': '草稿损坏',
})[snapshot.value.state]);

const persistenceLabel = computed(() => ({
    clean: '新工程已在内存中建立',
    saving: '正在保存本地草稿…',
    saved: '本地草稿已保存',
    'not-persisted': '草稿未持久化；当前页面内容仍可使用',
})[snapshot.value.persistence]);

const formatTime = (seconds: number): string => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${Math.floor(safe % 60).toString().padStart(2, '0')}`;
};

watch(
    () => route.params.trackId,
    () => {
        conflictExported.value = false;
        lastAutoRetrySignature = null;
        pendingAutoRetrySignature = null;
        if (sessionStore.persistence.state !== 'restoring') {
            void controller.enter(routeTrackId());
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

const togglePlayback = () => void audioSession.togglePlayback();

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
        const result = await controller.importProject(codecId.value);
        if (result === 'imported') ElMessage.success('工程已导入并写入本地草稿。');
    } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '工程导入失败。');
    }
};

const exportProject = async () => {
    try {
        const result = await controller.exportProject(codecId.value);
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

const leaveDialog = ref<HTMLDialogElement | null>(null);
const leaveStayButton = ref<HTMLButtonElement | null>(null);
const suppressFutureLeaveWarning = ref(false);
let pendingLeaveDecision: {
    promise: Promise<boolean>;
    resolve: (value: boolean) => void;
} | null = null;
let leaveTransition: Promise<void> | null = null;

const finishLeaveDecision = (shouldLeave: boolean) => {
    const pending = pendingLeaveDecision;
    if (!pending) return;
    pendingLeaveDecision = null;
    if (leaveDialog.value?.open) leaveDialog.value.close();
    pending.resolve(shouldLeave);
};

const requestLeaveDecision = (): Promise<boolean> => {
    if (pendingLeaveDecision) return pendingLeaveDecision.promise;
    suppressFutureLeaveWarning.value = false;
    let resolveDecision!: (value: boolean) => void;
    const promise = new Promise<boolean>((resolve) => {
        resolveDecision = resolve;
    });
    pendingLeaveDecision = { promise, resolve: resolveDecision };
    void nextTick(() => {
        const dialog = leaveDialog.value;
        if (!dialog || pendingLeaveDecision?.promise !== promise) {
            finishLeaveDecision(false);
            return;
        }
        try {
            if (!dialog.open) dialog.showModal();
        } catch {
            finishLeaveDecision(false);
            return;
        }
        leaveStayButton.value?.focus();
    });
    return promise;
};

const onLeaveDialogCancel = (event: Event) => {
    event.preventDefault();
    finishLeaveDecision(false);
};

const onLeaveDialogBackdropClick = (event: MouseEvent) => {
    const dialog = leaveDialog.value;
    if (!dialog || event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left
        || event.clientX > bounds.right
        || event.clientY < bounds.top
        || event.clientY > bounds.bottom;
    if (outside) finishLeaveDecision(false);
};

const confirmLeave = async () => {
    try {
        if (suppressFutureLeaveWarning.value) {
            await controller.setLeaveWarningEnabled(false);
        }
        finishLeaveDecision(true);
    } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '无法保存离页提示设置。');
        leaveStayButton.value?.focus();
    }
};

const leaveEditorOnce = () => {
    leaveTransition ??= controller.leave();
    return leaveTransition;
};

onBeforeRouteLeave(async () => {
    if (controller.shouldWarnOnLeave()) {
        const shouldLeave = await requestLeaveDecision();
        if (!shouldLeave) return false;
    }
    await separationService.bind(null);
    await leaveEditorOnce();
    return true;
});

onBeforeUnmount(() => {
    finishLeaveDecision(false);
    cursorRequestRevision += 1;
    if (cursorTimer) clearTimeout(cursorTimer);
    unsubscribe();
    unsubscribeAnalysis();
});
</script>

<style scoped>
.editor-page {
    --editor-control-height: 30px;
    --editor-row-height: 44px;
    --editor-lane-name-width: 152px;
    --editor-inner-class-width: 144px;
    --editor-control-radius: 4px;
    --editor-flyout-radius: 8px;
    min-height: 100dvh;
    padding: var(--app-page-top-space) 12px 24px;
    color: var(--ink);
    font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
    background:
        radial-gradient(circle at 20% 0%, var(--glow-accent), transparent 35%),
        var(--canvas);
}

.editor-shell {
    width: 100%;
    margin: 0;
}
.editor-workspace-switch{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--hairline);margin:18px 0 0;gap:10px}
.editor-workspace-switch>div{display:flex;gap:24px}
.editor-workspace-switch button{position:relative;border:0;border-radius:0;background:none;height:38px;min-height:38px;padding:0 2px;color:#8caa98;font-size:12px}
.editor-workspace-switch button:after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:2px;background:#b2e2c7;transform:scaleX(0);transition:transform .2s}
.editor-workspace-switch button[aria-selected=true]{color:#e0eee5}.editor-workspace-switch button[aria-selected=true]:after{transform:scaleX(1)}
.workspace-new{display:inline-block;margin-left:6px;font:9px ui-monospace,monospace;letter-spacing:.02em;color:#9fbfae;border:1px solid #34523e;border-radius:3px;padding:1px 4px}
.workspace-context{font-size:10px;color:#728c7c;padding-right:2px}
@media(max-width:540px){.workspace-context{display:none}.editor-workspace-switch{margin-top:12px}}
@media(prefers-reduced-motion:reduce){.editor-workspace-switch button:after{transition:none}}

.editor-heading,
.editor-state,
.future-panel > div {
    border: 1px solid var(--hairline);
    border-radius: 8px;
    background: var(--editor-panel);
    box-shadow: inset 0 0 32px var(--glow-inset);
}

.editor-leave-dialog {
    box-sizing: border-box;
    width: min(520px, calc(100vw - 32px));
    border: 1px solid var(--hairline-focus);
    border-radius: 8px;
    padding: 20px;
    color: var(--ink);
    background: var(--surface-2);
    box-shadow: 0 24px 80px rgba(0, 0, 0, .72), inset 0 0 28px var(--glow-inset);
}

.editor-leave-dialog::backdrop {
    background: var(--editor-modal-backdrop);
}

.editor-leave-dialog h2 {
    margin: 0 36px 10px 0;
    color: var(--ink);
    font-size: 1.05rem;
}

.editor-leave-dialog p {
    margin: 0;
    color: var(--body);
    line-height: 1.65;
}

.leave-dialog-close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 30px;
    padding: 0;
    border-color: transparent;
    color: var(--body);
    background: transparent;
    font-size: 1.2rem;
}

.leave-dialog-preference {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    color: var(--ink);
    font-size: .86rem;
}

.leave-dialog-preference input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--accent);
}

.leave-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
}

.leave-stay {
    border-color: var(--accent-soft);
    background: var(--editor-control-primary);
}

.leave-confirm {
    color: var(--body);
    background: var(--editor-control-quiet);
}

@media (prefers-reduced-motion: reduce) {
    .editor-leave-dialog { scroll-behavior: auto; }
}

.editor-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding: 28px 64px 28px 28px;
}

.editor-heading h1,
.editor-state h2,
.future-panel h2 {
    margin: 4px 0 8px;
    color: var(--ink-strong);
}

.kicker,
.state-badge,
.repeat-badge {
    color: var(--accent-soft);
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.state-badge,
.repeat-badge {
    border: 1px solid var(--hairline);
    border-radius: var(--editor-control-radius);
    padding: 4px 8px;
    white-space: nowrap;
}

.editor-state {
    margin-top: 20px;
    padding: 28px;
}

.editor-workbench-toolbar {
    border: 1px solid rgba(155, 184, 170, .16);
    border-radius: 10px;
    background: #101b15;
    overflow: hidden;
}

.editor-toolbar-primary,
.editor-toolbar-secondary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 36px;
    padding: 3px 8px;
}
.editor-toolbar-primary { padding-right: 56px; }
@media (max-width: 767px) {
    .editor-toolbar-primary { padding-right: 8px; }
}

.editor-toolbar-secondary {
    min-height: 40px;
    border-top: 1px solid rgba(155, 184, 170, .1);
    background: #0c1711;
}

.toolbar-identity,
.transport,
.project-actions,
.project-actions label {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 10px;
}

.toolbar-identity h2 {
    flex: 0 1 auto;
    overflow: hidden;
    margin: 0;
    color: #dce9e0;
    font-size: 1.05rem;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.toolbar-identity .kicker {
    color: #88a092;
    font-size: .6rem;
    white-space: nowrap;
}

.track-meta,
.time-readout,
.persistence-state {
    color: var(--body);
    font-size: .78rem;
    white-space: nowrap;
}

.persistence-state {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
}

.toolbar-state {
    color: #a4d5b8;
}

.editor-toolbar-secondary button,
.editor-toolbar-secondary select {
    border-color: #35483b;
    color: #d2e1d6;
    background: #14231a;
    font: inherit;
    font-size: 12px;
}

.editor-toolbar-secondary button:hover { background: #22362a; }
.editor-toolbar-secondary .repeat-badge { border-color: #34483a; color: #a4bcae; font-size: 10px; }
.time-readout { font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.button-row,
.transport,
.project-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 0;
}

button,
select {
    box-sizing: border-box;
    height: var(--editor-control-height);
    min-height: var(--editor-control-height);
    border: 1px solid var(--hairline-focus);
    border-radius: var(--editor-control-radius);
    padding: 4px 10px;
    line-height: 1;
    color: var(--ink);
    background: var(--editor-control);
}

button:hover {
    border-color: var(--accent-soft);
    background: var(--editor-control-hover);
}

button:focus-visible,
select:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 3px;
}

.project-actions label {
    display: flex;
    align-items: center;
    gap: 8px;
}

.error-message,
.success-message {
    margin-top: 14px;
}

.error-message {
    margin: 0;
    padding: 4px 8px;
    border-top: 1px solid var(--error-hairline);
    color: var(--error);
}

.success-message {
    color: var(--accent-soft);
}

.future-panel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.future-panel > div {
    min-height: 220px;
    padding: 28px;
    opacity: 0.72;
}

@media (max-width: 800px) {
    .editor-page {
        padding: 72px 0 20px;
    }

    .editor-heading,
    .future-panel {
        grid-template-columns: 1fr;
        flex-direction: column;
    }

    .editor-toolbar-primary,
    .editor-toolbar-secondary {
        align-items: flex-start;
        flex-wrap: wrap;
    }


    .persistence-state {
        width: 100%;
    }
}
</style>
