import { pointCellAtTime, movePointCell } from './pointAnnotations';
import { normalizeEditorSeconds } from './projectCodec';
import { rangesOverlap } from './rangeAnnotations';
import { nextRangeCell } from './rangeAnnotations';
import { DEFAULT_BEAT_SNAP, type EditorBeatSnapSetting } from './beatSnap';
import type { EditorLaneV1, EditorProjectV1, PointEventV1, RangeEventV1 } from './types';

export interface MarkerBlockSelection {
    laneId: string;
    innerClassId: string;
    startSeconds: number;
    endSeconds: number;
    eventIds?: string[];
}

export interface MarkerBlockResult {
    project: EditorProjectV1;
    selection: MarkerBlockSelection;
    eventCount: number;
}

export type MarkerBlockErrorCode =
    | 'lane-not-found'
    | 'inner-class-not-found'
    | 'grid-unavailable'
    | 'empty-selection'
    | 'target-out-of-bounds'
    | 'point-conflict'
    | 'range-conflict';

export class MarkerBlockError extends Error {
    readonly code: MarkerBlockErrorCode;
    readonly conflictCount: number;

    constructor(code: MarkerBlockErrorCode, message: string, conflictCount = 0) {
        super(message);
        this.name = 'MarkerBlockError';
        this.code = code;
        this.conflictCount = conflictCount;
    }
}

const selectedLane = (
    project: EditorProjectV1,
    selection: Pick<MarkerBlockSelection, 'laneId' | 'innerClassId'>,
): EditorLaneV1 => {
    const lane = project.lanes.find(entry => entry.id === selection.laneId);
    if (!lane) {
        throw new MarkerBlockError('lane-not-found', '找不到所选标记轨道。');
    }
    if (!lane.innerClasses.some(entry => entry.id === selection.innerClassId)) {
        throw new MarkerBlockError('inner-class-not-found', '找不到所选标记分类。');
    }
    return lane;
};

const normalizedSelection = (project: EditorProjectV1, selection: MarkerBlockSelection): MarkerBlockSelection => {
    selectedLane(project, selection);
    const startSeconds = normalizeEditorSeconds(selection.startSeconds);
    const endSeconds = normalizeEditorSeconds(selection.endSeconds);
    if (startSeconds < 0 || endSeconds > project.track.durationSeconds || startSeconds >= endSeconds) {
        throw new MarkerBlockError('target-out-of-bounds', '区间必须完整位于歌曲时间范围内。');
    }
    return { ...selection, startSeconds, endSeconds };
};

export const markerGridSpanAtTime = (
    project: EditorProjectV1,
    time: number,
    setting: EditorBeatSnapSetting = DEFAULT_BEAT_SNAP,
) => {
    let cell = pointCellAtTime(time, project, 1, setting);
    if (cell && cell.timeSeconds >= project.track.durationSeconds)
        cell = movePointCell(cell.timeSeconds, -1, project, 1, setting);
    const next = cell && nextRangeCell(cell.timeSeconds, project, 1, setting);
    if (!cell || !next || next.timeSeconds <= cell.timeSeconds)
        throw new MarkerBlockError('grid-unavailable', '当前位置没有可用网格。');
    return { startSeconds: cell.timeSeconds, endSeconds: next.timeSeconds };
};

export const selectMarkerBlockByTime = (
    project: EditorProjectV1,
    laneId: string,
    innerClassId: string,
    anchorSeconds: number,
    extentSeconds = anchorSeconds,
    setting: EditorBeatSnapSetting = DEFAULT_BEAT_SNAP,
): MarkerBlockSelection => {
    selectedLane(project, { laneId, innerClassId });
    const anchor = markerGridSpanAtTime(project, anchorSeconds, setting),
        extent = markerGridSpanAtTime(project, extentSeconds, setting);
    const selection = normalizedSelection(project, {
        laneId,
        innerClassId,
        startSeconds: Math.min(anchor.startSeconds, extent.startSeconds),
        endSeconds: Math.max(anchor.endSeconds, extent.endSeconds),
    });
    const events = collectMarkerBlockEvents(project, selection);
    const ranges = events.filter((event): event is RangeEventV1 => 'startSeconds' in event);
    return {
        ...selection,
        startSeconds: Math.min(selection.startSeconds, ...ranges.map(event => event.startSeconds)),
        endSeconds: Math.max(selection.endSeconds, ...ranges.map(event => event.endSeconds)),
        eventIds: events.map(event => event.id),
    };
};

