<template>
    <main class="visualizer-page" data-testid="visualizer-page">
        <section v-if="snapshot.state === 'empty'" class="visualizer-state app-scrollbar" data-testid="visualizer-empty">
            <p class="kicker">Visualizer · 可视化制作台</p>
            <h1>先选择一首歌曲</h1>
            <p>可以在底部播放器导入或选择歌曲，再从导航栏 Visualizer 进入。</p>
        </section>

        <section v-else-if="snapshot.state === 'loading'" class="visualizer-state app-scrollbar" aria-live="polite">
            <h1>正在准备歌曲和可视化草稿…</h1>
        </section>

        <section v-else-if="snapshot.state === 'unavailable'" class="visualizer-state app-scrollbar" data-testid="visualizer-unavailable">
            <h1>这首歌曲暂时不能用于可视化</h1>
            <p role="alert">{{ snapshot.message }}</p>
            <p>请在底部播放器恢复文件访问或重新选择相同文件。</p>
        </section>

        <section v-else-if="snapshot.state === 'draft-conflict'" class="visualizer-state app-scrollbar" data-testid="visualizer-draft-conflict">
            <h1>另一首歌曲已有可视化草稿</h1>
            <p>{{ snapshot.message }}</p>
            <p v-if="snapshot.conflictingDraft">
                旧工程：{{ snapshot.conflictingDraft.project.track.fileName }}
            </p>
            <p v-if="conflictExported" class="success-message">
                旧工程已导出；仍需明确选择“覆盖草稿”才能继续。
            </p>
            <div class="state-actions">
                <button type="button" data-testid="export-visualizer-conflict" @click="exportConflict">
                    导出旧工程
                </button>
                <button type="button" data-testid="overwrite-visualizer-conflict" @click="overwriteConflict">
                    覆盖草稿
                </button>
                <button type="button" data-testid="cancel-visualizer-entry" @click="cancelConflict">
                    取消进入
                </button>
            </div>
        </section>

        <section
            v-else-if="isUsable && snapshot.project"
            ref="workspaceElement"
            class="visualizer-workspace"
            data-testid="visualizer-ready"
            @pointermove="handleWorkspacePointerMove"
            @pointerleave="handleWorkspacePointerLeave"
            @keydown.capture="handleWorkspaceKeydown"
        >
            <header class="workspace-toolbar">
                <div>
                    <p class="kicker">Visualizer · {{ activeTemplate?.title ?? '可视化制作台' }}</p>
                    <h1>{{ snapshot.project.track.title || snapshot.project.track.fileName }}</h1>
                    <p>
                        {{ snapshot.project.track.artist || 'unknown' }} ·
                        {{ formatTime(playback.durationSeconds) }} ·
                        {{ snapshot.project.output.resolution }} / {{ snapshot.project.output.frameRate }}fps
                    </p>
                </div>
                <div class="project-actions">
                    <span :data-state="snapshot.persistence" aria-live="polite">
                        {{ persistenceLabel }}
                    </span>
                    <button
                        type="button"
                        :disabled="recordingLocked"
                        data-testid="import-visualizer-project"
                        @click="importProject"
                    >
                        导入工程
                    </button>
                    <button type="button" data-testid="export-visualizer-project" @click="exportProject">
                        导出工程
                    </button>
                </div>
            </header>

            <p v-if="snapshot.message || actionError" class="workspace-alert" role="alert">
                {{ actionError || snapshot.message }}
            </p>

            <div class="compact-drawer-controls" aria-label="工作台侧栏">
                <button
                    type="button"
                    :aria-expanded="openDrawer === 'templates'"
                    aria-controls="visualizer-template-panel"
                    @click="toggleDrawer('templates')"
                >
                    场景模板
                </button>
                <button
                    type="button"
                    aria-label="工程设置"
                    :aria-expanded="openDrawer === 'settings'"
                    aria-controls="visualizer-settings-panel"
                    @click="toggleDrawer('settings')"
                >
                    参数与绑定
                </button>
            </div>

            <div class="workspace-grid">
                <aside
                    id="visualizer-template-panel"
                    class="workspace-panel template-panel app-scrollbar"
                    :class="{ 'drawer-open': openDrawer === 'templates' }"
                    data-testid="visualizer-template-panel"
                >
                    <div class="panel-heading">
                        <h2>场景模板</h2>
                        <button class="drawer-close" type="button" @click="openDrawer = null">关闭</button>
                    </div>
                    <button
                        v-for="template in templates"
                        :key="template.id"
                        type="button"
                        class="template-button"
                        :class="{ active: snapshot.project.scene.templateId === template.id }"
                        :aria-pressed="snapshot.project.scene.templateId === template.id"
                        :disabled="recordingLocked"
                        @click="switchTemplate(template.id)"
                    >
                        <strong>{{ template.title }}</strong>
                        <span>{{ template.description }}</span>
                    </button>
                </aside>

                <section class="preview-column" aria-label="可视化预览">
                    <div
                        class="preview-frame"
                        data-testid="visualizer-preview-frame"
                        :data-scene-status="rendererStatus.state"
                        :data-frame-state-hash="sceneFrame.hash"
                    >
                        <canvas ref="previewCanvas" data-testid="visualizer-preview-canvas" />
                        <div v-if="rendererStatus.state === 'error'" class="scene-error" role="alert">
                            <strong>场景暂时无法渲染</strong>
                            <span>{{ rendererStatus.message }}</span>
                            <button type="button" data-testid="retry-visualizer-scene" @click="retryScene">
                                重试场景
                            </button>
                        </div>
                        <div v-else-if="rendererStatus.state === 'recovering'" class="context-notice" role="status">
                            <strong>正在恢复 WebGL 场景</strong>
                            <span>{{ rendererStatus.message }}</span>
                        </div>
                        <div v-else-if="needsSourcePrompt" class="source-prompt">
                            请选择主要音色/鼓点数据源
                        </div>
                    </div>
                </section>

                <aside
                    id="visualizer-settings-panel"
                    class="workspace-panel settings-panel app-scrollbar"
                    :class="{ 'drawer-open': openDrawer === 'settings' }"
                    data-testid="visualizer-settings-panel"
                >
                    <div class="panel-heading">
                        <h2>参数与数据绑定</h2>
                        <button class="drawer-close" type="button" @click="openDrawer = null">关闭</button>
                    </div>
                    <details class="output-settings" open>
                        <summary>输出与工程设置</summary>
                        <label>
                            <span>输出分辨率</span>
                            <select
                                :value="snapshot.project.output.resolution"
                                :disabled="recordingLocked"
                                data-testid="visualizer-resolution"
                                @change="setResolution"
                            >
                                <option value="720p">1280 × 720</option>
                                <option value="1080p">1920 × 1080</option>
                            </select>
                        </label>
                        <label>
                            <span>帧率</span>
                            <select
                                :value="snapshot.project.output.frameRate"
                                :disabled="recordingLocked"
                                data-testid="visualizer-frame-rate"
                                @change="setFrameRate"
                            >
                                <option :value="30">30 fps</option>
                                <option :value="60">60 fps</option>
                            </select>
                        </label>
                        <dl>
                            <div><dt>画面比例</dt><dd>16:9</dd></div>
                            <div><dt>模板版本</dt><dd>1</dd></div>
                            <div><dt>确定性 Seed</dt><dd>{{ snapshot.project.scene.seed }}</dd></div>
                        </dl>
                    </details>
                    <VisualizerBindingInspector
                        v-if="activeTemplate"
                        v-model:error="actionError"
                        :project="snapshot.project"
                        :runtime="snapshot.bindingRuntime"
                        :descriptor="activeTemplate"
                        :resolved-values="resolvedValues"
                        :locked="recordingLocked"
                    />
                </aside>
            </div>

            <section
                class="recording-bar"
                aria-label="WebM 录制"
                aria-live="polite"
                :data-recording-status="snapshot.recording.status"
                :data-recording-error-code="snapshot.recording.status === 'error' ? snapshot.recording.code : ''"
            >
                <div>
                    <strong data-testid="visualizer-recording-state">{{ recordingLabel }}</strong>
                    <span>{{ formatTime(playback.currentTimeSeconds) }} / {{ formatTime(playback.durationSeconds) }}</span>
                    <span v-if="recordingMime">{{ recordingMime }}</span>
                    <span v-if="recordingSize">{{ recordingSize }}</span>
                </div>
                <div class="recording-actions">
                    <button
                        v-if="snapshot.recording.status === 'idle'"
                        type="button"
                        data-testid="start-visualizer-recording"
                        @click="startRecording"
                    >开始录制</button>
                    <button
                        v-if="recordingLocked"
                        type="button"
                        data-testid="cancel-visualizer-recording"
                        @click="cancelRecording"
                    >取消录制</button>
                    <template v-if="snapshot.recording.status === 'ready'">
                        <button type="button" data-testid="save-visualizer-recording" @click="saveRecording">
                            保存 WebM
                        </button>
                        <button type="button" data-testid="discard-visualizer-recording" @click="discardRecording">
                            丢弃
                        </button>
                    </template>
                    <button
                        v-if="snapshot.recording.status === 'error'"
                        type="button"
                        data-testid="reset-visualizer-recording-error"
                        @click="resetRecordingError"
                    >清除错误</button>
                </div>
            </section>

            <footer
                class="transport"
                :class="{ 'transport-hidden': isFullscreen && !fullscreenControlsVisible }"
                aria-label="Visualizer 播放控制"
                @pointerenter="handleTransportPointerEnter"
                @pointerleave="handleTransportPointerLeave"
                @focusin="handleTransportFocusIn"
                @focusout="handleTransportFocusOut"
            >
                <button
                    type="button"
                    :disabled="recordingLocked"
                    data-testid="visualizer-playback-toggle"
                    @click="togglePlayback"
                >
                    {{ playback.state === 'playing' ? '暂停' : '播放' }}
                </button>
                <span data-testid="visualizer-current-time">
                    {{ formatTime(playback.currentTimeSeconds) }} / {{ formatTime(playback.durationSeconds) }}
                </span>
                <input
                    type="range"
                    min="0"
                    :max="Math.max(0, playback.durationSeconds)"
                    step="0.001"
                    :value="playback.currentTimeSeconds"
                    :disabled="recordingLocked"
                    aria-label="播放进度"
                    data-testid="visualizer-seek"
                    @input="seek"
                >
                <span class="ended-policy" data-testid="visualizer-ended-policy">播完暂停</span>
                <div class="fullscreen-actions">
                    <span
                        v-if="fullscreenStatusMessage"
                        id="visualizer-fullscreen-status"
                        class="fullscreen-status"
                        role="status"
                        aria-live="polite"
                    >{{ fullscreenStatusMessage }}</span>
                    <button
                        type="button"
                        :disabled="fullscreenButtonDisabled"
                        :aria-pressed="isFullscreen"
                        :aria-label="isFullscreen ? '退出全屏播放' : '进入全屏播放'"
                        :aria-describedby="fullscreenStatusMessage ? 'visualizer-fullscreen-status' : undefined"
                        :title="fullscreenButtonTitle"
                        data-testid="visualizer-fullscreen-toggle"
                        @click="toggleFullscreen"
                    >{{ isFullscreen ? '退出全屏' : '全屏' }}</button>
                </div>
            </footer>
        </section>

        <dialog ref="leaveDialog" class="leave-dialog" @cancel.prevent="stayOnPage">
            <h2>{{ leaveMode === 'active' ? '录制尚未结束' : 'WebM 尚未处理' }}</h2>
            <p v-if="leaveMode === 'active'">离开会取消当前录制，且不会生成半文件。</p>
            <p v-else>请保存或明确丢弃内存中的 WebM 后再离开。</p>
            <div class="state-actions">
                <button
                    v-if="leaveMode === 'active'"
                    type="button"
                    data-testid="leave-cancel-recording"
                    @click="cancelAndLeave"
                >取消录制并离开</button>
                <template v-else>
                    <button type="button" data-testid="leave-save-recording" @click="saveAndLeave">
                        保存并离开
                    </button>
                    <button type="button" data-testid="leave-discard-recording" @click="discardAndLeave">
                        丢弃并离开
                    </button>
                </template>
                <button type="button" data-testid="leave-stay" @click="stayOnPage">留在此页</button>
            </div>
        </dialog>
    </main>
