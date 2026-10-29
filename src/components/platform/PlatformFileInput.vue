<template>
    <input
        v-if="platform.kind === 'web'"
        type="file"
        :accept="accept"
        :multiple="multiple"
        :disabled="disabled"
        @change="selected" />
    <button v-else type="button" :disabled="disabled || choosing" @click="choose">
        {{ choosing ? '正在读取…' : '选择文件' }}
    </button>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { usePlatformPorts } from '../../platform/platformPorts';
import type { InputFilePurpose } from '../../platform/transferContracts';
const props = defineProps<{
    purpose: InputFilePurpose;
    accept: string;
    multiple?: boolean;
    disabled?: boolean;
    selectionKey?: string;
}>();
const emit = defineEmits<{ files: [files: File[]]; error: [message: string] }>();
const platform = usePlatformPorts(),
    choosing = ref(false);
let pending: AbortController | null = null;
function cancel() {
    pending?.abort();
    pending = null;
    choosing.value = false;
}
watch(() => [props.disabled, props.selectionKey, props.purpose], cancel);
onBeforeUnmount(cancel);
function selected(event: Event) {
    const input = event.target as HTMLInputElement,
        files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length) emit('files', files);
}
async function choose() {
    cancel();
    const task = new AbortController();
    pending = task;
    choosing.value = true;
    try {
        const files = await platform.transfers.openMany(props.purpose, !!props.multiple, task.signal);
        if (pending === task && !task.signal.aborted && files.length) emit('files', files);
    } catch (error) {
        if (pending === task && !task.signal.aborted) emit('error', (error as Error).message);
    } finally {
        if (pending === task) {
            pending = null;
            choosing.value = false;
        }
    }
}
</script>