export const collectMarkerBlockEvents = (
    project: EditorProjectV1,
    selectionInput: MarkerBlockSelection,
): Array<PointEventV1 | RangeEventV1> => {
    const selection = normalizedSelection(project, selectionInput);
    const lane = selectedLane(project, selection);
    const selectedIds = selection.eventIds ? new Set(selection.eventIds) : null;
    return lane.eventKind === 'point'
        ? lane.events.filter(
              event =>
                  event.innerClassId === selection.innerClassId &&
                  (selectedIds
                      ? selectedIds.has(event.id)
                      : event.atSeconds >= selection.startSeconds &&
                        (event.atSeconds < selection.endSeconds ||
                            (selection.endSeconds === project.track.durationSeconds &&
                                event.atSeconds === selection.endSeconds))),
          )
        : lane.events.filter(
              event =>
                  event.innerClassId === selection.innerClassId &&
                  (selectedIds
                      ? selectedIds.has(event.id)
                      : event.startSeconds < selection.endSeconds && event.endSeconds > selection.startSeconds),
          );
};

export const markerBlockEventCount = (project: EditorProjectV1, selection: MarkerBlockSelection): number =>
    collectMarkerBlockEvents(project, selection).length;

export function deleteMarkerBlock(project: EditorProjectV1, selection: MarkerBlockSelection) {
    const ids = new Set(collectMarkerBlockEvents(project, selection).map(event => event.id));
    if (!ids.size) return { project, eventCount: 0 };
    const lanes = project.lanes.map(lane => {
        if (lane.id !== selection.laneId) return lane;
        return lane.eventKind === 'point'
            ? { ...lane, events: lane.events.filter(event => !ids.has(event.id)) }
            : { ...lane, events: lane.events.filter(event => !ids.has(event.id)) };
    });
    return { project: { ...project, lanes }, eventCount: ids.size };
}

const assertPointConflicts = (existing: readonly PointEventV1[], candidates: readonly PointEventV1[]) => {
    const occupied = new Set(
        existing.map(event => `${event.innerClassId}\u0000${normalizeEditorSeconds(event.atSeconds)}`),
    );
    let conflicts = 0;
    for (const candidate of candidates) {
        const key = `${candidate.innerClassId}\u0000${normalizeEditorSeconds(candidate.atSeconds)}`;
        if (occupied.has(key)) conflicts += 1;
        occupied.add(key);
    }
    if (conflicts > 0) {
        throw new MarkerBlockError(
            'point-conflict',
            `目标区间已有 ${conflicts} 个相同时间的点标记，整批操作已取消。`,
            conflicts,
        );
    }
};

const assertRangeConflicts = (existing: readonly RangeEventV1[], candidates: readonly RangeEventV1[]) => {
    let conflicts = 0;
    const accepted = [...existing];
    for (const candidate of candidates) {
        if (
            accepted.some(
                event =>
                    event.innerClassId === candidate.innerClassId &&
                    rangesOverlap(event.startSeconds, event.endSeconds, candidate.startSeconds, candidate.endSeconds),
            )
        )
            conflicts += 1;
        accepted.push(candidate);
    }
    if (conflicts > 0) {
        throw new MarkerBlockError(
            'range-conflict',
            `目标区间会产生 ${conflicts} 个范围重叠，整批操作已取消。`,
            conflicts,
        );
    }
};

const shiftedSelection = (
    project: EditorProjectV1,
    selection: MarkerBlockSelection,
    targetStartSeconds: number,
): { selection: MarkerBlockSelection; offsetSeconds: number } => {
    const source = normalizedSelection(project, selection);
    const length = source.endSeconds - source.startSeconds;
    const targetStart = normalizeEditorSeconds(targetStartSeconds);
    const targetEnd = normalizeEditorSeconds(targetStart + length);
    if (targetStart < 0 || targetEnd > project.track.durationSeconds) {
        throw new MarkerBlockError('target-out-of-bounds', '目标区间超出歌曲范围，整批操作已取消。');
    }
    return {
        selection: {
            ...source,
            startSeconds: targetStart,
            endSeconds: targetEnd,
        },
        offsetSeconds: targetStart - source.startSeconds,
    };
};

