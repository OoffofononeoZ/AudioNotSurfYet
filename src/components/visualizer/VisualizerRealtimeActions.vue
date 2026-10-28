<template>
    <dialog
        ref="dialog"
        class="realtime-actions"
        aria-labelledby="realtime-actions-title"
        @cancel.prevent="close"
        @click="backdrop">
        <header class="realtime-header">
            <div class="realtime-title">
                <button type="button" class="dialog-icon" aria-label="返回导出选项" title="返回导出选项" @click="back">
                    <AppActionIcon name="back" />
                </button>
                <h2 id="realtime-actions-title">实时样式</h2>
            </div>
            <button type="button" class="dialog-icon" aria-label="关闭实时样式" title="关闭" @click="close">
                <AppActionIcon name="close" />
            </button>
        </header>
        <div class="realtime-body app-scrollbar">
            <section class="style-summary" aria-label="当前样式">
                <VisualizerRealtimePreview
                    :open="open"
                    :identity="projectKey"
                    :locked="locked"
                    :capture="captureCover" />
                <div class="style-identity">
                    <label for="realtime-style-name">样式名称</label
                    ><input id="realtime-style-name" v-model="name" :disabled="busy || locked" maxlength="100" />
                    <p>保存当前启用的完整画面和参数</p>
                </div>
            </section>
            <section class="realtime-destinations" aria-label="样式用途">
                <button
                    v-for="target in destinations"
                    :key="target.id"
                    type="button"
                    class="destination-card"
                    :class="{ 'is-active': activeAction === target.id }"
                    :disabled="busy || !canSave || !target.available"
                    :data-testid="target.testId"
                    :aria-describedby="!target.available ? 'realtime-issues' : undefined"
                    @click="activate(target.id)">
                    <span class="destination-heading"
                        ><span class="destination-icon"><AppActionIcon :name="target.icon" /></span
                        ><AppActionIcon class="destination-arrow" name="right"
                    /></span>
                    <strong>{{ target.title }}</strong
                    ><span class="destination-description">{{ target.description }}</span
                    ><span class="destination-state"
                        ><span v-if="activeAction === target.id" class="action-spinner" />{{
                            !target.available
                                ? '当前工程不可用'
                                : activeAction === target.id
                                  ? busyLabel
                                  : target.action
                        }}</span
                    >
                </button>
            </section>
            <section v-if="issues.length" id="realtime-issues" class="capability-notice" aria-label="实时样式限制">
                <h3>{{ capability?.browser ? 'Wallpaper Engine 暂不可用' : '当前工程暂不支持实时样式' }}</h3>
                <ul class="app-scrollbar">
                    <li v-for="issue in issues" :key="issue">{{ issue }}</li>
                </ul>
            </section>
            <p v-if="busy" class="task-status" role="status"><span class="action-spinner" />{{ busyLabel }}</p>
            <section v-if="address" class="result-panel" aria-label="展示地址已生成">
                <div class="result-heading">
                    <AppActionIcon name="check" />
                    <h3>展示地址已生成</h3>
                    <RouterLink :to="displayPath">打开展示页<AppActionIcon name="right" /></RouterLink>
                </div>
                <div class="address-field">
                    <input
                        :value="address"
                        readonly
                        aria-label="本地展示地址"
                        @focus="($event.target as HTMLInputElement).select()" /><button
                        type="button"
                        class="dialog-icon"
                        :aria-label="copied ? '已复制展示地址' : '复制展示地址'"
                        :title="copied ? '已复制' : '复制地址'"
                        @click="copyAddress">
                        <AppActionIcon :name="copied ? 'check' : 'copy'" />
                    </button>
                </div>
                <p>仅在当前浏览器可用，样式保存在本地。</p>
                <p v-if="copyError" role="status">{{ copyError }}</p>
            </section>
            <section v-if="wallpaperFiles" class="result-panel wallpaper-result" aria-label="壁纸导出结果">
                <div class="result-heading">
                    <AppActionIcon :name="wallpaperMessage ? 'check' : 'folder'" />
                    <h3>{{ wallpaperMessage ? '壁纸已导出' : '壁纸已准备好' }}</h3>
                </div>
                <p v-if="wallpaperMessage" role="status">{{ wallpaperMessage }}</p>
                <p v-else>选择保存位置后，将创建一个独立的壁纸文件夹。</p>
                <button
                    type="button"
                    class="save-wallpaper"
                    :disabled="busy || locked || !open"
                    data-testid="save-wallpaper-directory"
                    @click="saveWallpaper">
                    <AppActionIcon name="folder" />{{
                        activeAction === 'directory' ? '正在保存…' : '选择目录并保存壁纸'
                    }}
                </button>
            </section>
            <p v-if="error" class="realtime-error" role="alert">{{ error }}</p>
        </div>
    </dialog>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import type { VisualizerProjectV6 } from '../../visualizer/compositionTypes';
