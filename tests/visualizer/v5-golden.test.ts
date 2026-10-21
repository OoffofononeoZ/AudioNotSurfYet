import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readEditorProject } from '../../src/editor/projectCodec';
import type { EditorProjectV2 } from '../../src/editor/types';
import {
    SAMPLE_RATE,
    VISUALIZER_V5_DURATION_SECONDS,
    createVisualizerV5AvSyncFixture,
    sha256Float32,
} from '../support/audio-fixtures';

const golden = JSON.parse(
    readFileSync(new URL('../analysis/golden/visualizer-v5-recording.v1.json', import.meta.url), 'utf8'),
) as {
    schemaVersion: number;
    generatorVersion: string;
    fixture: string;
    wavSha256: string;
    sampleRate: number;
    channels: number;
    durationSeconds: number;
    burst: {
        eventSeconds: number;
        durationSeconds: number;
        maximumAllowedSyncErrorSeconds: number;
    };
    editorProject: EditorProjectV2;
    orthogonalBindings: Array<{
        parameterId: string;
        source: { kind: string; laneId: string; innerClassId: string };
    }>;
};

describe('Visualizer V5 versioned recording golden', () => {
    test('locks the deterministic mono 48 kHz three-second fixture and Editor point/range', () => {
        const wav = readFileSync(new URL('../fixtures/audio/visualizer-v5-avsync-v1.wav', import.meta.url));
        expect(createHash('sha256').update(wav).digest('hex')).toBe(golden.wavSha256);
        expect(golden).toMatchObject({
            schemaVersion: 1,
            generatorVersion: 'visualizer-v5-avsync-fixture-v1',
            sampleRate: 48_000,
            channels: 1,
            durationSeconds: 3,
        });
        expect(sha256Float32(createVisualizerV5AvSyncFixture())).toMatch(/^[a-f0-9]{64}$/);
        expect(SAMPLE_RATE).toBe(golden.sampleRate);
        expect(VISUALIZER_V5_DURATION_SECONDS).toBe(golden.durationSeconds);
        const editor = readEditorProject(golden.editorProject, {
            contentHash: golden.wavSha256,
            durationSeconds: 3,
            sampleRate: 48_000,
        });
        expect(editor.lanes).toMatchObject([
            { id: 'v5-sync-flash', eventKind: 'point', events: [{ atSeconds: 1.5 }] },
            { id: 'v5-tone-bed', eventKind: 'range', events: [{ startSeconds: 0, endSeconds: 3 }] },
        ]);
        expect(golden.orthogonalBindings).toMatchObject([
            {
                parameterId: 'horizontalIntensity',
                source: { kind: 'editor-event', laneId: 'v5-sync-flash' },
            },
            {
                parameterId: 'verticalIntensity',
                source: { kind: 'editor-event', laneId: 'v5-sync-flash' },
            },
        ]);
    });

    test('places the 10 ms RMS peak within one window of the 1.5 second sync event', () => {
        const samples = createVisualizerV5AvSyncFixture();
        const windowSize = Math.round(SAMPLE_RATE * 0.01);
        let peakRms = -Infinity;
        let peakSeconds = 0;
        for (let start = 0; start + windowSize <= samples.length; start += windowSize) {
            let sum = 0;
            for (let index = start; index < start + windowSize; index += 1) {
                sum += samples[index]! ** 2;
            }
            const rms = Math.sqrt(sum / windowSize);
            if (rms > peakRms) {
                peakRms = rms;
                peakSeconds = (start + windowSize / 2) / SAMPLE_RATE;
            }
        }
        expect(peakRms).toBeGreaterThan(0.3);
        expect(Math.abs(peakSeconds - golden.burst.eventSeconds)).toBeLessThanOrEqual(0.01);
        expect(golden.burst.maximumAllowedSyncErrorSeconds).toBe(0.1);
    });
});
