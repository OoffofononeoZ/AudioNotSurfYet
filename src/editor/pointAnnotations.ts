import type { PersistedTimelineViewport } from '../types/session';
import { normalizeEditorSeconds } from './projectCodec';
import {
    beatSecondsFor,
    segmentAtTime,
    segmentEndSeconds,
    selectVisibleSubdivision,
} from './tempoMap';
import type {
    EditorProjectV1,
    InnerClassV1,
    PointEventV1,
    PointLaneV1,
} from './types';

export type PointAnnotationErrorCode =
    | 'lane-not-found'
    | 'inner-class-not-found'
    | 'empty-label'
    | 'last-inner-class'
    | 'resolution-required'
    | 'invalid-migration-target'
    | 'migration-conflict'
    | 'point-not-found'
    | 'point-duplicate'
    | 'grid-unavailable';

export class PointAnnotationError extends Error {
    readonly code: PointAnnotationErrorCode;
    readonly conflictCount: number;

    constructor(
        code: PointAnnotationErrorCode,
        message: string,
        conflictCount = 0,
    ) {
        super(message);
        this.name = 'PointAnnotationError';
        this.code = code;
        this.conflictCount = conflictCount;
    }
}

export type InnerClassRemovalResolution =
    | { kind: 'delete-events' }
    | { kind: 'migrate'; targetInnerClassId: string };

export interface PointCell {
    timeSeconds: number;
    startSeconds: number;
    endSeconds: number;
    stepSeconds: number;
    subdivision: 1 | 2 | 4 | 8 | 16 | 'single-beat';
    segmentId: string;
}

const laneIndex = (project: EditorProjectV1, laneId: string): number => {
    const index = project.lanes.findIndex((lane) => lane.id === laneId);
    if (index < 0 || project.lanes[index]?.eventKind !== 'point') {
        throw new PointAnnotationError('lane-not-found', '找不到对应的点标记轨道。');
    }
    return index;
};

const pointLane = (
    project: EditorProjectV1,
    laneId: string,
): PointLaneV1 => project.lanes[laneIndex(project, laneId)] as PointLaneV1;

const withPointLane = (
    project: EditorProjectV1,
    laneId: string,
    update: (lane: PointLaneV1) => PointLaneV1,
): EditorProjectV1 => {
    const index = laneIndex(project, laneId);
    const lane = project.lanes[index] as PointLaneV1;
    const lanes = [...project.lanes];
    lanes[index] = update(lane);
    return { ...project, lanes };
};

const labelValue = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new PointAnnotationError('empty-label', '名称不能为空。');
    }
    return trimmed;
};

const nextPointLaneName = (project: EditorProjectV1): string => {
    const names = new Set(project.lanes.map((lane) => lane.name));
    for (let index = 1; ; index += 1) {
        const candidate = `点标记 ${index}`;
        if (!names.has(candidate)) return candidate;
    }
};

const nextInnerClassLabel = (lane: PointLaneV1): string => {
    const labels = new Set(lane.innerClasses.map((entry) => entry.label));
    for (let index = 1; ; index += 1) {
        const candidate = `分类 ${index}`;
        if (!labels.has(candidate)) return candidate;
    }
};

export const createPointLane = (
    project: EditorProjectV1,
    createId: () => string = () => crypto.randomUUID(),
): EditorProjectV1 => ({
    ...project,
    lanes: [...project.lanes, {
        id: createId(),
        name: nextPointLaneName(project),
        eventKind: 'point',
        innerClasses: [{ id: createId(), label: 'default' }],
        events: [],
    }],
});

export const renamePointLane = (
    project: EditorProjectV1,
    laneId: string,
    name: string,
): EditorProjectV1 => withPointLane(project, laneId, (lane) => ({
    ...lane,
    name: labelValue(name),
}));

export const addPointInnerClass = (
    project: EditorProjectV1,
    laneId: string,
    createId: () => string = () => crypto.randomUUID(),
): EditorProjectV1 => withPointLane(project, laneId, (lane) => ({
    ...lane,
    innerClasses: [...lane.innerClasses, {
        id: createId(),
        label: nextInnerClassLabel(lane),
    }],
}));