import { inspectRealtimeProject } from '../../visualizer/realtimeCapabilities';
import { createRealtimeStyle } from '../../visualizer/realtimeStyle';
import { RealtimeStyleRepository } from '../../visualizer/realtimeStyleRepository';
import { validateRealtimeCandidate } from '../../visualizer/validateRealtimeCandidate';
import { useConfigstore } from '../../stores/configStore';
import { prepareWallpaperFiles, type WallpaperExportFile } from '../../visualizer/wallpaperExport';
import { WallpaperDirectoryWriter, WallpaperDirectoryCleanupError } from '../../visualizer/wallpaperDirectoryWriter';
import { ElMessage } from 'element-plus';
import AppActionIcon from '../controls/AppActionIcon.vue';
import VisualizerRealtimePreview from './VisualizerRealtimePreview.vue';
const props = defineProps<{
    open: boolean;
    project: VisualizerProjectV6 | null;
    locked: boolean;
    captureCover: (signal: AbortSignal) => Promise<Blob>;
}>();
const emit = defineEmits<{ close: []; back: [] }>();
const router = useRouter(),
    config = useConfigstore(),
    repository = new RealtimeStyleRepository();
const dialog = ref<HTMLDialogElement | null>(null),
    name = ref('自定义样式'),
    error = ref(''),
    displayPath = ref('');
type Action = 'home' | 'page' | 'wallpaper' | 'directory';
const activeAction = ref<Action | null>(null),
    phase = ref('');
const busy = computed(() => activeAction.value !== null);
const busyLabel = computed(() =>
    phase.value === 'validating'
        ? '正在验证样式…'
        : phase.value === 'preparing'
          ? '正在准备壁纸…'
          : phase.value === 'directory'
            ? '正在保存壁纸…'
            : '正在保存样式…',
);
const address = computed(() => (displayPath.value ? new URL(displayPath.value, location.origin).href : ''));
const wallpaperFiles = shallowRef<WallpaperExportFile[] | null>(null),
    wallpaperMessage = ref('');
const copied = ref(false),
    copyError = ref('');
const capability = computed(() => (props.project ? inspectRealtimeProject(props.project) : null));
const projectKey = computed(() => (props.project ? props.project.projectId + ':' + props.project.updatedAt : ''));
const canSave = computed(() => props.open && !!props.project && !props.locked && !!name.value.trim());
const issues = computed(() =>
    !capability.value?.browser
        ? (capability.value?.browserIssues ?? [])
        : !capability.value.wallpaper
          ? capability.value.wallpaperIssues
          : [],
);
const destinations = computed(() => [
    {
        id: 'home' as const,
        icon: 'home',
        title: '首页',
        description: '用作首页的可视化背景',
        action: '应用到首页',
        testId: 'apply-home-style',
        available: !!capability.value?.browser,
    },
    {
        id: 'page' as const,
        icon: 'display',
        title: '展示地址',
        description: '生成独立的本地展示页',
        action: '生成展示地址',
        testId: 'create-display-page',
        available: !!capability.value?.browser,
    },
    {
        id: 'wallpaper' as const,
        icon: 'wallpaper',
        title: 'Wallpaper Engine',
        description: '导出可独立运行的壁纸目录',
        action: '准备壁纸',
        testId: 'prepare-wallpaper-export',
        available: !!capability.value?.wallpaper,
    },
]);
let task: AbortController | null = null,
    disposed = false,
    copyRevision = 0;
function cancelTask() {
    task?.abort();
    task = null;
    activeAction.value = null;
    phase.value = '';
}
function reset() {
    cancelTask();
    displayPath.value = '';
    wallpaperFiles.value = null;
    wallpaperMessage.value = '';
    error.value = '';
    copied.value = false;
    copyError.value = '';
    copyRevision++;
}
function close() {
    reset();
    dialog.value?.close();
    emit('close');
}
function back() {
    close();
    emit('back');
}
function backdrop(event: MouseEvent) {
    if (event.target !== dialog.value) return;
    const r = dialog.value!.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
}
watch(
    () => props.open,
    async value => {
        reset();
        await nextTick();
        if (props.open !== value) return;
        if (value && !dialog.value?.open) dialog.value?.showModal();
        else if (!value) dialog.value?.close();
    },
    { immediate: true },
);
watch(projectKey, reset);
watch(name, reset);
watch(
    () => props.locked,
    value => {
        if (value) reset();
    },
);
function begin(action: Action) {
    const owner = new AbortController();
    task = owner;
    activeAction.value = action;
    phase.value = action === 'directory' ? 'directory' : 'validating';
    error.value = '';
    return owner;
}
const current = (owner: AbortController) =>
    task === owner && !owner.signal.aborted && !disposed && props.open && !props.locked;
