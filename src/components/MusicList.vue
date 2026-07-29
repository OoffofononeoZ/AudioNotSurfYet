<template>
    <div class="list-container p-2 w-[516px]">
        <div style="color: white;" class="flex pl-4 pr-4 justify-between items-center mt-2">
            <div>
                <span class="text-xl mr-2">播放列表</span>
                <span data-testid="queue-count">{{ info.length }}</span>
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
                        </div>
                    </div>
                    <div @click.stop>
                        <div class="text-sm mr-2" v-show="mouseEnteredIndex !== index">
                            <p>{{ data?.duration }}</p>
                        </div>
                        <div class="flex items-center gap-4 mr-2" v-show="mouseEnteredIndex === index">
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
const props = defineProps<{
    info: {
        id: string;
        albumCover: string;
        fileName: string;
        title: string;
        artist: string;
        duration: string;
    }[];
}>();
const emit = defineEmits<{
    'select-index': [index: number];
    'add-to-analysis': [index: number];
    delete: [index: number];
    clear: [];
    'close-list': [];
}>();
const key = computed(() => props.info.map(item => item.id));
const mouseEnteredIndex = ref<number | null>(null);
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
