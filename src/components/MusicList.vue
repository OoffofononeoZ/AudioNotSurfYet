<template>
    <div class="list-container p-2">
        <div class="flex pl-4 pr-4 justify-between items-center mt-2 list-header">
            <div>
                <span class="text-xl mr-2">播放列表</span>
                <span data-testid="queue-count">{{ info.length }}</span>
            <p v-if="persistence.message" class="text-xs mt-1 max-w-80 persistence-note"
                data-testid="persistence-message" :data-persistence-state="persistence.state">
                    {{ persistence.message }}
                    <button v-if="canClearPersisted" type="button"
                        class="ml-2 underline focus-visible:outline focus-visible:outline-2"
                        data-testid="clear-persisted-session" @click="emit('clear-persisted')">
                        清除旧会话
                    </button>
                </p>
            </div>
            <div class="flex items-center gap-2 mr-2">
                <button type="button" class="icon-button" data-testid="clear-queue" aria-label="清空播放列表"
                    @click="emit('clear')">
                    <svg class="w-4 h-4" aria-hidden="true">
                        <use href="/icons.svg#trashbin-delete"></use>
                    </svg>
                </button>
                <button type="button" class="icon-button" aria-label="关闭播放列表" @click="emit('close-list')">
                    <svg class="w-4 h-4" aria-hidden="true">
                        <use href="/icons.svg#xmark-delete"></use>
                    </svg>
                </button>
            </div>
        </div>
        <AnimatedList :items="key" :slot-data="info" @item-selected="(_, index) => emit('select-index', index)"
            class-name="max-h-full h-full" v-if="info.length > 0">
            <template v-for="value in key" :key="value" #[value]="{ index, data }">
                <div class="flex items-center justify-between item-container" data-testid="queue-item"
                    role="button" tabindex="0" :aria-label="`播放 ${data?.title}`"
                    :data-track-id="data?.id"
                    @mouseenter="mouseEnteredIndex = index" @mouseleave="mouseEnteredIndex = null"
                    @focusin="mouseEnteredIndex = index"
                    @keydown.enter.prevent="emit('select-index', index)"
                    @keydown.space.prevent="emit('select-index', index)">
                    <div class="flex items-center gap-2">
                        <div class="w-16 h-16 rounded-md overflow-hidden">
                            <img :src="data?.albumCover" alt="cover">
                        </div>
                        <div class="max-w-72 text-sm">
                            <p class="truncate list-title">{{ data?.fileName }}</p>
                            <p class="truncate list-subtitle">{{ data?.title }}</p>
                            <p class="truncate list-meta">{{ data?.artist }}</p>
                            <p v-if="data?.restoreState !== 'available'"
                                class="truncate text-xs restore-state" data-testid="track-restore-state"
                                :data-restore-state="data?.restoreState">
                                {{ restoreStateLabel(data?.restoreState) }}
                            </p>
                        </div>
                    </div>
                    <div @click.stop>
                        <div v-if="needsAccess(data?.restoreState)" class="mr-2">
                            <button type="button" class="text-xs underline focus-visible:outline focus-visible:outline-2"
                                data-testid="restore-access" @click="emit('restore-access', index)">
                                恢复访问
                            </button>
                        </div>
                        <div v-else-if="needsReselect(data?.restoreState)" class="mr-2">
                            <button type="button" class="text-xs underline focus-visible:outline focus-visible:outline-2"
                                data-testid="reselect-track" @click="emit('reselect-track', index)">
                                重新选择
                            </button>
                        </div>
                        <div v-else class="text-sm mr-2" v-show="mouseEnteredIndex !== index">
                            <p class="list-duration">{{ data?.duration }}</p>
                        </div>
                        <div class="flex items-center gap-4 mr-2"
                            v-show="mouseEnteredIndex === index && !needsRecovery(data?.restoreState)">
                            <el-tooltip content="去编辑" placement="top">
                                <button type="button" class="icon-button" data-testid="edit-track"
                                    :aria-label="`去编辑 ${data?.title}`" @click="emit('edit-track', index)">
                                    <svg class="w-6 h-6" aria-hidden="true">
                                        <use href="/icons.svg#add-music"></use>
                                    </svg>
                                </button>
                            </el-tooltip>
                            <button type="button" class="icon-button" data-testid="delete-track"
                                :aria-label="`从播放列表删除 ${data?.title}`" @click="emit('delete', index)">
                                <svg class="w-6 h-6" aria-hidden="true">
                                    <use href="/icons.svg#xmark-delete"></use>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </template>
        </AnimatedList>
    </div>
</template>

<script setup lang="ts">
import AnimatedList from './AnimatedList.vue';
import { computed, ref } from 'vue';
import { ElTooltip } from 'element-plus';
import type {
    RestoreState,
    SessionPersistenceSnapshot,
} from '../types/audio';
const props = defineProps<{
    info: {
        id: string;
        albumCover: string;
        fileName: string;
        title: string;
        artist: string;
        duration: string;
        restoreState: RestoreState;
    }[];
    persistence: SessionPersistenceSnapshot;
}>();
const emit = defineEmits<{
    'select-index': [index: number];
    'edit-track': [index: number];
    delete: [index: number];
    clear: [];
    'restore-access': [index: number];
    'reselect-track': [index: number];
    'clear-persisted': [];
    'close-list': [];
}>();
const key = computed(() => props.info.map(item => item.id));
const mouseEnteredIndex = ref<number | null>(null);
const canClearPersisted = computed(() =>
    ['unsupported-schema', 'restore-error'].includes(
        props.persistence.state,
    ),
);

const restoreStateLabels: Record<RestoreState, string> = {
    available: '',
    'permission-required': '需要授权后才能恢复',
    'permission-denied': '文件访问已被拒绝',
    'file-missing': '原文件已移动或不可用',
    'content-changed': '文件内容已变化',
    'not-persisted': '本次会话无法跨刷新保存',
    'decode-error': '音频无法解码',
};

const restoreStateLabel = (state?: RestoreState) =>
    state ? restoreStateLabels[state] : '';
const needsAccess = (state?: RestoreState) =>
    state === 'permission-required' || state === 'permission-denied';
const needsReselect = (state?: RestoreState) =>
    state === 'file-missing' || state === 'content-changed';
const needsRecovery = (state?: RestoreState) =>
    needsAccess(state) || needsReselect(state);
</script>

<style scoped>
.list-container {
    width: 100%;
    height: 100%;
    max-height: 100%;
    overflow-y: hidden;
    background-color: var(--surface-panel);
    border-radius: 10px 0 0 10px;
}

.item-container > div:first-child { min-width: 0; flex: 1; }
.item-container > div:first-child > div:first-child { flex: none; }
.item-container > div:first-child > div:last-child { min-width: 0; }
.item-container > div:last-child { flex: none; }

.list-header,
.item-container,
.list-title {
    color: var(--ink-strong);
}

.list-subtitle {
    color: var(--ink);
}

.list-meta {
    color: var(--body);
}

.list-duration {
    color: var(--mute);
}

.persistence-note,
.restore-state {
    color: var(--warning);
}

.item-container:focus-visible,
.icon-button:focus-visible {
    border-radius: var(--radius-sm);
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}

.icon-button {
    align-items: center;
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    display: inline-flex;
    justify-content: center;
    padding: 2px;
}
</style>
