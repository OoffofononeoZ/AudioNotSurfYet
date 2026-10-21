import { describe, expect, test } from 'vitest';
import {
    addPointInnerClass,
    createPointEvent,
    createPointLane,
    deletePointEvent,
    movePointCell,
    pointCellAtTime,
    PointAnnotationError,
    removePointInnerClass,
    renamePointInnerClass,
    renamePointLane,
    visiblePointEvents,
} from '../../src/editor/pointAnnotations';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import type { EditorProjectV2, PointLaneV1 } from '../../src/editor/types';
import { buildE3PointGolden } from '../support/e3-point-fixture';

const createProject = (): EditorProjectV2 => {
    let id = 0;
    const project = createInitialEditorProject({
        track: {
            contentHash: '3'.repeat(64),
            fileName: 'editor-e3-points-v1.wav',
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: () => `initial-${++id}`,
        now: () => new Date('2026-08-27T00:00:00.000Z'),
    });
    project.tempoMap[0] = {
        ...project.tempoMap[0]!,
        mode: 'metered',
        beatOriginSeconds: project.tempoMap[0]!.startSeconds,
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

const firstPointLane = (project: EditorProjectV2): PointLaneV1 => {
    const lane = project.lanes.find(entry => entry.eventKind === 'point');
    if (!lane || lane.eventKind !== 'point') throw new Error('Missing point lane.');
    return lane;
};

describe('Editor E3 point annotation domain', () => {
    test('creates sequential point lanes and manages names and inner classes', () => {
        let project = createPointLane(createProject(), ids('lane-1', 'class-default'));
        expect(firstPointLane(project)).toMatchObject({
            id: 'lane-1',
            name: '点标记 1',
            eventKind: 'point',
            innerClasses: [{ id: 'class-default', label: 'default' }],
            events: [],
        });
        project = renamePointLane(project, 'lane-1', ' Notes ');
        project = addPointInnerClass(project, 'lane-1', ids('class-accent'));
        project = renamePointInnerClass(project, 'lane-1', 'class-accent', ' Accent ');
        expect(firstPointLane(project)).toMatchObject({
            name: 'Notes',
            innerClasses: [{ label: 'default' }, { id: 'class-accent', label: 'Accent' }],
        });
        expect(() => renamePointLane(project, 'lane-1', '   ')).toThrowError(
            expect.objectContaining({ code: 'empty-label' }),
        );
    });

    test('requires explicit event migration or deletion and blocks conflicts', () => {
        let project = createPointLane(createProject(), ids('lane-1', 'source'));
        project = addPointInnerClass(project, 'lane-1', ids('target'));
        project = createPointEvent(project, 'lane-1', 'source', 1.2, ids('source-event')).project;
        project = createPointEvent(project, 'lane-1', 'target', 2.4, ids('target-event')).project;
        expect(() => removePointInnerClass(project, 'lane-1', 'source')).toThrowError(
            expect.objectContaining({ code: 'resolution-required' }),
        );

        const migrated = removePointInnerClass(project, 'lane-1', 'source', {
            kind: 'migrate',
            targetInnerClassId: 'target',
        });
        expect(firstPointLane(migrated).events).toEqual([
            { id: 'source-event', innerClassId: 'target', atSeconds: 1.2 },
            { id: 'target-event', innerClassId: 'target', atSeconds: 2.4 },
        ]);

        const sourceId = firstPointLane(project).innerClasses[0]!.id;
        const conflicted = createPointEvent(project, 'lane-1', 'target', 1.2, ids('conflict')).project;
        expect(() =>
            removePointInnerClass(conflicted, 'lane-1', sourceId, {
                kind: 'migrate',
                targetInnerClassId: 'target',
            }),
        ).toThrowError(
            expect.objectContaining({
                code: 'migration-conflict',
                conflictCount: 1,
            }),
        );
        const deleted = removePointInnerClass(project, 'lane-1', sourceId, {
            kind: 'delete-events',
        });
        expect(firstPointLane(deleted).events.map(event => event.id)).toEqual(['target-event']);
    });

    test('keeps one inner class and point identity unique at track boundaries', () => {
        let project = createPointLane(createProject(), ids('lane-1', 'default'));
        const laneId = firstPointLane(project).id;
        const classId = firstPointLane(project).innerClasses[0]!.id;
        expect(() => removePointInnerClass(project, laneId, classId)).toThrowError(
            expect.objectContaining({ code: 'last-inner-class' }),
        );
        const start = createPointEvent(project, laneId, classId, 0, ids('start'));
        project = start.project;
        project = createPointEvent(project, laneId, classId, 12, ids('end')).project;
        expect(() => createPointEvent(project, laneId, classId, 0.0000004, ids('duplicate'))).toThrowError(
            expect.objectContaining({ code: 'point-duplicate' }),
        );
        expect(
            visiblePointEvents(firstPointLane(project), classId, {
                startSeconds: 0,
                endSeconds: 6,
                zoom: 2,
            }).map(event => event.id),
        ).toEqual(['start']);
        project = deletePointEvent(project, laneId, 'start');
        expect(firstPointLane(project).events.map(event => event.id)).toEqual(['end']);
    });

    test('supports historical timing examples with an explicit divisor rather than viewport-driven snapping', () => {
        const project = createProject();
        const golden = buildE3PointGolden();
        for (const entry of golden.snappingCases) {
            project.workspace.viewport = entry.viewport;
            const cell = pointCellAtTime(entry.rawSeconds, project, entry.widthCssPx, {
                preset: 'common',
                divisor: entry.expectedSubdivision,
                customDivisor: 5,
            });
            expect(cell?.subdivision, entry.id).toBe(entry.expectedSubdivision);
            expect(cell?.timeSeconds, entry.id).toBe(entry.expectedSeconds);
        }
        project.workspace.viewport = { startSeconds: 0, endSeconds: 12, zoom: 1 };
        const moved = movePointCell(1.2, 1, project, 960);
        expect(moved).toMatchObject({ subdivision: 4, timeSeconds: 1.35 });
    });

    test('uses one candidate for single-beat and refuses unset metered grids', () => {
        const project = createProject();
        project.tempoMap = [
            {
                id: 'single',
                startSeconds: 0,
                mode: 'single-beat',
            },
        ];
        expect(pointCellAtTime(9, project, 960)).toMatchObject({
            timeSeconds: 0,
            startSeconds: 0,
            endSeconds: 12,
            subdivision: 'single-beat',
        });
        project.tempoMap = [
            {
                id: 'unset',
                startSeconds: 0,
                mode: 'metered',
                beatOriginSeconds: 0,
                bpm: null,
                bpmSource: 'unset',
                meter: { numerator: 4, denominator: 4 },
            },
        ];
        expect(pointCellAtTime(4, project, 960)).toBeNull();
    });

    test('exposes typed failures for missing identities', () => {
        const project = createProject();
        expect(() => renamePointLane(project, 'missing', 'name')).toThrow(PointAnnotationError);
    });
});
