<template>
    <main class="visualizer-page" data-testid="visualizer-page">
        <section v-if="snapshot.state === 'empty'" class="visualizer-state" data-testid="visualizer-empty">
            <p class="kicker">Visualizer · 可视化制作台</p>
            <h1>先选择一首歌曲</h1>
            <p>可以在底部播放器导入或选择歌曲，再从导航栏 Visualizer 进入。</p>
        </section>

        <section v-else-if="snapshot.state === 'loading'" class="visualizer-state" aria-live="polite">
            <h1>正在准备歌曲和可视化草稿…</h1>
        </section>

        <section v-else-if="snapshot.state === 'unavailable'" class="visualizer-state" data-testid="visualizer-unavailable">
            <h1>这首歌曲暂时不能用于可视化</h1>
            <p role="alert">{{ snapshot.message }}</p>
            <p>请在底部播放器恢复文件访问或重新选择相同文件。</p>
        </section>

        <section v-else-if="snapshot.state === 'draft-conflict'" class="visualizer-state" data-testid="visualizer-draft-conflict">
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
            class="visualizer-workspace"
            data-testid="visualizer-ready"
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
                    <button type="button" data-testid="import-visualizer-project" @click="importProject">
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
                    class="workspace-panel template-panel"
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
                    class="workspace-panel settings-panel"
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
                    />
                </aside>
            </div>

            <footer class="transport" aria-label="Visualizer 播放控制">
                <button
                    type="button"
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
                    aria-label="播放进度"
                    data-testid="visualizer-seek"
                    @input="seek"
                >
                <span class="ended-policy" data-testid="visualizer-ended-policy">播完暂停</span>
            </footer>
        </section>
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
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { useAudioSessionService } from '../audio/audioSessionService';
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
const audioSession = useAudioSessionService();
const sessionStore = useAudioSessionStore();
const snapshot = shallowRef<VisualizerSessionSnapshot>(controller.getSnapshot());
const unsubscribe = controller.subscribe((value) => {
    snapshot.value = value;
});
const templates = controller.listTemplates();
const previewCanvas = ref<HTMLCanvasElement | null>(null);
const openDrawer = ref<'templates' | 'settings' | null>(null);
const conflictExported = ref(false);
const actionError = ref('');
const resolvedValues = shallowRef<VisualizerResolvedParameterMap>(new Map());
const rendererStatus = shallowRef<VisualizerRendererStatus>({ state: 'idle' });
const sceneFrame = shallowRef<VisualizerSceneFrameSnapshot>({
    hash: '',
    needsSourcePrompt: false,
});
let resizeObserver: ResizeObserver | null = null;
let rendererHost: VisualizerRendererHost | null = null;

const playback = computed(() => sessionStore.playback);
const isUsable = computed(() => ['ready', 'not-persisted'].includes(snapshot.value.state));
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

