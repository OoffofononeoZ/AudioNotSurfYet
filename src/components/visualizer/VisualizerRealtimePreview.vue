<template>
    <figure class="realtime-preview" :aria-busy="loading">
        <img v-if="url" :src="url" alt="当前工程画面" />
        <span v-else class="preview-placeholder"
            ><AppActionIcon name="style" /><span>{{ loading ? '正在截取画面…' : '画面暂不可用' }}</span></span
        >
        <figcaption v-if="url">当前画面</figcaption>
    </figure>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import AppActionIcon from '../controls/AppActionIcon.vue';
const props = defineProps<{
    open: boolean;
    identity: string;
    locked: boolean;
    capture: (signal: AbortSignal) => Promise<Blob>;
}>();
const url = ref(''),
    loading = ref(false);
let task: AbortController | null = null;
function clear() {
    task?.abort();
    task = null;
    if (url.value) URL.revokeObjectURL(url.value);
    url.value = '';
    loading.value = false;
}
watch(
    [() => props.open, () => props.identity, () => props.locked],
    async () => {
        clear();
        if (!props.open || props.locked || !props.identity) return;
        const owner = new AbortController();
        task = owner;
        loading.value = true;
        try {
            const blob = await props.capture(owner.signal);
            if (task === owner && !owner.signal.aborted) url.value = URL.createObjectURL(blob);
        } catch {
            // The optional snapshot never prevents saving a valid realtime style.
        } finally {
            if (task === owner) {
                task = null;
                loading.value = false;
            }
        }
    },
    { immediate: true },
);
onBeforeUnmount(clear);
</script>
<style scoped>
.realtime-preview {
    position: relative;
    width: 232px;
    flex: none;
    aspect-ratio: 16 / 9;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--divider);
    border-radius: 8px;
    background: #030705;
}
img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
}
.preview-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 100%;
    color: var(--mute);
    font-size: 11px;
}
.preview-placeholder svg {
    width: 26px;
    height: 26px;
    opacity: 0.45;
}
figcaption {
    position: absolute;
    bottom: 8px;
    left: 8px;
    padding: 3px 6px;
    border-radius: 4px;
    background: #030705cc;
    color: var(--body);
    font-size: 10px;
    line-height: 16px;
}
@media (max-width: 640px) {
    .realtime-preview {
        width: 100%;
    }
}
</style>
