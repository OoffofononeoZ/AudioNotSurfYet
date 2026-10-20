<template>
    <button
        type="button"
        class="viz-catalog-card"
        :aria-label="'添加' + title + (version ? ' v' + version : '')"
        :disabled="locked"
        @click="$emit('add')">
        <span class="catalog-artwork">
            <VisualizerResourceCover :src="previewUrl" />
            <span class="catalog-kind">{{ kindLabel }}</span>
        </span>
        <span class="catalog-card-content">
            <span class="catalog-card-heading">
                <span class="catalog-card-title"
                    >{{ title }}<small v-if="version">v{{ version }}</small></span
                >
                <span class="catalog-add"><VisualizerIcon name="add" /></span>
            </span>
            <span v-if="description && description !== title" class="catalog-description">{{ description }}</span>
            <span class="catalog-card-meta">
                <span class="catalog-creator" aria-label="创建者 default"><VisualizerIcon name="user" />default</span>
                <time v-if="createdAt" :datetime="createdAt" :title="fullDate" :aria-label="'创建时间 ' + date">{{
                    date
                }}</time>
            </span>
        </span>
    </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
import VisualizerResourceCover from './VisualizerResourceCover.vue';
const props = defineProps<{
    title: string;
    description: string;
    kindLabel: string;
    previewUrl?: string;
    createdAt?: string;
    version?: number;
    locked: boolean;
}>();
defineEmits<{ add: [] }>();
const date = computed(() => {
    if (!props.createdAt) return '';
    const value = new Date(props.createdAt);
    return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, '0'),
        String(value.getDate()).padStart(2, '0'),
    ].join('-');
});
const fullDate = computed(() => (props.createdAt ? new Date(props.createdAt).toLocaleString() : ''));
</script>

<style scoped>
.viz-catalog-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--divider);
    border-radius: 10px;
    background: #0e1612;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    transition:
        border-color 160ms,
        background 160ms;
}
.viz-catalog-card:hover:not(:disabled),
.viz-catalog-card:focus-visible {
    border-color: var(--hairline-focus);
    background: #121f18;
}
.viz-catalog-card:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 3px;
}
.viz-catalog-card:disabled {
    opacity: 0.45;
    cursor: default;
}
.catalog-artwork {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-bottom: 1px solid var(--divider);
    background: #050a07;
}
.catalog-kind {
    position: absolute;
    bottom: 10px;
    left: 12px;
    max-width: calc(100% - 24px);
    padding: 3px 7px;
    overflow: hidden;
    border: 1px solid #ffffff14;
    border-radius: 4px;
    background: #050b08d9;
    color: #c4d4cb;
    font-size: 10px;
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
    backdrop-filter: blur(8px);
}
.catalog-card-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    gap: 10px;
    padding: 14px 16px;
}
.catalog-card-heading {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}
.catalog-card-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 14px;
    line-height: 22px;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.catalog-card-title small {
    margin-left: 7px;
    color: var(--mute);
    font-size: 11px;
}
.catalog-add {
    display: grid;
    place-items: center;
    flex: none;
    width: 27px;
    height: 27px;
    border: 1px solid var(--divider);
    border-radius: 6px;
    color: var(--body);
    transition:
        background 160ms,
        color 160ms;
}
.catalog-add svg {
    width: 15px;
    height: 15px;
}
.viz-catalog-card:hover:not(:disabled) .catalog-add,
.viz-catalog-card:focus-visible .catalog-add {
    color: var(--accent-soft);
    background: var(--marker-fill-soft);
    border-color: var(--hairline);
}
.catalog-description {
    display: -webkit-box;
    overflow: hidden;
    color: var(--mute);
    font-size: 12px;
    line-height: 18px;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}
.catalog-card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: auto;
    padding-top: 11px;
    border-top: 1px solid #ffffff09;
    color: var(--mute);
    font-size: 11px;
    line-height: 18px;
}
.catalog-creator {
    display: flex;
    align-items: center;
    gap: 6px;
}
.catalog-creator svg {
    width: 12px;
    height: 12px;
    opacity: 0.7;
}
time {
    font-variant-numeric: tabular-nums;
}
@media (prefers-reduced-motion: reduce) {
    .viz-catalog-card,
    .catalog-add {
        transition: none;
    }
}
</style>
