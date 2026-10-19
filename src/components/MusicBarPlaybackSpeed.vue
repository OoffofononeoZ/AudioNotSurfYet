<template>
    <div ref="root" class="playback-speed" @keydown.esc.stop="open = false">
        <button
            type="button"
            class="speed-trigger"
            data-testid="playback-speed"
            :disabled="disabled"
            aria-label="播放速度"
            :aria-expanded="open"
            :aria-controls="panelId"
            @click="open = !open">
            {{ rate.toFixed(1) }}×
        </button>
        <div v-if="open" :id="panelId" class="speed-panel" role="group" aria-label="播放速度设置">
            <label :for="sliderId"
                >播放速度 <output>{{ rate.toFixed(1) }}×</output></label
            >
            <input
                :id="sliderId"
                type="range"
                aria-label="播放速度"
                min="0.1"
                max="2"
                step="0.1"
                :value="rate"
                :disabled="disabled"
                @input="changeRate" />
            <div class="speed-limits"><span>0.1×</span><span>2.0×</span></div>
            <button
                type="button"
                data-testid="reset-playback-speed"
                :disabled="disabled || rate === 1"
                @click="$emit('change', 1)">
                恢复 1×
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, useId, watch } from 'vue';

const props = defineProps<{ rate: number; disabled: boolean }>();
const emit = defineEmits<{ change: [rate: number] }>();
const root = ref<HTMLElement | null>(null);
const open = ref(false);
const panelId = useId(),
    sliderId = useId();
function changeRate(event: Event) {
    emit('change', Number((event.target as HTMLInputElement).value));
}
function closeOutside(event: PointerEvent) {
    if (event.target instanceof Node && !root.value?.contains(event.target)) open.value = false;
}
watch(
    () => props.disabled,
    disabled => {
        if (disabled) open.value = false;
    },
);
onMounted(() => document.addEventListener('pointerdown', closeOutside));
onUnmounted(() => document.removeEventListener('pointerdown', closeOutside));
</script>

<style scoped>
.playback-speed {
    position: relative;
    flex: none;
}
.speed-trigger {
    min-width: 46px;
    height: 32px;
    padding: 0 4px;
    border: 0;
    border-radius: var(--radius-xs);
    color: var(--ink);
    background: transparent;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
}
.speed-trigger:hover:not(:disabled),
.speed-trigger[aria-expanded='true'] {
    color: var(--accent-soft);
    background: rgba(101, 255, 169, 0.08);
}
.speed-trigger:disabled {
    opacity: 0.35;
    cursor: default;
}
.speed-trigger:focus-visible,
.speed-panel button:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 2px;
}
.speed-panel {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 14px);
    transform: translateX(-50%);
    z-index: var(--layer-player-popover);
    width: 220px;
    padding: 14px;
    border: 1px solid var(--divider);
    border-radius: var(--radius-sm);
    color: var(--ink);
    background: var(--surface-menu);
    box-shadow: 0 8px 24px #0006;
}
.speed-panel label {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
}
.speed-panel input {
    width: 100%;
    margin: 14px 0 0;
    accent-color: var(--accent);
}
.speed-limits {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--mute);
}
.speed-panel button {
    margin-top: 12px;
    padding: 4px 8px;
    border: 1px solid var(--divider);
    border-radius: var(--radius-xs);
    color: var(--ink);
    background: transparent;
    cursor: pointer;
}
.speed-panel button:disabled {
    opacity: 0.4;
    cursor: default;
}
@media (max-width: 640px) {
    .speed-trigger {
        min-width: 40px;
        height: 28px;
    }
}
</style>
