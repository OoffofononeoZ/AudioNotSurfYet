<template>
    <section class="actions-section musicbar-actions" aria-label="播放器选项">
        <button type="button" class="musicbar-action" data-testid="playback-mode" :disabled="modeLocked||exportLocked"
            :aria-label="modeLabel" :title="modeLabel" @click="$emit('mode')"><MusicBarIcon :name="mode"/></button>
        <ElTooltip placement="top" popper-class="musicbar-volume-popover">
            <button type="button" class="musicbar-action" data-testid="volume-control" role="slider"
                aria-label="音量" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="volume" :aria-valuetext="volume+'%'"
                @keydown="$emit('volume-keydown',$event)"><MusicBarIcon :name="volume===0?'volume-muted':volume<50?'volume-low':'volume'"/></button>
            <template #content>
                <div class="musicbar-volume-panel"><span>{{ volume }}%</span>
                    <ElSlider vertical height="100px" :show-tooltip="false" :max="100" :min="0" :step="1"
                        :model-value="volume" @update:model-value="$emit('update:volume',Number($event))" @change="$emit('volume',$event)"/>
                </div>
            </template>
        </ElTooltip>
        <button type="button" class="musicbar-action" data-testid="toggle-queue" aria-label="播放列表" title="播放列表"
            :aria-expanded="queueOpen" @click="$emit('queue')"><MusicBarIcon name="queue"/></button>
        <button type="button" class="musicbar-action" data-testid="import-audio" aria-label="导入本地音频" title="导入本地音频"
            :disabled="exportLocked" @click="$emit('import')"><MusicBarIcon name="import"/></button>
        <button type="button" class="musicbar-action" data-testid="change-musicbar-style" aria-label="切换播放器样式" title="切换播放器样式"
            :disabled="transitioning" @click="$emit('appearance')"><MusicBarIcon name="appearance"/></button>
        <button type="button" class="musicbar-action" disabled aria-label="更多功能尚未开放" title="更多功能尚未开放"><MusicBarIcon name="more"/></button>
    </section>
</template>

<script setup lang="ts">
import { ElSlider, ElTooltip } from 'element-plus';
import MusicBarIcon from './MusicBarIcon.vue';
import type { PlaybackMode } from '../audio/playbackPolicy';
defineProps<{
    mode: PlaybackMode; modeLabel: string; modeLocked: boolean; exportLocked: boolean;
    volume: number; queueOpen: boolean; transitioning: boolean;
}>();
defineEmits<{
    mode: []; 'volume-keydown': [event: KeyboardEvent]; 'update:volume': [value: number];
    volume: [value: number | number[]]; queue: []; import: []; appearance: [];
}>();
</script>

<style scoped>
.musicbar-actions { display: flex; flex: none; align-items: center; justify-content: flex-end; gap: 8px; margin: 4px; }
.musicbar-action { display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px; padding: 6px; border: 0; border-radius: var(--radius-xs); color: var(--ink); background: transparent; cursor: pointer; transition: color 120ms, background 120ms; }
.musicbar-action svg { width: 20px; height: 20px; }
.musicbar-action:hover:not(:disabled) { background: rgba(255,255,255,.07); color: var(--accent-soft); }
.musicbar-action:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; }
.musicbar-action:disabled { opacity: .35; cursor: default; }
.musicbar-action[aria-expanded=true] { color: var(--accent-soft); background: rgba(101,255,169,.08); }
.musicbar-volume-panel { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 0 12px; font-size: 12px; font-variant-numeric: tabular-nums; }
.musicbar-volume-panel :deep(.el-slider__button) { border: 2px solid var(--accent); }
.musicbar-volume-panel :deep(.el-slider__bar) { background: var(--accent); }
:global(.musicbar-volume-popover.el-popper.is-dark), :global(.musicbar-volume-popover.el-popper.is-dark .el-popper__arrow::before) { border-color: var(--divider); background: var(--surface-menu); color: var(--ink); }
@media (max-width: 640px) {
    .musicbar-actions { gap: 4px; }
    .musicbar-action { width: 28px; height: 28px; padding: 4px; }
}
</style>
