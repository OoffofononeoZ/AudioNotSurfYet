import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
    collectMarkerBlockEvents,
    copyMarkerBlockAfter,
    markerGridSpanAtTime,
    moveMarkerBlock,
    selectMarkerBlockByTime,
} from '../../src/editor/markerBlockOperations';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import type { EditorProjectV1, PointLaneV1, RangeLaneV1, TempoSegmentV1 } from '../../src/editor/types';

interface Golden {
    durationSeconds: number;
    tempoMap: TempoSegmentV1[];
    measureCases: Array<{
        timeSeconds: number;
        startSeconds: number;
        endSeconds: number;
        kind: 'metered' | 'single-beat';
    }>;
    unavailableTimeSeconds: number;
}

const golden = JSON.parse(
    readFileSync(path.resolve(import.meta.dirname, '../analysis/golden/editor-e10-marker-block.v1.json'), 'utf8'),
) as Golden;

const createProject = (): EditorProjectV1 => {
    const project = createInitialEditorProject({
        track: {
            contentHash: 'a'.repeat(64),
            fileName: 'editor-e10.wav',
            durationSeconds: golden.durationSeconds,
            sampleRate: 48_000,
        },
        createId: (() => {
            let id = 0;
            return () => `base-${++id}`;
        })(),
        now: () => new Date('2026-09-04T08:00:00.000Z'),
    });
    return {
        ...project,
        tempoMap: golden.tempoMap,
        lanes: [
            {
                id: 'point-lane',
                name: 'Points',
                eventKind: 'point',
                innerClasses: [
                    { id: 'point-main', label: 'main' },
                    { id: 'point-other', label: 'other' },
                ],
                events: [
                    { id: 'p-a', innerClassId: 'point-main', atSeconds: 0.5 },
                    { id: 'p-b', innerClassId: 'point-main', atSeconds: 1.5 },
                    { id: 'p-edge', innerClassId: 'point-main', atSeconds: 2 },
                    { id: 'p-other', innerClassId: 'point-other', atSeconds: 0.75 },
                ],
            },
            {
                id: 'range-lane',
                name: 'Ranges',
                eventKind: 'range',
                innerClasses: [{ id: 'range-main', label: 'main' }],
                events: [
                    { id: 'r-contained', innerClassId: 'range-main', startSeconds: 0.25, endSeconds: 1.25 },
                    { id: 'r-crossing', innerClassId: 'range-main', startSeconds: 1.75, endSeconds: 2.25 },
                ],
            },
        ],
    };
};

const allMeteredProject = (): EditorProjectV1 => {
    const project = createProject();
    return {
        ...project,
        tempoMap: [
            {
                id: 'tempo-all',
                startSeconds: 0,
                mode: 'metered',
                bpm: 120,
                bpmSource: 'user',
                meter: { numerator: 4, denominator: 4 },
            },
        ],
    };
};

