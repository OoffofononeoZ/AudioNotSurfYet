import artifacts from './model-artifacts.json';
import { hashBytes } from '../processing/sha256';

export const TRANSCRIPTION_MODELS = artifacts.models;
export type TranscriptionModelId = 'adt-encoder' | 'adt-decoder' | 'basic-pitch' | 'htdemucs-6s';
export function transcriptionModel(id:TranscriptionModelId) {
    const model = TRANSCRIPTION_MODELS.find(model => model.id === id);
    if (!model) throw new Error(`Missing transcription model: ${id}`);
    return model;
}
export const TRANSCRIPTION_CONFIG = {
    version: 'editor-limited-instruments-v1',
    resampler: 'torchaudio-sinc-hann-width6-rolloff0.99-mono-bounded-v1',
    drums: {
        sampleRate: 24000, samples: 61440, fft: 2048, hop: 240, melBins: 128,
        melScale: 'htk', melNorm: 'none', minimumHz: 20, power: 2,
        window: 'hann-periodic', center: true, cropHeadFrames: 5, cropTailFrames: 6,
        logFloor: 1e-10, logClamp: [-23, 12], logNormalize: [23, 35],
        bos: 2, eos: 3, timeOffset: 4, pitchOffset: 300, velocityOffset: 400,
        vocabulary: 1400, timeStepSeconds: 0.01, decoding: 'greedy-adjacent-triplets',
        maxTokens: 512, backend: 'wasm',
        classMap: 'kick35,36-snare38,40-hat42,43,44-other-ignored-v1',
    },
    pitch: {
        sampleRate: 22050, samples: 43844, hop: 256, frames: 172,
        overlapFrames: 30, inputHeadSamples: 3840, retainedFrames: 142,
        frameTime: 'absolute-input-window-origin-plus-256-sample-output-hop-v1',
        silencePadding: '3840-leading-zero-samples-then-tail-zero',
        onsetThreshold: 0.5, frameThreshold: 0.3, minimumFrames: 11,
        backend: 'wasm',
    },
    auxiliary: {
        sampleRate: 44100, samples: 343980, overlap: 85995,
        outputOrder: ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano'],
        retainedRows: [4, 5], backend: 'webgpu',
        normalization: 'none-export-graph',
        window: 'existing-ft-linear-25pct-f32-uncovered-endpoint-1e-8',
    },
    pointRangeThresholdMs: 300,
} as const;
export const TRANSCRIPTION_CONFIG_HASH = hashBytes(new TextEncoder().encode(JSON.stringify(TRANSCRIPTION_CONFIG)));
export const TRANSCRIPTION_MODEL_HASH = hashBytes(new TextEncoder().encode(JSON.stringify(artifacts)));
