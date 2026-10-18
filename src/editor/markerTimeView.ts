import { pointCellAtTime, movePointCell, type PointCell } from './pointAnnotations';
import { DEFAULT_BEAT_SNAP, type EditorBeatSnapSetting } from './beatSnap';
import { collectMarkerBlockEvents, type MarkerBlockSelection } from './markerBlockOperations';
import type { EditorProjectV1, PointEventV1, RangeEventV1 } from './types';

export const MARKER_PLAYHEAD_RATIO = .15;
export const DEFAULT_MARKER_SPAN = 10;
export const normalizeMarkerSpan = (span: number): number => Number.isFinite(span) ? Math.min(10, Math.max(1, span)) : DEFAULT_MARKER_SPAN;

/** Runtime geometry only. Never persist this moving window in workspace.viewport. */
export interface MarkerTimeView {
    readonly startSeconds: number;
    readonly endSeconds: number;
    readonly spanSeconds: number;
    readonly cursorSeconds: number;
    readonly durationSeconds: number;
    readonly playheadRatio: number;
    readonly editable: boolean;
    readonly zoom: number;
}

export function createMarkerTimeView(cursor: number, duration: number, span = DEFAULT_MARKER_SPAN, playing = false): MarkerTimeView {
    const durationSeconds = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    const cursorSeconds = Math.min(durationSeconds, Math.max(0, Number.isFinite(cursor) ? cursor : 0));
    const spanSeconds = normalizeMarkerSpan(span);
    const startSeconds = cursorSeconds - MARKER_PLAYHEAD_RATIO * spanSeconds;
    return Object.freeze({ startSeconds, endSeconds: startSeconds + spanSeconds, spanSeconds, cursorSeconds,
        durationSeconds, playheadRatio: MARKER_PLAYHEAD_RATIO, editable: !playing, zoom: durationSeconds / spanSeconds });
}

export const markerTimeToX = (time: number, view: MarkerTimeView, width: number): number => (time - view.startSeconds) / view.spanSeconds * width;
export const markerXToTime = (x: number, view: MarkerTimeView, width: number): number => view.startSeconds + (width > 0 ? x / width : 0) * view.spanSeconds;
export const markerCanEditAt = (view: MarkerTimeView, time: number): boolean => view.editable && Number.isFinite(time)
    && time >= view.cursorSeconds && time <= view.durationSeconds && time <= view.endSeconds;
export const markerEventReachable = (view: MarkerTimeView, event: PointEventV1 | RangeEventV1): boolean => view.editable
    && ('atSeconds' in event ? event.atSeconds >= view.cursorSeconds : event.endSeconds > view.cursorSeconds);

/** The pointer must be in the editable area before snapping; never clamp song padding into an event. */
export function markerCellAtTime(raw: number, project: EditorProjectV1, view: MarkerTimeView, width: number,
    setting: Readonly<EditorBeatSnapSetting> = DEFAULT_BEAT_SNAP): PointCell | null {
    if (!markerCanEditAt(view, raw)) return null;
    let cell = pointCellAtTime(raw, project, width, setting);
    if (cell && cell.timeSeconds < view.cursorSeconds) {
        const next = movePointCell(cell.timeSeconds, 1, project, width, setting);
        cell = next && next.timeSeconds > cell.timeSeconds ? next : null;
    }
    return cell && markerCanEditAt(view, cell.timeSeconds) ? cell : null;
}

/** Freeze explicit event IDs so later commands cannot pull historical events into a selection. */
export function editableMarkerBlock(project: EditorProjectV1, selection: MarkerBlockSelection, view: MarkerTimeView): MarkerBlockSelection {
    return { ...selection, eventIds: collectMarkerBlockEvents(project, selection).filter(event => markerEventReachable(view, event)).map(event => event.id) };
}

export function assertMarkerBlockEditable(project: EditorProjectV1, selection: MarkerBlockSelection, view: MarkerTimeView, offset = 0): void {
    const events = collectMarkerBlockEvents(project, selection);
    if (!view.editable || events.some(event => !markerEventReachable(view, event)
        || ('atSeconds' in event ? event.atSeconds + offset < view.cursorSeconds : event.endSeconds + offset <= view.cursorSeconds))) {
        throw new Error('只能在暂停后操作播放线右侧的标记。');
    }
}
