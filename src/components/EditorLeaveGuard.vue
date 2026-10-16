<template>
        <dialog
            ref="leaveDialog"
            class="editor-leave-dialog"
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
            >×</button>
            <h2 id="editor-leave-dialog-title">离开 Editor？</h2>
            <p id="editor-leave-dialog-description">
                如果之后用其他歌曲进入 Editor，当前单草稿可能被覆盖。建议先导出工程。
            </p>
            <label class="leave-dialog-preference">
                <input v-model="suppressFutureLeaveWarning" type="checkbox" data-testid="editor-leave-suppress">
                <span>之后不再显示普通离页提示</span>
            </label>
            <div class="leave-dialog-actions">
                <button
                    ref="leaveStayButton"
                    type="button"
                    class="leave-stay"
                    data-testid="editor-leave-stay"
                    @click="finishLeaveDecision(false)"
                >留在此页</button>
                <button
                    type="button"
                    class="leave-confirm"
                    data-testid="editor-leave-confirm"
                    @click="confirmLeave"
                >仍然离开</button>
            </div>
        </dialog>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useEditorSessionController } from '../editor/editorSessionController';
import { useEditorSeparationService } from '../processing/editorSeparationService';
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
button { box-sizing: border-box; min-height: 30px; border: 1px solid var(--hairline-focus); border-radius: 4px; padding: 4px 10px; color: var(--ink); background: var(--editor-control); }
button:hover { background: var(--editor-control-hover); }
button:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; }
.editor-leave-dialog {
    box-sizing: border-box;
    width: min(520px, calc(100vw - 32px));
    border: 1px solid var(--hairline-focus);
    border-radius: 8px;
    padding: 20px;
    color: var(--ink);
    background: var(--surface-2);
    box-shadow: 0 24px 80px rgba(0, 0, 0, .72), inset 0 0 28px var(--glow-inset);
}

.editor-leave-dialog::backdrop {
    background: var(--editor-modal-backdrop);
}

.editor-leave-dialog h2 {
    margin: 0 36px 10px 0;
    color: var(--ink);
    font-size: 1.05rem;
}

.editor-leave-dialog p {
    margin: 0;
    color: var(--body);
    line-height: 1.65;
}

.leave-dialog-close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 30px;
    padding: 0;
    border-color: transparent;
    color: var(--body);
    background: transparent;
    font-size: 1.2rem;
}

.leave-dialog-preference {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    color: var(--ink);
    font-size: .86rem;
}

.leave-dialog-preference input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--accent);
}

.leave-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
}

.leave-stay {
    border-color: var(--accent-soft);
    background: var(--editor-control-primary);
}

.leave-confirm {
    color: var(--body);
    background: var(--editor-control-quiet);
}

@media (prefers-reduced-motion: reduce) {
    .editor-leave-dialog { scroll-behavior: auto; }
}

</style>