describe('Editor E10 marker block domain', () => {
    test('selects subdivision cells rather than measures and rejects missing endpoint grids', () => {
        const project = createProject();
        expect(markerGridSpanAtTime(project, 0.4)).toEqual({ startSeconds: 0.375, endSeconds: 0.5 });
        expect(selectMarkerBlockByTime(project, 'point-lane', 'point-main', 0.4, 1.5)).toMatchObject({
            startSeconds: 0.375,
            endSeconds: 1.625,
            eventIds: ['p-a', 'p-b'],
        });
        expect(selectMarkerBlockByTime(project, 'point-lane', 'point-main', 7)).toMatchObject({
            startSeconds: 6,
            endSeconds: 8,
        });
        expect(() => markerGridSpanAtTime(project, golden.unavailableTimeSeconds)).toThrowError(
            expect.objectContaining({ code: 'grid-unavailable' }),
        );
        expect(selectMarkerBlockByTime(project, 'range-lane', 'range-main', 1, 2)).toMatchObject({
            startSeconds: 0.25,
            endSeconds: 2.25,
            eventIds: ['r-contained', 'r-crossing'],
        });
    });

    test('collects point events half-open and whole ranges when they intersect', () => {
        const project = createProject();
        expect(
            collectMarkerBlockEvents(project, {
                laneId: 'point-lane',
                innerClassId: 'point-main',
                startSeconds: 0,
                endSeconds: 2,
            }).map(event => event.id),
        ).toEqual(['p-a', 'p-b']);
        expect(
            collectMarkerBlockEvents(project, {
                laneId: 'range-lane',
                innerClassId: 'range-main',
                startSeconds: 0,
                endSeconds: 2,
            }).map(event => event.id),
        ).toEqual(['r-contained', 'r-crossing']);
    });

    test('copies immediately after the selection with fresh ids and supports repetition', () => {
        const project = allMeteredProject();
        let id = 0;
        const first = copyMarkerBlockAfter(
            project,
            {
                laneId: 'point-lane',
                innerClassId: 'point-main',
                startSeconds: 0,
                endSeconds: 2,
            },
            () => `copy-${++id}`,
        );
        expect(first.selection).toMatchObject({ startSeconds: 2, endSeconds: 4 });
        expect(first.eventCount).toBe(2);
        expect((first.project.lanes[0] as PointLaneV1).events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'copy-1', atSeconds: 2.5 }),
                expect.objectContaining({ id: 'copy-2', atSeconds: 3.5 }),
            ]),
        );
        const second = copyMarkerBlockAfter(first.project, first.selection, () => `copy-${++id}`);
        expect(second.selection).toMatchObject({ startSeconds: 4, endSeconds: 6 });
        expect((second.project.lanes[0] as PointLaneV1).events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'copy-3', atSeconds: 4.5 }),
                expect.objectContaining({ id: 'copy-4', atSeconds: 5.5 }),
            ]),
        );
    });

    test('moves atomically while preserving ids and relative seconds', () => {
        const project = allMeteredProject();
        const result = moveMarkerBlock(
            project,
            {
                laneId: 'point-lane',
                innerClassId: 'point-main',
                startSeconds: 0,
                endSeconds: 2,
            },
            4,
        );
        const events = (result.project.lanes[0] as PointLaneV1).events;
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'p-a', atSeconds: 4.5 }),
                expect.objectContaining({ id: 'p-b', atSeconds: 5.5 }),
            ]),
        );
        expect(events.some(event => event.id === 'p-edge' && event.atSeconds === 2)).toBe(true);
        expect(result.selection).toMatchObject({ startSeconds: 4, endSeconds: 6 });
    });

    test('rejects point conflicts, range overlap and song-end overflow without mutation', () => {
        const base = allMeteredProject();
        const pointLane = base.lanes[0] as PointLaneV1;
        const pointConflict: EditorProjectV1 = {
            ...base,
            lanes: [
                {
                    ...pointLane,
                    events: [
                        ...pointLane.events,
                        {
                            id: 'occupied',
                            innerClassId: 'point-main',
                            atSeconds: 2.5,
                        },
                    ],
                },
                base.lanes[1]!,
            ],
        };
        let allocatedIds = 0;
        expect(() =>
            copyMarkerBlockAfter(
                pointConflict,
                {
                    laneId: 'point-lane',
                    innerClassId: 'point-main',
                    startSeconds: 0,
                    endSeconds: 2,
                },
                () => `should-not-allocate-${++allocatedIds}`,
            ),
        ).toThrowError(expect.objectContaining({ code: 'point-conflict' }));
        expect(allocatedIds).toBe(0);
        expect((pointConflict.lanes[0] as PointLaneV1).events.at(-1)?.id).toBe('occupied');

        const rangeLane = base.lanes[1] as RangeLaneV1;
        const rangeConflict: EditorProjectV1 = {
            ...base,
            lanes: [
                base.lanes[0]!,
                {
                    ...rangeLane,
                    events: [
                        ...rangeLane.events,
                        {
                            id: 'range-occupied',
                            innerClassId: 'range-main',
                            startSeconds: 2.5,
                            endSeconds: 3.25,
                        },
                    ],
                },
            ],
        };
        expect(() =>
            copyMarkerBlockAfter(rangeConflict, {
                laneId: 'range-lane',
                innerClassId: 'range-main',
                startSeconds: 0,
                endSeconds: 2,
            }),
        ).toThrowError(expect.objectContaining({ code: 'range-conflict' }));
        expect(() =>
            copyMarkerBlockAfter(base, {
                laneId: 'point-lane',
                innerClassId: 'point-main',
                startSeconds: 14,
                endSeconds: 16,
            }),
        ).toThrowError(expect.objectContaining({ code: 'empty-selection' }));
        expect(() =>
            moveMarkerBlock(
                base,
                {
                    laneId: 'point-lane',
                    innerClassId: 'point-main',
                    startSeconds: 0,
                    endSeconds: 2,
                },
                15,
            ),
        ).toThrowError(expect.objectContaining({ code: 'target-out-of-bounds' }));
    });
});