</template>

<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    shallowRef,
    watch,
} from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import VisualizerBindingInspector from '../components/VisualizerBindingInspector.vue';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import type { VisualizerResolvedParameterMap } from '../visualizer/rendererTypes';
import type {
    VisualizerFrameRate,
    VisualizerResolution,
    VisualizerSessionSnapshot,
    VisualizerTemplateId,
} from '../visualizer/types';
import { useVisualizerSessionController } from '../visualizer/visualizerSessionController';
import {
    VisualizerRendererHost,
} from '../visualizer/visualizerRendererHost';
import type {
    VisualizerRendererStatus,
    VisualizerSceneFrameSnapshot,
} from '../visualizer/rendererTypes';

const route = useRoute();
const router = useRouter();
const controller = useVisualizerSessionController();
const sessionStore = useAudioSessionStore();
const snapshot = shallowRef<VisualizerSessionSnapshot>(controller.getSnapshot());
const unsubscribe = controller.subscribe((value) => {
    snapshot.value = value;
});
const templates = controller.listTemplates();
const previewCanvas = ref<HTMLCanvasElement | null>(null);
const workspaceElement = ref<HTMLElement | null>(null);
const leaveDialog = ref<HTMLDialogElement | null>(null);
const leaveMode = ref<'active' | 'ready'>('active');
const openDrawer = ref<'templates' | 'settings' | null>(null);
const conflictExported = ref(false);
const actionError = ref('');
const isFullscreen = ref(false);
const fullscreenSupported = ref(false);
const fullscreenControlsVisible = ref(true);
const fullscreenControlError = ref('');
const resolvedValues = shallowRef<VisualizerResolvedParameterMap>(new Map());
const rendererStatus = shallowRef<VisualizerRendererStatus>({ state: 'idle' });
const sceneFrame = shallowRef<VisualizerSceneFrameSnapshot>({
    hash: '',
    needsSourcePrompt: false,
});
let resizeObserver: ResizeObserver | null = null;
let rendererHost: VisualizerRendererHost | null = null;
let detachRecordingTarget: (() => void) | null = null;
let resolveLeaveDecision: ((value: boolean) => void) | null = null;
let fullscreenHideTimer: number | null = null;
let fullscreenPointerHeld = false;
let fullscreenFocusHeld = false;
let lastPointerY: number | null = null;

