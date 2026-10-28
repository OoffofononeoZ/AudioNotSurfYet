<template>
    <dialog
        ref="dialog"
        class="preset-export app-scrollbar"
        aria-labelledby="preset-export-title"
        @cancel.prevent="close">
        <header class="flex items-center justify-between gap-4">
            <h2 id="preset-export-title">导出预设</h2>
            <button type="button" aria-label="关闭导出预设" @click="close">关闭</button>
        </header>
        <form @submit.prevent="save">
            <label>预设名称<input v-model="title" required maxlength="100" :disabled="busy" /></label>
            <label>预设说明<textarea v-model="description" rows="3" :disabled="busy" /></label>
            <label>作者<input v-model="creator" :disabled="busy" /></label>
            <div class="cover-field">
                <img v-if="coverUrl" :src="coverUrl" alt="预设封面预览" />
                <label
                    >更换封面<input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        :disabled="busy || preparing"
                        @change="selectCover"
                /></label>
            </div>
            <p v-if="preparing" role="status">正在验证预设并截取封面…</p>
            <ul v-if="issues.length" class="app-scrollbar" role="alert">
                <li v-for="issue in issues" :key="issue">{{ issue }}</li>
            </ul>
            <p>目标资源库：{{ state.folderName || '尚未加载，请先在资源商城加载资源库' }}</p>
            <p v-if="error" role="alert">{{ error }}</p>
            <p v-if="message" role="status">{{ message }}</p>
            <button
                type="submit"
                data-testid="save-visualizer-preset"
                :disabled="
                    busy ||
                    preparing ||
                    coverLoading ||
                    !verified ||
                    !title.trim() ||
                    !cover ||
                    state.status !== 'ready' ||
                    locked
                ">
                {{ busy ? '正在保存…' : '导出到资源库' }}
            </button>
        </form>
    </dialog>
