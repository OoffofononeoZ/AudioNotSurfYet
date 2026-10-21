import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import {
    addRangeInnerClass,
    createRangeEvent,
    createRangeLane,
    removeRangeInnerClass,
    updateRangeEvent,
    visibleRangeEvents,
} from '../../src/editor/rangeAnnotations';
import { createPointEvent, createPointLane } from '../../src/editor/pointAnnotations';
import { EditorDraftRepository, createEditorDraftEnvelope } from '../../src/editor/editorDraftRepository';
import { createInitialEditorProject, decodeEditorProject, encodeEditorProjectV2 } from '../../src/editor/projectCodec';
import type { EditorProjectV2, PointLaneV1, RangeLaneV1 } from '../../src/editor/types';

const createProject = (): EditorProjectV2 => {
    let id = 0;
    const project = createInitialEditorProject({
        track: {
            contentHash: '8'.repeat(64),
            fileName: 'editor-e5-ranges-v1.wav',
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: () => `base-${++id}`,
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

const rangeLane = (project: EditorProjectV2): RangeLaneV1 => {
    const lane = project.lanes.find(entry => entry.eventKind === 'range');
    if (!lane || lane.eventKind !== 'range') throw new Error('Missing range lane.');
    return lane;
};

const sequentialIds = (...values: string[]) => {
    let index = 0;
    return () => values[index++] ?? `generated-${index}`;
};

describe('Editor E5 range persistence integration', () => {
    test('round-trips point and range events without changing JSON V2', () => {
        let project = createRangeLane(createProject(), sequentialIds('range-lane', 'range-default'));
        project = createRangeEvent(project, 'range-lane', 'range-default', 1.2, 2.4, () => 'range-event').project;
        project = createPointLane(project, sequentialIds('point-lane', 'point-default'));
        project = createPointEvent(project, 'point-lane', 'point-default', 1.8, () => 'point-event').project;
        const decoded = decodeEditorProject(encodeEditorProjectV2(project));
        expect(decoded.schemaVersion).toBe(2);
        expect((decoded.lanes[0] as RangeLaneV1).events).toEqual([
            {
                id: 'range-event',
                innerClassId: 'range-default',
                startSeconds: 1.2,
                endSeconds: 2.4,
            },
        ]);
        expect((decoded.lanes[1] as PointLaneV1).events[0]?.atSeconds).toBe(1.8);
    });

    test('persists range, viewport, tempo and overlay through the draft repository', async () => {
        const repository = new EditorDraftRepository({
            indexedDB,
            databaseName: `e5-${crypto.randomUUID()}`,
        });
        let project = createRangeLane(createProject(), sequentialIds('lane', 'default'));
        project = createRangeEvent(project, 'lane', 'default', 3, 4.5, () => 'range').project;
        project.workspace.viewport = { startSeconds: 3, endSeconds: 9, zoom: 2 };
        project.workspace.overlay = { featureId: 'chroma', topRatio: 0.2, heightRatio: 0.4 };
        await repository.replace(createEditorDraftEnvelope(project, () => new Date('2026-08-27T00:01:00.000Z')));
        const restored = await repository.restore();
        expect(restored?.project.workspace).toEqual(project.workspace);
        expect((restored?.project.lanes[0] as RangeLaneV1).events[0]).toMatchObject({
            id: 'range',
            startSeconds: 3,
            endSeconds: 4.5,
        });
        repository.close();
    });

    test('atomically rejects overlapping imported ranges', () => {
        let project = createRangeLane(createProject(), sequentialIds('lane', 'default'));
        project = createRangeEvent(project, 'lane', 'default', 0, 1.2, () => 'valid').project;
        const before = encodeEditorProjectV2(project);
        const invalid = JSON.parse(new TextDecoder().decode(before)) as EditorProjectV2;
        (invalid.lanes[0] as RangeLaneV1).events.push({
            id: 'overlap',
            innerClassId: 'default',
            startSeconds: 0.6,
            endSeconds: 1.8,
        });
        expect(() => decodeEditorProject(JSON.stringify(invalid))).toThrowError(
            expect.objectContaining({ code: 'invalid-schema' }),
        );
        expect(decodeEditorProject(before).lanes).toEqual(project.lanes);
    });

    test('keeps seconds stable across tempo and viewport changes', () => {
        let project = createRangeLane(createProject(), sequentialIds('lane', 'default'));
        project = createRangeEvent(project, 'lane', 'default', 1.2, 2.4, () => 'range').project;
        const changed: EditorProjectV2 = {
            ...project,
            tempoMap: [
                {
                    id: project.tempoMap[0]!.id,
                    startSeconds: 0,
                    mode: 'metered',
                    beatOriginSeconds: 0,
                    bpm: 127.5,
                    bpmSource: 'user',
                    meter: { numerator: 7, denominator: 8 },
                },
            ],
            workspace: {
                ...project.workspace,
                viewport: { startSeconds: 1, endSeconds: 4, zoom: 4 },
            },
        };
        expect(rangeLane(changed).events[0]).toMatchObject({
            startSeconds: 1.2,
            endSeconds: 2.4,
        });
        expect(visibleRangeEvents(rangeLane(changed), 'default', changed.workspace.viewport)).toHaveLength(1);
    });

    test('migrates non-overlapping ranges and preserves stable identities', () => {
        let project = createRangeLane(createProject(), sequentialIds('lane', 'source'));
        project = addRangeInnerClass(project, 'lane', () => 'target');
        project = createRangeEvent(project, 'lane', 'source', 0, 1.2, () => 'source-a').project;
        project = createRangeEvent(project, 'lane', 'target', 1.2, 2.4, () => 'target-a').project;
        project = removeRangeInnerClass(project, 'lane', 'source', {
            kind: 'migrate',
            targetInnerClassId: 'target',
        });
        project = updateRangeEvent(project, 'lane', 'source-a', 0, 0.6);
        expect(rangeLane(project).events).toEqual([
            {
                id: 'source-a',
                innerClassId: 'target',
                startSeconds: 0,
                endSeconds: 0.6,
            },
            {
                id: 'target-a',
                innerClassId: 'target',
                startSeconds: 1.2,
                endSeconds: 2.4,
            },
        ]);
    });
});
