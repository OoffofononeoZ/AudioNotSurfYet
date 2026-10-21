import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { createEditorDraftEnvelope, EditorDraftRepository } from '../../src/editor/editorDraftRepository';
import { createInitialEditorProject, decodeEditorProject, encodeEditorProjectV2 } from '../../src/editor/projectCodec';
import { createPointEvent, createPointLane } from '../../src/editor/pointAnnotations';
import { createRangeEvent, createRangeLane } from '../../src/editor/rangeAnnotations';
import { removeTempoBoundary } from '../../src/editor/tempoMap';
import type { EditorProjectV2, PointLaneV1, RangeLaneV1 } from '../../src/editor/types';

const projectWithTempoAnnotations = (): EditorProjectV2 => {
    let sequence = 0;
    let project = createInitialEditorProject({
        track: {
            contentHash: '9'.repeat(64),
            fileName: 'editor-e9.wav',
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: () => `e9-${++sequence}`,
        now: () => new Date('2026-09-04T00:00:00.000Z'),
    });
    project.tempoMap = [
        {
            ...project.tempoMap[0]!,
            mode: 'metered',
            beatOriginSeconds: project.tempoMap[0]!.startSeconds,
            bpm: 100,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        },
        {
            id: 'tempo-middle',
            startSeconds: 4,
            mode: 'metered',
            beatOriginSeconds: 4,
            bpm: 128,
            bpmSource: 'user',
            meter: { numerator: 7, denominator: 8 },
        },
        { id: 'tempo-last', startSeconds: 8, mode: 'single-beat' },
    ];
    const pointIds = (() => {
        const ids = ['point-lane', 'point-default'];
        return () => ids.shift() ?? crypto.randomUUID();
    })();
    project = createPointLane(project, pointIds);
    const lane = project.lanes[0] as PointLaneV1;
    project = createPointEvent(project, lane.id, lane.innerClasses[0]!.id, 6.25, () => 'point-event').project;
    const rangeIds = (() => {
        const ids = ['range-lane', 'range-default'];
        return () => ids.shift() ?? crypto.randomUUID();
    })();
    project = createRangeLane(project, rangeIds);
    const rangeLane = project.lanes[1] as RangeLaneV1;
    return createRangeEvent(project, rangeLane.id, rangeLane.innerClasses[0]!.id, 9.125, 10.75, () => 'range-event')
        .project;
};

describe('Editor E9 persistence integration', () => {
    test('round-trips a deleted boundary in JSON V2 without moving events', () => {
        const original = projectWithTempoAnnotations();
        const lane = original.lanes[0] as PointLaneV1;
        const eventSeconds = lane.events.map(event => event.atSeconds);
        const rangeLane = original.lanes[1] as RangeLaneV1;
        const rangeSeconds = rangeLane.events.map(event => [event.startSeconds, event.endSeconds]);
        const candidate = {
            ...original,
            tempoMap: removeTempoBoundary(original.tempoMap, 'tempo-middle'),
        };
        const decoded = decodeEditorProject(encodeEditorProjectV2(candidate));
        expect(decoded.tempoMap.map(segment => segment.id)).toEqual([original.tempoMap[0]!.id, 'tempo-last']);
        expect((decoded.lanes[0] as PointLaneV1).events.map(event => event.atSeconds)).toEqual(eventSeconds);
        expect((decoded.lanes[1] as RangeLaneV1).events.map(event => [event.startSeconds, event.endSeconds])).toEqual(
            rangeSeconds,
        );
        expect(decoded.schemaVersion).toBe(2);
    });

    test('persists the latest deleted map atomically in the existing single draft', async () => {
        const repository = new EditorDraftRepository({
            indexedDB,
            databaseName: `e9-${crypto.randomUUID()}`,
        });
        const original = projectWithTempoAnnotations();
        const candidate = {
            ...original,
            tempoMap: removeTempoBoundary(original.tempoMap, 'tempo-middle'),
        };
        await repository.replace(createEditorDraftEnvelope(candidate, () => new Date('2026-09-04T00:00:01.000Z')));
        const restored = await repository.restore();
        expect(restored?.project.tempoMap).toEqual(candidate.tempoMap);
        expect((restored?.project.lanes[0] as PointLaneV1).events[0]?.atSeconds).toBe(6.25);
        expect((restored?.project.lanes[1] as RangeLaneV1).events[0]).toMatchObject({
            startSeconds: 9.125,
            endSeconds: 10.75,
        });
        repository.close();
    });
});
