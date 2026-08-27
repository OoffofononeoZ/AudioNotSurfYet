import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import {
    addPointInnerClass,
    createPointEvent,
    createPointLane,
    removePointInnerClass,
    visiblePointEvents,
} from '../../src/editor/pointAnnotations';
import {
    EditorDraftRepository,
    createEditorDraftEnvelope,
} from '../../src/editor/editorDraftRepository';
import {
    createInitialEditorProject,
    decodeEditorProjectV1,
    encodeEditorProjectV1,
} from '../../src/editor/projectCodec';
import type { EditorProjectV1, PointLaneV1 } from '../../src/editor/types';

const createProject = (): EditorProjectV1 => {
    let id = 0;
    const project = createInitialEditorProject({
        track: {
            contentHash: '7'.repeat(64),
            fileName: 'editor-e3-points-v1.wav',
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: () => `base-${++id}`,
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

const pointLane = (project: EditorProjectV1): PointLaneV1 => {
    const lane = project.lanes.find((entry) => entry.eventKind === 'point');
    if (!lane || lane.eventKind !== 'point') throw new Error('Missing point lane.');
    return lane;
};

describe('Editor E3 point persistence integration', () => {
    test('round-trips point changes and preserves imported range lanes', () => {
        let project = createPointLane(createProject(), (() => {
            const values = ['point-lane', 'point-default'];
            return () => values.shift() ?? crypto.randomUUID();
        })());
        const lane = pointLane(project);
        project = createPointEvent(project, lane.id, lane.innerClasses[0]!.id, 1.35, () => 'point-1').project;
        project = {
            ...project,
            lanes: [...project.lanes, {
                id: 'range-lane',
                name: 'Effects',
                eventKind: 'range',
                innerClasses: [{ id: 'range-class', label: 'up' }],
                events: [{
                    id: 'range-event',
                    innerClassId: 'range-class',
                    startSeconds: 3,
                    endSeconds: 4,
                }],
            }],
        };
        const decoded = decodeEditorProjectV1(encodeEditorProjectV1(project));
        expect(decoded.lanes).toEqual(project.lanes);
        expect(decoded.lanes[1]).toMatchObject({
            eventKind: 'range',
            events: [{ startSeconds: 3, endSeconds: 4 }],
        });
    });

    test('persists point and viewport through the independent draft repository', async () => {
        const repository = new EditorDraftRepository({
            indexedDB,
            databaseName: `e3-${crypto.randomUUID()}`,
        });
        let project = createPointLane(createProject(), (() => {
            const values = ['lane', 'default'];
            return () => values.shift() ?? crypto.randomUUID();
        })());
        const lane = pointLane(project);
        project = createPointEvent(project, lane.id, lane.innerClasses[0]!.id, 6, () => 'point-6').project;
        project.workspace.viewport = { startSeconds: 3, endSeconds: 9, zoom: 2 };
        await repository.replace(createEditorDraftEnvelope(
            project,
            () => new Date('2026-08-27T00:01:00.000Z'),
        ));
        const restored = await repository.restore();
        expect(restored?.project.workspace.viewport).toEqual({
            startSeconds: 3,
            endSeconds: 9,
            zoom: 2,
        });
        expect((restored?.project.lanes[0] as PointLaneV1).events)
            .toEqual([{ id: 'point-6', innerClassId: 'default', atSeconds: 6 }]);
        repository.close();
    });

    test('migration keeps event seconds stable when tempo changes', () => {
        let project = createPointLane(createProject(), (() => {
            const values = ['lane', 'source'];
            return () => values.shift() ?? crypto.randomUUID();
        })());
        project = addPointInnerClass(project, 'lane', () => 'target');
        project = createPointEvent(project, 'lane', 'source', 1.35, () => 'point-a').project;
        const migrated = removePointInnerClass(project, 'lane', 'source', {
            kind: 'migrate',
            targetInnerClassId: 'target',
        });
        const tempoChanged = {
            ...migrated,
            tempoMap: [{
                id: migrated.tempoMap[0]!.id,
                startSeconds: 0,
                mode: 'metered' as const,
                bpm: 127.5,
                bpmSource: 'user' as const,
                meter: { numerator: 7, denominator: 8 as const },
            }],
        };
        expect(pointLane(tempoChanged).events[0]).toMatchObject({
            id: 'point-a',
            innerClassId: 'target',
            atSeconds: 1.35,
        });
    });

    test('filters only current horizontal viewport markers', () => {
        let project = createPointLane(createProject(), (() => {
            const values = ['lane', 'default'];
            return () => values.shift() ?? crypto.randomUUID();
        })());
        for (const [id, time] of [['a', 0], ['b', 3], ['c', 6], ['d', 12]] as const) {
            project = createPointEvent(project, 'lane', 'default', time, () => id).project;
        }
        const visible = visiblePointEvents(pointLane(project), 'default', {
            startSeconds: 3,
            endSeconds: 6,
            zoom: 4,
        });
        expect(visible.map((event) => event.id)).toEqual(['b', 'c']);
    });
});
