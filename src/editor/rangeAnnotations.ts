import type { PersistedTimelineViewport } from '../types/session';
import { DEFAULT_BEAT_SNAP, type EditorBeatSnapSetting } from './beatSnap';
import { normalizeEditorSeconds } from './projectCodec';
import { movePointCell, pointCellAtTime, type PointCell } from './pointAnnotations';
import type { EditorProjectV2, InnerClassV1, RangeEventV1, RangeLaneV1 } from './types';

export type RangeAnnotationErrorCode =
    | 'lane-not-found'
    | 'inner-class-not-found'
    | 'empty-label'
    | 'last-inner-class'
    | 'resolution-required'
    | 'invalid-migration-target'
    | 'migration-conflict'
    | 'range-not-found'
    | 'range-invalid'
    | 'range-overlap'
    | 'grid-unavailable';

export class RangeAnnotationError extends Error {
    readonly code: RangeAnnotationErrorCode;
    readonly conflictCount: number;

    constructor(code: RangeAnnotationErrorCode, message: string, conflictCount = 0) {
        super(message);
        this.name = 'RangeAnnotationError';
        this.code = code;
        this.conflictCount = conflictCount;
    }
}

export type RangeInnerClassRemovalResolution =
    { kind: 'delete-events' } | { kind: 'migrate'; targetInnerClassId: string };

const laneIndex = (project: EditorProjectV2, laneId: string): number => {
    const index = project.lanes.findIndex(lane => lane.id === laneId);
    if (index < 0 || project.lanes[index]?.eventKind !== 'range') {
        throw new RangeAnnotationError('lane-not-found', '找不到对应的范围标记轨道。');
    }
    return index;
};

const rangeLane = (project: EditorProjectV2, laneId: string): RangeLaneV1 =>
    project.lanes[laneIndex(project, laneId)] as RangeLaneV1;

const withRangeLane = (
    project: EditorProjectV2,
    laneId: string,
    update: (lane: RangeLaneV1) => RangeLaneV1,
): EditorProjectV2 => {
    const index = laneIndex(project, laneId);
    const lanes = [...project.lanes];
    lanes[index] = update(lanes[index] as RangeLaneV1);
    return { ...project, lanes };
};

const labelValue = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new RangeAnnotationError('empty-label', '名称不能为空。');
    }
    return trimmed;
};

const nextLaneName = (project: EditorProjectV2): string => {
    const names = new Set(project.lanes.map(lane => lane.name));
    for (let index = 1; ; index += 1) {
        const candidate = `范围标记 ${index}`;
        if (!names.has(candidate)) return candidate;
    }
};

const nextClassLabel = (lane: RangeLaneV1): string => {
    const labels = new Set(lane.innerClasses.map(entry => entry.label));
    for (let index = 1; ; index += 1) {
        const candidate = `分类 ${index}`;
        if (!labels.has(candidate)) return candidate;
    }
};

const sortEvents = (events: RangeEventV1[]) =>
    [...events].sort(
        (left, right) =>
            left.startSeconds - right.startSeconds ||
            left.endSeconds - right.endSeconds ||
            left.id.localeCompare(right.id),
    );

export const rangesOverlap = (leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): boolean =>
    leftStart < rightEnd && rightStart < leftEnd;

const overlapCount = (
    events: readonly RangeEventV1[],
    innerClassId: string,
    startSeconds: number,
    endSeconds: number,
    excludeEventId?: string,
): number =>
    events.filter(
        event =>
            event.id !== excludeEventId &&
            event.innerClassId === innerClassId &&
            rangesOverlap(startSeconds, endSeconds, event.startSeconds, event.endSeconds),
    ).length;

const normalizedRange = (
    project: EditorProjectV2,
    startSeconds: number,
    endSeconds: number,
    minimumEndSeconds?: number,
) => {
    const start = normalizeEditorSeconds(startSeconds);
    const end = normalizeEditorSeconds(endSeconds);
    const minimum = minimumEndSeconds === undefined ? start : normalizeEditorSeconds(minimumEndSeconds);
    if (start < 0 || end > project.track.durationSeconds || start >= end || end < minimum) {
        throw new RangeAnnotationError('range-invalid', '范围终点必须晚于起点至少一个当前网格单位，并位于歌曲以内。');
    }
    return { start, end };
};

