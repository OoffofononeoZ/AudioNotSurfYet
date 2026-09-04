import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import {
    copyMarkerBlockAfter,
    moveMarkerBlock,
    type MarkerBlockSelection,
} from '../../src/editor/markerBlockOperations';
import {
    createEditorDraftEnvelope,
    EditorDraftRepository,
} from '../../src/editor/editorDraftRepository';
import {
    createInitialEditorProject,
    decodeEditorProjectV1,
    encodeEditorProjectV1,
} from '../../src/editor/projectCodec';
import type { EditorProjectV1, PointLaneV1, RangeLaneV1 } from '../../src/editor/types';

const projectFixture = (): EditorProjectV1 => {
    const project = createInitialEditorProject({
        track: {
            contentHash: 'b'.repeat(64),
            fileName: 'editor-e10-integration.wav',
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: (() => {
            let value = 0;
            return () => `base-${++value}`;
        })(),
        now: () => new Date('2026-09-04T09:00:00.000Z'),
    });
    return {
        ...project,
        tempoMap: [{
            id: 'tempo',
            startSeconds: 0,
            mode: 'metered',
            bpm: 120,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        }],
        lanes: [{
            id: 'point-lane',
            name: 'Points',
            eventKind: 'point',
            innerClasses: [{ id: 'point-main', label: 'main' }],
            events: [
                { id: 'point-a', innerClassId: 'point-main', atSeconds: 0.5 },
                { id: 'point-b', innerClassId: 'point-main', atSeconds: 1.5 },
            ],
        }, {
            id: 'range-lane',
            name: 'Ranges',
            eventKind: 'range',
            innerClasses: [{ id: 'range-main', label: 'main' }],
            events: [{
                id: 'range-a',
                innerClassId: 'range-main',
                startSeconds: 4.25,
                endSeconds: 5.25,
            }],
        }],
    };
};

describe('Editor E10 marker block integration', () => {
    test('applies a copy as one project update and restores it through the single JSON V1 draft', async () => {
        const repository = new EditorDraftRepository({
            indexedDB,
            databaseName: `e10-${crypto.randomUUID()}`,
        });
        const update = vi.fn(async (project: EditorProjectV1) => {
            await repository.replace(createEditorDraftEnvelope(
                project,
                () => new Date('2026-09-04T09:00:01.000Z'),
            ));
        });
        let id = 0;
        const result = copyMarkerBlockAfter(projectFixture(), {
            laneId: 'point-lane',
            innerClassId: 'point-main',
            startSeconds: 0,
            endSeconds: 2,
        }, () => `copy-${++id}`);
        await update(result.project);
        expect(update).toHaveBeenCalledTimes(1);
        const restored = await repository.restore();
        expect(restored?.project.schemaVersion).toBe(1);
        expect((restored?.project.lanes[0] as PointLaneV1).events.map((event) => event.id))
            .toEqual(['point-a', 'point-b', 'copy-1', 'copy-2']);
        expect(encodeEditorProjectV1(restored!.project)).not.toContain('blockMode');
        repository.close();
    });

    test('round-trips a moved range with stable identity and unchanged JSON schema', () => {
        const source = projectFixture();
        const selection: MarkerBlockSelection = {
            laneId: 'range-lane',
            innerClassId: 'range-main',
            startSeconds: 4,
            endSeconds: 6,
        };
        const result = moveMarkerBlock(source, selection, 8);
        const decoded = decodeEditorProjectV1(encodeEditorProjectV1(result.project));
        expect(decoded.schemaVersion).toBe(1);
        expect((decoded.lanes[1] as RangeLaneV1).events).toEqual([{
            id: 'range-a',
            innerClassId: 'range-main',
            startSeconds: 8.25,
            endSeconds: 9.25,
        }]);
        expect(result.selection).toMatchObject({ startSeconds: 8, endSeconds: 10 });
    });

    test('keeps serialized project bytes stable after an atomic conflict rejection', () => {
        const source = projectFixture();
        const lane = source.lanes[0] as PointLaneV1;
        const project: EditorProjectV1 = {
            ...source,
            lanes: [{
                ...lane,
                events: [...lane.events, {
                    id: 'occupied',
                    innerClassId: 'point-main',
                    atSeconds: 2.5,
                }],
            }, source.lanes[1]!],
        };
        const before = encodeEditorProjectV1(project);
        expect(() => copyMarkerBlockAfter(project, {
            laneId: 'point-lane',
            innerClassId: 'point-main',
            startSeconds: 0,
            endSeconds: 2,
        })).toThrowError(expect.objectContaining({ code: 'point-conflict' }));
        expect(encodeEditorProjectV1(project)).toEqual(before);
    });

    test('uses a native themed dialog while retaining the route guard and beforeunload controller path', () => {
        const source = readFileSync(path.resolve(
            import.meta.dirname,
            '../../src/views/Editor.vue',
        ), 'utf8');
        expect(source).toContain('<dialog');
        expect(source).toContain('dialog.showModal()');
        expect(source).toContain('onBeforeRouteLeave');
        expect(source).toContain('controller.shouldWarnOnLeave()');
        expect(source).not.toContain('ElMessageBox');
        expect(source).not.toContain('ElCheckbox');
    });
});