const playback = computed(() => sessionStore.playback);
const isUsable = computed(() => ['ready', 'not-persisted'].includes(snapshot.value.state));
const recordingLocked = computed(() => [
    'preparing',
    'recording',
    'finalizing',
].includes(snapshot.value.recording.status));
const fullscreenButtonDisabled = computed(() => (
    !fullscreenSupported.value
    || (!isFullscreen.value && recordingLocked.value)
));
const fullscreenStatusMessage = computed(() => {
    if (fullscreenControlError.value) return fullscreenControlError.value;
    if (!fullscreenSupported.value) return '当前浏览器不支持原生全屏。';
    if (!isFullscreen.value && recordingLocked.value) return '录制期间不能进入全屏。';
    return '';
});
const fullscreenButtonTitle = computed(() => {
    if (!fullscreenSupported.value) return '当前浏览器不支持原生全屏';
    if (!isFullscreen.value && recordingLocked.value) return '录制期间不能进入全屏';
    return isFullscreen.value ? '退出全屏播放' : '进入全屏播放';
});
const recordingLabel = computed(() => {
    const recording = snapshot.value.recording;
    if (recording.status === 'error') return `录制错误：${recording.message}`;
    return ({
        idle: '录制待命',
        preparing: '正在准备录制…',
        recording: '正在录制',
        finalizing: '正在生成 WebM…',
        ready: 'WebM 已就绪',
    } as const)[recording.status];
});
const recordingMime = computed(() => {
    const recording = snapshot.value.recording;
    return 'mimeType' in recording ? recording.mimeType : '';
});
const recordingSize = computed(() => {
    const recording = snapshot.value.recording;
    if (recording.status !== 'ready') return '';
    if (recording.byteLength < 1024 * 1024) {
        return `${(recording.byteLength / 1024).toFixed(1)} KiB`;
    }
    return `${(recording.byteLength / (1024 * 1024)).toFixed(2)} MiB`;
});
const activeTemplate = computed(() => templates.find(
    (template) => template.id === snapshot.value.project?.scene.templateId,
));
const needsSourcePrompt = computed(() => {
    const project = snapshot.value.project;
    if (!project || project.scene.templateId !== 'orthogonal-lines') return false;
    return ['horizontalIntensity', 'verticalIntensity'].every((parameterId) => {
        const binding = project.scene.bindings.find((entry) => entry.parameterId === parameterId);
        return binding?.source.kind === 'constant'
            && Number(binding.source.value) === 0;
    });
});
const persistenceLabel = computed(() => ({
    clean: '新工程已建立',
    saving: '正在保存草稿…',
    saved: snapshot.value.restoredFromDraft ? '草稿已恢复' : '草稿已保存',
    'not-persisted': '草稿未持久化',
})[snapshot.value.persistence]);

