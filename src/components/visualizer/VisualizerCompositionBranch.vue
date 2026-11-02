<template>
    <VisualizerCompositionRow
        :id="node.id"
        :name="node.name"
        :kind="node.kind"
        icon="layers"
        :preview="preview"
        :enabled="node.enabled"
        :selected="selection === node.id"
        :locked="locked"
        :nested="!!parentId"
        :first="!up"
        :last="!down"
        :up-title="compositionMoveTitle(project, up, -1)"
        :down-title="compositionMoveTitle(project, down, 1)"
        :drop-position="dropPosition"
        :expanded="expanded"
        @select="$emit('select', node.id)"
        @visibility="$emit('visibility', node.id, $event)"
        @remove="$emit('remove', node.id)"
        @expand="expanded = !expanded"
        @move="move($event)"
        @drag="$emit('drag', node.id)"
        @dragend="$emit('drag', null)"
        @drag-over="dragOver"
        @drag-leave="dragLeave"
        @drop="drop" />
    <div
        v-if="node.children.length && expanded"
        class="viz-preset-children"
        role="list"
        :aria-label="node.name + '内部元素'">
        <VisualizerCompositionBranch
            v-for="child in node.children"
            :key="child.id"
            :node="child"
            :project="project"
            :parent-id="node.id"
            :selection="selection"
            :locked="locked"
            :dragged="dragged"
            :reveal="reveal"
            @select="$emit('select', $event)"
            @visibility="(id, value) => $emit('visibility', id, value)"
            @remove="$emit('remove', $event)"
            @move="$emit('move', $event)"
            @drag="$emit('drag', $event)" />
    </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import VisualizerCompositionRow from './VisualizerCompositionRow.vue';
import { useResourceLibrary } from '../../visualizer/useResourceLibrary';
import { resourceKey } from '../../visualizer/resourceIdentity';
import type { CompositionListNode } from '../../visualizer/compositionList';
import type { VisualizerProjectV6 } from '../../visualizer/compositionTypes';
import {
    compositionStepMove,
    compositionDropMove,
    compositionMoveTitle,
    type CompositionMove,
    type CompositionDropPosition,
} from '../../visualizer/compositionMovement';
const props = defineProps<{
    node: CompositionListNode;
    project: VisualizerProjectV6;
    parentId?: string;
    selection: string | null;
    locked: boolean;
    dragged: string | null;
    reveal: { id: string | null } | null;
}>();
const emit = defineEmits<{
    select: [id: string];
    visibility: [id: string, value: boolean];
    remove: [id: string];
    move: [request: CompositionMove];
    drag: [value: string | null];
}>();
const expanded = ref(props.node.kind === 'scene3d');
const up = computed(() => compositionStepMove(props.project, props.node.id, -1));
const down = computed(() => compositionStepMove(props.project, props.node.id, 1));
const dropPosition = ref<CompositionDropPosition | 'invalid'>();
watch(
    () => props.reveal,
    value => {
        if (value?.id === props.node.id) expanded.value = true;
    },
);
watch(
    () => [props.dragged, props.locked],
    () => {
        dropPosition.value = undefined;
    },
);
const { state } = useResourceLibrary();
const preview = computed(() =>
    props.node.resource
        ? state.value.entries.find(e => resourceKey(e.info.resource) === resourceKey(props.node.resource!))?.previewUrl
        : undefined,
);
function move(offset: number) {
    const request = offset === -1 ? up.value : down.value;
    if (!props.locked && request) emit('move', request);
}
function dropRequest(event: DragEvent) {
    if (props.locked || !props.dragged) return null;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const fraction = (event.clientY - rect.top) / rect.height;
    const position: CompositionDropPosition =
        props.node.kind === 'preset'
            ? fraction < 0.25
                ? 'before'
                : fraction > 0.75
                  ? 'after'
                  : 'inside'
            : fraction < 0.5
              ? 'before'
              : 'after';
    return { position, request: compositionDropMove(props.project, props.dragged, props.node.id, position) };
}
function dragOver(event: DragEvent) {
    const target = dropRequest(event);
    dropPosition.value = target?.request ? target.position : props.dragged ? 'invalid' : undefined;
    if (event.dataTransfer) event.dataTransfer.dropEffect = target?.request ? 'move' : 'none';
    if (target?.request) event.preventDefault();
}
function dragLeave(event: DragEvent) {
    if (event.relatedTarget instanceof Node && (event.currentTarget as HTMLElement).contains(event.relatedTarget))
        return;
    dropPosition.value = undefined;
}
function drop(event: DragEvent) {
    const target = dropRequest(event);
    event.preventDefault();
    event.stopPropagation();
    if (target?.request) emit('move', target.request);
    dropPosition.value = undefined;
    emit('drag', null);
}
</script>
<style scoped>
.viz-preset-children {
    position: relative;
    margin: 0;
    padding: 0;
    background: #0002;
}
.viz-preset-children::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 1px;
    left: 12px;
    width: 1px;
    background: var(--divider);
    z-index: 1;
    pointer-events: none;
}
</style>