export const renamePointInnerClass = (
    project: EditorProjectV1,
    laneId: string,
    innerClassId: string,
    label: string,
): EditorProjectV1 => withPointLane(project, laneId, (lane) => {
    if (!lane.innerClasses.some((entry) => entry.id === innerClassId)) {
        throw new PointAnnotationError(
            'inner-class-not-found',
            '找不到对应的内部分类。',
        );
    }
    return {
        ...lane,
        innerClasses: lane.innerClasses.map((entry) => entry.id === innerClassId
            ? { ...entry, label: labelValue(label) }
            : entry),
    };
});

export const pointInnerClassEventCount = (
    project: EditorProjectV1,
    laneId: string,
    innerClassId: string,
): number => pointLane(project, laneId).events.filter(
    (event) => event.innerClassId === innerClassId,
).length;

export const removePointInnerClass = (
    project: EditorProjectV1,
    laneId: string,
    innerClassId: string,
    resolution?: InnerClassRemovalResolution,
): EditorProjectV1 => withPointLane(project, laneId, (lane) => {
    if (lane.innerClasses.length <= 1) {
        throw new PointAnnotationError(
            'last-inner-class',
            '每个轨道至少要保留一个内部分类。',
        );
    }
    if (!lane.innerClasses.some((entry) => entry.id === innerClassId)) {
        throw new PointAnnotationError(
            'inner-class-not-found',
            '找不到对应的内部分类。',
        );
    }
    const sourceEvents = lane.events.filter(
        (event) => event.innerClassId === innerClassId,
    );
    if (sourceEvents.length > 0 && !resolution) {
        throw new PointAnnotationError(
            'resolution-required',
            '这个分类还有标记，请先选择迁移或明确删除。',
        );
    }
    let events = lane.events.filter((event) => event.innerClassId !== innerClassId);
    if (sourceEvents.length > 0 && resolution?.kind === 'migrate') {
        const target = resolution.targetInnerClassId;
        if (
            target === innerClassId
            || !lane.innerClasses.some((entry) => entry.id === target)
        ) {
            throw new PointAnnotationError(
                'invalid-migration-target',
                '请选择同一轨道中的其他分类。',
            );
        }
        const occupied = new Set(events
            .filter((event) => event.innerClassId === target)
            .map((event) => normalizeEditorSeconds(event.atSeconds)));
        const conflicts = sourceEvents.filter((event) =>
            occupied.has(normalizeEditorSeconds(event.atSeconds))).length;
        if (conflicts > 0) {
            throw new PointAnnotationError(
                'migration-conflict',
                `目标分类已有 ${conflicts} 个相同时间的标记。`,
                conflicts,
            );
        }
        events = [...events, ...sourceEvents.map((event) => ({
            ...event,
            innerClassId: target,
        }))];
    }
    return {
        ...lane,
        innerClasses: lane.innerClasses.filter((entry) => entry.id !== innerClassId),
        events: events.sort((left, right) =>
            left.atSeconds - right.atSeconds || left.id.localeCompare(right.id)),
    };
});

export const createPointEvent = (
    project: EditorProjectV1,
    laneId: string,
    innerClassId: string,
    atSeconds: number,
    createId: () => string = () => crypto.randomUUID(),
): { project: EditorProjectV1; event: PointEventV1 } => {
    const seconds = normalizeEditorSeconds(atSeconds);
    const lane = pointLane(project, laneId);
    if (!lane.innerClasses.some((entry) => entry.id === innerClassId)) {
        throw new PointAnnotationError(
            'inner-class-not-found',
            '找不到对应的内部分类。',
        );
    }
    const duplicate = lane.events.find((event) =>
        event.innerClassId === innerClassId
        && normalizeEditorSeconds(event.atSeconds) === seconds);
    if (duplicate) {
        throw new PointAnnotationError(
            'point-duplicate',
            '这个位置已经有标记。',
        );
    }
    if (seconds < 0 || seconds > project.track.durationSeconds) {
        throw new PointAnnotationError('grid-unavailable', '标记时间超出歌曲范围。');
    }
    const event = { id: createId(), innerClassId, atSeconds: seconds };
    return {
        event,
        project: withPointLane(project, laneId, (current) => ({
            ...current,
            events: [...current.events, event].sort((left, right) =>
                left.atSeconds - right.atSeconds || left.id.localeCompare(right.id)),
        })),
    };
};

