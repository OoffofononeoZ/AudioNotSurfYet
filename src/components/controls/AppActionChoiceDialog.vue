<template>
    <dialog ref="dialog" class="action-choice" :aria-labelledby="titleId" @cancel.prevent="close" @click="backdrop">
        <header>
            <h2 :id="titleId">{{ title }}</h2>
            <button class="choice-close" type="button" :aria-label="'关闭' + title" @click="close">
                <AppActionIcon name="close" />
            </button>
        </header>
        <div class="choice-options app-scrollbar">
            <button
                v-for="option in options"
                :key="option.id"
                class="choice-card"
                type="button"
                :disabled="option.disabled"
                :data-testid="option.testId"
                @click="choose(option)">
                <span class="choice-icon"><AppActionIcon :name="option.icon" /></span>
                <strong>{{ option.title }}</strong
                ><span class="choice-description">{{
                    option.disabled && option.reason ? option.reason : option.description
                }}</span>
                <AppActionIcon class="choice-arrow" name="right" />
            </button>
        </div>
    </dialog>
</template>
<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue';
import AppActionIcon from './AppActionIcon.vue';
type Option = {
    id: string;
    title: string;
    description: string;
    icon: string;
    testId: string;
    disabled?: boolean;
    reason?: string;
};
const props = defineProps<{ open: boolean; title: string; options: readonly Option[] }>();
const emit = defineEmits<{ close: []; select: [id: string] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
watch(
    () => props.open,
    async open => {
        await nextTick();
        if (props.open !== open) return;
        if (open && !dialog.value?.open) dialog.value?.showModal();
        else if (!open) dialog.value?.close();
    },
    { immediate: true },
);
function close() {
    dialog.value?.close();
    emit('close');
}
function choose(option: Option) {
    if (!props.open || option.disabled) return;
    // Close synchronously, then dispatch from the same user gesture as the file picker.
    dialog.value?.close();
    emit('select', option.id);
}
function backdrop(event: MouseEvent) {
    if (event.target !== dialog.value) return;
    const rect = dialog.value!.getBoundingClientRect();
    if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
    )
        close();
}
</script>
<style scoped>
.action-choice {
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100dvh - 64px);
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--divider);
    border-radius: 12px;
    background: #0b120e;
    color: var(--ink);
    box-shadow: 0 28px 100px #0009;
}
.action-choice[open] {
    display: flex;
    flex-direction: column;
}
.action-choice::backdrop {
    background: #000a;
    backdrop-filter: blur(8px);
}
header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: none;
    padding: 20px 20px 12px 24px;
}
h2 {
    margin: 0;
    font-size: 20px;
    line-height: 28px;
    font-weight: 500;
}
.choice-close {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--mute);
    cursor: pointer;
}
.choice-close svg {
    width: 18px;
    height: 18px;
}
.choice-close:is(:hover, :focus-visible) {
    color: var(--ink);
    background: #ffffff08;
}
.choice-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    min-height: 0;
    padding: 8px 24px 24px;
    overflow: auto;
}
.choice-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
    min-height: 160px;
    padding: 18px;
    border: 1px solid var(--divider);
    border-radius: 8px;
    background: #0e1812;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    transition:
        background 160ms,
        border-color 160ms;
}
.choice-card:is(:hover, :focus-visible):not(:disabled) {
    border-color: var(--hairline-focus);
    background: #14241b;
}
.choice-icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--divider);
    border-radius: 8px;
    color: var(--body);
}
.choice-icon svg {
    width: 19px;
    height: 19px;
}
.choice-card strong {
    font-size: 14px;
    line-height: 22px;
    font-weight: 500;
}
.choice-description {
    padding-right: 8px;
    color: var(--mute);
    font-size: 12px;
    line-height: 20px;
}
.choice-arrow {
    position: absolute;
    width: 15px;
    height: 15px;
    right: 16px;
    top: 27px;
    color: var(--mute);
}
.choice-card:disabled {
    background: transparent;
    color: var(--mute);
    cursor: default;
}
.choice-card:disabled .choice-icon {
    opacity: 0.4;
}
@media (max-width: 520px) {
    .choice-options {
        grid-template-columns: minmax(0, 1fr);
    }
    .choice-card {
        min-height: 142px;
    }
}
@media (prefers-reduced-motion: reduce) {
    .choice-card {
        transition: none;
    }
}
</style>
