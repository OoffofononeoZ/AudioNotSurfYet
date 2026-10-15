<template>
    <div class="app-playback-progress" :class="{ 'is-disabled': disabled }"
        :style="{ '--progress-width': percent+'%' }">
        <input type="range" min="0" :max="max" step=".001" :value="modelValue"
            :aria-label="label" :aria-valuetext="valueText" :data-testid="testId" :disabled="disabled"
            @input="changed(Number(($event.target as HTMLInputElement).value))" @keydown="keydown"/>
        <span class="app-playback-progress__thumb" aria-hidden="true"/>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import './playbackProgress.css';
const props = defineProps<{
    modelValue: number; max: number; label: string; valueText?: string; disabled?: boolean; testId?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const percent = computed(() => props.max > 0 ? Math.max(0, Math.min(100, props.modelValue / props.max * 100)) : 0);
function changed(value: number) { if (!props.disabled) emit('update:modelValue', Math.max(0, Math.min(props.max, value))); }
function keydown(event: KeyboardEvent) {
    let next: number;
    switch (event.key) {
        case 'ArrowLeft': case 'ArrowDown': next = props.modelValue - 5; break;
        case 'ArrowRight': case 'ArrowUp': next = props.modelValue + 5; break;
        case 'Home': next = 0; break;
        case 'End': next = props.max; break;
        default: return;
    }
    event.preventDefault(); changed(next);
}
</script>

<style scoped>
.app-playback-progress input {
    appearance: none;
    position: absolute;
    top: 50%;
    left: -5px;
    width: calc(100% + 10px);
    height: 24px;
    margin: 0;
    transform: translateY(-50%);
    opacity: 0;
    cursor: pointer;
}
.app-playback-progress input::-webkit-slider-thumb { appearance: none; width: 10px; height: 10px; }
.app-playback-progress input::-moz-range-thumb { width: 10px; height: 10px; border: 0; }
.app-playback-progress .app-playback-progress__thumb { opacity: 0; pointer-events: none; transition: opacity 120ms, scale 120ms; }
.app-playback-progress:hover .app-playback-progress__thumb,
.app-playback-progress:focus-within .app-playback-progress__thumb { opacity: 1; }
.app-playback-progress:focus-within { outline: 2px solid var(--accent); outline-offset: 3px; }
.app-playback-progress.is-disabled { opacity: .4; }
.app-playback-progress.is-disabled input { cursor: default; }
</style>