export const createRangeLane = (
    project: EditorProjectV2,
    createId: () => string = () => crypto.randomUUID(),
): EditorProjectV2 => ({
    ...project,
    lanes: [
        ...project.lanes,
        {
            id: createId(),
            name: nextLaneName(project),
            eventKind: 'range',
            innerClasses: [{ id: createId(), label: 'default' }],
            events: [],
        },
    ],
});

export const renameRangeLane = (project: EditorProjectV2, laneId: string, name: string): EditorProjectV2 =>
    withRangeLane(project, laneId, lane => ({
        ...lane,
        name: labelValue(name),
    }));

export const addRangeInnerClass = (
    project: EditorProjectV2,
    laneId: string,
    createId: () => string = () => crypto.randomUUID(),
): EditorProjectV2 =>
    withRangeLane(project, laneId, lane => ({
        ...lane,
        innerClasses: [
            ...lane.innerClasses,
            {
                id: createId(),
                label: nextClassLabel(lane),
            },
        ],
    }));

export const renameRangeInnerClass = (
    project: EditorProjectV2,
    laneId: string,
    innerClassId: string,
    label: string,
): EditorProjectV2 =>
    withRangeLane(project, laneId, lane => {
        if (!lane.innerClasses.some(entry => entry.id === innerClassId)) {
            throw new RangeAnnotationError('inner-class-not-found', '找不到对应的内部分类。');
        }
        return {
            ...lane,
            innerClasses: lane.innerClasses.map(entry =>
                entry.id === innerClassId ? { ...entry, label: labelValue(label) } : entry,
            ),
        };
    });

export const rangeInnerClassEventCount = (project: EditorProjectV2, laneId: string, innerClassId: string): number =>
    rangeLane(project, laneId).events.filter(event => event.innerClassId === innerClassId).length;

export const removeRangeInnerClass = (
    project: EditorProjectV2,
    laneId: string,
    innerClassId: string,
    resolution?: RangeInnerClassRemovalResolution,
): EditorProjectV2 =>
    withRangeLane(project, laneId, lane => {
        if (lane.innerClasses.length <= 1) {
            throw new RangeAnnotationError('last-inner-class', '每个轨道至少要保留一个内部分类。');
        }
        if (!lane.innerClasses.some(entry => entry.id === innerClassId)) {
            throw new RangeAnnotationError('inner-class-not-found', '找不到对应的内部分类。');
        }
        const sourceEvents = lane.events.filter(event => event.innerClassId === innerClassId);
        if (sourceEvents.length > 0 && !resolution) {
            throw new RangeAnnotationError('resolution-required', '这个分类还有范围，请先选择迁移或明确删除。');
        }
        let events = lane.events.filter(event => event.innerClassId !== innerClassId);
        if (sourceEvents.length > 0 && resolution?.kind === 'migrate') {
            const target = resolution.targetInnerClassId;
            if (target === innerClassId || !lane.innerClasses.some(entry => entry.id === target)) {
                throw new RangeAnnotationError('invalid-migration-target', '请选择同一轨道中的其他分类。');
            }
            let conflicts = 0;
            for (const source of sourceEvents) {
                conflicts += overlapCount(events, target, source.startSeconds, source.endSeconds);
            }
            for (let index = 0; index < sourceEvents.length; index += 1) {
                const source = sourceEvents[index]!;
                for (let other = index + 1; other < sourceEvents.length; other += 1) {
                    const candidate = sourceEvents[other]!;
                    if (
                        rangesOverlap(
                            source.startSeconds,
                            source.endSeconds,
                            candidate.startSeconds,
                            candidate.endSeconds,
                        )
                    )
                        conflicts += 1;
                }
            }
            if (conflicts > 0) {
                throw new RangeAnnotationError(
                    'migration-conflict',
                    `目标分类会产生 ${conflicts} 个范围重叠。`,
                    conflicts,
                );
            }
            events = [
                ...events,
                ...sourceEvents.map(event => ({
                    ...event,
                    innerClassId: target,
                })),
            ];
        }
        return {
            ...lane,
            innerClasses: lane.innerClasses.filter(entry => entry.id !== innerClassId),
            events: sortEvents(events),
        };
    });

