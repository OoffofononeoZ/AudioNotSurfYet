<template>
    <main class="visualizer-page" data-testid="visualizer-page">
        <header class="viz-toolbar" aria-label="工程操作">
            <button
                type="button"
                class="viz-icon-button"
                :disabled="!usable || locked"
                aria-label="导入工程"
                title="导入工程"
                data-testid="import-visualizer-project"
                :aria-busy="importBusy"
                @click="importProject">
                <VisualizerIcon name="import" /></button
            ><button
                type="button"
                class="viz-icon-button"
                :disabled="!usable"
                aria-label="导出工程"
                title="导出工程"
                data-testid="export-visualizer-project"
                @click="run(() => controller.exportProject())">
                <VisualizerIcon name="export" />
            </button>
            <div v-if="usable" class="viz-drawer-controls">
                <button
                    type="button"
                    class="viz-icon-button"
                    :aria-expanded="drawer === 'elements'"
                    aria-label="元素列表"
                    @click="drawer = drawer === 'elements' ? null : 'elements'">
                    <VisualizerIcon name="layers" /></button
                ><button
                    type="button"
                    class="viz-icon-button"
                    :aria-expanded="drawer === 'inspector'"
                    aria-label="元素属性"
                    @click="drawer = drawer === 'inspector' ? null : 'inspector'">
                    <VisualizerIcon name="sliders" />
                </button>
            </div>
        </header>
        <section
            v-if="snapshot.project && usable"
            ref="workspace"
            class="viz-workspace"
            data-testid="visualizer-ready"
            :class="{ 'is-fullscreen': fullscreen.active.value }"
            @pointermove="fullscreen.reveal"
            @keydown.capture="fullscreen.reveal">
            <aside
                class="viz-panel viz-elements"
                :class="{ 'drawer-open': drawer === 'elements' }"
                aria-label="元素列表"
                data-testid="visualizer-elements-panel">
                <button
                    type="button"
                    class="viz-drawer-close viz-icon-button"
                    aria-label="关闭元素列表"
                    @click="drawer = null">
                    <VisualizerIcon name="close" /></button
                ><VisualizerElementList
                    :project="snapshot.project"
                    :selection="selection"
                    :locked="locked"
                    @add="catalogOpen = true"
                    @select="selectElement"
                    @visibility="(id, enabled) => run(() => controller.updateVisibility(id, enabled))"
                    @remove="id => run(() => controller.removeElement(id))"
                    @reorder="(ids, parentId) => run(() => controller.reorderElements(ids, parentId))" />
            </aside>
            <section class="viz-preview-column" aria-label="可视化预览">
                <div class="viz-preview-stage">
                    <div
                        class="viz-preview-frame"
                        data-testid="visualizer-preview-frame"
                        :data-scene-status="preview.status.value.state">
                        <canvas ref="canvas" data-testid="visualizer-preview-canvas" />
                        <div v-if="preview.status.value.state === 'error'" class="viz-preview-error" role="alert">
                            <span>{{ preview.status.value.message }}</span
                            ><button type="button" @click="preview.retry">重试渲染</button>
                        </div>
                        <div
                            v-else-if="preview.status.value.state === 'recovering'"
                            class="viz-preview-notice"
                            role="status">
                            正在恢复画面
                        </div>
                        <div
                            v-else-if="preview.nativeStatus.value === 'loading'"
                            class="viz-preview-notice"
                            role="status">
                            原生输入准备中
                        </div>
                        <div v-else-if="preview.nativeStatus.value === 'error'" class="viz-preview-error" role="alert">
                            <span>{{ preview.nativeMessage.value }}</span
                            ><button type="button" :disabled="locked" @click="run(() => controller.retryNativeInput())">
                                重试原生输入
                            </button>
                        </div>
                        <div v-if="locked" class="viz-export-badge" aria-live="polite"><i />{{ exportLabel }}</div>
                        <div
                            class="viz-video-controls"
                            :class="{ 'controls-visible': fullscreen.visible.value && fullscreen.active.value }"
                            @focusin="fullscreen.focusIn"
                            @focusout="fullscreen.focusOut"
                            @pointerenter="fullscreen.focusIn"
                            @pointerleave="fullscreen.focusOut">
                            <template v-if="fullscreen.active.value"
                                ><AppPlaybackProgress
                                    class="viz-fullscreen-progress"
                                    :max="store.playback.durationSeconds"
                                    :model-value="store.playback.currentTimeSeconds"
                                    label="全屏播放进度"
                                    :value-text="
                                        formatTime(store.playback.currentTimeSeconds) +
                                        ' / ' +
                                        formatTime(store.playback.durationSeconds)
                                    "
                                    test-id="visualizer-seek"
                                    :disabled="locked"
                                    @update:model-value="value => run(() => controller.seek(value))" /><button
                                    type="button"
                                    class="viz-icon-button"
                                    :aria-label="store.playback.state === 'playing' ? '暂停' : '播放'"
                                    :disabled="locked"
                                    @click="run(() => controller.togglePlayback())">
                                    <VisualizerIcon
                                        :name="store.playback.state === 'playing' ? 'pause' : 'play'" /></button
                                ><span class="viz-fullscreen-time"
                                    >{{ formatTime(store.playback.currentTimeSeconds) }} /
                                    {{ formatTime(store.playback.durationSeconds) }}</span
                                ></template
                            >
                            <span class="viz-controls-spacer" />
                            <button
                                v-if="snapshot.export.status === 'idle'"
                                type="button"
                                class="viz-icon-button"
                                aria-label="导出视频"
                                title="导出视频"
                                data-testid="start-visualizer-export"
                                @click="startExport">
                                <VisualizerIcon name="export" /></button
                            ><button
                                v-if="locked"
                                type="button"
                                class="viz-icon-button exporting"
                                aria-label="取消导出"
                                title="取消导出"
                                data-testid="cancel-visualizer-export"
                                @click="run(() => controller.cancelExport())">
                                <VisualizerIcon name="stop" />
                            </button>
                            <button
                                type="button"
                                class="viz-icon-button"
                                :disabled="!fullscreen.supported.value || (locked && !fullscreen.active.value)"
                                :aria-label="fullscreen.active.value ? '退出全屏播放' : '进入全屏播放'"
                                :title="fullscreen.active.value ? '退出全屏' : '全屏'"
                                data-testid="visualizer-fullscreen-toggle"
                                @click="fullscreen.toggle">
                                <VisualizerIcon :name="fullscreen.active.value ? 'exit' : 'fullscreen'" />
                            </button>
                        </div>
                    </div>
                </div>
                <VisualizerBottomPanel
                    :snapshot="snapshot"
                    :project="snapshot.project"
                    :locked="locked"
                    :error="actionError || fullscreen.error.value"
                    @output="(r, f) => run(() => controller.updateOutput(r, f))"
                    @seed="seed => run(() => controller.updateProject({ ...snapshot.project!, seed }))"
                    @reload-editor="run(() => controller.reloadEditorDraft())"
                    @import-editor="run(() => controller.importEditorProject())"
                    @remove-editor="run(() => controller.removeEditorSnapshot())"
                    @retry-analysis="run(() => controller.retryAnalysis())"
                    @save-export="run(() => controller.saveExport())"
                    @discard-export="run(() => controller.discardExport())"
                    @reset-export="run(() => controller.resetExportError())"
                    @retry-save="run(() => controller.flush())" />
            </section>
            <aside
                class="viz-panel viz-properties"
                :class="{ 'drawer-open': drawer === 'inspector' }"
                aria-label="元素属性"
                data-testid="visualizer-settings-panel">
                <button
                    type="button"
                    class="viz-drawer-close viz-icon-button"
                    aria-label="关闭元素属性"
                    @click="drawer = null">
                    <VisualizerIcon name="close" /></button
                ><VisualizerPresetInspector
                    v-if="selectedPreset"
                    :project="snapshot.project"
                    :preset="selectedPreset"
                    :locked="locked"
                    @rename="
                        name =>
                            run(() => {
                                if (selection) controller.updatePreset(selection, { name });
                            })
                    "
                    @control="
                        (id, value) =>
                            run(() => {
                                if (selection) controller.updateCommonControl(selection, id, value);
                            })
                    " /><VisualizerElementInspector
                    v-else
                    :project="snapshot.project"
                    :element="selectedElement"
                    :locked="locked"
                    @update="
                        patch =>
                            run(() => {
                                if (selection) controller.updateElement(selection, patch);
                            })
                    "
                    @binding="
                        binding =>
                            run(() => {
                                if (selection) controller.updateBinding(selection, binding);
                            })
                    " />
            </aside>
        </section>
        <section v-else class="viz-page-state app-scrollbar" :data-testid="'visualizer-' + snapshot.state">
            <VisualizerDraftNotice
                v-if="snapshot.state === 'draft-conflict' || snapshot.state === 'unsupported-draft'"
                :file-name="snapshot.conflictingDraft?.project.track.fileName"
                @export="run(() => controller.exportConflictingDraft())"
                @replace="run(() => controller.overwriteConflictingDraft())"
                @cancel="router.push('/')" />
            <template v-else-if="snapshot.state === 'empty'"
                ><h1>先选择一首歌曲</h1>
                <p>使用底部播放器导入或选择歌曲。</p></template
            ><template v-else-if="snapshot.state === 'loading'"><p role="status">正在准备工程…</p></template
            ><template v-else
                ><h1>歌曲暂时不可用</h1>
                <p role="alert">{{ snapshot.message }}</p></template
            >
            <p v-if="actionError" class="viz-error" role="alert">{{ actionError }}</p>
        </section>
        <VisualizerElementCatalog
            :open="catalogOpen"
            :locked="locked"
            @close="catalogOpen = false"
            @add="addElement"
            @preset="addPreset" />
        <dialog
            ref="leaveDialog"
            class="viz-leave-dialog"
            aria-labelledby="viz-leave-title"
            @cancel.prevent="resolveLeave(false)">
            <h2 id="viz-leave-title">
                {{ leaveKind === 'project' ? '切换歌曲工程' : locked ? '导出尚未结束' : 'WebM 尚未处理' }}
            </h2>
            <p>
                {{
                    leaveKind === 'project'
                        ? '当前只保留一个可视化草稿。可以先导出当前工程，或明确覆盖为目标歌曲的空工程。'
                        : locked
                          ? '离开会取消当前导出，不生成半文件。'
                          : '请先保存或明确丢弃当前 WebM。'
                }}
            </p>
            <div class="viz-inline-actions">
                <template v-if="leaveKind === 'project'"
                    ><button type="button" @click="run(() => controller.exportProject())">导出当前工程</button
                    ><button type="button" data-testid="confirm-track-project-switch" @click="resolveLeave(true)">
                        覆盖草稿并切换
                    </button></template
                ><button v-else-if="locked" type="button" @click="cancelAndLeave">取消导出并离开</button
                ><template v-else
                    ><button type="button" @click="saveAndLeave">保存并离开</button
                    ><button type="button" @click="discardAndLeave">丢弃并离开</button></template
                ><button type="button" @click="resolveLeave(false)">留在此页</button>
            </div>
        </dialog>
    </main>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import VisualizerIcon from '../components/visualizer/VisualizerIcon.vue';
