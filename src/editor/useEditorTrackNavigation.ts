import { onBeforeUnmount, shallowRef } from 'vue';
import { onBeforeRouteUpdate, type Router } from 'vue-router';
import type { AudioSessionService } from '../audio/audioSessionService';
import type { EditorSeparationService } from '../processing/editorSeparationService';
import type { EditorSessionController } from './editorSessionController';

export interface EditorTrackChangeDecision {
    target: string | null;
    busy: boolean;
    exported: boolean;
    error: string;
}

/** Protects the draft before any playlist, route or processing-source mutation. */
export function useEditorTrackNavigation(
    controller: EditorSessionController,
    audio: AudioSessionService,
    separation: EditorSeparationService,
    router: Router,
) {
    const decision = shallowRef<EditorTrackChangeDecision | null>(null);
    let resolveDecision: ((allowed: boolean) => void) | null = null;
    let approval: symbol | undefined;
    let requestedPlayTarget: string | null = null;
    let entryRevision = 0;
    let disposed = false;
    let preparing = false;

    function cancel() {
        if (decision.value?.busy) return;
        decision.value = null;
        const resolve = resolveDecision;
        resolveDecision = null;
        resolve?.(false);
    }

    async function confirm() {
        const current = decision.value;
        if (!current || current.busy) return;
        decision.value = { ...current, busy: true, error: '' };
        try {
            const token = await controller.approveTrackChange(current.target);
            if (disposed) return;
            if (!token) {
                decision.value = { ...current, busy: false, error: '当前草稿尚未保存或工程已改变。请重试，也可以导出工程或取消。' };
                return;
            }
            approval = token;
            const resolve = resolveDecision;
            resolveDecision = null;
            resolve?.(true);
        } catch (error) {
            if (!disposed) decision.value = { ...current, busy: false, error: error instanceof Error ? error.message : '草稿保存失败。' };
        }
    }

    async function exportCurrent() {
        const current = decision.value;
        if (!current || current.busy) return;
        decision.value = { ...current, busy: true, error: '' };
        try {
            const result = await controller.exportProject();
            if (!disposed) decision.value = { ...current, busy: false, exported: result === 'saved' || current.exported };
        } catch (error) {
            if (!disposed) decision.value = { ...current, busy: false, error: error instanceof Error ? error.message : '工程导出失败。' };
        }
    }

    async function prepare(target: string | null): Promise<boolean> {
        if (disposed || preparing) return false;
        const current = controller.getSnapshot();
        // Cancelling an entry conflict has already restored this song and its leases.
        if (target && current.activeTrackId === target && current.state === 'ready') return true;
        preparing = true;
        try {
            if (!controller.isTrackChangeApproved(approval, target)) {
                approval = undefined;
                if (controller.getSnapshot().project) {
                    decision.value = { target, busy: false, exported: false, error: '' };
                    const allowed = await new Promise<boolean>(resolve => { resolveDecision = resolve; });
                    if (!allowed || disposed) return false;
                }
            }
            // bind(null) aborts and awaits separation plus its transcription consumers.
            await separation.bind(null);
            return !disposed;
        } finally {
            preparing = false;
            if (!resolveDecision) decision.value = null;
        }
    }

    async function enter(trackId: string | null) {
        const revision = ++entryRevision;
        const token = approval;
        approval = undefined;
        const current = controller.getSnapshot();
        if (current.state !== 'ready' || current.activeTrackId !== trackId) await controller.enter(trackId, token);
        if (disposed || revision !== entryRevision) return;
        if (trackId && requestedPlayTarget === trackId && controller.getSnapshot().state === 'ready') {
            requestedPlayTarget = null;
            await audio.play();
        }
    }

    onBeforeRouteUpdate(to => prepare(typeof to.params.trackId === 'string' ? to.params.trackId : null));
    const detach = audio.attachTrackNavigation({
        async select(trackId) {
            requestedPlayTarget = trackId;
            const result = await router.replace({ name: 'editor', params: { trackId } });
            if (result && requestedPlayTarget === trackId) requestedPlayTarget = null;
        },
        beforeMutation: prepare,
        async cleared() {
            requestedPlayTarget = null;
            await router.replace({ name: 'editor', params: { trackId: undefined } });
        },
    });
    onBeforeUnmount(() => {
        disposed = true;
        ++entryRevision;
        detach();
        decision.value = null;
        resolveDecision?.(false);
        resolveDecision = null;
    });
    return { decision, confirm, cancel, exportCurrent, enter };
}