const routeTrackId = (): string | null => {
    const value = route.params.trackId;
    return typeof value === 'string' && value.length > 0 ? value : null;
};

const formatTime = (seconds: number): string => {
    const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
    const minutes = Math.floor(safe / 60);
    const remainder = Math.floor(safe % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
};

const resizePreview = () => {
    const canvas = previewCanvas.value;
    if (!canvas || !rendererHost) return;
    const rect = canvas.getBoundingClientRect();
    rendererHost.resize(rect.width, rect.height, window.devicePixelRatio || 1);
};

const updateFullscreenSupport = () => {
    const workspace = workspaceElement.value;
    fullscreenSupported.value = Boolean(
        document.fullscreenEnabled
        && workspace
        && typeof workspace.requestFullscreen === 'function',
    );
};

const clearFullscreenHideTimer = () => {
    if (fullscreenHideTimer === null) return;
    window.clearTimeout(fullscreenHideTimer);
    fullscreenHideTimer = null;
};

const shouldAutoHideFullscreenControls = () => (
    isFullscreen.value
    && playback.value.state === 'playing'
    && !fullscreenPointerHeld
    && !fullscreenFocusHeld
);

const scheduleFullscreenControlsHide = () => {
    clearFullscreenHideTimer();
    if (!shouldAutoHideFullscreenControls()) return;
    fullscreenHideTimer = window.setTimeout(() => {
        fullscreenHideTimer = null;
        if (shouldAutoHideFullscreenControls()) {
            fullscreenControlsVisible.value = false;
        }
    }, 2000);
};

const setFullscreenError = (message: string) => {
    fullscreenControlError.value = message;
    fullscreenControlsVisible.value = true;
    clearFullscreenHideTimer();
};

const activeControlUsesKeyboardFocus = () => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return false;
    if (!active.closest('.transport')) return false;
    try {
        return active.matches(':focus-visible');
    } catch {
        return true;
    }
};

const syncFullscreenState = () => {
    const workspace = workspaceElement.value;
    const ownsFullscreen = Boolean(workspace && document.fullscreenElement === workspace);
    isFullscreen.value = ownsFullscreen;
    fullscreenControlError.value = '';

    if (ownsFullscreen) {
        openDrawer.value = null;
        fullscreenControlsVisible.value = true;
        fullscreenFocusHeld = activeControlUsesKeyboardFocus();
        const rect = workspace?.getBoundingClientRect();
        fullscreenPointerHeld = Boolean(
            rect
            && lastPointerY !== null
            && lastPointerY >= rect.bottom - 96,
        );
        scheduleFullscreenControlsHide();
    } else {
        fullscreenPointerHeld = false;
        fullscreenFocusHeld = false;
        lastPointerY = null;
        fullscreenControlsVisible.value = true;
        clearFullscreenHideTimer();
    }

    void nextTick().then(() => {
        resizePreview();
        rendererHost?.requestFrame();
    });
};

