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
        :first="siblings[0] === node.id"
        :last="siblings[siblings.length - 1] === node.id"
        :expanded="expanded"
        @select="$emit('select', node.id)"
        @visibility="$emit('visibility', node.id, $event)"
        @remove="$emit('remove', node.id)"
        @expand="expanded = !expanded"
        @move="move($event)"
        @drag="$emit('drag', { id: node.id, parentId })"
        @dragend="$emit('drag', null)"
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
            :siblings="node.children.map(c => c.id)"
            :parent-id="node.id"
            :selection="selection"
            :locked="locked"
            :dragged="dragged"
            @select="$emit('select', $event)"
            @visibility="(id, value) => $emit('visibility', id, value)"
            @remove="$emit('remove', $event)"
            @reorder="(ids, parent) => $emit('reorder', ids, parent)"
            @drag="$emit('drag', $event)" />
    </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import VisualizerCompositionRow from './VisualizerCompositionRow.vue';
import { useResourceLibrary } from '../../visualizer/useResourceLibrary';
import { resourceKey } from '../../visualizer/resourceIdentity';
import type { CompositionListNode } from '../../visualizer/compositionList';
const props = defineProps<{
    node: CompositionListNode;
    siblings: string[];
    parentId?: string;
    selection: string | null;
    locked: boolean;
    dragged: { id: string; parentId?: string } | null;
}>();
const emit = defineEmits<{
    select: [id: string];
    visibility: [id: string, value: boolean];
    remove: [id: string];
    reorder: [ids: string[], parentId?: string];
    drag: [value: { id: string; parentId?: string } | null];
}>();
const expanded = ref(props.node.kind === 'scene3d');
const { state } = useResourceLibrary();
const preview = computed(() =>
    props.node.resource
        ? state.value.entries.find(e => resourceKey(e.info.resource) === resourceKey(props.node.resource!))?.previewUrl
        : undefined,
);
function move(offset: number) {
    const ids = [...props.siblings],
        from = ids.indexOf(props.node.id),
        to = from + offset;
    if (props.locked || to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, props.node.id);
    emit('reorder', ids, props.parentId);
}
function drop() {
    const drag = props.dragged;
    if (props.locked || !drag || drag.parentId !== props.parentId) return;
    const ids = [...props.siblings],
        from = ids.indexOf(drag.id),
        to = ids.indexOf(props.node.id);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, drag.id);
    emit('reorder', ids, props.parentId);
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
