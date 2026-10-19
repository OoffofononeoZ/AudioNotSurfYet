<template>
    <dialog
        ref="dialog"
        class="viz-catalog"
        aria-labelledby="element-catalog-title"
        @cancel.prevent="$emit('close')"
        @click="backdrop">
        <header>
            <h2 id="element-catalog-title">添加元素</h2>
            <div class="viz-catalog-header-actions">
                <button type="button" class="viz-icon-button" aria-label="关闭元素库" @click="$emit('close')">
                    <VisualizerIcon name="close" />
                </button>
            </div>
        </header>
        <div class="viz-catalog-filters">
            <div role="group" aria-label="元素分类">
                <button
                    v-for="entry in categories"
                    :key="entry.id"
                    type="button"
                    :aria-pressed="category === entry.id"
                    @click="category = entry.id">
                    {{ entry.label }}
                </button>
            </div>
            <input v-model="query" type="search" aria-label="搜索元素" placeholder="搜索元素" />
        </div>
        <div class="viz-catalog-message viz-library-actions">
            <button type="button" :disabled="locked" @click="library.choose()">选择文件夹</button>
            <button v-if="state.canRestore" type="button" :disabled="locked" @click="library.recover()">
                恢复访问
            </button>
            <button
                v-if="state.folderName || state.status === 'error'"
                type="button"
                :disabled="locked"
                @click="library.reload()">
                重新加载
            </button>
            <span v-if="state.folderName"
                >{{ state.folderName }} · {{ state.elements.length }} 个元素 / {{ state.presets.length }} 个预设</span
            >
            <span v-else>请选择 WheresYourElements/assets 文件夹</span>
        </div>
        <div v-if="state.status === 'loading'" role="status" class="viz-catalog-message">正在加载资源</div>
        <div v-if="state.message" class="viz-catalog-message" role="alert">
            {{ state.message }}
        </div>

        <div v-if="category === 'preset'" class="viz-catalog-grid app-scrollbar">
            <button
                v-for="preset in filteredPresets"
                :key="resourceKey(preset)"
                type="button"
                class="viz-catalog-card viz-preset-card"
                :data-preset-id="preset.id"
                :disabled="locked"
                @click="$emit('preset', resourceKey(preset))">
                <img class="viz-preset-preview" :src="metadata(preset)?.previewUrl" alt="" /><span
                    >{{ preset.title
                    }}<small v-if="hasVersions('presets', preset.id)" class="viz-resource-version"
                        >v{{ preset.version }}</small
                    ></span
                ><small>{{ preset.description }}</small
                ><VisualizerIcon name="add" />
            </button>
            <p v-if="state.status !== 'loading' && !filteredPresets.length">没有匹配的预设</p>
        </div>
        <div v-else class="viz-catalog-grid app-scrollbar">
            <button
                v-for="descriptor in filtered"
                :key="resourceKey(descriptor)"
                type="button"
                class="viz-catalog-card"
                :data-element-type="descriptor.algorithm.id"
                :data-resource-id="descriptor.id"
                :disabled="locked"
                @click="$emit('add', resourceKey(descriptor))">
                <div class="viz-catalog-preview" :class="descriptor.icon">
                    <img :src="metadata(descriptor)?.previewUrl" alt="" />
                </div>
                <span
                    >{{ descriptor.title
                    }}<small v-if="hasVersions('elements', descriptor.id)" class="viz-resource-version"
                        >v{{ descriptor.version }}</small
                    ></span
                ><VisualizerIcon name="add" />
            </button>
            <p v-if="state.status !== 'loading' && !filtered.length">没有匹配的元素</p>
        </div>
    </dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
import { useResourceLibrary } from '../../visualizer/useResourceLibrary';
import type { ResourceRef } from '../../visualizer/resourceTypes';
import { resourceKey } from '../../visualizer/resourceIdentity';
const props = defineProps<{ open: boolean; locked: boolean }>();
const { library, state } = useResourceLibrary();
const metadata = (resource: ResourceRef) =>
    state.value.entries.find(e => resourceKey(e.info.resource) === resourceKey(resource));
const dialog = ref<HTMLDialogElement | null>(null),
    query = ref(''),
    category = ref('all');
const categories = [
    { id: 'all', label: '全部' },
    { id: 'visual', label: '视觉' },
    { id: 'modifier', label: '影响效果' },
    { id: 'transition', label: '转场' },
    { id: 'preset', label: '预设' },
];
const filtered = computed(() =>
    state.value.elements.filter(
        e => (category.value === 'all' || e.kind === category.value) && e.title.includes(query.value.trim()),
    ),
);
const filteredPresets = computed(() =>
    state.value.presets.filter(p => (p.title + p.description).includes(query.value.trim())),
);
const hasVersions = (kind: 'elements' | 'presets', id: string) => state.value[kind].filter(d => d.id === id).length > 1;
watch(
    () => props.open,
    async open => {
        await nextTick();
        if (open && !dialog.value?.open) {
            query.value = '';
            dialog.value?.showModal();
        } else if (!open) dialog.value?.close();
    },
    { immediate: true },
);
const emit = defineEmits<{ close: []; add: [id: string]; preset: [id: string] }>();
function backdrop(event: MouseEvent) {
    const element = dialog.value;
    if (!element || event.target !== element) return;
    const r = element.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)
        emit('close');
}
</script>
<style scoped>
.viz-resource-version {
    margin-left: 6px;
    color: #9ca9a2;
    font-size: 11px;
}
.viz-catalog-header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}
.viz-catalog-message {
    padding: 10px 20px;
    color: #bfcfc5;
}
.viz-catalog-message button {
    margin-left: 12px;
    text-decoration: underline;
}
.viz-library-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
}
.viz-catalog-preview img {
    width: 70px;
    height: 70px;
    opacity: 0.9;
}
.viz-preset-preview {
    width: 100%;
    height: auto;
    grid-column: 1/-1;
    border-radius: 6px;
}
.viz-preset-card {
    grid-template-columns: 1fr auto;
    gap: 8px;
    min-width: 0;
}
.viz-preset-card small {
    grid-column: 1;
    grid-row: 3;
    font-size: 11px;
    line-height: 1.5;
    color: #9ca9a2;
}
.viz-preset-card > svg:last-child {
    grid-column: 2;
    grid-row: 2/4;
}
</style>
