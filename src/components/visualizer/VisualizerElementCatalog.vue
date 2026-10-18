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
                <button type="button" :disabled="locked || busy || state.status === 'loading'" @click="importPackage">
                    导入资源包</button
                ><button type="button" class="viz-icon-button" aria-label="关闭元素库" @click="$emit('close')">
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
        <div v-if="state.status === 'loading'" role="status" class="viz-catalog-message">正在加载资源</div>
        <div v-if="state.status === 'error'" class="viz-catalog-message" role="alert">
            {{ state.message }}<button type="button" :disabled="busy" @click="library.load()">重试加载</button>
        </div>
        <p v-if="error" class="viz-catalog-message" role="alert">{{ error }}</p>
        <div v-if="category === 'preset'" class="viz-catalog-grid app-scrollbar">
            <button
                v-for="preset in filteredPresets"
                :key="resourceKey(preset)"
                type="button"
                class="viz-catalog-card viz-preset-card"
                :data-preset-id="preset.id"
                :disabled="locked || busy"
                @click="$emit('preset', resourceKey(preset))">
                <VisualizerPresetPreview :cinematic="preset.preview === 'cinematic'" /><span
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
                :data-element-type="descriptor.kernelId"
                :data-resource-id="descriptor.id"
                :disabled="locked || busy"
                @click="$emit('add', resourceKey(descriptor))">
                <div class="viz-catalog-preview" :class="descriptor.icon">
                    <VisualizerIcon :name="descriptor.icon" />
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
        <details v-if="state.imported.length" class="viz-imported-packages app-scrollbar">
            <summary>已导入资源包</summary>
            <div v-for="pack in state.imported" :key="pack.id + '@' + pack.version">
                <span>{{ pack.id }} · v{{ pack.version }}</span
                ><button
                    type="button"
                    :disabled="locked || busy"
                    :aria-label="'移除资源包 ' + pack.id"
                    @click="remove(pack.id, pack.version)">
                    移除
                </button>
            </div>
        </details>
    </dialog>
</template>
<script setup lang="ts">
import { computed, ref, shallowRef, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
import VisualizerPresetPreview from './VisualizerPresetPreview.vue';
import { VisualizerResourceLibrary } from '../../visualizer/resourceLibrary';
import { resourceKey } from '../../visualizer/resourceIdentity';
import { resourceFileFormat } from '../../visualizer/resourceCodec';
import { NativeVisualizerFileGateway } from '../../visualizer/fileIO';
const props = defineProps<{ open: boolean; locked: boolean }>();
const library = new VisualizerResourceLibrary(
        undefined,
        undefined,
        undefined,
        import.meta.env.BASE_URL + 'visualizer-resources/v1/',
    ),
    state = shallowRef(library.snapshot()),
    detach = library.subscribe(value => (state.value = value)),
    files = new NativeVisualizerFileGateway();
const dialog = ref<HTMLDialogElement | null>(null),
    query = ref(''),
    category = ref('all'),
    error = ref(''),
    busy = ref(false);
let fileGeneration = 0;
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
        if (!open) fileGeneration++;
        await nextTick();
        if (open && !dialog.value?.open) {
            query.value = '';
            error.value = '';
            dialog.value?.showModal();
        } else if (!open) dialog.value?.close();
    },
    { immediate: true },
);
const emit = defineEmits<{ close: []; add: [id: string]; preset: [id: string] }>();
onMounted(() => void library.load());
onBeforeUnmount(() => {
    fileGeneration++;
    detach();
    library.dispose();
});
async function importPackage() {
    if (busy.value || props.locked) return;
    const revision = ++fileGeneration;
    busy.value = true;
    error.value = '';
    try {
        const opened = await files.open(resourceFileFormat);
        if (!opened || revision !== fileGeneration || !props.open || props.locked) return;
        await library.import(opened.bytes);
    } catch (e) {
        if (revision === fileGeneration) error.value = (e as Error).message;
    } finally {
        busy.value = false;
    }
}
async function remove(id: string, version: number) {
    if (busy.value || props.locked) return;
    busy.value = true;
    error.value = '';
    try {
        await library.remove(id, version);
    } catch (e) {
        error.value = (e as Error).message;
    } finally {
        busy.value = false;
    }
}
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
.viz-imported-packages {
    max-height: 150px;
    overflow: auto;
    margin: 12px 20px;
    font-size: 12px;
    color: #aabbb0;
}
.viz-imported-packages > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
}
.viz-imported-packages button {
    color: #e1c3a2;
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
