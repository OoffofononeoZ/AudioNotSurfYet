import { sha256Bytes } from './audio-fixtures.ts';
import {
    E2_TEMPO_DURATION_SECONDS,
    createClickTrack,
} from './e2-tempo-fixture.ts';
import { encodeMonoWav } from './m7-learning-fixture.ts';

export const E5_RANGE_GENERATOR_VERSION = 'editor-e5-ranges-v1';
export const E5_RANGE_DURATION_SECONDS = E2_TEMPO_DURATION_SECONDS;

export const createE5RangeWav = (): Uint8Array =>
    encodeMonoWav(createClickTrack(100, E5_RANGE_DURATION_SECONDS));

export const buildE5RangeGolden = () => {
    const wav = createE5RangeWav();
    return {
        schemaVersion: 1,
        generatedAt: '2026-08-27',
        generatorVersion: E5_RANGE_GENERATOR_VERSION,
        durationSeconds: E5_RANGE_DURATION_SECONDS,
        bpm: 100,
        meter: '4/4',
        wavSha256: sha256Bytes(wav),
        snappingCases: [
            {
                id: 'minimum-full-viewport',
                viewport: { startSeconds: 0, endSeconds: 12, zoom: 1 },
                widthCssPx: 960,
                startSeconds: 1.2,
                expectedEndSeconds: 1.35,
            },
            {
                id: 'minimum-zoomed-viewport',
                viewport: { startSeconds: 0, endSeconds: 3, zoom: 4 },
                widthCssPx: 960,
                startSeconds: 1.2,
                expectedEndSeconds: 1.2375,
            },
        ],
        rangeEvents: [
            { innerClass: 'default', startSeconds: 0, endSeconds: 1.2 },
            { innerClass: 'default', startSeconds: 1.2, endSeconds: 2.4 },
            { innerClass: 'effect', startSeconds: 0.6, endSeconds: 1.8 },
            { innerClass: 'single-beat', startSeconds: 6, endSeconds: 12 },
        ],
        rules: {
            interval: '[startSeconds, endSeconds)',
            adjacentAllowed: true,
            sameClassOverlapAllowed: false,
            differentClassOverlapAllowed: true,
            pointInsideRangeAllowed: true,
        },
    };
};

export const createE5RangeProject = (): string => {
    const wavHash = sha256Bytes(createE5RangeWav());
    return `${JSON.stringify({
        format: 'audiosurf-editor',
        schemaVersion: 1,
        projectId: 'e5-range-project',
        createdAt: '2026-08-27T00:00:00.000Z',
        updatedAt: '2026-08-27T00:00:00.000Z',
        track: {
            contentHash: wavHash,
            fileName: 'editor-e5-ranges-v1.wav',
            title: 'Editor E5 Ranges',
            durationSeconds: E5_RANGE_DURATION_SECONDS,
            sampleRate: 48_000,
        },
        tempoMap: [{
            id: 'e5-tempo',
            startSeconds: 0,
            mode: 'metered',
            bpm: 100,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        }],
        lanes: [{
            id: 'e5-range-lane',
            name: 'Long effects',
            eventKind: 'range',
            innerClasses: [
                { id: 'e5-default', label: 'default' },
                { id: 'e5-effect', label: 'effect' },
            ],
            events: [
                {
                    id: 'e5-adjacent-a',
                    innerClassId: 'e5-default',
                    startSeconds: 0,
                    endSeconds: 1.2,
                },
                {
                    id: 'e5-adjacent-b',
                    innerClassId: 'e5-default',
                    startSeconds: 1.2,
                    endSeconds: 2.4,
                },
                {
                    id: 'e5-cross-class',
                    innerClassId: 'e5-effect',
                    startSeconds: 0.6,
                    endSeconds: 1.8,
                },
            ],
        }, {
            id: 'e5-point-lane',
            name: 'Notes',
            eventKind: 'point',
            innerClasses: [{ id: 'e5-note', label: 'note' }],
            events: [{
                id: 'e5-point-in-range',
                innerClassId: 'e5-note',
                atSeconds: 0.9,
            }],
        }],
        workspace: {
            viewport: { startSeconds: 0, endSeconds: 12, zoom: 1 },
            overlay: { featureId: 'rms', topRatio: 0.1, heightRatio: 0.35 },
        },
    }, null, 2)}\n`;
};
