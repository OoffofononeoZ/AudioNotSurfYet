<template>
    <Teleport to="body">
        <dialog v-if="busy" ref="dialog" class="shutdown-overlay" aria-label="正在退出" @cancel.prevent>
            <div role="status" aria-live="polite">
                <strong>正在退出</strong>
                <span>正在保存草稿并释放资源，请稍候。</span>
            </div>
        </dialog>
    </Teleport>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
const props = defineProps<{ busy: boolean }>();
let restore: (() => void) | null = null;
const dialog = ref<HTMLDialogElement | null>(null);
let disposed = false;
function unlock() {
    restore?.();
    restore = null;
}
function block(event: Event) {
    event.preventDefault();
    event.stopImmediatePropagation();
}
watch(
    () => props.busy,
    async busy => {
        unlock();
        if (!busy) return;
        const root = document.getElementById('app'),
            previous = root?.inert;
        if (root) root.inert = true;
        const events = ['keydown', 'pointerdown', 'click', 'submit'];
        for (const event of events) document.addEventListener(event, block, true);
        restore = () => {
            dialog.value?.close();
            if (root) root.inert = previous ?? false;
            for (const event of events) document.removeEventListener(event, block, true);
        };
        await nextTick();
        if (!disposed && props.busy && dialog.value?.isConnected) dialog.value.showModal();
    },
    { immediate: true, flush: 'sync' },
);
onBeforeUnmount(() => {
    disposed = true;
    unlock();
});
</script>
<style scoped>
.shutdown-overlay {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    border: 0;
    z-index: 2147483647;
    display: grid;
    place-content: center;
    gap: 12px;
    padding: 24px;
    color: var(--text-primary, #e4ece6);
    background: rgb(9 18 13 / 96%);
    text-align: center;
}
.shutdown-overlay div {
    display: grid;
    gap: 12px;
}
.shutdown-overlay strong {
    font-size: 22px;
}
</style>
