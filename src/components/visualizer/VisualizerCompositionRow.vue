<template>
    <div
        role="listitem"
        class="viz-element-row"
        :class="{ selected, muted: !enabled, nested, preset: kind === 'preset', locked }"
        :draggable="!locked"
        :data-element-id="kind === 'element' ? id : undefined"
        :data-preset-instance-id="kind === 'preset' ? id : undefined"
        @pointerdown.capture="pointerDown"
        @dragstart="startDrag"
        @dragover.prevent
        @drop.prevent="$emit('drop')"
        @dragend="endDrag">
        <button type="button" class="viz-element-select" :aria-pressed="selected" :disabled="locked" @click="select">
            <span class="viz-row-preview" aria-hidden="true">
                <VisualizerResourceCover v-if="preview" :src="preview" />
                <VisualizerIcon v-else :name="icon" />
            </span>
            <span class="viz-row-name" :title="name">{{ name }}</span>
        </button>
        <button
            v-if="kind === 'preset'"
            type="button"
            class="viz-icon-button small viz-row-expand"
            :aria-label="(expanded ? '折叠' : '展开') + name"
            :aria-expanded="expanded"
            :disabled="locked"
            @click.stop="$emit('expand')">
            <VisualizerIcon :name="expanded ? 'down' : 'right'" />
        </button>
        <div class="viz-row-actions">
            <button
                type="button"
                class="viz-icon-button small"
                :disabled="locked"
                :aria-label="(enabled ? '隐藏' : '显示') + (kind === 'preset' ? '预设' : '元素')"
                :title="enabled ? '隐藏' : '显示'"
                @click.stop="$emit('visibility', !enabled)">
                <VisualizerIcon :name="enabled ? 'eye' : 'hidden'" />
            </button>
            <button
                type="button"
                class="viz-icon-button small"
                :disabled="locked || first"
                :aria-label="kind === 'preset' ? '上移预设' : '上移元素'"
                title="上移"
                @click.stop="$emit('move', -1)">
                <VisualizerIcon name="up" />
            </button>
            <button
                type="button"
                class="viz-icon-button small viz-row-remove"
                :disabled="locked"
                :aria-label="kind === 'preset' ? '删除预设' : '删除元素'"
                title="删除"
                @click.stop="$emit('remove')">
                <VisualizerIcon name="trash" />
            </button>
            <button
                type="button"
                class="viz-icon-button small"
                :disabled="locked || last"
                :aria-label="kind === 'preset' ? '下移预设' : '下移元素'"
                title="下移"
                @click.stop="$emit('move', 1)">
                <VisualizerIcon name="down" />
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
import VisualizerResourceCover from './VisualizerResourceCover.vue';

const props = defineProps<{
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
    nested?: boolean;
}>();
const emit = defineEmits<{
    select: [];
    visibility: [enabled: boolean];
    remove: [];
    move: [offset: number];
    expand: [];
    drag: [];
    drop: [];
    dragend: [];
}>();
let allowDrag = true,
    dragging = false,
    suppressDragClick = false;
function isAction(target: EventTarget | null) {
    return target instanceof Element && !!target.closest('.viz-row-actions, .viz-row-expand');
}
function pointerDown(event: PointerEvent) {
    allowDrag = event.button === 0 && !isAction(event.target);
    suppressDragClick = false;
}
function startDrag(event: DragEvent) {
    if (props.locked || !allowDrag || isAction(event.target)) {
        event.preventDefault();
        return;
    }
    dragging = true;
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', props.id);
    }
    emit('drag');
}
function endDrag() {
    if (!dragging) return;
    dragging = false;
    suppressDragClick = true;
    emit('dragend');
}
function select(event: MouseEvent) {
    if (props.locked || dragging) return;
    if (suppressDragClick && event.detail > 0) {
        suppressDragClick = false;
        return;
    }
    suppressDragClick = false;
    emit('select');
}
onBeforeUnmount(() => {
    if (dragging) emit('dragend');
});
</script>

<style scoped>
.viz-element-row {
    position: relative;
    height: 64px;
    border-bottom: 1px solid var(--divider);
    transition: background 120ms;
}
.viz-element-row.preset {
    background: #ffffff02;
}
.viz-element-row:not(.locked, .selected):hover {
    background: #ffffff04;
}
.viz-element-row.selected {
    background: rgba(134, 237, 181, 0.065);
}
.viz-element-row.selected::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    background: var(--accent-soft);
    pointer-events: none;
    z-index: 1;
}
.viz-element-select {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    min-width: 0;
    padding: 0 68px 0 12px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--body);
    font: inherit;
    font-size: 13px;
    line-height: 20px;
    text-align: left;
    cursor: pointer;
}
.preset .viz-element-select {
    padding-left: 36px;
    font-weight: 500;
}
.nested .viz-element-select {
    padding-left: 24px;
}
.selected .viz-element-select {
    color: var(--ink);
}
.viz-element-select:disabled {
    cursor: default;
}
.viz-element-select:focus-visible {
    background: #65ffa90a;
}
.viz-row-preview {
    display: grid;
    place-items: center;
    flex: none;
    width: 24px;
    height: 24px;
    overflow: hidden;
    border-radius: 4px;
}
.viz-row-preview > svg {
    width: 20px;
    height: 20px;
}
.viz-row-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.muted :is(.viz-row-preview, .viz-row-name) {
    opacity: 0.45;
}
.viz-row-actions {
    position: absolute;
    top: 50%;
    right: 8px;
    display: grid;
    grid-template-columns: repeat(2, 24px);
    grid-template-rows: repeat(2, 24px);
    gap: 4px;
    transform: translateY(-50%);
    pointer-events: none;
}
.viz-icon-button.small {
    width: 24px;
    height: 24px;
    padding: 5px;
}
.viz-row-actions > button {
    pointer-events: auto;
}
.viz-row-expand {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
}
.viz-row-expand svg {
    width: 12px;
    height: 12px;
}
.viz-row-remove:is(:hover, :focus-visible):not(:disabled) {
    color: var(--error);
    background: #ffb0a810;
}
.viz-icon-button:focus-visible {
    color: var(--ink);
    background: rgba(180, 220, 199, 0.08);
}
@media (prefers-reduced-motion: reduce) {
    .viz-element-row {
        transition: none;
    }
}
</style>
