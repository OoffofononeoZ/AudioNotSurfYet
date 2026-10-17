import { nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { useEditorGrid } from './useEditorGrid';
import { moveEditorMarker } from './markerMovement';
import { editorXToTime } from './timeline';
import type { EditorProjectV1 } from './types';

interface Selection { laneId: string; innerClassId: string; eventId: string }
interface Preview extends Selection { time: number; original: number; valid: boolean; error: string }
interface Drag { selection: Selection; pointerId: number; element: HTMLElement; surface: HTMLElement; startX: number; offset: number; original: number; moved: boolean; fingerprint: string; eventFingerprint: string }
export function useMarkerMovement(project: () => EditorProjectV1, blocked: () => boolean,
    publish: (project: EditorProjectV1, immediate?: boolean) => void, report: (message: string) => void) {
    const grid = useEditorGrid();
    const selected = shallowRef<Selection | null>(null), preview = shallowRef<Preview | null>(null);
    let drag: Drag | null = null;
    function eventFor(laneId: string, eventId: string) { return project().lanes.find(item => item.id === laneId)?.events.find(item => item.id === eventId); }
    const fingerprint = () => `${project().projectId}:${JSON.stringify(project().tempoMap)}:${JSON.stringify(project().workspace.viewport)}:${JSON.stringify(grid.setting.value)}`;
    function select(laneId: string, eventId: string) {
        if (blocked()) return;
        const event = eventFor(laneId,eventId);
        if (event) selected.value = { laneId, eventId, innerClassId: event.innerClassId };
    }
    function stop() {
        const active = drag; drag = null; preview.value = null;
        if (active?.element.hasPointerCapture(active.pointerId)) active.element.releasePointerCapture(active.pointerId);
    }
    function cancel() { if (drag?.moved) report('已取消移动，标记保持原位。'); stop(); }
    function begin(event: PointerEvent, laneId: string, eventId: string) {
        if (blocked() || event.button !== 0) return;
        const item = eventFor(laneId,eventId), element = event.currentTarget as HTMLElement;
        const surface = element.closest<HTMLElement>('.marker-surface');
        if (!item || !surface) return;
        event.preventDefault(); event.stopPropagation(); select(laneId,eventId); element.focus({ preventScroll: true });
        const original = 'atSeconds' in item ? item.atSeconds : item.startSeconds;
        const bounds = surface.getBoundingClientRect();
        drag = { selection: selected.value!, pointerId: event.pointerId, element, surface, startX: event.clientX,
            offset: editorXToTime(event.clientX - bounds.left, project().workspace.viewport, bounds.width) - original,
            original, moved: false, fingerprint: fingerprint(), eventFingerprint:JSON.stringify(item) };
        element.setPointerCapture(event.pointerId);
    }
    function move(event: PointerEvent) {
        const active = drag;
        if (!active || active.pointerId !== event.pointerId) return;
        event.stopPropagation();
        if (fingerprint() !== active.fingerprint) { cancel(); return; }
        if (!active.moved && Math.abs(event.clientX - active.startX) < 4) return;
        active.moved = true;
        const bounds = active.surface.getBoundingClientRect();
        const raw = editorXToTime(event.clientX - bounds.left, project().workspace.viewport, bounds.width) - active.offset;
        const cell = grid.pointCellAtTime(raw, project(), bounds.width);
        let error = '';
        try {
            if (!cell) throw new Error('当前位置没有可用节拍网格。');
            moveEditorMarker(project(), active.selection.laneId, active.selection.eventId, cell.timeSeconds);
        } catch (failure) { error = failure instanceof Error ? failure.message : '无法移动标记。'; }
        preview.value = { ...active.selection, time: cell?.timeSeconds ?? active.original, original: active.original, valid: !error, error };
    }
    function finish(event: PointerEvent) {
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault(); event.stopPropagation();
        const active = drag, candidate = preview.value;
        stop();
        if (active.moved && candidate) {
            try {
                if (active.fingerprint !== fingerprint()) throw new Error('工程已变化，已取消移动。');
                const current = eventFor(candidate.laneId,candidate.eventId);
                if (!current || JSON.stringify(current) !== active.eventFingerprint) throw new Error('标记已变化，已取消移动。');
                if (!candidate.valid) throw new Error(candidate.error);
                publish(moveEditorMarker(project(), candidate.laneId, candidate.eventId, candidate.time), true);
                report(`已移动到 ${candidate.time.toFixed(3)} 秒。`);
            } catch (failure) { report(failure instanceof Error ? failure.message : '无法移动标记。'); }
        }
        void nextTick(() => active.element.isConnected && active.element.focus({ preventScroll: true }));
    }
    function key(event: KeyboardEvent, laneId: string, eventId: string): boolean {
        if (blocked()) return false;
        if (event.key === 'Escape' && drag) { event.preventDefault(); event.stopPropagation(); cancel(); return true; }
        if (!event.altKey || !['ArrowLeft','ArrowRight'].includes(event.key)) return false;
        event.preventDefault(); event.stopPropagation(); select(laneId,eventId);
        const item = eventFor(laneId,eventId), surface = (event.currentTarget as HTMLElement).closest<HTMLElement>('.marker-surface');
        if (!item || !surface) return true;
        const time = 'atSeconds' in item ? item.atSeconds : item.startSeconds;
        const cell = grid.movePointCell(time, event.key === 'ArrowLeft' ? -1 : 1, project(), surface.clientWidth);
        try { if (cell) { publish(moveEditorMarker(project(),laneId,eventId,cell.timeSeconds), true); report(`已移动到 ${cell.timeSeconds.toFixed(3)} 秒。`); } }
        catch (failure) { report(failure instanceof Error ? failure.message : '无法移动标记。'); }
        return true;
    }
    function hint(laneId: string, innerClassId: string): string {
        const value = preview.value;
        return value?.laneId === laneId && value.innerClassId === innerClassId
            ? value.valid ? `${value.time.toFixed(3)} 秒 · ${(value.time - value.original) >= 0 ? '+' : ''}${(value.time - value.original).toFixed(3)} 秒` : value.error : '';
    }
    watch(() => [project().projectId, blocked(), fingerprint()], () => { if (blocked() || drag && drag.fingerprint !== fingerprint()) cancel(); });
    watch(() => project().lanes, () => { if (selected.value && !eventFor(selected.value.laneId,selected.value.eventId)) { stop(); selected.value = null; } });
    onMounted(() => window.addEventListener('blur',cancel));
    onBeforeUnmount(() => { stop(); window.removeEventListener('blur',cancel); });
    return { begin, move, finish, cancel, key, select, hint, preview, selected,
        clear() { stop(); selected.value = null; },
        isSelected: (id: string) => selected.value?.eventId === id,
        invalid: (id: string) => preview.value?.eventId === id && !preview.value.valid,
        time: (id: string, original: number) => preview.value?.eventId === id ? preview.value.time : original,
    };
}
