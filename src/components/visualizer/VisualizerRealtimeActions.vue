<template>
    <button type="button" :disabled="!project || locked" data-testid="realtime-style-actions" @click="open">
        实时样式
    </button>
    <dialog ref="dialog" class="realtime-actions" aria-labelledby="realtime-actions-title" @cancel.prevent="close">
        <header>
            <h2 id="realtime-actions-title">实时样式</h2>
            <button type="button" aria-label="关闭实时样式" @click="close">关闭</button>
        </header>
        <label>样式名称<input v-model="name" :disabled="busy" maxlength="100" /></label>
        <p>保存当前启用的完整画面和参数</p>
        <ul v-if="!capability?.browser" class="app-scrollbar">
            <li v-for="issue in capability?.browserIssues" :key="issue">{{ issue }}</li>
        </ul>
        <div class="realtime-action-buttons">
            <button
                type="button"
                :disabled="busy || !capability?.browser || !name.trim()"
                data-testid="apply-home-style"
                @click="save('home')">
                应用到首页
            </button>
            <button
                type="button"
                :disabled="busy || !capability?.browser || !name.trim()"
                data-testid="create-display-page"
                @click="save('page')">
                生成展示地址
            </button>
        </div>
        <p v-if="busy" role="status">正在验证并保存样式</p>
        <div v-if="address">
            <label
                >本地展示地址<input
                    :value="address"
                    readonly
                    aria-label="本地展示地址"
                    @focus="($event.target as HTMLInputElement).select()" /></label
            ><RouterLink :to="displayPath">打开展示页</RouterLink>
        </div>
        <p v-if="error" role="alert">{{ error }}</p>
    </dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import type { VisualizerProjectV5 } from '../../visualizer/compositionTypes';
import { inspectRealtimeProject } from '../../visualizer/realtimeCapabilities';
import { createRealtimeStyle } from '../../visualizer/realtimeStyle';
import { RealtimeStyleRepository } from '../../visualizer/realtimeStyleRepository';
import { validateRealtimeCandidate } from '../../visualizer/validateRealtimeCandidate';
import { useConfigstore } from '../../stores/configStore';
const props = defineProps<{ project: VisualizerProjectV5 | null; locked: boolean }>();
const router = useRouter(),
    config = useConfigstore(),
    repository = new RealtimeStyleRepository();
const dialog = ref<HTMLDialogElement | null>(null),
    name = ref('自定义样式'),
    error = ref(''),
    busy = ref(false),
    displayPath = ref('');
const address = computed(() => (displayPath.value ? new URL(displayPath.value, location.origin).href : ''));
const capability = computed(() => (props.project ? inspectRealtimeProject(props.project) : null));
let task: AbortController | null = null,
    disposed = false;
function open() {
    error.value = '';
    displayPath.value = '';
    dialog.value?.showModal();
}
function close() {
    task?.abort();
    task = null;
    busy.value = false;
    dialog.value?.close();
}
watch(
    () => (props.project ? props.project.projectId + ':' + props.project.updatedAt : ''),
    () => {
        task?.abort();
        task = null;
        busy.value = false;
        displayPath.value = '';
    },
);
async function save(target: 'home' | 'page') {
    if (!props.project || busy.value || props.locked) return;
    const owner = new AbortController();
    task?.abort();
    task = owner;
    busy.value = true;
    error.value = '';
    try {
        const style = createRealtimeStyle(props.project, name.value);
        await validateRealtimeCandidate(style, owner.signal);
        owner.signal.throwIfAborted();
        await repository.save(style);
        owner.signal.throwIfAborted();
        if (disposed || task !== owner) return;
        if (target === 'home') {
            config.homeStyleId = style.id;
            config.homeDisplayMode = 'visualizer';
            close();
            await router.push('/');
        } else displayPath.value = '/display/' + style.id;
    } catch (e) {
        if (!disposed && task === owner && !owner.signal.aborted) error.value = (e as Error).message;
    } finally {
        if (task === owner) {
            busy.value = false;
            task = null;
        }
    }
}
onBeforeUnmount(() => {
    disposed = true;
    task?.abort();
    repository.close();
});
</script>
<style scoped>
.realtime-actions {
    width: min(580px, calc(100vw - 32px));
    max-height: calc(100dvh - 48px);
    overflow-y: auto;
    padding: 24px;
    border: 1px solid #46594e;
    border-radius: 12px;
    background: #111b15;
    color: #edf5f1;
}
.realtime-actions::backdrop {
    background: #0009;
}
header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 20px;
}
h2 {
    font-size: 20px;
}
label {
    display: grid;
    gap: 8px;
    margin: 14px 0;
}
input {
    width: 100%;
    padding: 9px;
    border: 1px solid #46594e;
    border-radius: 4px;
    background: #1b2a21;
    color: inherit;
}
ul {
    max-height: 180px;
    overflow-y: auto;
    padding: 12px 20px;
    list-style: disc;
}
.realtime-action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 20px 0;
}
button,
a {
    padding: 8px;
    border: 1px solid #46594e;
    border-radius: 4px;
}
button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}
p {
    margin: 12px 0;
}
</style>