const attachPreviewObserver = async () => {
    await nextTick();
    resizeObserver?.disconnect();
    if (!previewCanvas.value) return;
    if (!rendererHost) {
        try {
            rendererHost = new VisualizerRendererHost({
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
                },
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

const togglePlayback = () => void audioSession.togglePlayback();
const seek = (event: Event) => {
    void audioSession.seek(Number((event.target as HTMLInputElement).value));
};

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

onBeforeRouteLeave(async () => {
    await controller.leave();
    return true;
});

onBeforeUnmount(() => {
    detachRenderer();
    unsubscribe();
});
</script>

<style scoped>
.visualizer-page {
    min-height: 100dvh;
    padding: 72px 12px 12px;
    color: #eafff2;
    background: #020403;
}

.visualizer-state,
.visualizer-workspace {
    min-height: calc(100dvh - 84px);
    border: 1px solid rgba(101, 255, 169, .22);
    background: rgba(4, 10, 7, .94);
}

.visualizer-state {
    display: grid;
    place-content: center;
    gap: 12px;
    padding: 32px;
    text-align: center;
}

.visualizer-state h1,
.visualizer-state p,
.workspace-toolbar h1,
.workspace-toolbar p {
    margin: 0;
}

.kicker {
    color: #65ffa9;
    letter-spacing: .08em;
    text-transform: uppercase;
}

button,
select,
input {
    min-height: 32px;
    border: 1px solid rgba(101, 255, 169, .36);
    border-radius: 4px;
    color: #eafff2;
    background: #07110d;
}

button {
    padding: 6px 12px;
    cursor: pointer;
}

button:hover,
button[aria-pressed="true"] {
    border-color: #65ffa9;
    background: rgba(39, 255, 100, .12);
}

button:focus-visible,
select:focus-visible,
input:focus-visible {
    outline: 2px solid #65ffa9;
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
    color: #65ffa9;
}

.visualizer-workspace {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    overflow: hidden;
}

.workspace-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(159, 196, 175, .18);
}

.workspace-toolbar h1 {
    font-size: 1.1rem;
}

.workspace-toolbar p {
    color: #a9c7b7;
}

.workspace-alert {
    margin: 0;
    padding: 8px 14px;
    border-bottom: 1px solid rgba(255, 173, 96, .3);
    color: #ffd2a6;
}

.workspace-grid {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr) 336px;
    min-height: 0;
}

.workspace-panel {
    min-width: 0;
    padding: 12px;
    overflow: auto;
    background: #050a07;
}

.template-panel {
    border-right: 1px solid rgba(159, 196, 175, .18);
}

.settings-panel {
    border-left: 1px solid rgba(159, 196, 175, .18);
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
    color: #9eb8aa;
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
    border-bottom: 1px solid rgba(159, 196, 175, .18);
}

.output-settings summary {
    margin-bottom: 10px;
    color: #cfe7da;
    cursor: pointer;
}

.settings-panel select {
    width: 100%;
    padding: 4px 8px;
}

.settings-panel dl {
    margin: 18px 0;
    border-top: 1px solid rgba(159, 196, 175, .18);
}

.settings-panel dl div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(159, 196, 175, .12);
}

.settings-panel dd {
    margin: 0;
    color: #65ffa9;
}

.preview-column {
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    padding: 18px;
    background: #010201;
}

.preview-frame {
    position: relative;
    width: min(100%, calc((100dvh - 240px) * 16 / 9));
    aspect-ratio: 16 / 9;
    border: 1px solid rgba(101, 255, 169, .3);
    background: #020403;
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
    background: rgba(2, 4, 3, .88);
    pointer-events: auto;
}

.scene-error span {
    color: #ffd2a6;
}

.source-prompt {
    position: absolute;
    right: 12px;
    bottom: 12px;
    padding: 6px 9px;
    border: 1px solid rgba(101, 255, 169, .24);
    border-radius: 4px;
    color: #cfe7da;
    background: rgba(2, 4, 3, .78);
    font-size: .78rem;
    pointer-events: none;
}

.context-notice strong {
    color: #65ffa9;
    font-size: 1.5rem;
}

.context-notice span {
    color: #9eb8aa;
}

.transport {
    display: grid;
    grid-template-columns: auto auto minmax(120px, 1fr) auto;
    padding: 10px 14px;
    border-top: 1px solid rgba(159, 196, 175, .18);
}

.transport input {
    width: 100%;
}

.ended-policy {
    color: #65ffa9;
}

@media (min-width: 1024px) and (max-width: 1279px) {
    .visualizer-workspace {
        position: relative;
        grid-template-rows: auto auto auto minmax(0, 1fr) auto;
    }

    .compact-drawer-controls {
        display: flex;
        position: relative;
        z-index: 6;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(159, 196, 175, .18);
        background: #050a07;
    }

    .workspace-grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .workspace-panel {
        position: absolute;
        z-index: 5;
        top: 112px;
        bottom: 54px;
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
