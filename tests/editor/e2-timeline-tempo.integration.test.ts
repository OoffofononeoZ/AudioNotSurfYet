import { describe, expect, test } from 'vitest';
import { createAnalysisConfig } from '../../src/analysis/config';
import { extractTempoEstimate, runAnalysisJob } from '../../src/analysis/workerCore';
import { createInitialEditorProject, decodeEditorProject, encodeEditorProjectV2 } from '../../src/editor/projectCodec';
import { insertTempoBoundary } from '../../src/editor/tempoMap';
import { SAMPLE_RATE } from '../support/audio-fixtures';
import { createClickTrack } from '../support/e2-tempo-fixture';

describe('Editor E2 analysis and persistence integration', () => {
    test('reuses retained Buffer PCM for an identity-bound tempo result', async () => {
        const pcm = createClickTrack(100);
        const config = await createAnalysisConfig(SAMPLE_RATE);
        const request = {
            kind: 'analyze' as const,
            jobId: 'e2-buffer',
            generation: 2,
            trackHash: 'e2-track',
            config,
            featureIds: ['buffer'] as const,
            cursorFeatureIds: ['buffer'] as const,
            pcm: pcm.buffer.slice(0) as ArrayBuffer,
            durationSeconds: pcm.length / SAMPLE_RATE,
        };
        const output = await runAnalysisJob(request, {
            yieldControl: async () => undefined,
        });
        expect(output.result.series[0]?.payload.kind).toBe('waveform-envelope');
        const result = extractTempoEstimate(output.retained, {
            kind: 'tempo-estimate',
            requestId: 'tempo-1',
            generation: 2,
            trackHash: 'e2-track',
            configHash: config.configHash,
        });
        expect(result).toMatchObject({
            state: 'reliable',
            bpm: expect.any(Number),
            trackHash: 'e2-track',
            configHash: config.configHash,
        });
        expect(
            extractTempoEstimate(output.retained, {
                kind: 'tempo-estimate',
                requestId: 'stale',
                generation: 1,
                trackHash: 'e2-track',
                configHash: config.configHash,
            }),
        ).toBeNull();
    }, 30_000);

    test('round-trips viewport and inherited tempo segments through JSON V1', () => {
        const project = createInitialEditorProject({
            track: {
                contentHash: 'e'.repeat(64),
                fileName: 'editor-e2-tempo-100-v1.wav',
                durationSeconds: 12,
                sampleRate: SAMPLE_RATE,
            },
            createId: (() => {
                let id = 0;
                return () => `e2-${++id}`;
            })(),
            now: () => new Date('2026-08-27T00:00:00.000Z'),
        });
        project.tempoMap[0] = {
            ...project.tempoMap[0]!,
            mode: 'metered',
            beatOriginSeconds: project.tempoMap[0]!.startSeconds,
            bpm: 100,
            bpmSource: 'estimated',
            meter: { numerator: 4, denominator: 4 },
        };
        project.tempoMap = insertTempoBoundary(project.tempoMap, 6, () => 'e2-boundary');
        project.workspace.viewport = { startSeconds: 3, endSeconds: 9, zoom: 2 };
        expect(decodeEditorProject(encodeEditorProjectV2(project))).toEqual(project);
    });
});