import VisualizerElementList from '../components/visualizer/VisualizerElementList.vue';
import VisualizerElementCatalog from '../components/visualizer/VisualizerElementCatalog.vue';
import VisualizerElementInspector from '../components/visualizer/VisualizerElementInspector.vue';
import VisualizerBottomPanel from '../components/visualizer/VisualizerBottomPanel.vue';
import VisualizerPresetInspector from '../components/visualizer/VisualizerPresetInspector.vue';
import AppPlaybackProgress from '../components/controls/AppPlaybackProgress.vue';
import VisualizerDraftNotice from '../components/visualizer/VisualizerDraftNotice.vue';
import type { CompositionPresetId } from '../visualizer/compositionPresets';
import { useAudioSessionService } from '../audio/audioSessionService';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import { useVisualizerSessionController } from '../visualizer/visualizerSessionController';
import { useVisualizerPreview } from '../visualizer/useVisualizerPreview';
import { useVisualizerFullscreen } from '../visualizer/useVisualizerFullscreen';
import { formatSecToTime as formatTime } from '../utils/utils';
import '../visualizer/workspace.css';
const route = useRoute(),
    router = useRouter(),
    controller = useVisualizerSessionController(),
    store = useAudioSessionStore(),
    audioSession = useAudioSessionService();
