<template>
    <div class="catalog-library" :class="{ centered }" :aria-busy="loading">
        <div class="library-source">
            <span class="library-folder"
                ><VisualizerIcon :name="loading ? 'refresh' : 'folder'" :class="{ spinning: loading }"
            /></span>
            <div class="library-copy">
                <strong :title="state.folderName">{{ heading }}</strong>
                <span v-if="state.folderName"
                    >{{ state.elements.length }} 个元素<span class="library-separator">/</span
                    >{{ state.presets.length }} 个预设</span
                >
                <span v-else-if="!state.message && !loading">选择资源文件夹，浏览元素和预设</span>
            </div>
        </div>
        <p
            v-if="state.message"
            class="library-message"
            :class="{ error: state.status === 'error', warning: state.status === 'ready' }"
            :role="state.status === 'error' || state.status === 'permission' ? 'alert' : 'status'">
            {{ state.message }}
        </p>
        <span v-if="loading" class="library-loading" role="status">正在加载资源库…</span>
        <div class="library-actions">
            <button
                v-if="state.canRestore"
                type="button"
                :disabled="blocked"
                class="library-action"
                :class="{ primary: centered }"
                @click="library.recover()">
                恢复访问
            </button>
            <button
                type="button"
                :disabled="blocked"
                class="library-action"
                :class="{ primary: centered && !state.canRestore }"
                @click="library.choose()">
                <VisualizerIcon v-if="centered && !state.canRestore" name="folder" />{{
                    state.folderName || state.canRestore ? '更换文件夹' : '加载资源库'
                }}
            </button>
            <button
                v-if="state.folderName"
                type="button"
                class="library-action library-refresh"
                :disabled="blocked"
                aria-label="重新加载"
                title="重新加载"
                @click="library.reload()">
                <VisualizerIcon name="refresh" />
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
import { useResourceLibrary } from '../../visualizer/useResourceLibrary';
const props = defineProps<{ centered?: boolean; locked: boolean }>();
const { library, state } = useResourceLibrary();
const loading = computed(() => state.value.status === 'loading');
const blocked = computed(() => props.locked || loading.value);
const heading = computed(
    () =>
        state.value.folderName ||
        (loading.value
            ? '读取资源文件夹'
            : state.value.canRestore
              ? '恢复资源库访问'
              : state.value.status === 'error'
                ? '无法加载资源库'
                : '连接本地资源库'),
);
</script>

<style scoped>
.catalog-library {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 20px;
    min-width: 0;
}
.library-source {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
    flex: 1;
}
.library-folder {
    display: grid;
    place-items: center;
    flex: none;
    width: 34px;
    height: 34px;
    border: 1px solid var(--divider);
    border-radius: 8px;
    color: var(--body);
    background: #ffffff03;
}
.library-folder svg {
    width: 17px;
    height: 17px;
}
.library-copy {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}
.library-copy strong {
    overflow: hidden;
    font-size: 12px;
    line-height: 18px;
    font-weight: 500;
    color: var(--body);
    text-overflow: ellipsis;
    white-space: nowrap;
}
.library-copy > span {
    color: var(--mute);
    font-size: 10px;
    line-height: 16px;
}
.library-separator {
    margin-inline: 9px;
    opacity: 0.5;
}
.library-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
}
.library-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 34px;
    padding: 7px 11px;
    border: 1px solid var(--divider);
    border-radius: 6px;
    background: transparent;
    color: var(--body);
    font: inherit;
    font-size: 11px;
    line-height: 18px;
    cursor: pointer;
    transition:
        color 160ms,
        background 160ms;
}
.library-action:hover:not(:disabled) {
    background: #ffffff07;
    color: var(--ink);
    border-color: var(--hairline);
}
.library-action:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 3px;
}
.library-action:disabled {
    opacity: 0.4;
    cursor: default;
}
.library-action svg {
    width: 17px;
    height: 17px;
}
.library-refresh {
    width: 34px;
    padding: 7px;
}
.library-message {
    flex-basis: 100%;
    order: 1;
    margin: 0;
    color: var(--body);
    font-size: 11px;
    line-height: 18px;
    overflow-wrap: anywhere;
}
.library-message.error {
    color: var(--error);
}
.library-message.warning {
    color: var(--warning);
}
.library-loading {
    font-size: 11px;
    color: var(--mute);
}
.centered {
    flex-direction: column;
    justify-content: center;
    margin: auto;
    padding: 40px 16px;
    width: min(100%, 440px);
    gap: 20px;
    text-align: center;
}
.centered .library-source {
    flex: none;
    flex-direction: column;
    gap: 23px;
    max-width: 100%;
}
.centered .library-folder {
    width: 68px;
    height: 68px;
    border-radius: 18px;
    color: var(--accent-soft);
    background: #65ffa906;
}
.centered .library-folder svg {
    width: 29px;
    height: 29px;
}
.centered .library-copy {
    gap: 10px;
}
.centered .library-copy strong {
    font-size: 18px;
    line-height: 26px;
    color: var(--ink);
}
.centered .library-copy > span {
    font-size: 12px;
    line-height: 20px;
}
.centered .library-message {
    order: 0;
    flex-basis: auto;
}
.centered .library-action {
    min-height: 40px;
    padding: 10px 17px;
    font-size: 12px;
}
.library-action.primary {
    border-color: transparent;
    background: var(--accent-soft);
    color: var(--on-accent);
    font-weight: 600;
}
.library-action.primary:hover:not(:disabled) {
    background: var(--accent-bright);
}
.spinning {
    animation: library-spin 1.2s linear infinite;
}
@keyframes library-spin {
    to {
        transform: rotate(360deg);
    }
}
@media (prefers-reduced-motion: reduce) {
    .spinning {
        animation: none;
    }
    .library-action {
        transition: none;
    }
}
@media (max-width: 500px) {
    .catalog-library:not(.centered) {
        gap: 12px;
    }
}
</style>
