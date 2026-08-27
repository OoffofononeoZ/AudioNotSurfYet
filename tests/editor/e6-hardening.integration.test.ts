import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import {
    createEditorDraftEnvelope,
    EditorDraftRepository,
} from '../../src/editor/editorDraftRepository';
import {
    decodeEditorProjectV1,
    encodeEditorProjectV1,
} from '../../src/editor/projectCodec';
import type { EditorProjectV1, RangeLaneV1 } from '../../src/editor/types';
import {
    buildE6StressProject,
    E6_STRESS_DURATION_SECONDS,
    summarizeE6StressProject,
} from '../support/e6-stress-project';

const buildProject = () => buildE6StressProject({
    contentHash: '6'.repeat(64),
    fileName: 'editor-e6-stress.wav',
    durationSeconds: E6_STRESS_DURATION_SECONDS,
    sampleRate: 48_000,
});

describe('Editor E6 10,000-event persistence', () => {
    test('round-trips the complete project without schema or identity loss', () => {
        const project = buildProject();
        const decoded = decodeEditorProjectV1(encodeEditorProjectV1(project));
        expect(summarizeE6StressProject(decoded))
            .toEqual(summarizeE6StressProject(project));
        expect(decoded).toEqual(project);
    });

    test('restores the exact stress project from the V1 draft repository', async () => {
        const repository = new EditorDraftRepository({
            indexedDB,
            databaseName: `e6-${crypto.randomUUID()}`,
        });
        const project = buildProject();
        await repository.replace(createEditorDraftEnvelope(
            project,
            () => new Date('2026-08-27T12:01:00.000Z'),
        ));
        const restored = await repository.restore();
        expect(restored?.project).toEqual(project);
        repository.close();
    });

    test('rejects an overlapping import before replacing the durable draft', async () => {
        const repository = new EditorDraftRepository({
            indexedDB,
            databaseName: `e6-atomic-${crypto.randomUUID()}`,
        });
        const project = buildProject();
        await repository.replace(createEditorDraftEnvelope(project));
        const invalid = structuredClone(project) as EditorProjectV1;
        const lane = invalid.lanes.find(
            (entry): entry is RangeLaneV1 => entry.eventKind === 'range',
        )!;
        const first = lane.events[0]!;
        lane.events.push({
            id: 'e6-invalid-overlap',
            innerClassId: first.innerClassId,
            startSeconds: first.startSeconds,
            endSeconds: first.endSeconds,
        });
        expect(() => decodeEditorProjectV1(JSON.stringify(invalid)))
            .toThrowError(expect.objectContaining({ code: 'invalid-schema' }));
        expect((await repository.restore())?.project).toEqual(project);
        repository.close();
    });
});
