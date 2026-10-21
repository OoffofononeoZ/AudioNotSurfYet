import { FEATURE_IDS } from '../../src/analysis/types.ts';
import { sha256Bytes } from './audio-fixtures.ts';
import { createE3PointWav } from './e3-point-fixture.ts';

export const E4_OVERLAY_GENERATOR_VERSION = 'editor-e4-overlay-v1';
export const E4_OVERLAY_DURATION_SECONDS = 12;

export const createE4OverlayWav = (): Uint8Array => createE3PointWav();

const featureFamily = (featureId: (typeof FEATURE_IDS)[number]) => {
    if (featureId === 'buffer') {
        return { outputShape: 'waveform', renderer: 'waveform' };
    }
    if (featureId === 'loudness') {
        return { outputShape: 'loudness-structure', renderer: 'loudness' };
    }
    if (featureId === 'complexSpectrum') {
        return {
            outputShape: 'complex-spectrum',
            renderer: 'complex-spectrum',
        };
    }
    if (featureId === 'chroma') {
        return { outputShape: 'category-vector', renderer: 'chroma-heatmap' };
    }
    if (featureId === 'mfcc') {
        return { outputShape: 'category-vector', renderer: 'frequency-heatmap' };
    }
    if (featureId === 'amplitudeSpectrum' || featureId === 'powerSpectrum') {
        return { outputShape: 'frequency-vector', renderer: 'frequency-heatmap' };
    }
    return { outputShape: 'scalar', renderer: 'scalar-line' };
};

export const buildE4OverlayGolden = () => ({
    schemaVersion: 1,
    generatedAt: '2026-08-27',
    generatorVersion: E4_OVERLAY_GENERATOR_VERSION,
    durationSeconds: E4_OVERLAY_DURATION_SECONDS,
    bpm: 100,
    wavSha256: sha256Bytes(createE4OverlayWav()),
    overlay: {
        featureId: 'rms',
        topRatio: 0.1,
        heightRatio: 0.35,
        minHeightRatio: 0.12,
        keyboardStep: 0.01,
        keyboardCoarseStep: 0.05,
    },
    geometryAnchorsSeconds: [0, 1.2, 3, 6, 9, 12],
    features: FEATURE_IDS.map(featureId => ({
        featureId,
        ...featureFamily(featureId),
    })),
});

export const createE4OverlayProject = (): string =>
    `${JSON.stringify(
        {
            format: 'audiosurf-editor',
            schemaVersion: 2,
            projectId: 'e4-overlay-project',
            createdAt: '2026-08-27T00:00:00.000Z',
            updatedAt: '2026-08-27T00:00:00.000Z',
            track: {
                contentHash: sha256Bytes(createE4OverlayWav()),
                fileName: 'editor-e4-overlay-v1.wav',
                title: 'Editor E4 Overlay',
                durationSeconds: E4_OVERLAY_DURATION_SECONDS,
                sampleRate: 48_000,
            },
            tempoMap: [
                {
                    id: 'e4-tempo',
                    startSeconds: 0,
                    mode: 'metered',
                    beatOriginSeconds: 0,
                    bpm: 100,
                    bpmSource: 'user',
                    meter: { numerator: 4, denominator: 4 },
                },
            ],
            lanes: [
                {
                    id: 'e4-point-lane',
                    name: 'Overlay anchors',
                    eventKind: 'point',
                    innerClasses: [{ id: 'e4-default', label: 'default' }],
                    events: [
                        { id: 'e4-point-a', innerClassId: 'e4-default', atSeconds: 1.2 },
                        { id: 'e4-point-b', innerClassId: 'e4-default', atSeconds: 6 },
                    ],
                },
            ],
            workspace: {
                viewport: { startSeconds: 0, endSeconds: 12, zoom: 1 },
                overlay: { featureId: 'rms', topRatio: 0.1, heightRatio: 0.35 },
            },
        },
        null,
        2,
    )}\n`;
