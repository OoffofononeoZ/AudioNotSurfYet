<template>
    <a v-if="platform.kind === 'web'" v-bind="$attrs" :href="href" :download="name"><slot /></a>
    <button v-else v-bind="$attrs" type="button" class="platform-download" :disabled="disabled || saving" @click="save">
        <slot />
    </button>
    <span v-if="error" role="alert">{{ error }}</span>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { usePlatformPorts } from '../../platform/platformPorts';
import type { TransferPurpose } from '../../platform/transferContracts';
defineOptions({ inheritAttrs: false });
const props = defineProps<{
    href?: string;
    name: string;
    purpose: TransferPurpose;
    disabled?: boolean;
    load(signal: AbortSignal): Promise<Blob>;
}>();
const platform = usePlatformPorts(),
    saving = ref(false),
    error = ref('');
let pending: AbortController | null = null;
function cancel() {
    pending?.abort();
    pending = null;
    saving.value = false;
    error.value = '';
}
watch(() => [props.href, props.name, props.disabled], cancel);
onBeforeUnmount(cancel);
async function save() {
    if (props.disabled || saving.value) return;
    const task = new AbortController();
    pending = task;
    saving.value = true;
    error.value = '';
    try {
        const file = await props.load(task.signal);
        task.signal.throwIfAborted();
        await platform.transfers.save(props.purpose, props.name, file, task.signal);
    } catch (cause) {
        if (pending === task && !task.signal.aborted) error.value = (cause as Error).message;
    } finally {
        if (pending === task) {
            pending = null;
            saving.value = false;
        }
    }
}
</script>
<style scoped>
.platform-download {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding: 0;
}
.platform-download:disabled {
    opacity: 0.5;
    cursor: default;
}
</style>