function finish(owner: AbortController) {
    if (task === owner) {
        task = null;
        activeAction.value = null;
        phase.value = '';
    }
}
async function activate(action: 'home' | 'page' | 'wallpaper') {
    if (action === 'wallpaper') await prepareWallpaper();
    else await save(action);
}
async function prepareWallpaper() {
    if (!canSave.value || busy.value || !capability.value?.wallpaper) return;
    wallpaperFiles.value = null;
    wallpaperMessage.value = '';
    const owner = begin('wallpaper');
    try {
        const style = createRealtimeStyle(props.project!, name.value);
        await validateRealtimeCandidate(style, owner.signal);
        if (!current(owner)) return;
        phase.value = 'preparing';
        const files = await prepareWallpaperFiles(style, owner.signal);
        if (current(owner)) wallpaperFiles.value = files;
    } catch (e) {
        if (current(owner)) error.value = (e as Error).message;
    } finally {
        finish(owner);
    }
}
async function saveWallpaper() {
    if (!canSave.value || !wallpaperFiles.value || busy.value || !capability.value?.wallpaper) return;
    const owner = begin('directory');
    wallpaperMessage.value = '';
    try {
        const result = await new WallpaperDirectoryWriter().save(wallpaperFiles.value, owner.signal);
        if (current(owner) && result.status === 'saved')
            wallpaperMessage.value = `已导出 ${result.folderName}，将目录中的 index.html 导入 Wallpaper Engine。`;
    } catch (e) {
        if (e instanceof WallpaperDirectoryCleanupError) ElMessage.error(e.message);
        if (current(owner)) error.value = (e as Error).message;
    } finally {
        finish(owner);
    }
}
async function save(target: 'home' | 'page') {
    if (!canSave.value || busy.value || !capability.value?.browser) return;
    const owner = begin(target);
    if (target === 'page') {
        displayPath.value = '';
        copied.value = false;
        copyError.value = '';
        copyRevision++;
    }
    try {
        const style = createRealtimeStyle(props.project!, name.value);
        await validateRealtimeCandidate(style, owner.signal);
        if (!current(owner)) return;
        phase.value = 'saving';
        await repository.save(style);
        if (!current(owner)) return;
        if (target === 'home') {
            config.homeStyleId = style.id;
            config.homeDisplayMode = 'visualizer';
            close();
            await router.push('/');
        } else displayPath.value = '/display/' + style.id;
    } catch (e) {
        if (current(owner)) error.value = (e as Error).message;
    } finally {
        finish(owner);
    }
}
async function copyAddress() {
    const value = address.value,
        revision = ++copyRevision;
    if (!value || !props.open) return;
    copied.value = false;
    copyError.value = '';
    try {
        await navigator.clipboard.writeText(value);
        if (props.open && revision === copyRevision && value === address.value) copied.value = true;
    } catch {
        if (props.open && revision === copyRevision && value === address.value)
            copyError.value = '无法复制，请选中地址后手动复制。';
    }
}
onBeforeUnmount(() => {
    disposed = true;
    reset();
    repository.close();
});
</script>

