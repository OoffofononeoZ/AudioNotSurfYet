import { describe, expect, test } from 'vitest';
import {
    addRangeInnerClass,
    createRangeEvent,
    createRangeLane,
    deleteRangeEvent,
    nextRangeCell,
    rangeCellAtTime,
    RangeAnnotationError,
    rangesOverlap,
    removeRangeInnerClass,
    renameRangeInnerClass,
    renameRangeLane,
    updateRangeEvent,
    visibleRangeEvents,
} from '../../src/editor/rangeAnnotations';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import type { EditorProjectV1, RangeLaneV1 } from '../../src/editor/types';
import { buildE5RangeGolden } from '../support/e5-range-fixture';

const createProject = (): EditorProjectV1 => {
    let id = 0;
    const project = createInitialEditorProject({
        track: {
            contentHash: '5'.repeat(64),
            fileName: 'editor-e5-ranges-v1.wav',
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: () => `initial-${++id}`,
        now: () => new Date('2026-08-27T00:00:00.000Z'),
    });
    project.tempoMap[0] = {
        ...project.tempoMap[0]!,
        mode: 'metered',
        bpm: 100,
        bpmSource: 'user',
        meter: { numerator: 4, denominator: 4 },
    };
    return project;
};

const ids = (...values: string[]) => {
    let index = 0;
    return () => values[index++] ?? `generated-${index}`;
};

const firstRangeLane = (project: EditorProjectV1): RangeLaneV1 => {
    const lane = project.lanes.find((entry) => entry.eventKind === 'range');
    if (!lane || lane.eventKind !== 'range') throw new Error('Missing range lane.');
    return lane;
};

describe('Editor E5 range annotation domain', () => {
    test('creates range lanes and manages names and inner classes', () => {
        let project = createRangeLane(createProject(), ids('range-lane', 'range-default'));
        expect(firstRangeLane(project)).toMatchObject({
            id: 'range-lane',
            name: '范围标记 1',
            eventKind: 'range',
            innerClasses: [{ id: 'range-default', label: 'default' }],
            events: [],
        });
        project = renameRangeLane(project, 'range-lane', ' Long effects ');
        project = addRangeInnerClass(project, 'range-lane', ids('range-effect'));
        project = renameRangeInnerClass(project, 'range-lane', 'range-effect', ' Fade ');
        expect(firstRangeLane(project)).toMatchObject({
            name: 'Long effects',
            innerClasses: [
                { label: 'default' },
                { id: 'range-effect', label: 'Fade' },
            ],
        });
        expect(() => renameRangeLane(project, 'range-lane', '   '))
            .toThrowError(expect.objectContaining({ code: 'empty-label' }));
    });

    test('uses half-open overlap rules and permits adjacency and cross-class overlap', () => {
        expect(rangesOverlap(0, 1.2, 1.2, 2.4)).toBe(false);
        expect(rangesOverlap(0, 1.2, 0.6, 1.8)).toBe(true);
        let project = createRangeLane(createProject(), ids('lane', 'default'));
        project = addRangeInnerClass(project, 'lane', ids('effect'));
        project = createRangeEvent(project, 'lane', 'default', 0, 1.2, ids('a')).project;
        project = createRangeEvent(project, 'lane', 'default', 1.2, 2.4, ids('b')).project;
        project = createRangeEvent(project, 'lane', 'effect', 0.6, 1.8, ids('cross')).project;
        expect(firstRangeLane(project).events.map((entry) => entry.id))
            .toEqual(['a', 'cross', 'b']);
        expect(() => createRangeEvent(project, 'lane', 'default', 0.6, 1.8, ids('overlap')))
            .toThrowError(expect.objectContaining({ code: 'range-overlap', conflictCount: 2 }));
    });

    test('requires one current grid unit and validates endpoint moves atomically', () => {
        let project = createRangeLane(createProject(), ids('lane', 'default'));
        const minimum = nextRangeCell(1.2, project, 960);
        expect(minimum?.timeSeconds).toBe(1.35);
        expect(() => createRangeEvent(
            project,
            'lane',
            'default',
            1.2,
            1.3,
            ids('short'),
            minimum!.timeSeconds,
        )).toThrowError(expect.objectContaining({ code: 'range-invalid' }));
        project = createRangeEvent(
            project,
            'lane',
            'default',
            1.2,
            minimum!.timeSeconds,
            ids('range'),
            minimum!.timeSeconds,
        ).project;
        project = updateRangeEvent(project, 'lane', 'range', 1.05, 1.35);
        expect(firstRangeLane(project).events[0]).toMatchObject({
            startSeconds: 1.05,
            endSeconds: 1.35,
        });
        const before = project;
        expect(() => updateRangeEvent(project, 'lane', 'range', 1.35, 1.35))
            .toThrowError(expect.objectContaining({ code: 'range-invalid' }));
        expect(project).toBe(before);
    });

    test('requires explicit migration or deletion and rejects migration overlap', () => {
        let project = createRangeLane(createProject(), ids('lane', 'source'));
        project = addRangeInnerClass(project, 'lane', ids('target'));
        project = createRangeEvent(project, 'lane', 'source', 0, 1.2, ids('source-a')).project;
        project = createRangeEvent(project, 'lane', 'target', 0.6, 1.8, ids('target-a')).project;
        expect(() => removeRangeInnerClass(project, 'lane', 'source'))
            .toThrowError(expect.objectContaining({ code: 'resolution-required' }));
        expect(() => removeRangeInnerClass(project, 'lane', 'source', {
            kind: 'migrate',
            targetInnerClassId: 'target',
        })).toThrowError(expect.objectContaining({
            code: 'migration-conflict',
            conflictCount: 1,
        }));
        const deleted = removeRangeInnerClass(project, 'lane', 'source', {
            kind: 'delete-events',
        });
        expect(firstRangeLane(deleted).innerClasses.map((entry) => entry.id))
            .toEqual(['target']);
        expect(firstRangeLane(deleted).events.map((entry) => entry.id))
            .toEqual(['target-a']);
    });

    test('supports explicit minimum-range divisors and reports missing grids', () => {
        const project = createProject();
        for (const [index, entry] of buildE5RangeGolden().snappingCases.entries()) {
            project.workspace.viewport = entry.viewport;
            expect(nextRangeCell(entry.startSeconds, project, entry.widthCssPx, { preset: 'common', divisor: [4, 16][index]!, customDivisor: 5 })?.timeSeconds)
                .toBe(entry.expectedEndSeconds);
        }
        project.tempoMap = [{
            id: 'single',
            startSeconds: 0,
            mode: 'single-beat',
        }];
        expect(rangeCellAtTime(8, project, 960)).toMatchObject({
            startSeconds: 0,
            endSeconds: 12,
            subdivision: 'single-beat',
        });
        expect(nextRangeCell(0, project, 960)?.timeSeconds).toBe(12);
        project.tempoMap = [{
            id: 'unset',
            startSeconds: 0,
            mode: 'metered',
            bpm: null,
            bpmSource: 'unset',
            meter: { numerator: 4, denominator: 4 },
        }];
        expect(rangeCellAtTime(4, project, 960)).toBeNull();
        expect(nextRangeCell(4, project, 960)).toBeNull();
    });

    test('filters viewport-intersecting ranges and deletes by stable identity', () => {
        let project = createRangeLane(createProject(), ids('lane', 'default'));
        for (const [id, start, end] of [
            ['before', 0, 2],
            ['left-edge', 2, 4],
            ['inside', 4, 5],
            ['right-edge', 6, 8],
            ['after', 8, 10],
        ] as const) {
            project = createRangeEvent(project, 'lane', 'default', start, end, ids(id)).project;
        }
        expect(visibleRangeEvents(firstRangeLane(project), 'default', {
            startSeconds: 4,
            endSeconds: 6,
            zoom: 3,
        }).map((entry) => entry.id)).toEqual(['inside']);
        project = deleteRangeEvent(project, 'lane', 'inside');
        expect(firstRangeLane(project).events.some((entry) => entry.id === 'inside')).toBe(false);
    });

    test('exposes typed failures for missing identities', () => {
        expect(() => renameRangeLane(createProject(), 'missing', 'name'))
            .toThrow(RangeAnnotationError);
    });
});
