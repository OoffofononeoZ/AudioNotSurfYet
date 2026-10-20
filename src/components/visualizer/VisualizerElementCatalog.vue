<template>
    <dialog
        ref="dialog"
        class="viz-catalog"
        aria-labelledby="element-catalog-title"
        @cancel.prevent="$emit('close')"
        @click="backdrop">
        <header class="catalog-heading">
            <h2 id="element-catalog-title">资源商城</h2>
            <button
                type="button"
                class="viz-icon-button"
                aria-label="关闭资源商城"
                title="关闭"
                @click="$emit('close')">
                <VisualizerIcon name="close" />
            </button>
        </header>
        <div class="catalog-toolbar">
            <div class="catalog-tabs" role="group" aria-label="资源类型">
                <button
                    v-for="entry in tabs"
                    :key="entry.id"
                    type="button"
                    :aria-pressed="tab === entry.id"
                    @click="tab = entry.id">
                    {{ entry.label }}
                </button>
            </div>
            <label class="catalog-search"
                ><VisualizerIcon name="search" /><input
                    v-model="query"
                    type="search"
                    aria-label="搜索资源"
                    placeholder="搜索名称或描述"
            /></label>
        </div>
        <div class="catalog-filters">
            <div v-if="tab === 'element'" class="catalog-categories" role="group" aria-label="元素分类">
                <button
                    v-for="entry in categories"
                    :key="entry.id"
                    type="button"
                    :aria-pressed="category === entry.id"
                    @click="category = entry.id">
                    {{ entry.label }}
                </button>
            </div>
            <AppSelect v-else v-model="capabilityFilter" label="预设用途" :options="capabilityOptions" />
            <span class="catalog-result-count" aria-live="polite"
                >{{ cards.length }} 个{{ tab === 'preset' ? '预设' : '元素' }}</span
            >
        </div>
        <div
            ref="results"
            class="catalog-body app-scrollbar"
            role="region"
            aria-label="资源列表"
            :aria-busy="state.status === 'loading'">
            <VisualizerLibraryStatus v-if="!state.entries.length" centered :locked="locked" />
            <div v-else-if="cards.length" class="viz-catalog-grid">
                <VisualizerCatalogCard
                    v-for="card in cards"
                    :key="card.key"
                    :title="card.title"
                    :description="card.description"
                    :kind-label="card.kindLabel"
                    :preview-url="card.previewUrl"
                    :created-at="card.createdAt"
                    :version="card.version"
                    :locked="locked"
                    :data-resource-id="card.preset ? undefined : card.id"
                    :data-preset-id="card.preset ? card.id : undefined"
                    :data-element-type="card.algorithmId"
                    @add="add(card)" />
            </div>
            <div v-else class="catalog-no-results" role="status">
                <VisualizerIcon name="search" />
                <p>没有匹配的{{ tab === 'preset' ? '预设' : '元素' }}</p>
                <button
                    v-if="query || category !== 'all' || capabilityFilter !== 'all'"
                    type="button"
                    @click="clearFilters">
                    清除筛选
                </button>
            </div>
        </div>
        <footer class="catalog-footer">
            <VisualizerLibraryStatus v-if="state.entries.length" :locked="locked" />
            <span v-else class="catalog-folder-hint"
                ><VisualizerIcon name="folder" />资源文件夹需包含 elements 与 presets</span
            >
        </footer>
    </dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import AppSelect from '../controls/AppSelect.vue';
import VisualizerIcon from './VisualizerIcon.vue';
import VisualizerCatalogCard from './VisualizerCatalogCard.vue';
import VisualizerLibraryStatus from './VisualizerLibraryStatus.vue';
import { useResourceLibrary } from '../../visualizer/useResourceLibrary';
import type { ResourceRef, PresetDefinition } from '../../visualizer/resourceTypes';
import { inspectRealtimePreset } from '../../visualizer/realtimeCapabilities';
import { resourceKey } from '../../visualizer/resourceIdentity';
const props = defineProps<{ open: boolean; locked: boolean }>();
const emit = defineEmits<{ close: []; add: [id: string]; preset: [id: string] }>();
const { state } = useResourceLibrary();
const metadata = computed(() => new Map(state.value.entries.map(entry => [resourceKey(entry.info.resource), entry])));
const dialog = ref<HTMLDialogElement | null>(null),
    results = ref<HTMLElement | null>(null);
