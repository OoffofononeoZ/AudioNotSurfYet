import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { createPointEvent, deletePointEvent, movePointCell, pointCellAtTime } from './pointAnnotations';
import { createRangeEvent, deleteRangeEvent, nextRangeCell, updateRangeEvent } from './rangeAnnotations';
import { moveEditorMarker } from './markerMovement';
import {
    markerCanEditAt,
    markerCellAtTime,
    markerEventReachable,
    markerXToTime,
    type MarkerTimeView,
} from './markerTimeView';
import { useMarkerBlocks } from './useMarkerBlocks';
import { normalizeEditorSeconds } from './projectCodec';
import type { EditorBeatSnapSetting } from './beatSnap';
import type { EditorProjectV1, PointEventV1, RangeEventV1 } from './types';

interface Row {
    laneId: string;
    innerClassId: string;
}
interface Candidate extends Row {
    timeSeconds: number;
}
interface Pending extends Row {
    startSeconds: number;
}
type MarkerEvent = PointEventV1 | RangeEventV1;
interface Drag extends Row {
    kind: 'create' | 'event' | 'endpoint' | 'select' | 'block';
    element: HTMLElement;
    pointerId: number;
    startX: number;
    rawStart: number;
    moved: boolean;
    source: string;
    eventId?: string;
    endpoint?: 'start' | 'end';
    original?: number;
}
interface Preview {
    project: EditorProjectV1 | null;
    error: string;
}