export const deletePointEvent = (
    project: EditorProjectV1,
    laneId: string,
    eventId: string,
): EditorProjectV1 => withPointLane(project, laneId, (lane) => {
    if (!lane.events.some((event) => event.id === eventId)) {
        throw new PointAnnotationError('point-not-found', '找不到对应的点标记。');
    }
    return {
        ...lane,
        events: lane.events.filter((event) => event.id !== eventId),
    };
});

export const visiblePointEvents = (
    lane: PointLaneV1,
    innerClassId: string,
    viewport: PersistedTimelineViewport,
): PointEventV1[] => lane.events.filter((event) =>
    event.innerClassId === innerClassId
    && event.atSeconds >= viewport.startSeconds
    && event.atSeconds <= viewport.endSeconds);

export const findPointAt = (
    lane: PointLaneV1,
    innerClassId: string,
    timeSeconds: number,
): PointEventV1 | null => {
    const seconds = normalizeEditorSeconds(timeSeconds);
    return lane.events.find((event) =>
        event.innerClassId === innerClassId
        && normalizeEditorSeconds(event.atSeconds) === seconds) ?? null;
};

export const pointCellAtTime = (
    rawSeconds: number,
    project: Pick<EditorProjectV1, 'tempoMap' | 'track' | 'workspace'>,
    width: number,
): PointCell | null => {
    const duration = project.track.durationSeconds;
    const clamped = Math.max(0, Math.min(duration, rawSeconds));
    const segment = segmentAtTime(project.tempoMap, clamped);
    const index = project.tempoMap.findIndex((entry) => entry.id === segment.id);
    const segmentEnd = segmentEndSeconds(project.tempoMap, index, duration);
    if (segment.mode === 'single-beat') {
        return {
            timeSeconds: segment.startSeconds,
            startSeconds: segment.startSeconds,
            endSeconds: segmentEnd,
            stepSeconds: segmentEnd - segment.startSeconds,
            subdivision: 'single-beat',
            segmentId: segment.id,
        };
    }
    if (segment.bpm === null || width <= 0) return null;
    const beatSeconds = beatSecondsFor(segment.bpm);
    const subdivision = selectVisibleSubdivision(
        beatSeconds,
        project.workspace.viewport,
        width,
    );
    const step = beatSeconds / subdivision;
    const snapped = normalizeEditorSeconds(Math.max(
        segment.startSeconds,
        Math.min(
            segmentEnd,
            segment.startSeconds
                + Math.round((clamped - segment.startSeconds) / step) * step,
        ),
    ));
    return {
        timeSeconds: snapped,
        startSeconds: Math.max(segment.startSeconds, snapped - step / 2),
        endSeconds: Math.min(segmentEnd, snapped + step / 2),
        stepSeconds: step,
        subdivision,
        segmentId: segment.id,
    };
};

export const movePointCell = (
    currentSeconds: number,
    direction: -1 | 1,
    project: Pick<EditorProjectV1, 'tempoMap' | 'track' | 'workspace'>,
    width: number,
): PointCell | null => {
    const current = pointCellAtTime(currentSeconds, project, width);
    if (!current) return null;
    const epsilon = direction * 1e-6;
    return pointCellAtTime(
        current.timeSeconds + direction * current.stepSeconds + epsilon,
        project,
        width,
    );
};

export const pointLaneInnerClasses = (
    project: EditorProjectV1,
): Array<{ lane: PointLaneV1; innerClass: InnerClassV1 }> => project.lanes.flatMap(
    (lane) => lane.eventKind === 'point'
        ? lane.innerClasses.map((innerClass) => ({ lane, innerClass }))
        : [],
);
