<template>
    <button
        ref="trigger"
        type="button"
        class="editor-lane-delete"
        :aria-label="`删除轨道 ${lane?.name ?? ''}`"
        title="删除轨道"
        :data-testid="`delete-lane-${laneId}`"
        :disabled="disabled"
        @click="request">
        <EditorIcon name="trash" />
    </button>
    <Teleport to="body">
        <dialog
            ref="dialog"
            class="editor-delete-dialog"
            data-testid="editor-delete-lane-dialog"
            :aria-labelledby="`editor-delete-lane-title-${laneId}`"
            @cancel.prevent="cancel">
            <h2 :id="`editor-delete-lane-title-${laneId}`">删除轨道？</h2>
            <p>“{{ lane?.name }}”及其中 {{ lane?.events.length ?? 0 }} 个标记将被删除。</p>
            <div class="actions">
                <button type="button" class="danger" data-testid="confirm-delete-lane" @click="remove">
                    删除轨道与标记</button
                ><button ref="cancelButton" type="button" @click="cancel">取消</button>
            </div>
        </dialog>
    </Teleport>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import EditorIcon from './EditorIcon.vue';
import { removeEditorLane } from '../editor/laneOperations';
import type { EditorProjectV2 } from '../editor/types';
const props = defineProps<{ project: EditorProjectV2; laneId: string; disabled?: boolean }>();
const emit = defineEmits<{ updateProject: [project: EditorProjectV2, immediate: boolean]; removed: [] }>();
const lane = computed(() => props.project.lanes.find(item => item.id === props.laneId));
const dialog = ref<HTMLDialogElement | null>(null),
    trigger = ref<HTMLButtonElement | null>(null),
    cancelButton = ref<HTMLButtonElement | null>(null);
function cancel() {
    dialog.value?.close();
    trigger.value?.focus({ preventScroll: true });
}
async function request() {
    if (!lane.value || props.disabled) return;
    if (!lane.value.events.length) return remove();
    dialog.value?.showModal();
    await nextTick();
    cancelButton.value?.focus();
}
function remove() {
    if (!lane.value || props.disabled) return;
    const index = props.project.lanes.indexOf(lane.value);
    const next = props.project.lanes[index + 1] ?? props.project.lanes[index - 1];
    dialog.value?.close();
    emit('removed');
    emit('updateProject', removeEditorLane(props.project, props.laneId), true);
    void nextTick(() => {
        const target = next
            ? document.getElementById(`${next.eventKind === 'range' ? 'range-' : ''}lane-name-${next.id}`)
            : null;
        (target ?? document.querySelector<HTMLElement>('[data-testid="add-marker-lane"]'))?.focus();
    });
}
watch(
    () => [props.project.projectId, props.project.track.contentHash, props.disabled],
    () => dialog.value?.close(),
);
onBeforeUnmount(() => dialog.value?.close());
</script>
<style scoped>
.editor-lane-delete {
    width: 24px;
    min-width: 24px;
    padding: 4px !important;
    background: transparent !important;
    border: 0 !important;
    color: var(--muted);
    cursor: pointer;
}
.editor-lane-delete svg {
    width: 16px;
    height: 16px;
}
.editor-lane-delete:hover {
    color: var(--error);
}
.editor-delete-dialog {
    width: min(420px, calc(100vw - 32px));
    padding: 24px;
    border: 1px solid var(--hairline-focus);
    border-radius: 6px;
    color: var(--ink);
    background: var(--surface-2);
}
.editor-delete-dialog::backdrop {
    background: var(--editor-modal-backdrop);
}
h2 {
    margin: 0 0 12px;
    font-size: 17px;
}
p {
    color: var(--body);
    font-size: 13px;
    line-height: 1.7;
}
.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 20px;
}
.actions button {
    min-height: 34px;
    padding: 6px 12px;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    color: var(--ink);
    background: var(--editor-control);
}
.actions .danger {
    color: var(--error);
}
button:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 2px;
}
</style>
