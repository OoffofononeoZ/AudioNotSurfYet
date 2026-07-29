<template>
    <div class="list-container p-2 w-[516px]">
        <div style="color: white;" class="flex pl-4 pr-4 justify-between items-center mt-2">
            <div>
                <span class="text-xl mr-2">播放列表</span>
                <span data-testid="queue-count">{{ info.length }}</span>
                <p v-if="persistence.message" class="text-xs text-amber-300 mt-1 max-w-80"
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
                <svg class="w-4 h-4 cursor-pointer" data-testid="clear-queue" @click="emit('clear')">
                    <use href="/icons.svg#trashbin-delete"></use>
                </svg>
                <svg class="w-4 h-4 cursor-pointer" @click="emit('close-list')">
                    <use href="/icons.svg#xmark-delete"></use>
                </svg>
            </div>
        </div>
        <AnimatedList :items="key" :slot-data="info" @item-selected="(_, index) => emit('select-index', index)"
            class-name="max-h-full h-full" v-if="info.length > 0">
            <template v-for="value in key" :key="value" #[value]="{ index, data }">
                <div class="flex items-center justify-between item-container" data-testid="queue-item"
                    style="color: white;"
                    :data-track-id="data?.id"
                    @mouseenter="mouseEnteredIndex = index" @mouseleave="mouseEnteredIndex = null">
                    <div class="flex items-center gap-2">
                        <div class="w-16 h-16 rounded-md overflow-hidden">
                            <img :src="data?.albumCover" alt="cover">
                        </div>
                        <div class="max-w-72 text-sm">
                            <p class="truncate">{{ data?.fileName }}</p>
                            <p class="truncate">{{ data?.title }}</p>
                            <p class="truncate">{{ data?.artist }}</p>
                            <p v-if="data?.restoreState !== 'available'"
                                class="truncate text-xs text-amber-300" data-testid="track-restore-state"
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
                            <p>{{ data?.duration }}</p>
                        </div>
                        <div class="flex items-center gap-4 mr-2"
                            v-show="mouseEnteredIndex === index && !needsRecovery(data?.restoreState)">
                            <svg class="w-6 h-6 cursor-pointer" @click="emit('add-to-analysis', index)">
                                <use href="/icons.svg#add-music"></use>
                            </svg>
                            <svg class="w-6 h-6 cursor-pointer" data-testid="delete-track"
                                @click="emit('delete', index)">
                                <use href="/icons.svg#xmark-delete"></use>
                            </svg>
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
    'add-to-analysis': [index: number];
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
    height: 100%;
    max-height: 100%;
    overflow-y: hidden;
    background-color: #181818;
    border-radius: 10px 0 0 10px;
}
</style>