const handleFullscreenError = () => {
    syncFullscreenState();
    setFullscreenError('浏览器拒绝了全屏操作，请重试或使用 Escape 退出。');
};

const exitOwnedFullscreen = async (): Promise<boolean> => {
    const workspace = workspaceElement.value;
    if (!workspace || document.fullscreenElement !== workspace) return true;
    try {
        await document.exitFullscreen();
        return true;
    } catch (error) {
        setFullscreenError(error instanceof Error
            ? `退出全屏失败：${error.message}`
            : '退出全屏失败，请使用 Escape 重试。');
        return false;
    }
};

const toggleFullscreen = async () => {
    fullscreenControlError.value = '';
    const workspace = workspaceElement.value;
    if (!workspace) {
        setFullscreenError('可视化工作台尚未准备好。');
        return;
    }

    if (document.fullscreenElement === workspace) {
        await exitOwnedFullscreen();
        return;
    }
    if (!fullscreenSupported.value) {
        setFullscreenError('当前浏览器不支持原生全屏。');
        return;
    }
    if (recordingLocked.value) {
        setFullscreenError('录制期间不能进入全屏。');
        return;
    }
    if (document.fullscreenElement) {
        setFullscreenError('其他内容正在使用全屏，请先退出后重试。');
        return;
    }

    try {
        await workspace.requestFullscreen();
    } catch (error) {
        setFullscreenError(error instanceof Error
            ? `进入全屏失败：${error.message}`
            : '浏览器拒绝了全屏请求。');
    }
};

const handleWorkspacePointerMove = (event: PointerEvent) => {
    lastPointerY = event.clientY;
    if (!isFullscreen.value) return;
    const rect = workspaceElement.value?.getBoundingClientRect();
    const inBottomHotZone = Boolean(rect && event.clientY >= rect.bottom - 96);
    if (inBottomHotZone) {
        fullscreenPointerHeld = true;
        fullscreenControlsVisible.value = true;
        clearFullscreenHideTimer();
    } else if (fullscreenPointerHeld) {
        fullscreenPointerHeld = false;
        scheduleFullscreenControlsHide();
    }
};

const handleWorkspacePointerLeave = () => {
    lastPointerY = null;
    if (!isFullscreen.value) return;
    fullscreenPointerHeld = false;
    scheduleFullscreenControlsHide();
};

const handleTransportPointerEnter = () => {
    if (!isFullscreen.value) return;
    fullscreenPointerHeld = true;
    fullscreenControlsVisible.value = true;
    clearFullscreenHideTimer();
};

const handleTransportPointerLeave = () => {
    if (!isFullscreen.value) return;
    const rect = workspaceElement.value?.getBoundingClientRect();
    fullscreenPointerHeld = Boolean(
        rect
        && lastPointerY !== null
        && lastPointerY >= rect.bottom - 96,
    );
    scheduleFullscreenControlsHide();
};

const handleWorkspaceKeydown = () => {
    if (!isFullscreen.value) return;
    fullscreenControlsVisible.value = true;
    scheduleFullscreenControlsHide();
};

const handleTransportFocusIn = () => {
    if (!isFullscreen.value) return;
    void nextTick().then(() => {
        fullscreenFocusHeld = activeControlUsesKeyboardFocus();
        fullscreenControlsVisible.value = true;
        if (fullscreenFocusHeld) clearFullscreenHideTimer();
        else scheduleFullscreenControlsHide();
    });
};

const handleTransportFocusOut = () => {
    if (!isFullscreen.value) return;
    void nextTick().then(() => {
        fullscreenFocusHeld = activeControlUsesKeyboardFocus();
        scheduleFullscreenControlsHide();
    });
};

const attachPreviewObserver = async () => {
    await nextTick();
    updateFullscreenSupport();
    resizeObserver?.disconnect();
    if (!previewCanvas.value) return;
    if (!rendererHost) {
        try {
            const host = new VisualizerRendererHost({
                canvas: previewCanvas.value,
                registry: controller.getSceneRegistry(),
                readFrame: () => {
                    const project = snapshot.value.project;
                    if (!project || !isUsable.value) return null;
                    return {
                        trackIdentity: project.track.contentHash,
                        templateId: project.scene.templateId,
                        templateVersion: project.scene.templateVersion,
                        seed: project.scene.seed,
                        timeSeconds: playback.value.currentTimeSeconds,
                        bindingRevision: snapshot.value.bindingRuntime.bindingRevision,
                        playbackState: playback.value.state,
                    };
                },
                resolveValuesAt: (timeSeconds) => new Map(
                    controller.resolveParameters(timeSeconds).map((entry) => [entry.parameterId, entry]),
                ),
                onFrame: (values, frame) => {
                    resolvedValues.value = values;
                    sceneFrame.value = frame;
                },
                onStatus: (status) => {
                    rendererStatus.value = status;
                    controller.notifyRendererStatus(status);
                },
            });
            rendererHost = host;
            detachRecordingTarget = controller.attachRecordingTarget({
                getStatus: () => rendererStatus.value,
                acquireRecordingSurface: (width, height) =>
                    host.acquireRecordingSurface(width, height),
            });
        } catch (error) {
            rendererStatus.value = {
                state: 'error',
                message: error instanceof Error ? error.message : 'WebGL 渲染器创建失败。',
            };
            return;
        }
    }
    resizeObserver = new ResizeObserver(resizePreview);
    resizeObserver.observe(previewCanvas.value);
    resizePreview();
};

