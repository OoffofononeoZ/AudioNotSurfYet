import {
    describe,
    expect,
    test,
} from 'vitest';
import {
    EditorFormatCodecRegistry,
    EditorProjectValidationError,
    createInitialEditorProject,
    decodeEditorProjectV1,
    encodeEditorProjectV1,
    validateEditorProjectV1,
} from '../../src/editor/projectCodec';
import type { EditorProjectV1 } from '../../src/editor/types';

const HASH = 'a'.repeat(64);
const NOW = new Date('2026-08-26T00:00:00.000Z');

const createProject = (): EditorProjectV1 => {
    let id = 0;
    const initial = createInitialEditorProject({
        track: {
            contentHash: HASH,
            fileName: 'editor-fixture.wav',
            title: 'Editor Fixture',
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        createId: () => `id-${++id}`,
        now: () => NOW,
    });
    return validateEditorProjectV1({
        ...initial,
        lanes: [
            {
                id: 'point-lane',
                name: 'Notes',
                eventKind: 'point',
                innerClasses: [
                    { id: 'note-c', label: 'C' },
                    { id: 'note-e', label: 'E' },
                ],
                events: [
                    { id: 'point-2', innerClassId: 'note-e', atSeconds: 2 },
                    { id: 'point-1', innerClassId: 'note-c', atSeconds: 1 },
                ],
            },
            {
                id: 'range-lane',
                name: 'Effects',
                eventKind: 'range',
                innerClasses: [{ id: 'fx-up', label: 'up' }],
                events: [
                    {
                        id: 'range-2',
                        innerClassId: 'fx-up',
                        startSeconds: 3,
                        endSeconds: 4,
                    },
                    {
                        id: 'range-1',
                        innerClassId: 'fx-up',
                        startSeconds: 1,
                        endSeconds: 3,
                    },
                ],
            },
        ],
    });
};

const mutate = (
    project: EditorProjectV1,
    update: (candidate: Record<string, unknown>) => void,
): unknown => {
    const candidate = structuredClone(project) as unknown as Record<string, unknown>;
    update(candidate);
    return candidate;
};

describe('Editor E1 JSON V1 contract', () => {
    test('creates the approved empty project and one registered JSON codec', () => {
        const project = createInitialEditorProject({
            track: {
                contentHash: HASH,
                fileName: 'empty.wav',
                durationSeconds: 12,
            },
            createId: (() => {
                let id = 0;
                return () => `empty-${++id}`;
            })(),
            now: () => NOW,
        });
        expect(project.tempoMap).toEqual([{
            id: 'empty-2',
            startSeconds: 0,
            mode: 'metered',
            bpm: null,
            bpmSource: 'unset',
            meter: { numerator: 4, denominator: 4 },
        }]);
        expect(project.workspace).toEqual({
            viewport: { startSeconds: 0, endSeconds: 12, zoom: 1 },
            overlay: { featureId: null, topRatio: 0.1, heightRatio: 0.35 },
        });
        expect(project.lanes).toEqual([]);
        expect(new EditorFormatCodecRegistry().list().map((codec) => codec.id))
            .toEqual(['json-v1']);
    });

    test('round-trips point and adjacent range events canonically', () => {
        const project = createProject();
        const encoded = encodeEditorProjectV1(project);
        const text = new TextDecoder().decode(encoded);
        expect(text.endsWith('\n')).toBe(true);
        expect(text).toContain('\n  "schemaVersion": 1,\n');
        const decoded = decodeEditorProjectV1(encoded, {
            contentHash: HASH,
            durationSeconds: 12,
            sampleRate: 48_000,
        });
        expect(decoded).toEqual(project);
        expect(decoded.lanes[0]?.events.map((event) => event.id))
            .toEqual(['point-1', 'point-2']);
        expect(decoded.lanes[1]?.events.map((event) => event.id))
            .toEqual(['range-1', 'range-2']);
    });

    test.each([
        ['unknown field', (candidate: Record<string, unknown>) => {
            candidate.unknown = true;
        }],
        ['duplicate global ID', (candidate: Record<string, unknown>) => {
            const lanes = candidate.lanes as Array<Record<string, unknown>>;
            lanes[0]!.id = candidate.projectId;
        }],
        ['duplicate point', (candidate: Record<string, unknown>) => {
            const lanes = candidate.lanes as Array<Record<string, unknown>>;
            const events = lanes[0]!.events as Array<Record<string, unknown>>;
            events[1]!.innerClassId = events[0]!.innerClassId;
            events[1]!.atSeconds = events[0]!.atSeconds;
        }],
        ['overlapping range', (candidate: Record<string, unknown>) => {
            const lanes = candidate.lanes as Array<Record<string, unknown>>;
            const events = lanes[1]!.events as Array<Record<string, unknown>>;
            events[1]!.startSeconds = 2.5;
        }],
        ['event outside duration', (candidate: Record<string, unknown>) => {
            const lanes = candidate.lanes as Array<Record<string, unknown>>;
            const events = lanes[0]!.events as Array<Record<string, unknown>>;
            events[0]!.atSeconds = 12.1;
        }],
    ])('rejects %s without producing a project', (_label, update) => {
        expect(() => validateEditorProjectV1(mutate(createProject(), update)))
            .toThrow(EditorProjectValidationError);
    });

    test('distinguishes parse, schema and track identity failures', () => {
        expect(() => decodeEditorProjectV1('{'))
            .toThrowError(expect.objectContaining({ code: 'parse-failed' }));
        expect(() => validateEditorProjectV1({
            format: 'audiosurf-editor',
            schemaVersion: 2,
        })).toThrowError(expect.objectContaining({ code: 'unsupported-schema' }));
        expect(() => validateEditorProjectV1(createProject(), {
            contentHash: 'b'.repeat(64),
            durationSeconds: 12,
            sampleRate: 48_000,
        })).toThrowError(expect.objectContaining({ code: 'track-mismatch' }));
        expect(() => validateEditorProjectV1(createProject(), {
            contentHash: HASH,
            durationSeconds: 11,
            sampleRate: 48_000,
        })).toThrowError(expect.objectContaining({ code: 'track-mismatch' }));
    });

    test('normalizes persisted time to microseconds', () => {
        const project = createProject();
        const pointLane = project.lanes[0];
        if (!pointLane || pointLane.eventKind !== 'point') throw new Error('fixture');
        pointLane.events[0]!.atSeconds = 1.123456789;
        expect(validateEditorProjectV1(project).lanes[0]!.events[0])
            .toMatchObject({ atSeconds: 1.123457 });
    });
});
