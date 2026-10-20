<template>
    <div
        role="listitem"
        class="viz-element-row"
        :class="{ selected, muted: !enabled }"
        :draggable="!locked"
        :data-element-id="kind === 'element' ? id : undefined"
        :data-preset-instance-id="kind === 'preset' ? id : undefined"
        @dragstart="$emit('drag')"
        @dragover.prevent
        @drop.prevent="$emit('drop')"
        @dragend="$emit('dragend')">
        <div class="viz-item-title">
            <button
                v-if="kind === 'preset'"
                type="button"
                class="viz-icon-button small"
                :aria-label="(expanded ? '折叠' : '展开') + name"
                :aria-expanded="expanded"
                :disabled="locked"
                @click="$emit('expand')">
                <VisualizerIcon :name="expanded ? 'down' : 'right'" />
            </button>
            <button
                type="button"
                class="viz-element-select"
                :aria-pressed="selected"
                :disabled="locked"
                @click="$emit('select')">
                <VisualizerResourceCover v-if="preview" :src="preview" /><VisualizerIcon v-else :name="icon" /><span>{{
                    name
                }}</span>
            </button>
        </div>
        <div class="viz-row-actions">
            <button
                type="button"
                class="viz-icon-button small"
                :disabled="locked || first"
                :aria-label="kind === 'preset' ? '上移预设' : '上移元素'"
                title="上移"
                @click="$emit('move', -1)">
                <VisualizerIcon name="up" />
            </button>
            <button
                type="button"
                class="viz-icon-button small"
                :disabled="locked || last"
                :aria-label="kind === 'preset' ? '下移预设' : '下移元素'"
                title="下移"
                @click="$emit('move', 1)">
                <VisualizerIcon name="down" />
            </button>
            <button
                type="button"
                class="viz-icon-button small"
                :disabled="locked"
                :aria-label="(enabled ? '隐藏' : '显示') + (kind === 'preset' ? '预设' : '元素')"
                :title="enabled ? '隐藏' : '显示'"
                @click="$emit('visibility', !enabled)">
                <VisualizerIcon :name="enabled ? 'eye' : 'hidden'" />
            </button>
            <button
                type="button"
                class="viz-icon-button small"
                :disabled="locked"
                :aria-label="kind === 'preset' ? '删除预设' : '删除元素'"
                title="删除"
                @click="$emit('remove')">
                <VisualizerIcon name="trash" />
            </button>
        </div>
    </div>
</template>
<script setup lang="ts">
import VisualizerIcon from './VisualizerIcon.vue';
import VisualizerResourceCover from './VisualizerResourceCover.vue';
defineProps<{
    id: string;
    name: string;
    kind: 'element' | 'preset';
    icon: string;
    preview?: string;
    enabled: boolean;
    selected: boolean;
    locked: boolean;
    first: boolean;
    last: boolean;
    expanded?: boolean;
}>();
defineEmits<{
    select: [];
    visibility: [enabled: boolean];
    remove: [];
    move: [offset: number];
    expand: [];
    drag: [];
    drop: [];
    dragend: [];
}>();
</script>
<style scoped>
.viz-element-select > img {
    width: 24px;
    height: 24px;
    object-fit: contain;
    flex: none;
}
.viz-item-title {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 2px;
}
.viz-item-title .viz-element-select {
    flex: 1;
    min-width: 0;
}
</style>
