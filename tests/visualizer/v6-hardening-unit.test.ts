import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { FeatureId } from '../../src/analysis/types';
import { planVisualizerFeatures } from '../../src/visualizer/bindingPlanner';
import {
    createInitialVisualizerProject,
    decodeVisualizerProjectV1,
    encodeVisualizerProjectV1,
} from '../../src/visualizer/projectCodec';
import { SceneRegistry } from '../../src/visualizer/sceneRegistry';
import type {
    VisualizerParameterBindingV1,
    VisualizerProjectV1,
} from '../../src/visualizer/types';

type Golden = {
    schemaVersion: number;
    generatorVersion: string;
    fixtures: Array<{
        id: string;
        path: string;
        sha256: string;
        durationSeconds: number;
    }>;
    stressAudio: {
        storage: string;
        format: string;
        sampleRate: number;
        channels: number;
        durationSeconds: number;
        chunkSeconds: number;
        committed: boolean;
    };
    cube: {
        templateId: 'cube-swarm';
        templateVersion: 1;
        seed: number;
        bindings: VisualizerParameterBindingV1[];
        expectedActiveFeatureIds: FeatureId[];
    };
    orthogonal: {
        templateId: 'orthogonal-lines';
        templateVersion: 1;
        bindings: VisualizerParameterBindingV1[];
        expectedActiveFeatureIds: FeatureId[];
    };
    transition: {
        expectedActiveFeatureCounts: number[];
        expectedRestoredCubeFeatureIds: FeatureId[];
    };
    media: {
        browserNames: string[];
        formatNames: string[];
        minimumFiles: number;
        resolution: { width: number; height: number };
        frameRate: number;
    };
    canonical: {
        upstreamV5Run: string;
        upstreamV5ImplementationCommit: string;
        upstreamV5EvidenceCommit: string;
        upstreamV5SummarySha256: string;
        expectedStepCount: number;
    };
};

const goldenUrl = new URL(
    '../analysis/golden/visualizer-v6-hardening.v1.json',
    import.meta.url,
);
const golden = JSON.parse(readFileSync(goldenUrl, 'utf8')) as Golden;
const repositoryRoot = new URL('../../', import.meta.url);

const baseProject = (): VisualizerProjectV1 => createInitialVisualizerProject({
    track: {
        contentHash: golden.fixtures[1]!.sha256,
        fileName: 'format-master.wav',
        durationSeconds: golden.fixtures[1]!.durationSeconds,
        sampleRate: golden.stressAudio.sampleRate,
    },
    createId: () => '00000000-0000-4000-8000-000000000606',
    createSeed: () => golden.cube.seed,
    now: () => new Date('2026-09-03T06:00:00.000Z'),
});

const applyDynamicBindings = (
    project: VisualizerProjectV1,
    registry: SceneRegistry,
    templateId: 'orthogonal-lines' | 'cube-swarm',
    dynamic: readonly VisualizerParameterBindingV1[],
): VisualizerProjectV1 => {
    const bindings = registry.createConstantBindings(templateId);
    for (const binding of dynamic) {
        const index = bindings.findIndex((entry) => entry.parameterId === binding.parameterId);
        if (index < 0) throw new Error(`Golden references unknown parameter ${binding.parameterId}.`);
        bindings[index] = structuredClone(binding);
    }
    return {
        ...project,
        scene: {
            templateId,
            templateVersion: 1,
            seed: golden.cube.seed,
            bindings,
        },
    };
};

describe('Visualizer V6 final hardening golden', () => {
    test('locks MP3/WAV/FLAC fixture identity and the OPFS stress contract', () => {
        expect(golden).toMatchObject({
            schemaVersion: 1,
            generatorVersion: 'visualizer-v6-hardening-v1',
            stressAudio: {
                storage: 'opfs',
                format: 'wav-pcm16',
                sampleRate: 48_000,
                channels: 1,
                durationSeconds: 900,
                chunkSeconds: 5,
                committed: false,
            },
        });
        expect(golden.fixtures.map((entry) => entry.id)).toEqual([
            'format-master-mp3-v1',
            'format-master-wav-v1',
            'format-master-flac-v1',
        ]);
        for (const fixture of golden.fixtures) {
            const bytes = readFileSync(new URL(fixture.path, repositoryRoot));
            expect(createHash('sha256').update(bytes).digest('hex')).toBe(fixture.sha256);
        }
    });

    test('validates projection, component, transform and exact 4→2→4 feature plans', () => {
        const registry = new SceneRegistry();
        const initial = baseProject();
        const cube = applyDynamicBindings(initial, registry, 'cube-swarm', golden.cube.bindings);
        const canonicalCube = decodeVisualizerProjectV1(
            encodeVisualizerProjectV1(cube, registry),
            undefined,
            registry,
        );
        expect(planVisualizerFeatures(canonicalCube)).toEqual(
            golden.cube.expectedActiveFeatureIds,
        );
        expect(canonicalCube.scene.bindings.filter(
            (binding) => binding.source.kind === 'analysis',
        )).toEqual(golden.cube.bindings);

        const orthogonal = applyDynamicBindings(
            canonicalCube,
            registry,
            'orthogonal-lines',
            golden.orthogonal.bindings,
        );
        const restored = applyDynamicBindings(
            orthogonal,
            registry,
            'cube-swarm',
            golden.cube.bindings,
        );
        const plans = [
            planVisualizerFeatures(canonicalCube),
            planVisualizerFeatures(orthogonal),
            planVisualizerFeatures(restored),
        ];
        expect(plans.map((entry) => entry.length)).toEqual(
            golden.transition.expectedActiveFeatureCounts,
        );
        expect(plans[1]).toEqual(golden.orthogonal.expectedActiveFeatureIds);
        expect(plans[2]).toEqual(golden.transition.expectedRestoredCubeFeatureIds);
    });

    test('locks the six-file media matrix and upstream canonical identity', () => {
        expect(golden.media).toMatchObject({
            browserNames: ['chrome', 'edge'],
            formatNames: ['mp3', 'wav', 'flac'],
            minimumFiles: 6,
            resolution: { width: 1280, height: 720 },
            frameRate: 30,
        });
        expect(golden.canonical).toMatchObject({
            upstreamV5Run: 'V5-2026-09-03T03-49-31-211Z-9b5af09c',
            upstreamV5ImplementationCommit: '9b5af09c5846415a8e5465e710e6095f1e7db310',
            upstreamV5EvidenceCommit: '10a2bc0c7a30413d80689ed41dc98caae33ec21f',
            upstreamV5SummarySha256: 'cec1fab0310852458c2aa4fbd3bebc90eee3e213a54b7695a524736e07b07b7b',
            expectedStepCount: 54,
        });
    });
});
