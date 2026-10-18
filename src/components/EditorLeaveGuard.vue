<template>
        <dialog
            ref="leaveDialog"
            class="editor-leave-dialog editor-notice app-scrollbar"
            data-testid="editor-leave-dialog"
            aria-labelledby="editor-leave-dialog-title"
            aria-describedby="editor-leave-dialog-description"
            @cancel="onLeaveDialogCancel"
            @click="onLeaveDialogBackdropClick"
        >
            <button
                type="button"
                class="leave-dialog-close"
                aria-label="关闭并留在当前页面"
                data-testid="editor-leave-close"
                @click="finishLeaveDecision(false)"
            ><EditorIcon name="close" /></button>
            <div class="editor-notice__body">
                <div class="editor-notice__icon"><EditorIcon name="leave" /></div>
                <h2 id="editor-leave-dialog-title">离开 Editor？</h2>
                <p id="editor-leave-dialog-description" class="editor-notice__description">
                    如果之后用其他歌曲进入 Editor，当前单草稿可能被覆盖。建议先导出工程。
                </p>
                <label class="leave-dialog-preference">
                    <input v-model="suppressFutureLeaveWarning" type="checkbox" data-testid="editor-leave-suppress">
                    <span>之后不再显示普通离页提示</span>
                </label>
            </div>
            <footer class="editor-notice__actions">
                <button
                    type="button"
                    class="editor-notice__quiet"
                    data-testid="editor-leave-confirm"
                    @click="confirmLeave"
                >仍然离开</button>
                <button
                    ref="leaveStayButton"
                    type="button"
                    class="editor-notice__primary"
                    data-testid="editor-leave-stay"
                    @click="finishLeaveDecision(false)"
                >留在此页</button>
            </footer>
        </dialog>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useEditorSessionController } from '../editor/editorSessionController';
import { useEditorSeparationService } from '../processing/editorSeparationService';
import EditorIcon from './EditorIcon.vue';
import '../editor/notices.css';
const controller = useEditorSessionController();
const separationService = useEditorSeparationService();
const leaveDialog = ref<HTMLDialogElement | null>(null);
const leaveStayButton = ref<HTMLButtonElement | null>(null);
const suppressFutureLeaveWarning = ref(false);
let pendingLeaveDecision: {
    promise: Promise<boolean>;
    resolve: (value: boolean) => void;
} | null = null;
let leaveTransition: Promise<void> | null = null;

const finishLeaveDecision = (shouldLeave: boolean) => {
    const pending = pendingLeaveDecision;
    if (!pending) return;
    pendingLeaveDecision = null;
    if (leaveDialog.value?.open) leaveDialog.value.close();
    pending.resolve(shouldLeave);
};

const requestLeaveDecision = (): Promise<boolean> => {
    if (pendingLeaveDecision) return pendingLeaveDecision.promise;
    suppressFutureLeaveWarning.value = false;
    let resolveDecision!: (value: boolean) => void;
    const promise = new Promise<boolean>((resolve) => {
        resolveDecision = resolve;
    });
    pendingLeaveDecision = { promise, resolve: resolveDecision };
    void nextTick(() => {
        const dialog = leaveDialog.value;
        if (!dialog || pendingLeaveDecision?.promise !== promise) {
            finishLeaveDecision(false);
            return;
        }
        try {
            if (!dialog.open) dialog.showModal();
        } catch {
            finishLeaveDecision(false);
            return;
        }
        leaveStayButton.value?.focus();
    });
    return promise;
};

const onLeaveDialogCancel = (event: Event) => {
    event.preventDefault();
    finishLeaveDecision(false);
};

const onLeaveDialogBackdropClick = (event: MouseEvent) => {
    const dialog = leaveDialog.value;
    if (!dialog || event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left
        || event.clientX > bounds.right
        || event.clientY < bounds.top
        || event.clientY > bounds.bottom;
    if (outside) finishLeaveDecision(false);
};

const confirmLeave = async () => {
    try {
        if (suppressFutureLeaveWarning.value) {
            await controller.setLeaveWarningEnabled(false);
        }
        finishLeaveDecision(true);
    } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '无法保存离页提示设置。');
        leaveStayButton.value?.focus();
    }
};

const leaveEditorOnce = () => {
    leaveTransition ??= controller.leave();
    return leaveTransition;
};

onBeforeRouteLeave(async () => {
    if (controller.shouldWarnOnLeave()) {
        const shouldLeave = await requestLeaveDecision();
        if (!shouldLeave) return false;
    }
    await separationService.bind(null);
    await leaveEditorOnce();
    return true;
});


onBeforeUnmount(() => finishLeaveDecision(false));
</script>
<style scoped>
.editor-leave-dialog {
    width: min(500px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow: auto;
    overscroll-behavior: contain;
    padding: 0;
}

.editor-leave-dialog::backdrop {
    background: var(--editor-modal-backdrop);
}

.editor-leave-dialog h2 {
    padding-right: 20px;
}

.editor-leave-dialog .leave-dialog-close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 30px;
    height: 30px;
    min-height: 30px;
    padding: 0;
    color: var(--body);
    background: transparent;
}
.editor-leave-dialog .leave-dialog-close:hover { color: var(--ink); background: var(--control-hover); }

.leave-dialog-preference {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 20px;
    color: var(--body);
    font-size: 12px;
    line-height: 20px;
    cursor: pointer;
}

.leave-dialog-preference input {
    width: 16px;
    height: 16px;
    flex: none;
    margin: 0;
    accent-color: var(--accent-soft);
}

</style>
