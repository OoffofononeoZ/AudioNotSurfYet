<template>
    <button type="button" aria-label="标记补偿" data-testid="marker-compensation" :disabled="!active" @click="open">
        标记补偿<span v-if="modelValue"> · {{ modelValue }} 格</span>
    </button>
    <Teleport to="body">
        <dialog
            ref="dialog"
            class="marker-compensation-dialog app-scrollbar"
            aria-labelledby="marker-compensation-title"
            @keydown.esc.stop
            @cancel.prevent="close">
            <form @submit.prevent="apply">
                <h3 id="marker-compensation-title">标记补偿</h3>
                <label class="flex items-center justify-between gap-4 my-4">
                    <span>提前格数</span>
                    <AppNumberInput
                        v-model="draft"
                        label="提前格数"
                        :min="0"
                        :max="Number.MAX_SAFE_INTEGER"
                        :step="1"
                        snap-to-step />
                </label>
                <p>播放时的数字键标记按当前节拍细分提前。范围起点和终点均补偿。</p>
                <p>仅本次 Editor 页面生效，离开或刷新后恢复为 0 格。</p>
                <p v-if="error" role="alert">{{ error }}</p>
                <div class="flex justify-end gap-2 mt-4">
                    <button type="button" @click="close">取消</button>
                    <button type="submit" data-testid="apply-marker-compensation">确定</button>
                </div>
            </form>
        </dialog>
    </Teleport>
</template>
<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import AppNumberInput from './controls/AppNumberInput.vue';
import { assertMarkerCellCount } from '../editor/markerGridOffset';
const props = defineProps<{ modelValue: number; active: boolean; projectId: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: number]; opening: [] }>();
const dialog = ref<HTMLDialogElement | null>(null),
    draft = ref(0),
    error = ref('');
function open() {
    if (!props.active) return;
    draft.value = props.modelValue;
    error.value = '';
    emit('opening');
    dialog.value?.showModal();
}
function close() {
    dialog.value?.close();
}
function apply() {
    if (!props.active) return;
    try {
        assertMarkerCellCount(draft.value);
        emit('update:modelValue', draft.value);
        close();
    } catch (e) {
        error.value = (e as Error).message;
    }
}
watch(() => `${props.active}:${props.projectId}`, close);
onBeforeUnmount(close);
</script>
<style scoped>
.marker-compensation-dialog {
    width: min(430px, calc(100vw - 32px));
    max-height: calc(100dvh - 40px);
    overflow-y: auto;
    border: 1px solid var(--divider);
    border-radius: 10px;
    padding: 20px;
    background: var(--surface-1);
    color: var(--ink);
}
.marker-compensation-dialog::backdrop {
    background: #0009;
}
.marker-compensation-dialog h3 {
    font-size: 16px;
}
.marker-compensation-dialog p {
    font-size: 12px;
    margin: 10px 0;
    color: var(--body);
}
.marker-compensation-dialog [role='alert'] {
    color: var(--error);
}
button {
    border: 1px solid var(--divider);
    border-radius: 4px;
    padding: 5px 9px;
    background: var(--surface-2);
    color: var(--body);
    font-size: 12px;
}
button:disabled {
    opacity: 0.45;
}
</style>