export function useMarkerEditing(
    project: () => EditorProjectV1,
    view: () => MarkerTimeView,
    active: () => boolean,
    setting: () => EditorBeatSnapSetting,
    publish: (project: EditorProjectV1) => void,
    report: (text: string) => void,
) {
    const candidate = shallowRef<Candidate | null>(null),
        pending = shallowRef<Pending | null>(null);
    const selected = shallowRef<string | null>(null),
        drag = shallowRef<Drag | null>(null),
        preview = shallowRef<Preview | null>(null);
    const menu = shallowRef<{
        element: HTMLElement;
        x: number;
        y: number;
        time: number;
        kind: 'point' | 'range';
    } | null>(null);
    const blocks = useMarkerBlocks(project, view, setting, publish, report);
    const same = (value: Row | null, row: Row) =>
        value?.laneId === row.laneId && value?.innerClassId === row.innerClassId;
    const enabled = () => active() && view().editable;
    const fingerprint = () => JSON.stringify([project().projectId, project().tempoMap, project().lanes, setting()]);
    const item = (row: Row, id: string) =>
        project()
            .lanes.find(lane => lane.id === row.laneId)
            ?.events.find(event => event.id === id);
    const attempt = (job: () => void) => {
        try {
            job();
        } catch (error) {
            report(error instanceof Error ? error.message : '无法编辑标记。');
        }
    };
    const cell = (raw: number, width: number) => markerCellAtTime(raw, project(), view(), width, setting());
    function edgeCell(end: boolean, width: number) {
        const time = end ? Math.min(view().durationSeconds, view().endSeconds) : Math.max(0, view().startSeconds);
        const result = cell(time, width);
        if (result || !end) return result;
        const nearest = pointCellAtTime(time, project(), width, setting());
        const previous =
            nearest && nearest.timeSeconds > time
                ? movePointCell(nearest.timeSeconds, -1, project(), width, setting())
                : null;
        return previous && markerCanEditAt(view(), previous.timeSeconds) ? previous : null;
    }
    function stop() {
        const previous = drag.value;
        drag.value = null;
        preview.value = null;
        blocks.preview.value = null;
        if (previous?.element.hasPointerCapture(previous.pointerId))
            previous.element.releasePointerCapture(previous.pointerId);
    }
    function cancel() {
        if (drag.value?.moved) report('已取消拖动，标记保持原位。');
        stop();
    }
    function escape() {
        cancel();
        pending.value = null;
        menu.value = null;
        if (blocks.selection.value) blocks.clear();
        else blocks.mode.value = false;
        report('已取消。');
    }
    function clear() {
        stop();
        candidate.value = null;
        pending.value = null;
        selected.value = null;
        menu.value = null;
        blocks.clear();
    }
    function at(event: MouseEvent | PointerEvent, element: HTMLElement) {
        const bounds = element.getBoundingClientRect();
        return markerXToTime(event.clientX - bounds.left, view(), bounds.width);
    }
    function focus(row: Row, width: number) {
        if (!enabled()) return;
        const initial = cell(view().cursorSeconds, width);
        if (!same(candidate.value, row) && initial) candidate.value = { ...row, timeSeconds: initial.timeSeconds };
    }
    function create(row: Row, time: number, width: number) {
        if (!enabled() || !markerCanEditAt(view(), time)) return;
        const lane = project().lanes.find(value => value.id === row.laneId);
        if (lane?.eventKind === 'point') {
            const result = createPointEvent(project(), row.laneId, row.innerClassId, time);
            publish(result.project);
            selected.value = result.event.id;
            report(`已添加 ${time.toFixed(3)} 秒标记。`);
        } else if (lane?.eventKind === 'range') {
            if (pending.value && !same(pending.value, row)) {
                report('请在原分类选择终点，或先取消待完成范围。');
                return;
            }
            if (!pending.value) {
                const next = nextRangeCell(time, project(), width, setting());
                if (!next || next.timeSeconds <= time || next.timeSeconds > view().durationSeconds) {
                    report('此位置之后没有可用的范围终点。');
                    return;
                }
                pending.value = { ...row, startSeconds: time };
                report('可跳转后选择终点');
            } else {
                const start = pending.value!.startSeconds;
                const minimum = nextRangeCell(start, project(), width, setting())?.timeSeconds;
                const result = createRangeEvent(
                    project(),
                    row.laneId,
                    row.innerClassId,
                    start,
                    time,
                    undefined,
                    minimum,
                );
                publish(result.project);
                pending.value = null;
                selected.value = result.event.id;
                report('已添加范围标记。');
            }
        }
    }
    function down(event: PointerEvent, row: Row) {
        if (event.button !== 0 || !enabled() || drag.value) return;
        const element = event.currentTarget as HTMLElement,
            raw = at(event, element);
        if (!markerCanEditAt(view(), raw)) return;
        const target = (event.target as HTMLElement).closest<HTMLElement>('[data-event-id]');
        const value = target?.dataset.eventId ? item(row, target.dataset.eventId) : null;
        event.preventDefault();
        menu.value = null;
        (target ?? element).focus({ preventScroll: true });
        const snapped = cell(raw, element.clientWidth);
        if (snapped) candidate.value = { ...row, timeSeconds: snapped.timeSeconds };
        let kind: Drag['kind'] = 'create';
        const selection = blocks.selection.value;
        if (blocks.mode.value) {
            kind =
                same(selection, row) && raw >= selection!.startSeconds && raw <= selection!.endSeconds
                    ? 'block'
                    : 'select';
            if (kind === 'select') attempt(() => blocks.select(row.laneId, row.innerClassId, raw));
        } else if (value) {
            if (!markerEventReachable(view(), value)) return;
            selected.value = value.id;
            kind = target?.dataset.endpoint ? 'endpoint' : 'event';
        } else if (!snapped) return;
        drag.value = {
            ...row,
            kind,
            element,
            pointerId: event.pointerId,
            startX: event.clientX,
            rawStart: raw,
            moved: false,
            source: fingerprint(),
            eventId: value?.id,
            endpoint: target?.dataset.endpoint as Drag['endpoint'],
            original: value ? ('atSeconds' in value ? value.atSeconds : value.startSeconds) : undefined,
        };
        element.setPointerCapture(event.pointerId);
    }
    function movedProject(state: Drag, raw: number): EditorProjectV1 | null {
        const value = state.eventId ? item(state, state.eventId) : null;
        if (state.kind === 'event' && value) {
            if (!markerCanEditAt(view(), raw)) throw new Error('只能在歌曲范围内操作。');
            const time = normalizeEditorSeconds(raw - (state.rawStart - state.original!));
            // Use the existing nearest-cell algorithm without applying the new-endpoint boundary to a crossing range's start.
            const nearest = markerCellForMove(time, state.element.clientWidth);
            if (!nearest) throw new Error('当前位置没有可用节拍网格。');
            return moveEditorMarker(project(), state.laneId, value.id, nearest.timeSeconds);
        }
        if (state.kind === 'endpoint' && value && 'endSeconds' in value) {
            const snapped = cell(raw, state.element.clientWidth);
            if (!snapped) throw new Error('当前位置没有可用节拍网格。');
            const start = state.endpoint === 'start' ? snapped.timeSeconds : value.startSeconds;
            return updateRangeEvent(
                project(),
                state.laneId,
                value.id,
                start,
                state.endpoint === 'end' ? snapped.timeSeconds : value.endSeconds,
                nextRangeCell(start, project(), state.element.clientWidth, setting())?.timeSeconds,
            );
        }
        if (state.kind === 'block') {
            const selection = blocks.selection.value;
            const snapped = cell(raw, state.element.clientWidth);
            if (!selection || !snapped) throw new Error('当前位置没有可用节拍网格。');
            const target = markerCellForMove(selection.startSeconds + raw - state.rawStart, state.element.clientWidth);
            if (!target) throw new Error('当前位置没有可用节拍网格。');
            return blocks.move(target.timeSeconds, false)?.project ?? null;
        }
        return null;
    }
    function markerCellForMove(time: number, width: number) {
        return pointCellAtTime(time, project(), width, setting());
    }
    function move(event: PointerEvent, row: Row) {
        const state = drag.value,
            element = event.currentTarget as HTMLElement,
            raw = at(event, element);
        if (!state) {
            if (enabled()) {
                const snapped = cell(raw, element.clientWidth);
                candidate.value = snapped ? { ...row, timeSeconds: snapped.timeSeconds } : null;
            }
            return;
        }
        if (state.pointerId !== event.pointerId) return;
        if (!enabled() || fingerprint() !== state.source) {
            cancel();
            return;
        }
        if (Math.abs(event.clientX - state.startX) >= 4) state.moved = true;
        if (!state.moved) return;
        if (state.kind === 'select') {
            attempt(() => blocks.select(state.laneId, state.innerClassId, state.rawStart, raw));
            return;
        }
        try {
            preview.value = { project: movedProject(state, raw), error: '' };
        } catch (error) {
            blocks.preview.value = null;
            preview.value = { project: null, error: error instanceof Error ? error.message : '无法移动。' };
        }
    }
    function up(event: PointerEvent) {
        const state = drag.value;
        if (!state || state.pointerId !== event.pointerId) return;
        const result = preview.value,
            blockPreview = blocks.preview.value;
        stop();
        if (!enabled() || fingerprint() !== state.source) return;
        attempt(() => {
            if (state.kind === 'create' && !state.moved && same(candidate.value, state))
                create(state, candidate.value!.timeSeconds, state.element.clientWidth);
            else if (state.moved && result?.error) report(result.error);
            else if (state.moved && state.kind === 'block' && blockPreview)
                blocks.move(blockPreview.startSeconds, true);
            else if (state.moved && result?.project) {
                publish(result.project);
                report('标记已移动。');
            }
        });
    }
    function remove(row: Row, id: string) {
        if (!enabled()) return;
        const value = item(row, id);
        if (!value || !markerEventReachable(view(), value)) return;
        publish(
            'atSeconds' in value
                ? deletePointEvent(project(), row.laneId, id)
                : deleteRangeEvent(project(), row.laneId, id),
        );
        selected.value = null;
        report('标记已删除。');
    }
    function context(event: MouseEvent, row: Row) {
        event.preventDefault();
        const element = event.currentTarget as HTMLElement,
            time = at(event, element);
        if (time < 0 || time > view().durationSeconds) return;
        const id = (event.target as HTMLElement).closest<HTMLElement>('[data-event-id]')?.dataset.eventId;
        if (id) {
            attempt(() => remove(row, id));
            return;
        }
        const bounds = element.getBoundingClientRect();
        menu.value = {
            element,
            time,
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
            kind: project().lanes.find(lane => lane.id === row.laneId)!.eventKind,
        };
    }
    function key(event: KeyboardEvent, row: Row) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            escape();
            return;
        }
        if (!enabled()) return;
        attempt(() => {
            const element = event.currentTarget as HTMLElement;
            if (
                blocks.mode.value &&
                !blocks.selection.value &&
                event.shiftKey &&
                ['ArrowLeft', 'ArrowRight'].includes(event.key)
            ) {
                focus(row, element.clientWidth);
                if (same(candidate.value, row))
                    blocks.select(row.laneId, row.innerClassId, candidate.value!.timeSeconds);
            }
            if (blocks.key(event, element.clientWidth)) return;
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault();
                const surfaces = [
                    ...element.closest('.marker-scroll')!.querySelectorAll<HTMLElement>('.marker-surface'),
                ];
                surfaces[surfaces.indexOf(element) + (event.key === 'ArrowUp' ? -1 : 1)]?.focus({
                    preventScroll: true,
                });
                return;
            }
            const target = (event.target as HTMLElement).closest<HTMLElement>('[data-event-id]');
            const value = target?.dataset.eventId ? item(row, target.dataset.eventId) : null;
            if (value) {
                if (!markerEventReachable(view(), value)) return;
                selected.value = value.id;
                if (['Delete', 'Backspace'].includes(event.key)) {
                    event.preventDefault();
                    remove(row, value.id);
                    return;
                }
                if (target?.dataset.endpoint && 'endSeconds' in value && ['Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    const endpoint = target.dataset.endpoint,
                        current = endpoint === 'start' ? value.startSeconds : value.endSeconds;
                    const next = edgeCell(event.key === 'End', element.clientWidth);
                    if (next && markerCanEditAt(view(), current)) {
                        const start = endpoint === 'start' ? next.timeSeconds : value.startSeconds;
                        publish(
                            updateRangeEvent(
                                project(),
                                row.laneId,
                                value.id,
                                start,
                                endpoint === 'end' ? next.timeSeconds : value.endSeconds,
                                nextRangeCell(start, project(), element.clientWidth, setting())?.timeSeconds,
                            ),
                        );
                    }
                    return;
                }
                const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
                if (!direction) return;
                if (target?.dataset.endpoint && 'endSeconds' in value) {
                    event.preventDefault();
                    const endpoint = target.dataset.endpoint,
                        time = endpoint === 'start' ? value.startSeconds : value.endSeconds;
                    const next = movePointCell(
                        time,
                        direction,
                        project(),
                        element.clientWidth,
                        event.shiftKey ? { ...setting(), divisor: 1 } : setting(),
                    );
                    if (next && markerCanEditAt(view(), time) && markerCanEditAt(view(), next.timeSeconds)) {
                        const start = endpoint === 'start' ? next.timeSeconds : value.startSeconds;
                        publish(
                            updateRangeEvent(
                                project(),
                                row.laneId,
                                value.id,
                                start,
                                endpoint === 'end' ? next.timeSeconds : value.endSeconds,
                                nextRangeCell(start, project(), element.clientWidth, setting())?.timeSeconds,
                            ),
                        );
                    }
                } else if (event.altKey) {
                    event.preventDefault();
                    const time = 'atSeconds' in value ? value.atSeconds : value.startSeconds;
                    const next = movePointCell(time, direction, project(), element.clientWidth, setting());
                    if (next) publish(moveEditorMarker(project(), row.laneId, value.id, next.timeSeconds));
                }
                return;
            }
            focus(row, element.clientWidth);
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (same(candidate.value, row)) {
                    if (blocks.mode.value) blocks.select(row.laneId, row.innerClassId, candidate.value!.timeSeconds);
                    else create(row, candidate.value!.timeSeconds, element.clientWidth);
                }
            } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next =
                    event.key === 'Home'
                        ? edgeCell(false, element.clientWidth)
                        : event.key === 'End'
                          ? edgeCell(true, element.clientWidth)
                          : movePointCell(
                                candidate.value?.timeSeconds ?? view().cursorSeconds,
                                event.key === 'ArrowLeft' ? -1 : 1,
                                project(),
                                element.clientWidth,
                                setting(),
                            );
                if (next && markerCanEditAt(view(), next.timeSeconds))
                    candidate.value = { ...row, timeSeconds: next.timeSeconds };
            } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                event.preventDefault();
                if (same(candidate.value, row))
                    menu.value = {
                        element,
                        time: candidate.value!.timeSeconds,
                        x: element.clientWidth * 0.5,
                        y: 20,
                        kind: project().lanes.find(lane => lane.id === row.laneId)!.eventKind,
                    };
            }
        });
    }
    watch(
        () => `${view().cursorSeconds}:${view().spanSeconds}:${view().editable}`,
        () => {
            cancel();
            candidate.value = null;
            menu.value = null;
        },
    );
    watch(
        () => `${project().projectId}:${project().track.contentHash}:${active()}`,
        () => {
            clear();
            blocks.mode.value = false;
        },
    );
    watch(
        () => [project().lanes, project().tempoMap, setting()],
        () => {
            if (drag.value && drag.value.source !== fingerprint()) cancel();
            if (
                pending.value &&
                !project()
                    .lanes.find(lane => lane.id === pending.value!.laneId)
                    ?.innerClasses.some(category => category.id === pending.value!.innerClassId)
            )
                pending.value = null;
            const selection = blocks.selection.value;
            if (
                selection &&
                !project()
                    .lanes.find(lane => lane.id === selection.laneId)
                    ?.innerClasses.some(category => category.id === selection.innerClassId)
            )
                blocks.clear();
            if (selected.value && !project().lanes.some(lane => lane.events.some(event => event.id === selected.value)))
                selected.value = null;
        },
    );
    onMounted(() => window.addEventListener('blur', cancel));
    onBeforeUnmount(() => {
        clear();
        window.removeEventListener('blur', cancel);
    });
    const previewEvents = computed(
        () =>
            new Map(
                preview.value?.project?.lanes
                    .flatMap(lane => lane.events as MarkerEvent[])
                    .map(event => [event.id, event]) ?? [],
            ),
    );
    return {
        candidate,
        pending,
        selected,
        drag,
        preview,
        menu,
        blocks,
        same,
        focus,
        down,
        move,
        up,
        key,
        context,
        cancel,
        escape,
        clear,
        cancelPending() {
            if (pending.value) {
                pending.value = null;
                report('已取消待完成范围。');
            }
        },
        displayEvent(event: MarkerEvent) {
            return previewEvents.value.get(event.id) ?? event;
        },
    };
}
export type MarkerEditing = ReturnType<typeof useMarkerEditing>;