export const copyMarkerBlockAfter = (
    project: EditorProjectV1,
    selectionInput: MarkerBlockSelection,
    createId: () => string = () => crypto.randomUUID(),
): MarkerBlockResult => {
    const selection = normalizedSelection(project, selectionInput);
    const lane = selectedLane(project, selection);
    const selected = collectMarkerBlockEvents(project, selection);
    if (selected.length === 0) {
        throw new MarkerBlockError('empty-selection', '选区中没有可复制的标记。');
    }
    const shifted = shiftedSelection(project, selection, selection.endSeconds);
    let copiedIds: string[] = [];
    const lanes = project.lanes.map(entry => {
        if (entry.id !== lane.id) return entry;
        if (entry.eventKind === 'point') {
            const shiftedCandidates = (selected as PointEventV1[]).map(event => ({
                ...event,
                atSeconds: normalizeEditorSeconds(event.atSeconds + shifted.offsetSeconds),
            }));
            assertPointConflicts(entry.events, shiftedCandidates);
            const candidates = shiftedCandidates.map(event => ({
                ...event,
                id: createId(),
            }));
            copiedIds = candidates.map(event => event.id);
            return {
                ...entry,
                events: [...entry.events, ...candidates].sort(
                    (left, right) => left.atSeconds - right.atSeconds || left.id.localeCompare(right.id),
                ),
            };
        }
        const shiftedCandidates = (selected as RangeEventV1[]).map(event => ({
            ...event,
            startSeconds: normalizeEditorSeconds(event.startSeconds + shifted.offsetSeconds),
            endSeconds: normalizeEditorSeconds(event.endSeconds + shifted.offsetSeconds),
        }));
        assertRangeConflicts(entry.events, shiftedCandidates);
        const candidates = shiftedCandidates.map(event => ({
            ...event,
            id: createId(),
        }));
        copiedIds = candidates.map(event => event.id);
        return {
            ...entry,
            events: [...entry.events, ...candidates].sort(
                (left, right) =>
                    left.startSeconds - right.startSeconds ||
                    left.endSeconds - right.endSeconds ||
                    left.id.localeCompare(right.id),
            ),
        };
    });
    return {
        project: { ...project, lanes },
        selection: { ...shifted.selection, eventIds: copiedIds },
        eventCount: selected.length,
    };
};

export const moveMarkerBlock = (
    project: EditorProjectV1,
    selectionInput: MarkerBlockSelection,
    targetStartSeconds: number,
): MarkerBlockResult => {
    const selection = normalizedSelection(project, selectionInput);
    const lane = selectedLane(project, selection);
    const selected = collectMarkerBlockEvents(project, selection);
    if (selected.length === 0) {
        throw new MarkerBlockError('empty-selection', '选区中没有可移动的标记。');
    }
    const selectedIds = new Set(selected.map(event => event.id));
    const shifted = shiftedSelection(project, selection, targetStartSeconds);
    const lanes = project.lanes.map(entry => {
        if (entry.id !== lane.id) return entry;
        if (entry.eventKind === 'point') {
            const remaining = entry.events.filter(event => !selectedIds.has(event.id));
            const candidates = (selected as PointEventV1[]).map(event => ({
                ...event,
                atSeconds: normalizeEditorSeconds(event.atSeconds + shifted.offsetSeconds),
            }));
            assertPointConflicts(remaining, candidates);
            return {
                ...entry,
                events: [...remaining, ...candidates].sort(
                    (left, right) => left.atSeconds - right.atSeconds || left.id.localeCompare(right.id),
                ),
            };
        }
        const remaining = entry.events.filter(event => !selectedIds.has(event.id));
        const candidates = (selected as RangeEventV1[]).map(event => ({
            ...event,
            startSeconds: normalizeEditorSeconds(event.startSeconds + shifted.offsetSeconds),
            endSeconds: normalizeEditorSeconds(event.endSeconds + shifted.offsetSeconds),
        }));
        assertRangeConflicts(remaining, candidates);
        return {
            ...entry,
            events: [...remaining, ...candidates].sort(
                (left, right) =>
                    left.startSeconds - right.startSeconds ||
                    left.endSeconds - right.endSeconds ||
                    left.id.localeCompare(right.id),
            ),
        };
    });
    return {
        project: { ...project, lanes },
        selection: { ...shifted.selection, eventIds: selected.map(event => event.id) },
        eventCount: selected.length,
    };
};