const snapshot = shallowRef(controller.getSnapshot()),
    unsubscribe = controller.subscribe(value => (snapshot.value = value));
const workspace = ref<HTMLElement | null>(null),
    canvas = ref<HTMLCanvasElement | null>(null),
    catalogOpen = ref(false),
    selection = ref<string | null>(null),
    drawer = ref<'elements' | 'inspector' | null>(null),
    actionError = ref(''),
    importBusy = ref(false);
const locked = computed(
    () => importBusy.value || ['preparing', 'exporting', 'finalizing'].includes(snapshot.value.export.status),
);
const usable = computed(() => ['ready', 'not-persisted'].includes(snapshot.value.state));
const selectedElement = computed(() => snapshot.value.project?.elements.find(e => e.id === selection.value) ?? null);
const selectedPreset = computed(() => {
    const item = snapshot.value.project?.items.find(i => i.kind === 'preset' && i.id === selection.value);
    return item?.kind === 'preset' ? item : null;
});
const preview = useVisualizerPreview(canvas, controller, store, snapshot),
    fullscreen = useVisualizerFullscreen(
        workspace,
        () => store.playback.state === 'playing',
        () => locked.value,
    );
const exportLabel = computed(
    () =>
        (({ preparing: '准备导出', exporting: '正在导出视频', finalizing: '正在生成 WebM' }) as Record<string, string>)[
            snapshot.value.export.status
        ] ?? '',
);
async function run(operation: () => unknown) {
    actionError.value = '';
    try {
        return await operation();
    } catch (error) {
        actionError.value = (error as Error).message;
        return null;
    }
}
async function importProject() {
    if (locked.value) return;
    importBusy.value = true;
    try {
        await run(() => controller.importProject());
    } finally {
        importBusy.value = false;
    }
}
function selectElement(id: string) {
    selection.value = id;
    drawer.value = drawer.value === 'elements' ? 'inspector' : drawer.value;
}
async function addElement(type: string) {
    const id = await run(() => controller.addElement(type));
    if (typeof id === 'string') {
        selection.value = id;
        catalogOpen.value = false;
        drawer.value = null;
    }
}
async function addPreset(id: CompositionPresetId) {
    const instance = await run(() => controller.addPreset(id));
    if (typeof instance === 'string') {
        selection.value = instance;
        catalogOpen.value = false;
        drawer.value = null;
    }
}
async function startExport() {
    if (!(await fullscreen.exit())) return;
    await run(() => controller.startExport());
}
let requestedPlayTarget: string | null = null,
    entryRevision = 0;
