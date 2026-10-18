import { ref, shallowRef } from 'vue';
import { assertMarkerBlockEditable, editableMarkerBlock, type MarkerTimeView } from './markerTimeView';
import { copyMarkerBlockAfter, markerMeasureAtTime, moveMarkerBlock, selectMarkerBlockByMeasures, type MarkerBlockSelection } from './markerBlockOperations';
import type { EditorProjectV1 } from './types';
import type { EditorBeatSnapSetting } from './beatSnap';
import { movePointCell } from './pointAnnotations';

export function useMarkerBlocks(project: () => EditorProjectV1, view: () => MarkerTimeView, setting: () => EditorBeatSnapSetting,
    publish: (value: EditorProjectV1) => void, report: (text: string) => void) {
    const mode = ref(false), selection = shallowRef<MarkerBlockSelection | null>(null), preview = shallowRef<MarkerBlockSelection | null>(null);
    function select(laneId: string, innerClassId: string, anchor: number, extent = anchor) {
        if (!view().editable || extent < view().cursorSeconds) return;
        selection.value = editableMarkerBlock(project(), selectMarkerBlockByMeasures(project(), laneId, innerClassId, anchor, extent), view());
        preview.value = null;
    }
    function move(target: number, commit: boolean) {
        if (!selection.value) return;
        assertMarkerBlockEditable(project(), selection.value, view(), target - selection.value.startSeconds);
        const result = moveMarkerBlock(project(), selection.value, target);
        if (commit) { publish(result.project); selection.value = result.selection; preview.value = null; report(`已移动 ${result.eventCount} 个标记。`); }
        else preview.value = result.selection;
        return result;
    }
    function key(event: KeyboardEvent, width: number): boolean {
        if (!mode.value || !selection.value || !view().editable) return false;
        const current = selection.value;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
            event.preventDefault(); event.stopPropagation();
            assertMarkerBlockEditable(project(), current, view());
            assertMarkerBlockEditable(project(), current, view(), current.endSeconds - current.startSeconds);
            const result = copyMarkerBlockAfter(project(), current);
            publish(result.project); selection.value = result.selection; report(`已向后复制 ${result.eventCount} 个标记。`);
            return true;
        }
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !(event.shiftKey || event.altKey)) return false;
        event.preventDefault(); event.stopPropagation();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        if (event.altKey) {
            const cell = movePointCell(current.startSeconds,direction,project(),width,setting());
            if (cell) move(cell.timeSeconds,true);
        } else {
            const adjacent = markerMeasureAtTime(project(),direction < 0 ? Math.max(view().cursorSeconds,current.startSeconds - 1e-6) : current.endSeconds + 1e-6);
            const start = direction < 0 ? Math.min(current.startSeconds,adjacent.startSeconds) : current.startSeconds;
            const end = direction > 0 ? Math.max(current.endSeconds,adjacent.endSeconds) : current.endSeconds;
            select(current.laneId,current.innerClassId,Math.max(view().cursorSeconds,start),end - 1e-6);
        }
        return true;
    }
    function clear() { selection.value = null; preview.value = null; }
    function toggle() { mode.value = !mode.value; clear(); report(mode.value ? '区间操作：左键拖空白选小节，拖选区移动；Ctrl/Cmd+C 向后复制。' : '已关闭区间操作。'); }
    return { mode, selection, preview, select, move, key, clear, toggle };
}