const query = ref(''),
    tab = ref('element'),
    category = ref('all'),
    capabilityFilter = ref<string | number>('all');
const tabs = [
    { id: 'element', label: '元素' },
    { id: 'preset', label: '预设' },
];
const categories = [
    { id: 'all', label: '全部' },
    { id: 'visual', label: '视觉' },
    { id: 'modifier', label: '影响效果' },
    { id: 'transition', label: '转场' },
];
const capabilityOptions = [
    { value: 'all', label: '全部用途' },
    { value: 'browser', label: '实时可用' },
    { value: 'wallpaper', label: '壁纸可用' },
    { value: 'song', label: '歌曲专用' },
];
const capabilities = computed(() => new Map(state.value.presets.map(p => [resourceKey(p), inspectRealtimePreset(p)])));
function capabilityLabel(preset: PresetDefinition) {
    const c = capabilities.value.get(resourceKey(preset))!;
    return c.wallpaper ? '实时 / 壁纸可用' : c.browser ? '实时可用' : '歌曲专用';
}
function matches(resource: ResourceRef & { title: string }) {
    const info = metadata.value.get(resourceKey(resource))?.info;
    return (resource.title + ' ' + (info?.description ?? ''))
        .toLocaleLowerCase()
        .includes(query.value.trim().toLocaleLowerCase());
}
function makeCard(resource: ResourceRef & { title: string }, kindLabel: string, preset = false, algorithmId?: string) {
    const entry = metadata.value.get(resourceKey(resource));
    const hasVersions =
        state.value[preset ? 'presets' : 'elements'].filter(value => value.id === resource.id).length > 1;
    return {
        key: resourceKey(resource),
        id: resource.id,
        title: resource.title,
        description: entry?.info.description ?? '',
        kindLabel,
        previewUrl: entry?.previewUrl,
        createdAt: entry?.info.createdAt,
        version: hasVersions ? resource.version : undefined,
        preset,
        algorithmId,
    };
}
const cards = computed(() =>
    tab.value === 'preset'
        ? state.value.presets
              .filter(p => {
                  const c = capabilities.value.get(resourceKey(p))!;
                  return (
                      matches(p) &&
                      (capabilityFilter.value === 'all' ||
                          (capabilityFilter.value === 'song'
                              ? !c.browser
                              : c[capabilityFilter.value as 'browser' | 'wallpaper']))
                  );
              })
              .map(p => makeCard(p, capabilityLabel(p), true))
        : state.value.elements
              .filter(e => (category.value === 'all' || e.kind === category.value) && matches(e))
              .map(e => makeCard(e, categories.find(c => c.id === e.kind)!.label, false, e.algorithm.id)),
);
function clearFilters() {
    query.value = '';
    category.value = 'all';
    capabilityFilter.value = 'all';
}
function add(card: ReturnType<typeof makeCard>) {
    if (props.locked) return;
    if (card.preset) emit('preset', card.key);
    else emit('add', card.key);
}
watch(tab, clearFilters);
watch([tab, category, query, capabilityFilter], () => {
    if (results.value) results.value.scrollTop = 0;
});
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
function backdrop(event: MouseEvent) {
    const element = dialog.value;
    if (!element || event.target !== element) return;
    const r = element.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)
        emit('close');
}
</script>