const detachRenderer = () => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    detachRecordingTarget?.();
    detachRecordingTarget = null;
    rendererHost?.dispose();
    rendererHost = null;
    resolvedValues.value = new Map();
    sceneFrame.value = { hash: '', needsSourcePrompt: false };
    rendererStatus.value = { state: 'idle' };
};

watch(
    () => route.params.trackId,
    () => {
        conflictExported.value = false;
        actionError.value = '';
        if (sessionStore.persistence.state !== 'restoring') {
            void controller.enter(routeTrackId());
        }
    },
    { immediate: true },
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
    () => isUsable.value,
    (usable) => {
        if (usable) void attachPreviewObserver();
        else detachRenderer();
    },
    { immediate: true },
);

watch(
    () => [
        snapshot.value.project?.track.contentHash,
        snapshot.value.project?.scene.templateId,
        snapshot.value.project?.scene.seed,
        snapshot.value.bindingRuntime.bindingRevision,
        playback.value.currentTimeSeconds,
        playback.value.state,
    ],
    () => rendererHost?.requestFrame(),
);

watch(
    () => playback.value.state,
    () => {
        if (!isFullscreen.value) return;
        if (playback.value.state === 'playing') scheduleFullscreenControlsHide();
        else {
            fullscreenControlsVisible.value = true;
            clearFullscreenHideTimer();
        }
    },
);

watch(
    () => recordingLocked.value,
    (locked) => {
        if (locked && isFullscreen.value) void exitOwnedFullscreen();
    },
);

const toggleDrawer = (target: 'templates' | 'settings') => {
    openDrawer.value = openDrawer.value === target ? null : target;
};

const switchTemplate = (templateId: VisualizerTemplateId) => {
    controller.switchTemplate(templateId);
    openDrawer.value = null;
};

const retryScene = () => rendererHost?.retry();

const setResolution = (event: Event) => {
    const resolution = (event.target as HTMLSelectElement).value as VisualizerResolution;
    const frameRate = snapshot.value.project?.output.frameRate ?? 30;
    controller.updateOutput(resolution, frameRate);
};

const setFrameRate = (event: Event) => {
    const frameRate = Number((event.target as HTMLSelectElement).value) as VisualizerFrameRate;
    const resolution = snapshot.value.project?.output.resolution ?? '720p';
    controller.updateOutput(resolution, frameRate);
};

const togglePlayback = () => {
    actionError.value = '';
    void controller.togglePlayback().catch((error) => {
        actionError.value = error instanceof Error ? error.message : '播放操作失败。';
    });
};
const seek = (event: Event) => {
    actionError.value = '';
    void controller.seek(Number((event.target as HTMLInputElement).value)).catch((error) => {
        actionError.value = error instanceof Error ? error.message : '定位失败。';
    });
};

const startRecording = async () => {
    actionError.value = '';
    try {
        await controller.startRecording();
    } catch (error) {
        actionError.value = error instanceof Error ? error.message : '录制启动失败。';
    }
};

const cancelRecording = async () => {
    actionError.value = '';
    await controller.cancelRecording();
};

const saveRecording = async (): Promise<'saved' | 'cancelled'> => {
    actionError.value = '';
    try {
        return await controller.saveRecording();
    } catch (error) {
        actionError.value = error instanceof Error ? error.message : 'WebM 保存失败。';
        return 'cancelled';
    }
};

const discardRecording = () => controller.discardRecording();
const resetRecordingError = () => controller.resetRecordingError();

const importProject = async () => {
    actionError.value = '';
    try {
        await controller.importProject();
    } catch (error) {
        actionError.value = error instanceof Error ? error.message : '工程导入失败。';
    }
};

const exportProject = async () => {
    actionError.value = '';
    try {
        await controller.exportProject();
    } catch (error) {
        actionError.value = error instanceof Error ? error.message : '工程导出失败。';
    }
};

const exportConflict = async () => {
    actionError.value = '';
    try {
        conflictExported.value = await controller.exportConflictingDraft() === 'saved';
    } catch (error) {
        actionError.value = error instanceof Error ? error.message : '旧工程导出失败。';
    }
};

const overwriteConflict = () => void controller.overwriteConflictingDraft();
const cancelConflict = async () => {
    const result = await controller.cancelConflictingEntry();
    if (result.kind === 'restored-old') {
        await router.replace({ name: 'visualizer', params: { trackId: result.trackId } });
    } else {
        await router.replace('/');
    }
};