<style scoped>
.realtime-actions {
    width: min(760px, calc(100vw - 32px));
    min-height: min(480px, calc(100dvh - 64px));
    max-height: calc(100dvh - 64px);
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--divider);
    border-radius: 12px;
    background: #0b120e;
    color: var(--ink);
    box-shadow: 0 28px 100px #000a;
}
.realtime-actions[open] {
    display: flex;
    flex-direction: column;
}
.realtime-actions::backdrop {
    background: #000a;
    backdrop-filter: blur(8px);
}
.realtime-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: none;
    padding: 18px 20px;
    border-bottom: 1px solid var(--divider);
}
.realtime-title {
    display: flex;
    align-items: center;
    gap: 10px;
}
h2 {
    margin: 0;
    font-size: 20px;
    line-height: 28px;
    font-weight: 500;
}
.dialog-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex: none;
    padding: 7px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--mute);
    cursor: pointer;
}
.dialog-icon svg {
    width: 18px;
    height: 18px;
}
.dialog-icon:is(:hover, :focus-visible) {
    color: var(--ink);
    background: #ffffff08;
}
.realtime-body {
    min-height: 0;
    padding: 24px;
    overflow: auto;
    overscroll-behavior: contain;
}
.style-summary {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 24px;
}
.style-identity {
    flex: 1;
    min-width: 0;
}
.style-identity label {
    display: block;
    margin-bottom: 10px;
    color: var(--body);
    font-size: 12px;
}
.style-identity input {
    width: 100%;
    min-width: 0;
    padding: 10px 12px;
    border: 1px solid var(--divider);
    border-radius: 6px;
    background: #050b08;
    color: var(--ink);
    font: inherit;
    font-size: 14px;
}
.style-identity input:focus-visible {
    outline: 1px solid var(--hairline-focus);
    outline-offset: 1px;
}
.style-identity p {
    margin: 12px 0 0;
    color: var(--mute);
    font-size: 11px;
    line-height: 18px;
}
.realtime-destinations {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
}
.destination-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    padding: 18px 16px 14px;
    border: 1px solid var(--divider);
    border-radius: 8px;
    background: #0e1812;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    transition:
        border-color 160ms,
        background 160ms;
}
.destination-card:is(:hover, :focus-visible):not(:disabled),
.destination-card.is-active {
    border-color: var(--hairline-focus);
    background: #14241b;
}
.destination-card:disabled:not(.is-active) {
    opacity: 0.55;
    cursor: default;
}
.destination-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.destination-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--divider);
    border-radius: 8px;
    color: var(--body);
}
.destination-icon svg {
    width: 19px;
    height: 19px;
}
.destination-arrow {
    width: 14px;
    height: 14px;
    color: var(--mute);
}
.destination-card strong {
    font-size: 13px;
    line-height: 22px;
    font-weight: 500;
}
.destination-description {
    color: var(--mute);
    font-size: 11px;
    line-height: 18px;
}
.destination-state {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: auto;
    padding-top: 14px;
    border-top: 1px solid #ffffff0a;
    color: var(--accent-soft);
    font-size: 11px;
    line-height: 18px;
}
.destination-card:disabled:not(.is-active) .destination-state {
    color: var(--mute);
}
.capability-notice,
.result-panel {
    margin-top: 20px;
    padding: 16px;
    border: 1px solid var(--divider);
    border-radius: 8px;
    background: #050c08;
}
h3 {
    margin: 0;
    color: var(--body);
    font-size: 12px;
    line-height: 20px;
    font-weight: 500;
}
.capability-notice ul {
    max-height: 144px;
    margin: 10px 0 0;
    padding-left: 18px;
    overflow: auto;
    color: var(--mute);
    font-size: 11px;
    line-height: 20px;
    list-style: disc;
}
.result-heading {
    display: flex;
    align-items: center;
    gap: 8px;
}
.result-heading > svg {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--accent-soft);
}
.result-heading a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
    color: var(--accent-soft);
    font-size: 11px;
}
.result-heading a svg {
    width: 12px;
    height: 12px;
}
.result-heading a:focus-visible {
    text-decoration: underline;
}
.address-field {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
    padding: 3px 5px 3px 11px;
    border: 1px solid var(--divider);
    border-radius: 6px;
    background: #030805;
}
.address-field input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--body);
    font: inherit;
    font-size: 12px;
    line-height: 20px;
}
.result-panel p {
    margin: 10px 0 0;
    color: var(--mute);
    font-size: 11px;
    line-height: 20px;
    overflow-wrap: anywhere;
}
.save-wallpaper {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    padding: 9px 13px;
    border: 1px solid var(--hairline);
    border-radius: 6px;
    background: var(--marker-fill-soft);
    color: var(--accent-soft);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
}
.save-wallpaper svg {
    width: 16px;
    height: 16px;
}
.save-wallpaper:is(:hover, :focus-visible):not(:disabled) {
    background: var(--control-active);
}
.save-wallpaper:disabled {
    opacity: 0.45;
    cursor: default;
}
.task-status {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 16px 0 0;
    color: var(--body);
    font-size: 12px;
    line-height: 20px;
}
.realtime-error {
    margin: 16px 0 0;
    padding: 12px 14px;
    border: 1px solid var(--error-hairline);
    border-radius: 6px;
    background: #ffb0a808;
    color: var(--error);
    font-size: 12px;
    line-height: 20px;
    overflow-wrap: anywhere;
}
.action-spinner {
    display: inline-block;
    flex: none;
    width: 12px;
    height: 12px;
    border: 1px solid var(--hairline);
    border-top-color: var(--accent-soft);
    border-radius: 50%;
    animation: action-spin 0.9s linear infinite;
}
@keyframes action-spin {
    to {
        transform: rotate(360deg);
    }
}
@media (max-width: 640px) {
    .realtime-actions {
        max-height: calc(100dvh - 32px);
        min-height: min(480px, calc(100dvh - 32px));
    }
    .realtime-body {
        padding: 18px;
    }
    .style-summary {
        flex-direction: column;
        align-items: stretch;
        gap: 18px;
    }
    .realtime-destinations {
        grid-template-columns: minmax(0, 1fr);
    }
    .destination-card {
        gap: 10px;
    }
}
@media (prefers-reduced-motion: reduce) {
    .action-spinner {
        animation: none;
    }
    .destination-card {
        transition: none;
    }
}
</style>
