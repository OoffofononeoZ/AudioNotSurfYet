<template>
    <div class="viz-panel-heading">
        <h2>元素</h2>
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
    <div
        class="viz-element-items app-scrollbar divide-y [&>*]:border-t-[var(--divider)]"
        role="list"
        aria-label="可视化元素">
        <div v-for="(item, index) in roots" :key="item.id" class="viz-root-item" :data-root-item-id="item.id">
            <VisualizerCompositionRow
                :id="item.id"
                :name="name(item)"
                :kind="item.kind"
                :icon="item.kind === 'preset' ? 'layers' : descriptor(item.id).icon"
                :enabled="enabled(item)"
                :selected="selection === item.id"
                :locked="locked"
                :first="index === 0"
                :last="index === roots.length - 1"
                :expanded="expanded.has(item.id)"
                @select="$emit('select', item.id)"
                @visibility="$emit('visibility', item.id, $event)"
                @remove="$emit('remove', item.id)"
                @move="
                    move(
                        roots.map(i => i.id),
                        item.id,
                        $event,
                    )
                "
                @expand="toggle(item.id)"
                @drag="dragged = { id: item.id }"
                @drop="
                    drop(
                        roots.map(i => i.id),
                        item.id,
                    )
                "
                @dragend="dragged = null" />
            <div
                v-if="item.kind === 'preset' && expanded.has(item.id)"
                class="viz-preset-children divide-y border-t border-t-[var(--divider)] [&>*]:border-t-[var(--divider)]"
                role="list"
                :aria-label="item.name + '内部元素'">
                <VisualizerCompositionRow
                    v-for="(id, childIndex) in [...item.children].reverse()"
                    :id="id"
                    :key="id"
                    :name="leaf(id).name"
                    kind="element"
                    :icon="descriptor(id).icon"
                    :enabled="leaf(id).enabled"
                    :selected="selection === id"
                    :locked="locked"
                    :first="childIndex === 0"
                    :last="childIndex === item.children.length - 1"
                    @select="$emit('select', id)"
                    @visibility="$emit('visibility', id, $event)"
                    @remove="$emit('remove', id)"
                    @move="move([...item.children].reverse(), id, $event, item.id)"
                    @drag="dragged = { id, parentId: item.id }"
                    @drop="drop([...item.children].reverse(), id, item.id)"
                    @dragend="dragged = null" />
            </div>
        </div>
        <div v-if="!roots.length" class="viz-list-empty"><VisualizerIcon name="layers" /><span>尚未添加元素</span></div>
    </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
import VisualizerCompositionRow from './VisualizerCompositionRow.vue';
import { elementDescriptor } from '../../visualizer/compositionModel';
import type { VisualizerProjectV4 } from '../../visualizer/compositionTypes';
import type { CompositionItem } from '../../visualizer/resourceTypes';
const props = defineProps<{ project: VisualizerProjectV4; selection: string | null; locked: boolean }>();
const emit = defineEmits<{
    add: [];
    select: [id: string];
    visibility: [id: string, enabled: boolean];
    remove: [id: string];
    reorder: [ids: string[], parentId?: string];
}>();
const roots = computed(() => [...props.project.items].reverse()),
    expanded = ref(new Set<string>()),
    dragged = ref<{ id: string; parentId?: string } | null>(null);
const leaf = (id: string) => props.project.elements.find(e => e.id === id)!;
const descriptor = (id: string) => elementDescriptor(props.project, leaf(id));
const name = (item: CompositionItem) => (item.kind === 'preset' ? item.name : leaf(item.id).name);
const enabled = (item: CompositionItem) => (item.kind === 'preset' ? item.enabled : leaf(item.id).enabled);
function toggle(id: string) {
    const next = new Set(expanded.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded.value = next;
}
function move(ids: string[], id: string, offset: number, parentId?: string) {
    const index = ids.indexOf(id),
        target = index + offset;
    if (props.locked || index < 0 || target < 0 || target >= ids.length) return;
    ids.splice(index, 1);
    ids.splice(target, 0, id);
    emit('reorder', ids, parentId);
}
function drop(ids: string[], target: string, parentId?: string) {
    const from = dragged.value;
    if (props.locked || !from || from.parentId !== parentId) return;
    const source = ids.indexOf(from.id),
        to = ids.indexOf(target);
    if (source < 0 || to < 0) return;
    ids.splice(source, 1);
    ids.splice(to, 0, from.id);
    emit('reorder', ids, parentId);
    dragged.value = null;
}
</script>
<style scoped>
.viz-preset-children {
    margin: 4px 0 8px 14px;
    box-shadow: inset 1px 0 #35473c;
}
</style>
