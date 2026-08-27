import { sha256Bytes } from './audio-fixtures.ts';
import {
    E2_TEMPO_DURATION_SECONDS,
    createClickTrack,
} from './e2-tempo-fixture.ts';
import { encodeMonoWav } from './m7-learning-fixture.ts';

export const E3_POINT_GENERATOR_VERSION = 'editor-e3-points-v1';
export const E3_POINT_DURATION_SECONDS = E2_TEMPO_DURATION_SECONDS;

export const createE3PointWav = (): Uint8Array =>
    encodeMonoWav(createClickTrack(100, E3_POINT_DURATION_SECONDS));

export const buildE3PointGolden = () => {
    const wav = createE3PointWav();
    return {
        schemaVersion: 1,
        generatedAt: '2026-08-27',
        generatorVersion: E3_POINT_GENERATOR_VERSION,
        durationSeconds: E3_POINT_DURATION_SECONDS,
        bpm: 100,
        meter: '4/4',
        wavSha256: sha256Bytes(wav),
        snappingCases: [
            {
                id: 'full-viewport',
                viewport: { startSeconds: 0, endSeconds: 12, zoom: 1 },
                widthCssPx: 960,
                expectedSubdivision: 4,
                rawSeconds: 1.28,
                expectedSeconds: 1.35,
            },
            {
                id: 'zoomed-viewport',
                viewport: { startSeconds: 0, endSeconds: 3, zoom: 4 },
                widthCssPx: 960,
                expectedSubdivision: 16,
                rawSeconds: 1.28,
                expectedSeconds: 1.275,
            },
            {
                id: 'track-start',
                viewport: { startSeconds: 0, endSeconds: 12, zoom: 1 },
                widthCssPx: 960,
                expectedSubdivision: 4,
                rawSeconds: 0,
                expectedSeconds: 0,
            },
            {
                id: 'track-end',
                viewport: { startSeconds: 0, endSeconds: 12, zoom: 1 },
                widthCssPx: 960,
                expectedSubdivision: 4,
                rawSeconds: 12,
                expectedSeconds: 12,
            },
        ],
        pointEvents: [
            { innerClass: 'default', atSeconds: 0 },
            { innerClass: 'default', atSeconds: 1.35 },
            { innerClass: 'accent', atSeconds: 6 },
            { innerClass: 'accent', atSeconds: 12 },
        ],
    };
};

export const createE3RangeCompatibilityProject = (): string => {
    const wavHash = sha256Bytes(createE3PointWav());
    return `${JSON.stringify({
        format: 'audiosurf-editor',
        schemaVersion: 1,
        projectId: 'e3-compat-project',
        createdAt: '2026-08-27T00:00:00.000Z',
        updatedAt: '2026-08-27T00:00:00.000Z',
        track: {
            contentHash: wavHash,
            fileName: 'editor-e3-points-v1.wav',
            title: 'Editor E3 Points',
            durationSeconds: 12,
            sampleRate: 48_000,
        },
        tempoMap: [{
            id: 'e3-compat-tempo',
            startSeconds: 0,
            mode: 'metered',
            bpm: 100,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        }],
        lanes: [{
            id: 'e3-compat-range-lane',
            name: 'Long effects',
            eventKind: 'range',
            innerClasses: [{ id: 'e3-compat-range-class', label: 'up' }],
            events: [{
                id: 'e3-compat-range-event',
                innerClassId: 'e3-compat-range-class',
                startSeconds: 3,
                endSeconds: 4.5,
            }],
        }],
        workspace: {
            viewport: { startSeconds: 0, endSeconds: 12, zoom: 1 },
            overlay: { featureId: null, topRatio: 0.1, heightRatio: 0.35 },
        },
    }, null, 2)}\n`;
};