export const createRangeEvent = (
    project: EditorProjectV2,
    laneId: string,
    innerClassId: string,
    startSeconds: number,
    endSeconds: number,
    createId: () => string = () => crypto.randomUUID(),
    minimumEndSeconds?: number,
): { project: EditorProjectV2; event: RangeEventV1 } => {
    const lane = rangeLane(project, laneId);
    if (!lane.innerClasses.some(entry => entry.id === innerClassId)) {
        throw new RangeAnnotationError('inner-class-not-found', '找不到对应的内部分类。');
    }
    const normalized = normalizedRange(project, startSeconds, endSeconds, minimumEndSeconds);
    const conflicts = overlapCount(lane.events, innerClassId, normalized.start, normalized.end);
    if (conflicts > 0) {
        throw new RangeAnnotationError('range-overlap', '这个范围与同一分类中的已有范围重叠。', conflicts);
    }
    const event = {
        id: createId(),
        innerClassId,
        startSeconds: normalized.start,
        endSeconds: normalized.end,
    };
    return {
        event,
        project: withRangeLane(project, laneId, current => ({
            ...current,
            events: sortEvents([...current.events, event]),
        })),
    };
};

export const updateRangeEvent = (
    project: EditorProjectV2,
    laneId: string,
    eventId: string,
    startSeconds: number,
    endSeconds: number,
    minimumEndSeconds?: number,
): EditorProjectV2 =>
    withRangeLane(project, laneId, lane => {
        const current = lane.events.find(event => event.id === eventId);
        if (!current) {
            throw new RangeAnnotationError('range-not-found', '找不到对应的范围标记。');
        }
        const normalized = normalizedRange(project, startSeconds, endSeconds, minimumEndSeconds);
        const conflicts = overlapCount(lane.events, current.innerClassId, normalized.start, normalized.end, eventId);
        if (conflicts > 0) {
            throw new RangeAnnotationError('range-overlap', '调整后的范围与同一分类中的已有范围重叠。', conflicts);
        }
        return {
            ...lane,
            events: sortEvents(
                lane.events.map(event =>
                    event.id === eventId
                        ? {
                              ...event,
                              startSeconds: normalized.start,
                              endSeconds: normalized.end,
                          }
                        : event,
                ),
            ),
        };
    });

export const deleteRangeEvent = (project: EditorProjectV2, laneId: string, eventId: string): EditorProjectV2 =>
    withRangeLane(project, laneId, lane => {
        if (!lane.events.some(event => event.id === eventId)) {
            throw new RangeAnnotationError('range-not-found', '找不到对应的范围标记。');
        }
        return { ...lane, events: lane.events.filter(event => event.id !== eventId) };
    });

export const visibleRangeEvents = (
    lane: RangeLaneV1,
    innerClassId: string,
    viewport: PersistedTimelineViewport,
): RangeEventV1[] =>
    lane.events.filter(
        event =>
            event.innerClassId === innerClassId &&
            event.endSeconds > viewport.startSeconds &&
            event.startSeconds < viewport.endSeconds,
    );

export const rangeCellAtTime = pointCellAtTime;

export const nextRangeCell = (
    startSeconds: number,
    project: Pick<EditorProjectV2, 'tempoMap' | 'track' | 'workspace'>,
    width: number,
    setting: Readonly<EditorBeatSnapSetting> = DEFAULT_BEAT_SNAP,
): PointCell | null => {
    const current = pointCellAtTime(startSeconds, project, width, setting);
    if (!current) return null;
    if (current.subdivision === 'single-beat') {
        return {
            ...current,
            timeSeconds: current.endSeconds,
        };
    }
    return movePointCell(startSeconds, 1, project, width, setting);
};

export const rangeLaneInnerClasses = (
    project: EditorProjectV2,
): Array<{ lane: RangeLaneV1; innerClass: InnerClassV1 }> =>
    project.lanes.flatMap(lane =>
        lane.eventKind === 'range' ? lane.innerClasses.map(innerClass => ({ lane, innerClass })) : [],
    );
