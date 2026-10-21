import { createHash } from 'node:crypto';
import { encodeEditorProjectV2, normalizeEditorSeconds, validateEditorProjectV2 } from '../../src/editor/projectCodec';
import type {
    EditorLaneV1,
    EditorProjectV2,
    EditorTrackIdentityV1,
    PointEventV1,
    RangeEventV1,
} from '../../src/editor/types';

export const E6_STRESS_SEED = 0xe6002026;
export const E6_STRESS_DURATION_SECONDS = 15 * 60;
export const E6_STRESS_LANE_COUNT = 20;
export const E6_STRESS_INNER_CLASS_COUNT = 8;
export const E6_STRESS_POINT_COUNT = 5_000;
export const E6_STRESS_RANGE_COUNT = 5_000;
export const E6_STRESS_VIEWPORT = {
    startSeconds: 0,
    endSeconds: 90,
    zoom: 10,
} as const;

const GROUP_COUNT = 10 * E6_STRESS_INNER_CLASS_COUNT;
const FIXED_TIME = '2026-08-27T12:00:00.000Z';

const countForGroup = (groupIndex: number) =>
    Math.floor(E6_STRESS_POINT_COUNT / GROUP_COUNT) + (groupIndex < E6_STRESS_POINT_COUNT % GROUP_COUNT ? 1 : 0);

const id = (kind: string, ...parts: number[]) =>
    `e6-${kind}-${parts.map(part => String(part).padStart(3, '0')).join('-')}`;

const buildPointLane = (laneIndex: number, pointOffset: number): { lane: EditorLaneV1; nextOffset: number } => {
    const innerClasses = Array.from({ length: E6_STRESS_INNER_CLASS_COUNT }, (_, innerIndex) => ({
        id: id('point-class', laneIndex, innerIndex),
        label: `Point ${laneIndex + 1}.${innerIndex + 1}`,
    }));
    const events: PointEventV1[] = [];
    let offset = pointOffset;
    for (let innerIndex = 0; innerIndex < innerClasses.length; innerIndex += 1) {
        const groupIndex = laneIndex * E6_STRESS_INNER_CLASS_COUNT + innerIndex;
        const count = countForGroup(groupIndex);
        for (let eventIndex = 0; eventIndex < count; eventIndex += 1) {
            const atSeconds =
                offset === E6_STRESS_POINT_COUNT - 1
                    ? E6_STRESS_DURATION_SECONDS
                    : normalizeEditorSeconds(((offset + 1) * E6_STRESS_DURATION_SECONDS) / E6_STRESS_POINT_COUNT);
            events.push({
                id: id('point-event', offset),
                innerClassId: innerClasses[innerIndex]!.id,
                atSeconds,
            });
            offset += 1;
        }
    }
    return {
        lane: {
            id: id('point-lane', laneIndex),
            name: `压力点轨道 ${laneIndex + 1}`,
            eventKind: 'point',
            innerClasses,
            events,
        },
        nextOffset: offset,
    };
};

const buildRangeLane = (laneIndex: number, rangeOffset: number): { lane: EditorLaneV1; nextOffset: number } => {
    const innerClasses = Array.from({ length: E6_STRESS_INNER_CLASS_COUNT }, (_, innerIndex) => ({
        id: id('range-class', laneIndex, innerIndex),
        label: `Range ${laneIndex + 1}.${innerIndex + 1}`,
    }));
    const events: RangeEventV1[] = [];
    let offset = rangeOffset;
    for (let innerIndex = 0; innerIndex < innerClasses.length; innerIndex += 1) {
        const groupIndex = laneIndex * E6_STRESS_INNER_CLASS_COUNT + innerIndex;
        const count = countForGroup(groupIndex);
        const step = E6_STRESS_DURATION_SECONDS / count;
        for (let eventIndex = 0; eventIndex < count; eventIndex += 1) {
            let startSeconds = normalizeEditorSeconds(eventIndex * step);
            let endSeconds = normalizeEditorSeconds(startSeconds + step * 0.45);
            if (groupIndex === 0 && eventIndex === 1) {
                startSeconds = events[0]!.endSeconds;
                endSeconds = normalizeEditorSeconds(startSeconds + step * 0.45);
            }
            if (offset === E6_STRESS_RANGE_COUNT - 1) {
                endSeconds = E6_STRESS_DURATION_SECONDS;
                startSeconds = normalizeEditorSeconds(E6_STRESS_DURATION_SECONDS - step * 0.45);
            }
            events.push({
                id: id('range-event', offset),
                innerClassId: innerClasses[innerIndex]!.id,
                startSeconds,
                endSeconds,
            });
            offset += 1;
        }
    }
    return {
        lane: {
            id: id('range-lane', laneIndex),
            name: `压力范围轨道 ${laneIndex + 1}`,
            eventKind: 'range',
            innerClasses,
            events,
        },
        nextOffset: offset,
    };
};

export const buildE6StressProject = (track: EditorTrackIdentityV1): EditorProjectV2 => {
    if (Math.abs(track.durationSeconds - E6_STRESS_DURATION_SECONDS) > 1e-6) {
        throw new Error('E6 stress project requires an exact 15-minute track.');
    }
    const lanes: EditorLaneV1[] = [];
    let pointOffset = 0;
    let rangeOffset = 0;
    for (let laneIndex = 0; laneIndex < 10; laneIndex += 1) {
        const result = buildPointLane(laneIndex, pointOffset);
        lanes.push(result.lane);
        pointOffset = result.nextOffset;
    }
    for (let laneIndex = 0; laneIndex < 10; laneIndex += 1) {
        const result = buildRangeLane(laneIndex, rangeOffset);
        lanes.push(result.lane);
        rangeOffset = result.nextOffset;
    }
    return validateEditorProjectV2({
        format: 'audiosurf-editor',
        schemaVersion: 2,
        projectId: 'e6-stress-project',
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
        track,
        tempoMap: [
            {
                id: 'e6-tempo',
                startSeconds: 0,
                mode: 'metered',
                beatOriginSeconds: 0,
                bpm: 120,
                bpmSource: 'user',
                meter: { numerator: 4, denominator: 4 },
            },
        ],
        lanes,
        workspace: {
            viewport: E6_STRESS_VIEWPORT,
            overlay: {
                featureId: 'rms',
                topRatio: 0.1,
                heightRatio: 0.35,
            },
        },
    });
};

export const summarizeE6StressProject = (project: EditorProjectV2) => {
    const pointEvents = project.lanes.filter(lane => lane.eventKind === 'point').flatMap(lane => lane.events);
    const rangeEvents = project.lanes.filter(lane => lane.eventKind === 'range').flatMap(lane => lane.events);
    const ids = [
        project.projectId,
        ...project.tempoMap.map(segment => segment.id),
        ...project.lanes.flatMap(lane => [
            lane.id,
            ...lane.innerClasses.map(innerClass => innerClass.id),
            ...lane.events.map(event => event.id),
        ]),
    ];
    return {
        seed: E6_STRESS_SEED,
        durationSeconds: project.track.durationSeconds,
        laneCount: project.lanes.length,
        innerClassCount: project.lanes.reduce((total, lane) => total + lane.innerClasses.length, 0),
        pointCount: pointEvents.length,
        rangeCount: rangeEvents.length,
        eventCount: pointEvents.length + rangeEvents.length,
        uniqueIdCount: new Set(ids).size,
        totalIdCount: ids.length,
        sha256: createHash('sha256').update(encodeEditorProjectV2(project)).digest('hex'),
    };
};
