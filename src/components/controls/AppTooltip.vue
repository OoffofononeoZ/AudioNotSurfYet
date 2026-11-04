<template>
    <ElTooltip
        v-if="content.trim()"
        ref="tooltip"
        :visible="visible"
        :append-to="appendTo"
        placement="auto"
        strategy="fixed"
        :offset="8"
        :popper-options="popperOptions"
        popper-class="app-help-tooltip"
        :persistent="false"
        :show-arrow="true"
        :trigger-keys="[]">
        <button
            ref="trigger"
            type="button"
            class="app-help-trigger"
            :aria-label="label + '说明'"
            @mouseenter="hover(true)"
            @mouseleave="hover(false)"
            @focus="focus(true)"
            @blur="focus(false)"
            @pointerdown.stop="pointerDown"
            @click.stop.prevent="click"
            @keydown.space.stop
            @keydown.enter.stop>
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.2" />
                <path d="M10 5.8v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                <circle cx="10" cy="13.6" r=".8" fill="currentColor" />
            </svg>
        </button>
        <template #content>
            <div
                ref="body"
                class="app-help-content app-scrollbar"
                tabindex="0"
                @mouseenter="read(true)"
                @mouseleave="read(false)"
                @focus="read(true)"
                @blur="read(false)">
                {{ content }}
            </div>
        </template>
    </ElTooltip>
</template>
<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { ElTooltip } from 'element-plus';
import { useAppTooltip } from './useAppTooltip';
const props = defineProps<{ content: string; label: string }>();
const trigger = ref<HTMLElement>();
const tooltip = useTemplateRef<{ updatePopper(): void }>('tooltip');
const body = useTemplateRef<HTMLElement>('body');
const { visible, appendTo, hover, focus, read, pointerDown, click } = useAppTooltip(
    trigger,
    tooltip,
    body,
    () => props.content,
);
const popperOptions = {
    modifiers: [
        { name: 'flip', options: { boundary: [], rootBoundary: 'viewport', padding: 8 } },
        { name: 'preventOverflow', options: { boundary: [], rootBoundary: 'viewport', padding: 8, altAxis: true } },
    ],
};
</script>
<style scoped>
.app-help-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--mute);
    vertical-align: middle;
    cursor: help;
    transition:
        color 120ms,
        background 120ms;
}
.app-help-trigger:hover,
.app-help-trigger:focus-visible {
    color: var(--accent-soft);
    background: var(--marker-fill-soft);
}
.app-help-trigger:focus-visible {
    outline: 2px solid var(--hairline-focus);
    outline-offset: 1px;
}
:global(.app-help-tooltip.el-popper.is-dark) {
    padding: 0;
    border: 1px solid var(--divider-strong);
    border-radius: var(--radius-sm);
    background: var(--surface-1);
    color: var(--body);
    box-shadow: 0 8px 28px #0006;
    width: max-content;
    max-width: min(320px, calc(100vw - 16px));
}
:global(.app-help-tooltip.el-popper.is-dark .el-popper__arrow::before) {
    background: var(--surface-1);
    border-color: var(--divider-strong);
}
:global(.app-help-tooltip.el-fade-in-linear-leave-active) {
    visibility: hidden;
    pointer-events: none;
}
.app-help-content {
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.65;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: min(320px, calc((100dvh - 56px) / 2));
    overflow: auto;
}
@media (prefers-reduced-motion: reduce) {
    .app-help-trigger {
        transition: none;
    }
}
</style>