let approval: { trackId: string; project: ReturnType<typeof controller.readProject> } | null = null;
watch(
    () => route.params.trackId,
    trackId => {
        if (route.name !== 'visualizer') return;
        selection.value = null;
        drawer.value = null;
        catalogOpen.value = false;
        const id = typeof trackId === 'string' ? trackId : store.currentTrackId,
            revision = ++entryRevision;
        const overwrite = !!id && approval?.trackId === id && approval.project === controller.readProject();
        approval = null;
        void run(async () => {
            await controller.enter(id, overwrite);
            if (revision !== entryRevision) return;
            if (id && requestedPlayTarget === id && controller.getSnapshot().state === 'ready') {
                requestedPlayTarget = null;
                await audioSession.play();
            }
        });
    },
    { immediate: true },
);
watch(
    () => snapshot.value.project,
    (project, previous) => {
        if (!selection.value || selectedElement.value || selectedPreset.value) return;
        const parent = previous?.items.find(i => i.kind === 'preset' && i.children.includes(selection.value!));
        selection.value = parent && project?.items.some(i => i.id === parent.id) ? parent.id : null;
    },
);
const leaveDialog = ref<HTMLDialogElement | null>(null),
    leaveKind = ref<'exporting' | 'project'>('exporting');
let pendingLeave: ((value: boolean) => void) | null = null;
function resolveLeave(value: boolean) {
    leaveDialog.value?.close();
    const resolve = pendingLeave;
    pendingLeave = null;
    resolve?.(value);
}
async function cancelAndLeave() {
    await controller.cancelExport();
    resolveLeave(true);
}
async function saveAndLeave() {
    const result = await run(() => controller.saveExport());
    if (result === 'saved') resolveLeave(true);
}
async function discardAndLeave() {
    await controller.discardExport();
    resolveLeave(true);
}
async function guardLeave() {
    if (!(await fullscreen.exit())) return false;
    if (controller.hasUnresolvedExportOutput()) {
        resolveLeave(false);
        leaveKind.value = 'exporting';
        const answer = await new Promise<boolean>(resolve => {
            pendingLeave = resolve;
            leaveDialog.value?.showModal();
        });
        if (!answer) return false;
    }
    if (!(await controller.flush())) {
        actionError.value = '当前工程尚未保存，请重试保存或导出。';
        return false;
    }
    return true;
}
async function prepareTrackChange(id: string | null) {
    if (!(await guardLeave())) return false;
    const project = controller.readProject(),
        track = id ? store.queue.find(t => t.id === id) : null;
    if (!id || !project || track?.trackHash === project.track.contentHash) return true;
    if (approval?.trackId === id && approval.project === project) return true;
    resolveLeave(false);
    leaveKind.value = 'project';
    const confirmed = await new Promise<boolean>(resolve => {
        pendingLeave = resolve;
        leaveDialog.value?.showModal();
    });
    if (confirmed) approval = { trackId: id, project: controller.readProject() };
    return confirmed;
}
const detachNavigation = audioSession.attachTrackNavigation({
    async select(id) {
        requestedPlayTarget = id;
        const result = await router.push({ name: 'visualizer', params: { trackId: id } });
        if (result && requestedPlayTarget === id) requestedPlayTarget = null;
    },
    beforeMutation: prepareTrackChange,
    async cleared() {
        requestedPlayTarget = null;
        await router.push({ name: 'visualizer', params: { trackId: undefined } });
    },
});
onBeforeRouteLeave(async () => {
    if (!(await guardLeave())) return false;
    await controller.leave();
    return true;
});
onBeforeRouteUpdate(async to => prepareTrackChange(typeof to.params.trackId === 'string' ? to.params.trackId : null));
onBeforeUnmount(() => {
    entryRevision++;
    detachNavigation();
    resolveLeave(false);
    unsubscribe();
});
</script>
