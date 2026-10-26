<template>
    <div class="viz-panel-heading">
        <h2>元素</h2>
        <div class="flex items-center">
            <button
                class="viz-icon-button"
                type="button"
                aria-label="导出预设"
                title="导出预设"
                :disabled="locked || !project.elements.length"
                data-testid="export-visualizer-preset"
                @click="$emit('export-preset')">
                <VisualizerIcon name="export" />
            </button>
            <button
                class="viz-icon-button"
                type="button"
                aria-label="添加元素"
                title="添加元素"
                :disabled="locked"
                data-testid="add-visualizer-element"
                @click="$emit('add')">
                <VisualizerIcon name="add" />
            </button>
        </div>
    </div>
    <div class="viz-element-items app-scrollbar" role="list" aria-label="可视化元素">
        <div v-for="item in roots" :key="item.id" class="viz-root-item" :data-root-item-id="item.id">
            <VisualizerCompositionBranch
                :node="item"
                :siblings="roots.map(i => i.id)"
                :selection="selection"
                :locked="locked"
                :dragged="dragged"
                @select="$emit('select', $event)"
                @visibility="(id, value) => $emit('visibility', id, value)"
                @remove="$emit('remove', $event)"
                @reorder="(ids, parent) => $emit('reorder', ids, parent)"
                @drag="dragged = $event" />
        </div>
        <div v-if="!roots.length" class="viz-list-empty"><VisualizerIcon name="layers" /><span>尚未添加元素</span></div>
    </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
import VisualizerCompositionBranch from './VisualizerCompositionBranch.vue';
import { compositionList } from '../../visualizer/compositionList';
import type { VisualizerProjectV6 } from '../../visualizer/compositionTypes';
const props = defineProps<{ project: VisualizerProjectV6; selection: string | null; locked: boolean }>();
defineEmits<{
    add: [];
    'export-preset': [];
    select: [id: string];
    visibility: [id: string, enabled: boolean];
    remove: [id: string];
    reorder: [ids: string[], parentId?: string];
}>();
const roots = computed(() => compositionList(props.project));
const dragged = ref<{ id: string; parentId?: string } | null>(null);
</script>
