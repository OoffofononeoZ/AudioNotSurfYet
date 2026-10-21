import { ref, shallowRef } from 'vue';
import { assertMarkerBlockEditable, editableMarkerBlock, type MarkerTimeView } from './markerTimeView';
import {
    copyMarkerBlockAfter,
    deleteMarkerBlock,
    markerGridSpanAtTime,
    moveMarkerBlock,
    selectMarkerBlockByTime,
    type MarkerBlockSelection,
} from './markerBlockOperations';
import type { EditorProjectV2 } from './types';
import type { EditorBeatSnapSetting } from './beatSnap';
import { movePointCell } from './pointAnnotations';

export function useMarkerBlocks(
    project: () => EditorProjectV2,
    view: () => MarkerTimeView,
    setting: () => EditorBeatSnapSetting,
    publish: (value: EditorProjectV2) => void,
    report: (text: string) => void,
) {
    const mode = ref(false),
        selection = shallowRef<MarkerBlockSelection | null>(null),
        preview = shallowRef<MarkerBlockSelection | null>(null),
        deletion = shallowRef<MarkerBlockSelection | null>(null);
    function selectionAt(laneId: string, innerClassId: string, anchor: number, extent = anchor) {
        return editableMarkerBlock(
            project(),
            selectMarkerBlockByTime(project(), laneId, innerClassId, anchor, extent, setting()),
            view(),
        );
    }
    function select(laneId: string, innerClassId: string, anchor: number, extent = anchor) {
        if (!view().editable) return;
        selection.value = selectionAt(laneId, innerClassId, anchor, extent);
        preview.value = null;
    }
    function selectDeletion(laneId: string, innerClassId: string, anchor: number, extent: number) {
        deletion.value = null;
        if (view().editable) deletion.value = selectionAt(laneId, innerClassId, anchor, extent);
    }
    function remove(current: MarkerBlockSelection) {
        assertMarkerBlockEditable(project(), current, view());
        const result = deleteMarkerBlock(project(), current);
        if (result.eventCount) {
            publish(result.project);
            clear();
        }
        report(result.eventCount ? `已删除 ${result.eventCount} 个标记。` : '选区内没有标记。');
    }
    function move(target: number, commit: boolean) {
        if (!selection.value) return;
        assertMarkerBlockEditable(project(), selection.value, view(), target - selection.value.startSeconds);
        const result = moveMarkerBlock(project(), selection.value, target);
        if (commit) {
            publish(result.project);
            selection.value = result.selection;
            preview.value = null;
            report(`已移动 ${result.eventCount} 个标记。`);
        } else preview.value = result.selection;
        return result;
    }
    function key(event: KeyboardEvent, width: number): boolean {
        if (!mode.value || !selection.value || !view().editable) return false;
        const current = selection.value;
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            event.stopPropagation();
            assertMarkerBlockEditable(project(), current, view());
            assertMarkerBlockEditable(project(), current, view(), current.endSeconds - current.startSeconds);
            const result = copyMarkerBlockAfter(project(), current);
            publish(result.project);
            selection.value = result.selection;
            report(`已向后复制 ${result.eventCount} 个标记。`);
            return true;
        }
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || !(event.shiftKey || event.altKey)) return false;
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        if (event.altKey) {
            const cell = movePointCell(current.startSeconds, direction, project(), width, setting());
            if (cell) move(cell.timeSeconds, true);
        } else {
            const adjacent = markerGridSpanAtTime(
                project(),
                direction < 0
                    ? (movePointCell(current.startSeconds, -1, project(), width, setting())?.timeSeconds ??
                          current.startSeconds)
                    : current.endSeconds,
                setting(),
            );
            const start = direction < 0 ? Math.min(current.startSeconds, adjacent.startSeconds) : current.startSeconds;
            const end = direction > 0 ? Math.max(current.endSeconds, adjacent.endSeconds) : current.endSeconds;
            select(
                current.laneId,
                current.innerClassId,
                Math.max(Math.max(0, view().startSeconds), start),
                movePointCell(end, -1, project(), width, setting())?.timeSeconds ?? start,
            );
        }
        return true;
    }
    function clear() {
        selection.value = null;
        preview.value = null;
        deletion.value = null;
    }
    function toggle() {
        mode.value = !mode.value;
        clear();
        report(mode.value ? '区间操作：左键框选及移动，右键框选后松开删除；Ctrl/Cmd+C 向后复制。' : '已关闭区间操作。');
    }
    return { mode, selection, preview, deletion, select, selectDeletion, remove, move, key, clear, toggle };
}
