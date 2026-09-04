import { normalizeEditorSeconds } from './projectCodec';
import { rangesOverlap } from './rangeAnnotations';
import {
    beatSecondsFor,
    segmentAtTime,
    segmentEndSeconds,
} from './tempoMap';
import type {
    EditorLaneV1,
    EditorProjectV1,
    PointEventV1,
    RangeEventV1,
} from './types';

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

export interface MarkerMeasureUnit {
    startSeconds: number;
    endSeconds: number;
    segmentId: string;
    kind: 'metered' | 'single-beat';
}

export type MarkerBlockErrorCode =
    | 'lane-not-found'
    | 'inner-class-not-found'
    | 'measure-unavailable'
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

const EPSILON = 1e-6;

const selectedLane = (
    project: EditorProjectV1,
    selection: Pick<MarkerBlockSelection, 'laneId' | 'innerClassId'>,
): EditorLaneV1 => {
    const lane = project.lanes.find((entry) => entry.id === selection.laneId);
    if (!lane) {
        throw new MarkerBlockError('lane-not-found', '找不到所选标记轨道。');
    }
    if (!lane.innerClasses.some((entry) => entry.id === selection.innerClassId)) {
        throw new MarkerBlockError('inner-class-not-found', '找不到所选标记分类。');
    }
    return lane;
};

const normalizedSelection = (
    project: EditorProjectV1,
    selection: MarkerBlockSelection,
): MarkerBlockSelection => {
    selectedLane(project, selection);
    const startSeconds = normalizeEditorSeconds(selection.startSeconds);
    const endSeconds = normalizeEditorSeconds(selection.endSeconds);
    if (
        startSeconds < 0
        || endSeconds > project.track.durationSeconds
        || startSeconds >= endSeconds
    ) {
        throw new MarkerBlockError(
            'target-out-of-bounds',
            '区间必须完整位于歌曲时间范围内。',
        );
    }
    return { ...selection, startSeconds, endSeconds };
};

export const markerMeasureAtTime = (
    project: Pick<EditorProjectV1, 'tempoMap' | 'track'>,
    timeSeconds: number,
): MarkerMeasureUnit => {
    const duration = project.track.durationSeconds;
    const clamped = Math.max(0, Math.min(duration, timeSeconds));
    const lookupTime = clamped >= duration
        ? Math.max(0, duration - EPSILON)
        : clamped;
    const segment = segmentAtTime(project.tempoMap, lookupTime);
    const segmentIndex = project.tempoMap.findIndex((entry) => entry.id === segment.id);
    const segmentEnd = segmentEndSeconds(project.tempoMap, segmentIndex, duration);
    if (segment.mode === 'single-beat') {
        return {
            startSeconds: segment.startSeconds,
            endSeconds: segmentEnd,
            segmentId: segment.id,
            kind: 'single-beat',
        };
    }
    if (segment.bpm === null) {
        throw new MarkerBlockError(
            'measure-unavailable',
            '当前 Tempo 区间还没有 BPM，不能按小节选择。',
        );
    }
    const measureSeconds = beatSecondsFor(segment.bpm) * segment.meter.numerator;
    const measureIndex = Math.max(0, Math.floor(
        (lookupTime - segment.startSeconds) / measureSeconds,
    ));
    const startSeconds = normalizeEditorSeconds(
        segment.startSeconds + measureIndex * measureSeconds,
    );
    return {
        startSeconds,
        endSeconds: normalizeEditorSeconds(Math.min(
            segmentEnd,
            startSeconds + measureSeconds,
        )),
        segmentId: segment.id,
        kind: 'metered',
    };
};

const assertSelectableSpan = (
    project: Pick<EditorProjectV1, 'tempoMap' | 'track'>,
    startSeconds: number,
    endSeconds: number,
) => {
    for (let index = 0; index < project.tempoMap.length; index += 1) {
        const segment = project.tempoMap[index]!;
        const segmentEnd = segmentEndSeconds(
            project.tempoMap,
            index,
            project.track.durationSeconds,
        );
        if (segmentEnd <= startSeconds || segment.startSeconds >= endSeconds) continue;
        if (segment.mode === 'metered' && segment.bpm === null) {
            throw new MarkerBlockError(
                'measure-unavailable',
                '选区经过尚未设置 BPM 的 Tempo 区间，无法按小节选择。',
            );
        }
    }
};

