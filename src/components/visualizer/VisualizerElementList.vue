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
    <div
        ref="list"
        class="viz-element-items app-scrollbar"
        role="list"
        aria-label="可视化元素"
        @pointerdown.capture="suppressDragClick = false"
        @click.capture="guardDragClick">
        <div v-for="item in roots" :key="item.id" class="viz-root-item" :data-root-item-id="item.id">
            <VisualizerCompositionBranch
                :node="item"
                :project="project"
                :selection="selection"
                :locked="locked"
                :dragged="dragged"
                :reveal="reveal"
                @select="$emit('select', $event)"
                @visibility="(id, value) => $emit('visibility', id, value)"
                @remove="$emit('remove', $event)"
                @move="move"
                @drag="dragged = $event" />
        </div>
        <div v-if="!roots.length" class="viz-list-empty"><VisualizerIcon name="layers" /><span>尚未添加元素</span></div>
    </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
import VisualizerCompositionBranch from './VisualizerCompositionBranch.vue';
import { compositionList } from '../../visualizer/compositionList';
import type { VisualizerProjectV6 } from '../../visualizer/compositionTypes';
import { canMoveComposition, type CompositionMove } from '../../visualizer/compositionMovement';
const props = defineProps<{ project: VisualizerProjectV6; selection: string | null; locked: boolean }>();
const emit = defineEmits<{
    add: [];
    'export-preset': [];
    select: [id: string];
    visibility: [id: string, enabled: boolean];
    remove: [id: string];
    move: [request: CompositionMove];
}>();
const roots = computed(() => compositionList(props.project));
const dragged = ref<string | null>(null);
const reveal = ref<{ id: string | null } | null>(null);
const list = ref<HTMLElement | null>(null);
let moveRevision = 0;
let suppressDragClick = false;
function guardDragClick(event: MouseEvent) {
    if (suppressDragClick && event.detail > 0) {
        suppressDragClick = false;
        event.preventDefault();
        event.stopPropagation();
    }
}
onBeforeUnmount(() => moveRevision++);
watch(
    () => [props.project.projectId, props.project.updatedAt, props.locked],
    () => {
        dragged.value = null;
    },
    { flush: 'sync' },
);
async function move(request: CompositionMove) {
    if (props.locked || !canMoveComposition(props.project, request)) return;
    const active = document.activeElement as HTMLElement | null;
    const direction =
        active?.closest('[data-composition-id]')?.getAttribute('data-composition-id') === request.id
            ? active.dataset.moveDirection
            : undefined;
    const revision = ++moveRevision,
        projectId = props.project.projectId;
    if (dragged.value) suppressDragClick = true;
    emit('move', request);
    reveal.value = { id: request.parentId };
    await nextTick();
    if (direction && revision === moveRevision && projectId === props.project.projectId && !props.locked) {
        const row = list.value?.querySelector<HTMLElement>(`[data-composition-id="${request.id}"]`);
        const button = row?.querySelector<HTMLButtonElement>(`[data-move-direction="${direction}"]`);
        (button && !button.disabled ? button : row?.querySelector<HTMLButtonElement>('.viz-element-select'))?.focus();
    }
}
</script>
