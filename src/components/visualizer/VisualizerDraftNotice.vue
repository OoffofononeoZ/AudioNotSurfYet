<template>
    <section class="viz-draft-notice" :aria-labelledby="titleId">
        <div class="viz-draft-notice__body">
            <div class="viz-draft-notice__icon"><VisualizerIcon name="layers"/></div>
            <h1 :id="titleId">已有可视化草稿</h1>
            <div v-if="fileName" class="viz-draft-notice__file"><VisualizerIcon name="music"/><span>{{ fileName }}</span></div>
        </div>
        <footer>
            <button type="button" class="viz-draft-notice__cancel" @click="$emit('cancel')">取消进入</button>
            <button type="button" class="viz-draft-notice__export" @click="$emit('export')"><VisualizerIcon name="export"/>导出原草稿</button>
            <button type="button" class="viz-draft-notice__replace" @click="$emit('replace')">覆盖草稿<VisualizerIcon name="right"/></button>
        </footer>
    </section>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import VisualizerIcon from './VisualizerIcon.vue';
defineProps<{ fileName?: string }>();
defineEmits<{ export: []; replace: []; cancel: [] }>();
const titleId = useId();
</script>

<style scoped>
.viz-draft-notice { width: min(500px, 100%); overflow: hidden; border: 1px solid var(--divider); border-radius: var(--radius-md); background: var(--surface-card-strong); box-shadow: 0 16px 60px #0005; text-align: left; }
.viz-draft-notice__body { padding: 28px; }
.viz-draft-notice__icon { display: grid; place-items: center; width: 40px; height: 40px; margin-bottom: 20px; border: 1px solid var(--hairline-soft); border-radius: var(--radius-sm); background: var(--surface-chip); color: var(--accent-soft); }
.viz-draft-notice__icon svg { width: 22px; height: 22px; }
.viz-draft-notice h1 { margin: 0; font-size: 20px; font-weight: 500; line-height: 28px; }
.viz-draft-notice__file { display: flex; align-items: center; gap: 8px; margin-top: 20px; padding: 10px 12px; border: 1px solid var(--divider); border-radius: var(--radius-xs); color: var(--body); font-size: 12px; }
.viz-draft-notice__file svg { width: 16px; height: 16px; flex: none; }
.viz-draft-notice__file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.viz-draft-notice footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; padding: 16px 20px; border-top: 1px solid var(--divider); background: var(--surface-3); }
.viz-draft-notice button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 7px 11px; border: 1px solid transparent; border-radius: var(--radius-xs); font: inherit; font-size: 12px; line-height: 18px; cursor: pointer; }
.viz-draft-notice button svg { width: 15px; height: 15px; }
.viz-draft-notice__cancel { margin-right: auto; background: transparent; color: var(--mute); }
.viz-draft-notice button.viz-draft-notice__export { background: var(--surface-1); border-color: var(--divider); color: var(--ink); }
.viz-draft-notice__replace { background: var(--accent-soft); color: var(--on-accent); }
.viz-draft-notice__cancel:hover { color: var(--ink); background: var(--control-hover); }
.viz-draft-notice button.viz-draft-notice__export:hover { border-color: var(--hairline); background: var(--control-hover); }
.viz-draft-notice__replace:hover { background: var(--accent-bright); }
</style>