</template>
<script setup lang="ts">
import { ref, shallowRef, watch, onBeforeUnmount, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import type { VisualizerProjectV6 } from '../../visualizer/compositionTypes';
import { inspectRealtimeProject } from '../../visualizer/realtimeCapabilities';
import { createRealtimeStyle } from '../../visualizer/realtimeStyle';
import { validateRealtimeCandidate } from '../../visualizer/validateRealtimeCandidate';
import { createPresetExportValidationProject, preparePresetExport } from '../../visualizer/presetExport';
import { savePresetDirectory, PresetDirectoryCleanupError } from '../../visualizer/presetDirectoryWriter';
import { useResourceLibrary } from '../../visualizer/useResourceLibrary';
const props = defineProps<{
    open: boolean;
    project: VisualizerProjectV6 | null;
    locked: boolean;
    captureCover(signal: AbortSignal): Promise<Blob>;
}>();
const emit = defineEmits<{ close: [] }>();
const { library, state } = useResourceLibrary();
const dialog = ref<HTMLDialogElement | null>(null),
    source = shallowRef<VisualizerProjectV6 | null>(null);
const title = ref('自定义预设'),
    description = ref(''),
    creator = ref('default');
const cover = shallowRef<Blob | null>(null),
    coverUrl = ref('');
const error = ref(''),
    message = ref(''),
    issues = ref<string[]>([]);
const preparing = ref(false),
    coverLoading = ref(false),
    busy = ref(false),
    verified = ref(false);
let task: AbortController | null = null,
    coverTask: AbortController | null = null;
function cancel() {
    task?.abort();
    task = null;
    coverTask?.abort();
    coverTask = null;
    if (coverUrl.value) URL.revokeObjectURL(coverUrl.value);
    coverUrl.value = '';
    cover.value = null;
    busy.value = false;
    coverLoading.value = false;
    preparing.value = false;
    verified.value = false;
}
function close() {
    cancel();
    dialog.value?.close();
    emit('close');
}
function setCover(blob: Blob) {
    const url = URL.createObjectURL(blob);
    if (coverUrl.value) URL.revokeObjectURL(coverUrl.value);
    cover.value = blob;
    coverUrl.value = url;
}
watch(
    () => props.open,
    async open => {
        cancel();
        if (!open) {
            dialog.value?.close();
            return;
        }
        await nextTick();
        if (!props.open) return;
        dialog.value?.showModal();
        title.value = '自定义预设';
        description.value = '';
        creator.value = 'default';
        error.value = '';
        message.value = '';
        issues.value = [];
        if (!props.project || props.locked) return;
        source.value = structuredClone(props.project);
        const validationProject = createPresetExportValidationProject(source.value);
        const capability = inspectRealtimeProject(validationProject);
        issues.value = capability.browserIssues;
        if (!capability.browser) return;
        const owner = new AbortController();
        task = owner;
        preparing.value = true;
        try {
            const style = createRealtimeStyle(validationProject, title.value);
            const [blob] = await Promise.all([
                props.captureCover(owner.signal),
                validateRealtimeCandidate(style, owner.signal),
            ]);
            owner.signal.throwIfAborted();
            if (task !== owner) return;
            setCover(blob);
            verified.value = true;
        } catch (e) {
            if (task === owner && !owner.signal.aborted) {
                error.value = (e as Error).message;
                owner.abort();
            }
        } finally {
            if (task === owner) {
                task = null;
                preparing.value = false;
            }
        }
    },
);
watch(
    () => `${props.project?.projectId}:${props.project?.updatedAt}:${props.locked}`,
    () => {
        if (props.open) close();
    },
);
onBeforeUnmount(cancel);
async function selectCover(event: Event) {
    const input = event.target as HTMLInputElement,
        file = input.files?.[0];
    input.value = '';
    if (!file) return;
    coverTask?.abort();
    const owner = new AbortController();
    coverTask = owner;
    coverLoading.value = true;
    error.value = '';
    try {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
            throw Error('封面仅支持 PNG、JPEG 或 WebP。');
        const bitmap = await createImageBitmap(file);
        bitmap.close();
        owner.signal.throwIfAborted();
        if (coverTask === owner) setCover(file);
    } catch (e) {
        if (coverTask === owner && !owner.signal.aborted) error.value = '封面读取失败：' + (e as Error).message;
    } finally {
        if (coverTask === owner) {
            coverTask = null;
            coverLoading.value = false;
        }
    }
}
async function save() {
    if (
        !source.value ||
        !cover.value ||
        busy.value ||
        preparing.value ||
        coverLoading.value ||
        !verified.value ||
        props.locked
    )
        return;
    const owner = new AbortController();
    task = owner;
    busy.value = true;
    error.value = '';
    message.value = '';
    try {
        const prepared = preparePresetExport(
            source.value,
            { title: title.value, description: description.value, creator: creator.value },
            cover.value,
        );
        const directory = library.exportDirectory();
        const path = await savePresetDirectory(directory, prepared, owner.signal);
        if (task === owner && !owner.signal.aborted)
            message.value = `已保存到 ${directory.name}/${path}。请刷新资源商城后添加。`;
    } catch (e) {
        if (e instanceof PresetDirectoryCleanupError) ElMessage.error(e.message);
        if (task === owner && !owner.signal.aborted) error.value = (e as Error).message;
    } finally {
        if (task === owner) {
            task = null;
            busy.value = false;
        }
    }
}
</script>
<style scoped>
.preset-export {
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100dvh - 40px);
    overflow-y: auto;
    padding: 24px;
    border: 1px solid var(--divider);
    border-radius: 12px;
    background: var(--surface-1);
    color: var(--ink);
}
.preset-export::backdrop {
    background: #0009;
}
h2 {
    font-size: 18px;
}
label {
    display: grid;
    gap: 6px;
    margin: 14px 0;
    font-size: 12px;
}
input,
textarea {
    min-width: 0;
    padding: 8px;
    border: 1px solid var(--divider);
    border-radius: 4px;
    background: var(--canvas);
    color: inherit;
}
textarea {
    resize: vertical;
}
button {
    padding: 7px 10px;
    border: 1px solid var(--divider);
    border-radius: 4px;
}
button:disabled {
    opacity: 0.45;
    cursor: default;
}
.cover-field {
    display: flex;
    align-items: center;
    gap: 16px;
}
.cover-field img {
    width: 160px;
    aspect-ratio: 16/9;
    object-fit: cover;
    border-radius: 4px;
}
.cover-field label {
    min-width: 0;
}
ul {
    max-height: 140px;
    overflow-y: auto;
    padding-left: 20px;
    list-style: disc;
}
p,
ul {
    margin: 12px 0;
    font-size: 12px;
    white-space: pre-wrap;
}
[role='alert'] {
    color: var(--error);
}
</style>