<style scoped>
.viz-catalog {
    width: min(1080px, calc(100vw - 48px));
    height: min(76dvh, 800px);
    min-height: min(620px, calc(100dvh - 64px));
    max-height: calc(100dvh - 64px);
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--divider);
    border-radius: 14px;
    background: #0b120e;
    color: var(--ink);
    box-shadow: 0 32px 120px #000a;
}
.viz-catalog[open] {
    display: flex;
    flex-direction: column;
}
.viz-catalog::backdrop {
    background: #000a;
    backdrop-filter: blur(8px);
}
.catalog-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: none;
    padding: 22px 24px 18px 28px;
}
.catalog-heading h2 {
    margin: 0;
    font-size: 20px;
    line-height: 28px;
    font-weight: 500;
    letter-spacing: -0.4px;
}
.catalog-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: none;
    gap: 24px;
    padding: 0 28px 18px;
}
.catalog-tabs {
    display: flex;
    align-items: center;
    padding: 3px;
    gap: 3px;
    border: 1px solid var(--divider);
    border-radius: 8px;
    background: #050b08;
}
.catalog-tabs button {
    min-width: 80px;
    padding: 7px 16px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--mute);
    font-size: 12px;
    line-height: 20px;
    cursor: pointer;
}
.catalog-tabs button[aria-pressed='true'] {
    background: #1a2a20;
    color: var(--ink);
    box-shadow: 0 1px 4px #0003;
}
.catalog-search {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 280px;
    min-width: 0;
    padding: 9px 12px;
    border: 1px solid var(--divider);
    border-radius: 7px;
    background: #060c09;
}
.catalog-search:focus-within {
    border-color: var(--hairline-focus);
}
.catalog-search svg {
    width: 16px;
    height: 16px;
    flex: none;
    color: var(--mute);
}
.catalog-search input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    line-height: 20px;
}
.catalog-search input::placeholder {
    color: var(--mute);
    opacity: 0.65;
}
.catalog-filters {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    min-height: 54px;
    flex: none;
    padding: 10px 28px;
    border-block: 1px solid var(--divider);
    background: #ffffff02;
    font-size: 12px;
}
.catalog-categories {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
}
.catalog-categories button {
    padding: 5px 11px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    color: var(--mute);
    font-size: 11px;
    line-height: 20px;
    cursor: pointer;
}
.catalog-categories button[aria-pressed='true'] {
    border-color: var(--hairline-soft);
    background: var(--marker-fill-soft);
    color: var(--accent-soft);
}
.catalog-categories button:hover,
.catalog-tabs button:hover {
    color: var(--ink);
}
.catalog-result-count {
    flex: none;
    color: var(--mute);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
}
.catalog-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 24px 28px;
    overflow: auto;
    overscroll-behavior: contain;
    container-type: inline-size;
}
.viz-catalog-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: start;
    gap: 20px;
}
.catalog-no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 16px;
    padding: 24px;
    text-align: center;
}
.catalog-no-results svg {
    width: 32px;
    height: 32px;
    color: var(--mute);
    opacity: 0.5;
}
.catalog-no-results p {
    margin: 0;
    color: var(--body);
    font-size: 13px;
}
.catalog-no-results button {
    border: 0;
    border-bottom: 1px solid var(--hairline);
    padding: 3px 0;
    background: transparent;
    color: var(--accent-soft);
    font-size: 11px;
    cursor: pointer;
}
.catalog-footer {
    flex: none;
    padding: 14px 28px;
    border-top: 1px solid var(--divider);
    background: #080f0b;
}
.catalog-folder-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 34px;
    color: var(--mute);
    font-size: 10px;
}
.catalog-folder-hint svg {
    width: 14px;
    height: 14px;
    opacity: 0.65;
}
.viz-catalog :is(button, select):focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 3px;
}
.catalog-search input:focus-visible {
    outline: none;
}
@container (max-width: 899px) {
    .viz-catalog-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
@container (max-width: 579px) {
    .viz-catalog-grid {
        grid-template-columns: minmax(0, 1fr);
    }
}
@media (max-width: 600px) {
    .viz-catalog {
        width: calc(100vw - 24px);
        min-height: min(620px, calc(100dvh - 32px));
        max-height: calc(100dvh - 32px);
        border-radius: 10px;
    }
    .catalog-heading {
        padding: 18px 16px 14px;
    }
    .catalog-heading h2 {
        font-size: 18px;
    }
    .catalog-toolbar {
        flex-wrap: wrap;
        gap: 12px;
        padding: 0 16px 16px;
    }
    .catalog-search {
        width: 100%;
    }
    .catalog-filters {
        gap: 8px;
        padding: 10px 16px;
    }
    .catalog-categories {
        gap: 2px;
    }
    .catalog-categories button {
        padding-inline: 7px;
    }
    .catalog-result-count {
        font-size: 10px;
    }
    .catalog-body {
        padding: 18px 16px;
    }
    .catalog-footer {
        padding: 12px 16px;
    }
    .catalog-folder-hint {
        font-size: 9px;
    }
}
</style>
