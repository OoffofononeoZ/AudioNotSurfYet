import { describe, expect, test } from 'vitest';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import {
    createInitialVisualizerProject,
    decodeVisualizerProjectV1,
    encodeVisualizerProjectV1,
    validateVisualizerProjectV1,
    VisualizerProjectValidationError,
} from '../../src/visualizer/projectCodec';
import {
    SceneRegistry,
    type SceneTemplateDescriptor,
} from '../../src/visualizer/sceneRegistry';
import type { VisualizerProjectV1 } from '../../src/visualizer/types';

const HASH = 'a'.repeat(64);
const NOW = new Date('2026-09-02T04:00:00.000Z');
const UUIDS = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
];

const makeProject = (): VisualizerProjectV1 => createInitialVisualizerProject({
    track: {
        contentHash: HASH,
        fileName: 'v1.wav',
        title: 'V1 fixture',
        artist: 'AudioNotSurfYet',
        durationSeconds: 12,
        sampleRate: 48_000,
    },
    createId: () => UUIDS[0]!,
    createSeed: () => 0x1234_5678,
    now: () => NOW,
});

const context = {
    contentHash: HASH,
    durationSeconds: 12,
    sampleRate: 48_000,
};

describe('Visualizer V1 project contract', () => {
    test('creates the approved neutral Orthogonal Lines 720p30 project', () => {
        const project = makeProject();
        expect(project).toMatchObject({
            format: 'audiosurf-visualizer',
            schemaVersion: 1,
            projectId: UUIDS[0],
            output: { aspectRatio: '16:9', resolution: '720p', frameRate: 30 },
            scene: {
                templateId: 'orthogonal-lines',
                templateVersion: 1,
                seed: 0x1234_5678,
            },
        });
        expect(project.scene.bindings).toHaveLength(
            new SceneRegistry().get('orthogonal-lines').parameters.length,
        );
        expect(project.scene.bindings.every(
            (binding) => binding.source.kind === 'constant',
        )).toBe(true);
    });

    test('round-trips canonical JSON with stable bytes and a trailing newline', () => {
        const bytes = encodeVisualizerProjectV1(makeProject());
        const decoded = decodeVisualizerProjectV1(bytes, context);
        expect(decoded).toEqual(makeProject());
        expect(new TextDecoder().decode(bytes).endsWith('\n')).toBe(true);
        expect(encodeVisualizerProjectV1(decoded)).toEqual(bytes);
    });

    test.each([
        ['unknown top-level field', (project: any) => { project.extra = true; }],
        ['unknown schema', (project: any) => { project.schemaVersion = 2; }],
        ['unknown template', (project: any) => { project.scene.templateId = 'plugin-scene'; }],
        ['missing parameter', (project: any) => { project.scene.bindings.pop(); }],
        ['duplicate parameter', (project: any) => {
            project.scene.bindings[1].parameterId = project.scene.bindings[0].parameterId;
        }],
        ['invalid constant shape', (project: any) => {
            project.scene.bindings[0].source.value = 1;
        }],
    ])('rejects %s without partial normalization', (_name, mutate) => {
        const project = structuredClone(makeProject()) as any;
        mutate(project);
        expect(() => validateVisualizerProjectV1(project, context)).toThrow(
            VisualizerProjectValidationError,
        );
    });

    test('rejects a fifth unique analysis feature before runtime planning', () => {
        const descriptor: SceneTemplateDescriptor = {
            id: 'orthogonal-lines',
            version: 1,
            title: 'Feature limit fixture',
            description: 'Five independently bindable scalar parameters.',
            parameters: Array.from({ length: 5 }, (_, index) => ({
                id: `value${index}`,
                label: `Value ${index}`,
                valueKind: 'number' as const,
                defaultValue: 0,
                allowedSourceKinds: ['constant', 'analysis'] as const,
                range: { min: 0, max: 1 },
                allowedAnalysisComponents: ['default'] as const,
                allowedAnalysisProjections: ['scalar'] as const,
            })),
        };
        const registry = new SceneRegistry([descriptor]);
        const project = createInitialVisualizerProject({
            track: makeProject().track,
            registry,
            createId: () => UUIDS[0]!,
            createSeed: () => 1,
            now: () => NOW,
        });
        const featureIds = [
            'rms',
            'zcr',
            'energy',
            'spectralCentroid',
            'spectralFlux',
        ] as const;
        for (const [index, binding] of project.scene.bindings.entries()) {
            project.scene.bindings[index] = {
                parameterId: binding.parameterId,
                source: {
                    kind: 'analysis',
                    featureId: featureIds[index]!,
                    projection: { kind: 'scalar' },
                },
            };
        }
        expect(() => validateVisualizerProjectV1(project, context, registry)).toThrowError(
            expect.objectContaining({ code: 'analysis-feature-limit' }),
        );
    });

    test('enforces descriptor ranges, integer settings and allowed sources', () => {
        const outsideRange = structuredClone(makeProject());
        const thickness = outsideRange.scene.bindings.find(
            (binding) => binding.parameterId === 'horizontalThickness',
        )!;
        thickness.source = { kind: 'constant', value: -1 };
        expect(() => validateVisualizerProjectV1(outsideRange, context)).toThrow(
            /between 0.5 and 64/,
        );

        const dynamicSetting = structuredClone(makeProject());
        const brightness = dynamicSetting.scene.bindings.find(
            (binding) => binding.parameterId === 'horizontalBrightness',
        )!;
        brightness.source = {
            kind: 'analysis',
            featureId: 'rms',
            projection: { kind: 'scalar' },
        };
        expect(() => validateVisualizerProjectV1(dynamicSetting, context)).toThrow(
            /source.kind is not allowed/,
        );

        const registry = new SceneRegistry();
        const nonInteger = structuredClone(makeProject());
        nonInteger.scene.templateId = 'cube-swarm';
        nonInteger.scene.bindings = registry.createConstantBindings('cube-swarm');
        const cubeCount = nonInteger.scene.bindings.find(
            (binding) => binding.parameterId === 'cubeCount',
        )!;
        cubeCount.source = { kind: 'constant', value: 12.5 };
        expect(() => validateVisualizerProjectV1(nonInteger, context)).toThrow(
            /must be an integer/,
        );
    });

    test('validates an embedded same-song Editor event and rejects dangling references', () => {
        let sequence = 1;
        const editor = createInitialEditorProject({
            track: makeProject().track,
            createId: () => `editor-id-${sequence++}`,
            now: () => NOW,
        });
        editor.lanes = [{
            id: 'lane-1',
            name: 'drum',
            eventKind: 'point',
            innerClasses: [{ id: 'class-1', label: 'kick' }],
            events: [{ id: 'event-1', innerClassId: 'class-1', atSeconds: 1 }],
        }];
        const project = makeProject();
        project.editorSnapshot = { capturedAt: NOW.toISOString(), project: editor };
        project.scene.bindings[1] = {
            parameterId: project.scene.bindings[1]!.parameterId,
            source: { kind: 'editor-event', laneId: 'lane-1', innerClassId: 'class-1' },
        };
        expect(validateVisualizerProjectV1(project, context)).toMatchObject({
            editorSnapshot: { project: { lanes: [{ id: 'lane-1' }] } },
        });
        (project.scene.bindings[1]!.source as { innerClassId: string }).innerClassId = 'missing';
        expect(() => validateVisualizerProjectV1(project, context)).toThrow(
            /innerClassId/,
        );
    });

    test('rejects another track identity atomically', () => {
        expect(() => validateVisualizerProjectV1(makeProject(), {
            ...context,
            contentHash: 'b'.repeat(64),
        })).toThrowError(expect.objectContaining({ code: 'track-mismatch' }));
    });
});
