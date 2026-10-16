<template>
    <dialog ref="dialog" class="track-change-dialog" data-testid="editor-track-change-dialog" aria-labelledby="editor-track-change-title" @cancel.prevent="!decision?.busy && emit('cancel')">
        <h2 id="editor-track-change-title">{{ decision?.target ? '切换歌曲工程？' : '清空播放列表？' }}</h2>
        <p>{{ decision?.target ? 'Editor 只保留一个草稿。切换会覆盖为目标歌曲的工程，并结束当前处理任务。' : '清空会停止播放并结束当前处理任务；Editor 草稿仍会保留。' }}</p>
        <p v-if="decision?.exported" role="status">工程已导出；仍需明确选择切换。</p>
        <p v-if="decision?.error" class="error" role="alert">{{ decision.error }}</p>
        <div class="actions">
            <button type="button" :disabled="decision?.busy" data-testid="editor-track-change-export" @click="emit('export')">导出当前工程</button>
            <button type="button" :disabled="decision?.busy" data-testid="editor-track-change-confirm" @click="emit('confirm')">{{ decision?.busy ? '处理中…' : '覆盖草稿并切换' }}</button>
            <button ref="cancelButton" type="button" :disabled="decision?.busy" data-testid="editor-track-change-cancel" @click="emit('cancel')">取消</button>
        </div>
    </dialog>
</template>
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { EditorTrackChangeDecision } from '../editor/useEditorTrackNavigation';
const props = defineProps<{ decision: EditorTrackChangeDecision | null }>();
const emit = defineEmits<{ confirm: []; cancel: []; export: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const cancelButton = ref<HTMLButtonElement | null>(null);
watch(() => !!props.decision, async open => {
    await nextTick();
    if (open && props.decision && !dialog.value?.open) {
        dialog.value?.showModal();
        cancelButton.value?.focus();
    } else if (!props.decision && dialog.value?.open) dialog.value.close();
});
</script>
<style scoped>
.track-change-dialog { width: min(520px, calc(100vw - 32px)); border: 1px solid var(--hairline-focus); border-radius: 6px; padding: 24px; background: var(--surface-2); color: var(--ink); }
.track-change-dialog::backdrop { background: var(--editor-modal-backdrop); }
h2 { margin: 0 0 12px; font-size: 17px; } p { margin: 8px 0; color: var(--body); line-height: 1.65; font-size: 13px; }
.error { color: var(--error); } .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
button { min-height: 34px; padding: 6px 10px; border: 1px solid var(--hairline); border-radius: 4px; background: var(--editor-control); color: var(--ink); font-size: 12px; }
button:hover { background: var(--editor-control-hover); } button:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; } button:disabled { opacity: .5; }
</style>