const finishLeaveDecision = (decision: boolean) => {
    leaveDialog.value?.close();
    const resolve = resolveLeaveDecision;
    resolveLeaveDecision = null;
    resolve?.(decision);
};

const stayOnPage = () => finishLeaveDecision(false);
const cancelAndLeave = async () => {
    await controller.cancelRecording();
    finishLeaveDecision(true);
};
const saveAndLeave = async () => {
    if (await saveRecording() === 'saved') finishLeaveDecision(true);
};
const discardAndLeave = () => {
    controller.discardRecording();
    finishLeaveDecision(true);
};
const requestLeaveDecision = (): Promise<boolean> => {
    leaveMode.value = snapshot.value.recording.status === 'ready' ? 'ready' : 'active';
    return new Promise((resolve) => {
        resolveLeaveDecision = resolve;
        leaveDialog.value?.showModal();
    });
};

onBeforeRouteLeave(async () => {
    if (!await exitOwnedFullscreen()) return false;
    if (controller.hasUnresolvedRecordingOutput()) {
        const shouldLeave = await requestLeaveDecision();
        if (!shouldLeave) return false;
    }
    await controller.leave();
    return true;
});

onMounted(() => {
    updateFullscreenSupport();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('fullscreenerror', handleFullscreenError);
    syncFullscreenState();
});

onBeforeUnmount(() => {
    clearFullscreenHideTimer();
    document.removeEventListener('fullscreenchange', syncFullscreenState);
    document.removeEventListener('fullscreenerror', handleFullscreenError);
    if (workspaceElement.value && document.fullscreenElement === workspaceElement.value) {
        void document.exitFullscreen().catch(() => undefined);
    }
    detachRenderer();
    unsubscribe();
});
</script>

<style scoped>
.visualizer-page {
    height: 100dvh;
    min-height: 0;
    padding: var(--app-page-top-space) 12px 12px;
    overflow: hidden;
    color: var(--ink);
    background: var(--canvas);
}

.visualizer-state,
.visualizer-workspace {
    height: 100%;
    min-height: 0;
    background: var(--surface-card-strong);
}

.visualizer-state {
    display: grid;
    place-content: center;
    gap: 12px;
    padding: 32px;
    overflow: auto;
    overscroll-behavior: contain;
    text-align: center;
}

.visualizer-state h1,
.visualizer-state p,
.workspace-toolbar h1,
.workspace-toolbar p {
    margin: 0;
}

.kicker {
    color: var(--accent-soft);
    letter-spacing: .08em;
    text-transform: uppercase;
}

button,
select,
input {
    min-height: 32px;
    border: 1px solid var(--hairline-strong);
    border-radius: 4px;
    color: var(--ink);
    background: var(--surface-3);
}

button {
    padding: 6px 12px;
    cursor: pointer;
}

button:hover,
button[aria-pressed="true"] {
    border-color: var(--accent-soft);
    background: var(--marker-fill-soft);
}

button:focus-visible,
select:focus-visible,
input:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 2px;
}

.state-actions,
.project-actions,
.compact-drawer-controls,
.transport {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.success-message {
    color: var(--accent-soft);
}

.visualizer-workspace {
    display: grid;
    grid-template-rows: auto auto auto minmax(0, 1fr) auto auto;
    overflow: hidden;
}

.workspace-toolbar {
    grid-row: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 10px 60px 10px 14px;
    border-bottom: 1px solid var(--divider);
}

.workspace-toolbar h1 {
    font-size: 1.1rem;
}

.workspace-toolbar p {
    color: var(--body);
}

.workspace-alert {
    grid-row: 2;
    margin: 0;
    padding: 8px 14px;
    border-bottom: 1px solid var(--error-hairline);
    color: var(--error);
}

.workspace-grid {
    grid-row: 4;
    position: relative;
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr) 336px;
    min-height: 0;
    overflow: hidden;
}

.workspace-panel {
    min-width: 0;
    min-height: 0;
    padding: 12px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--surface-deep);
}

.template-panel {
    border-right: 1px solid var(--divider);
}

.settings-panel {
    border-left: 1px solid var(--divider);
}

.panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.panel-heading h2 {
    margin: 0;
    font-size: 1rem;
}

.drawer-close,
.compact-drawer-controls {
    display: none;
}

.compact-drawer-controls {
    grid-row: 3;
}

.template-button {
    display: grid;
    gap: 6px;
    width: 100%;
    margin-bottom: 8px;
    padding: 10px;
    text-align: left;
}

.template-button span,
.settings-panel p {
    color: var(--body);
    font-size: .85rem;
}

.settings-panel label {
    display: grid;
    gap: 6px;
    margin-bottom: 14px;
}

.output-settings {
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--divider);
}

.output-settings summary {
    margin-bottom: 10px;
    color: var(--ink);
    cursor: pointer;
}

.settings-panel select {
    width: 100%;
    padding: 4px 8px;
}

.settings-panel dl {
    margin: 18px 0;
    border-top: 1px solid var(--divider);
}

.settings-panel dl div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider);
}

.settings-panel dd {
    margin: 0;
    color: var(--accent-soft);
}

