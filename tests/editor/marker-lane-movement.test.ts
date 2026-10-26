import { expect, test } from 'vitest';
import { createInitialEditorProject, validateEditorProjectV2 } from '../../src/editor/projectCodec';
import { DEFAULT_BEAT_SNAP } from '../../src/editor/beatSnap';
import { moveMarkerLane } from '../../src/editor/markerLaneMovement';
import type { PointLaneV1, RangeLaneV1 } from '../../src/editor/types';

function project() {
    const p = createInitialEditorProject({
        track: { contentHash: 'a'.repeat(64), fileName: 'lane.wav', durationSeconds: 8 },
    });
    p.tempoMap = [
        {
            id: 'fast',
            startSeconds: 0,
            mode: 'metered',
            beatOriginSeconds: 0,
            bpm: 120,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        },
        {
            id: 'slow',
            startSeconds: 2,
            mode: 'metered',
            beatOriginSeconds: 2,
            bpm: 60,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        },
    ];
    p.lanes = [
        {
            id: 'points',
            name: '点轨道',
            eventKind: 'point',
            innerClasses: [
                { id: 'a', label: '甲' },
                { id: 'b', label: '乙' },
            ],
            events: [
                { id: 'p1', innerClassId: 'a', atSeconds: 1.875 },
                { id: 'p2', innerClassId: 'a', atSeconds: 2 },
                { id: 'p3', innerClassId: 'b', atSeconds: 5 },
            ],
        },
        {
            id: 'ranges',
            name: '范围轨道',
            eventKind: 'range',
            innerClasses: [
                { id: 'c', label: '丙' },
                { id: 'd', label: '丁' },
            ],
            events: [
                { id: 'r1', innerClassId: 'c', startSeconds: 1, endSeconds: 1.5 },
                { id: 'r2', innerClassId: 'c', startSeconds: 1.5, endSeconds: 2 },
                { id: 'r3', innerClassId: 'd', startSeconds: 1.875, endSeconds: 2.25 },
            ],
        },
    ];
    return validateEditorProjectV2(p);
}
test('moves every category and preserves identities, metadata and other lanes', () => {
    const p = project(),
        before = structuredClone(p);
    const result = moveMarkerLane(p, 'points', 1, DEFAULT_BEAT_SNAP);
    expect(result.eventCount).toBe(3);
    expect((result.project.lanes[0] as PointLaneV1).events.map(e => e.atSeconds)).toEqual([2, 2.25, 5.25]);
    expect(result.project.lanes[1]).toBe(p.lanes[1]);
    expect(result.project.lanes[0]!.innerClasses).toBe(p.lanes[0]!.innerClasses);
    expect(result.project.lanes[0]).toMatchObject({ id: 'points', name: '点轨道' });
    expect(result.project.lanes[0]!.events.map(({ id, innerClassId }) => [id, innerClassId])).toEqual(
        p.lanes[0]!.events.map(({ id, innerClassId }) => [id, innerClassId]),
    );
    expect(moveMarkerLane(result.project, 'points', -1, DEFAULT_BEAT_SNAP).project).toEqual(p);
    expect(p).toEqual(before);
});
test('moves range endpoints independently across BPM changes, retaining adjacency and IDs', () => {
    const p = project();
    const result = moveMarkerLane(p, 'ranges', 1, DEFAULT_BEAT_SNAP);
    expect(result.eventCount).toBe(3);
    expect((result.project.lanes[1] as RangeLaneV1).events).toEqual([
        { id: 'r1', innerClassId: 'c', startSeconds: 1.125, endSeconds: 1.625 },
        { id: 'r2', innerClassId: 'c', startSeconds: 1.625, endSeconds: 2.25 },
        { id: 'r3', innerClassId: 'd', startSeconds: 2, endSeconds: 2.5 },
    ]);
    expect(validateEditorProjectV2(result.project)).toEqual(result.project);
    expect(moveMarkerLane(result.project, 'ranges', -1, DEFAULT_BEAT_SNAP).project).toEqual(p);
});
test('a single failing event rejects the entire lane without mutating the source', () => {
    const p = project(),
        points = p.lanes[0] as PointLaneV1;
    points.events[2]!.atSeconds = 0;
    const before = structuredClone(p);
    expect(() => moveMarkerLane(p, 'points', -1, DEFAULT_BEAT_SNAP)).toThrow(/歌曲范围/);
    expect(p).toEqual(before);
    points.events[2]!.atSeconds = 8;
    expect(() => moveMarkerLane(p, 'points', 1, DEFAULT_BEAT_SNAP)).toThrow(/歌曲范围/);
    expect(() => moveMarkerLane(p, 'points', Number.MAX_SAFE_INTEGER, DEFAULT_BEAT_SNAP)).toThrow(/歌曲范围/);
});
test('off-grid duplicates and collapsed ranges reject atomically; different classes may coincide', () => {
    const p = project(),
        points = p.lanes[0] as PointLaneV1,
        ranges = p.lanes[1] as RangeLaneV1;
    points.events[0]!.atSeconds = 0.51;
    points.events[1]!.atSeconds = 0.52;
    expect(() => moveMarkerLane(p, 'points', 1, DEFAULT_BEAT_SNAP)).toThrow(/重复点/);
    points.events[1]!.innerClassId = 'b';
    expect(
        (moveMarkerLane(p, 'points', 1, DEFAULT_BEAT_SNAP).project.lanes[0] as PointLaneV1).events
            .slice(0, 2)
            .map(e => e.atSeconds),
    ).toEqual([0.625, 0.625]);
    ranges.events[0] = { ...ranges.events[0]!, startSeconds: 0.51, endSeconds: 0.52 };
    expect(() => moveMarkerLane(p, 'ranges', 1, DEFAULT_BEAT_SNAP)).toThrow(/不足一格/);
});
test('single-beat is one cell and missing BPM prevents crossing a gap', () => {
    const p = project();
    p.tempoMap.splice(1, 0, { id: 'single', startSeconds: 2, mode: 'single-beat' });
    p.tempoMap[2] = { ...p.tempoMap[2]!, startSeconds: 4 };
    const ranges = p.lanes[1] as RangeLaneV1;
    ranges.events = [{ id: 'r1', innerClassId: 'c', startSeconds: 2, endSeconds: 4 }];
    expect(
        (moveMarkerLane(p, 'ranges', -1, DEFAULT_BEAT_SNAP).project.lanes[1] as RangeLaneV1).events[0],
    ).toMatchObject({ startSeconds: 1.875, endSeconds: 2 });
    p.tempoMap[1] = { ...p.tempoMap[0]!, id: 'missing', startSeconds: 2, bpm: null } as (typeof p.tempoMap)[number];
    const points = p.lanes[0] as PointLaneV1;
    points.events = [points.events[0]!];
    expect(() => moveMarkerLane(p, 'points', 2, DEFAULT_BEAT_SNAP)).toThrow(/没有可用网格/);
});
test('rejects missing or empty lanes and non-positive, fractional or unsafe counts', () => {
    const p = project();
    expect(() => moveMarkerLane(p, 'missing', 1, DEFAULT_BEAT_SNAP)).toThrow(/找不到/);
    p.lanes[0]!.events = [];
    expect(() => moveMarkerLane(p, 'points', 1, DEFAULT_BEAT_SNAP)).toThrow(/没有可移动/);
    for (const cells of [0, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
        expect(() => moveMarkerLane(p, 'ranges', cells, DEFAULT_BEAT_SNAP)).toThrow(/安全整数/);
});