export const selectMarkerBlockByMeasures = (
    project: EditorProjectV1,
    laneId: string,
    innerClassId: string,
    anchorSeconds: number,
    extentSeconds = anchorSeconds,
): MarkerBlockSelection => {
    selectedLane(project, { laneId, innerClassId });
    const anchor = markerMeasureAtTime(project, anchorSeconds);
    const extent = markerMeasureAtTime(project, extentSeconds);
    const startSeconds = Math.min(anchor.startSeconds, extent.startSeconds);
    const endSeconds = Math.max(anchor.endSeconds, extent.endSeconds);
    assertSelectableSpan(project, startSeconds, endSeconds);
    const selection = normalizedSelection(project, {
        laneId,
        innerClassId,
        startSeconds,
        endSeconds,
    });
    return {
        ...selection,
        eventIds: collectMarkerBlockEvents(project, selection).map((event) => event.id),
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
        ? lane.events.filter((event) =>
            event.innerClassId === selection.innerClassId
            && (!selectedIds || selectedIds.has(event.id))
            && event.atSeconds >= selection.startSeconds
            && event.atSeconds < selection.endSeconds)
        : lane.events.filter((event) =>
            event.innerClassId === selection.innerClassId
            && (!selectedIds || selectedIds.has(event.id))
            && event.startSeconds >= selection.startSeconds
            && event.endSeconds <= selection.endSeconds);
};

export const markerBlockEventCount = (
    project: EditorProjectV1,
    selection: MarkerBlockSelection,
): number => collectMarkerBlockEvents(project, selection).length;

const assertPointConflicts = (
    existing: readonly PointEventV1[],
    candidates: readonly PointEventV1[],
) => {
    const occupied = new Set(existing.map((event) =>
        `${event.innerClassId}\u0000${normalizeEditorSeconds(event.atSeconds)}`));
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

const assertRangeConflicts = (
    existing: readonly RangeEventV1[],
    candidates: readonly RangeEventV1[],
) => {
    let conflicts = 0;
    const accepted = [...existing];
    for (const candidate of candidates) {
        if (accepted.some((event) =>
            event.innerClassId === candidate.innerClassId
            && rangesOverlap(
                event.startSeconds,
                event.endSeconds,
                candidate.startSeconds,
                candidate.endSeconds,
            ))) conflicts += 1;
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
        throw new MarkerBlockError(
            'target-out-of-bounds',
            '目标区间超出歌曲范围，整批操作已取消。',
        );
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
    const lanes = project.lanes.map((entry) => {
        if (entry.id !== lane.id) return entry;
        if (entry.eventKind === 'point') {
            const shiftedCandidates = (selected as PointEventV1[]).map((event) => ({
                ...event,
                atSeconds: normalizeEditorSeconds(event.atSeconds + shifted.offsetSeconds),
            }));
            assertPointConflicts(entry.events, shiftedCandidates);
            const candidates = shiftedCandidates.map((event) => ({
                ...event,
                id: createId(),
            }));
            copiedIds = candidates.map((event) => event.id);
            return {
                ...entry,
                events: [...entry.events, ...candidates].sort((left, right) =>
                    left.atSeconds - right.atSeconds || left.id.localeCompare(right.id)),
            };
        }
        const shiftedCandidates = (selected as RangeEventV1[]).map((event) => ({
            ...event,
            startSeconds: normalizeEditorSeconds(event.startSeconds + shifted.offsetSeconds),
            endSeconds: normalizeEditorSeconds(event.endSeconds + shifted.offsetSeconds),
        }));
        assertRangeConflicts(entry.events, shiftedCandidates);
        const candidates = shiftedCandidates.map((event) => ({
            ...event,
            id: createId(),
        }));
        copiedIds = candidates.map((event) => event.id);
        return {
            ...entry,
            events: [...entry.events, ...candidates].sort((left, right) =>
                left.startSeconds - right.startSeconds
                || left.endSeconds - right.endSeconds
                || left.id.localeCompare(right.id)),
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
    const selectedIds = new Set(selected.map((event) => event.id));
    const shifted = shiftedSelection(project, selection, targetStartSeconds);
    const lanes = project.lanes.map((entry) => {
        if (entry.id !== lane.id) return entry;
        if (entry.eventKind === 'point') {
            const remaining = entry.events.filter((event) => !selectedIds.has(event.id));
            const candidates = (selected as PointEventV1[]).map((event) => ({
                ...event,
                atSeconds: normalizeEditorSeconds(event.atSeconds + shifted.offsetSeconds),
            }));
            assertPointConflicts(remaining, candidates);
            return {
                ...entry,
                events: [...remaining, ...candidates].sort((left, right) =>
                    left.atSeconds - right.atSeconds || left.id.localeCompare(right.id)),
            };
        }
        const remaining = entry.events.filter((event) => !selectedIds.has(event.id));
        const candidates = (selected as RangeEventV1[]).map((event) => ({
            ...event,
            startSeconds: normalizeEditorSeconds(event.startSeconds + shifted.offsetSeconds),
            endSeconds: normalizeEditorSeconds(event.endSeconds + shifted.offsetSeconds),
        }));
        assertRangeConflicts(remaining, candidates);
        return {
            ...entry,
            events: [...remaining, ...candidates].sort((left, right) =>
                left.startSeconds - right.startSeconds
                || left.endSeconds - right.endSeconds
                || left.id.localeCompare(right.id)),
        };
    });
    return {
        project: { ...project, lanes },
        selection: { ...shifted.selection, eventIds: selected.map((event) => event.id) },
        eventCount: selected.length,
    };
};