.preview-column {
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    padding: 18px;
    background: var(--canvas);
}

.preview-frame {
    position: relative;
    width: min(100%, calc((100dvh - 240px) * 16 / 9));
    max-height: 100%;
    aspect-ratio: 16 / 9;
    border: 1px solid var(--hairline);
    background: var(--canvas);
}

.preview-frame canvas {
    display: block;
    width: 100%;
    height: 100%;
}

.context-notice,
.scene-error {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 8px;
    padding: 20px;
    text-align: center;
    pointer-events: none;
}

.scene-error {
    background: var(--surface-veil);
    pointer-events: auto;
}

.scene-error span {
    color: var(--error);
}

.source-prompt {
    position: absolute;
    right: 12px;
    bottom: 12px;
    padding: 6px 9px;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    color: var(--ink);
    background: var(--surface-veil-soft);
    font-size: .78rem;
    pointer-events: none;
}

.context-notice strong {
    color: var(--accent-soft);
    font-size: 1.5rem;
}

.context-notice span {
    color: var(--body);
}

.transport {
    grid-row: 6;
    display: grid;
    grid-template-columns: auto auto minmax(120px, 1fr) auto auto;
    padding: 10px 14px;
    border-top: 1px solid var(--divider);
}

.recording-bar {
    grid-row: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 14px;
    border-top: 1px solid var(--hairline-soft);
    background: var(--surface-deep);
}

.recording-bar > div,
.recording-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.recording-bar span {
    color: var(--body);
    font-size: .78rem;
}

.leave-dialog {
    max-width: min(520px, calc(100vw - 32px));
    border: 1px solid var(--hairline-strong);
    border-radius: 6px;
    color: var(--ink);
    background: var(--surface-3);
}

.leave-dialog::backdrop {
    background: var(--backdrop-modal);
}

.leave-dialog h2 {
    margin-top: 0;
}

button:disabled,
select:disabled,
input:disabled {
    cursor: not-allowed;
    opacity: .5;
}

.transport input {
    width: 100%;
}

.ended-policy {
    color: var(--accent-soft);
}

.fullscreen-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
}

.fullscreen-status {
    max-width: 260px;
    color: var(--warning);
    font-size: .75rem;
    line-height: 1.2;
    text-align: right;
}

.visualizer-workspace:fullscreen {
    position: relative;
    display: block;
    width: 100vw;
    height: 100dvh;
    border: 0;
    background: #000;
}

.visualizer-workspace:fullscreen::backdrop {
    background: #000;
}

.visualizer-workspace:fullscreen > .workspace-toolbar,
.visualizer-workspace:fullscreen > .workspace-alert,
.visualizer-workspace:fullscreen > .compact-drawer-controls,
.visualizer-workspace:fullscreen > .recording-bar {
    display: none;
}

.visualizer-workspace:fullscreen > .workspace-grid {
    position: absolute;
    inset: 0;
    display: grid;
    width: 100%;
    height: 100%;
    grid-template-columns: minmax(0, 1fr);
    background: #000;
}

.visualizer-workspace:fullscreen .workspace-panel {
    display: none;
}

.visualizer-workspace:fullscreen .source-prompt {
    display: none;
}

.visualizer-workspace:fullscreen .preview-column {
    padding: 0;
    background: #000;
}

.visualizer-workspace:fullscreen .preview-frame {
    width: min(100vw, calc(100dvh * 16 / 9));
    height: min(100dvh, calc(100vw * 9 / 16));
    max-width: 100vw;
    max-height: 100dvh;
    border: 0;
}

.visualizer-workspace:fullscreen > .transport {
    position: absolute;
    z-index: 10;
    right: 0;
    bottom: 0;
    left: 0;
    padding: 18px 24px 20px;
    border-top-color: var(--hairline);
    background: linear-gradient(180deg, rgba(0, 0, 0, .12), var(--surface-transport));
    transition: opacity 160ms ease, transform 160ms ease;
}

.visualizer-workspace:fullscreen > .transport.transport-hidden {
    opacity: 0;
    transform: translateY(100%);
    pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
    .visualizer-workspace:fullscreen > .transport {
        transition: none;
    }
}

@container app-workspace (max-width: 1279px) {
    .compact-drawer-controls {
        display: flex;
        position: relative;
        z-index: 6;
        padding: 8px 12px;
        border-bottom: 1px solid var(--divider);
        background: var(--surface-deep);
    }

    .workspace-grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .workspace-panel {
        position: absolute;
        z-index: 5;
        top: 0;
        bottom: 0;
        display: none;
        width: min(336px, 42vw);
        box-shadow: 0 18px 50px rgba(0, 0, 0, .55);
    }

    .workspace-panel.drawer-open,
    .drawer-close {
        display: block;
    }

    .template-panel {
        left: 0;
    }

    .settings-panel {
        right: 0;
    }
}

@media (max-width: 1023px) {
    .visualizer-page {
        overflow-x: auto;
    }

    .visualizer-workspace {
        min-width: 760px;
    }

    .workspace-toolbar {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
