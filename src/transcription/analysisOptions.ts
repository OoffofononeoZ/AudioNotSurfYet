import { hashBytes } from '../processing/sha256';
import { ACOUSTIC_CONFIG_HASH } from './acousticIndex';

export interface PitchDecodeOptions {
    onsetThreshold: number;
    frameThreshold: number;
    minimumFrames: number;
    gapFrames: number;
    neighbourRadius: number;
}
// Permissive raw decoding, followed by separately adjustable acoustic review.
// These values concern transcription only; auxiliary separation is unchanged.
export const ROLE_PITCH_OPTIONS = {
    bass: { onsetThreshold: 0.45, frameThreshold: 0.28, minimumFrames: 5, gapFrames: 6, neighbourRadius: 1 },
    vocals: { onsetThreshold: 0.55, frameThreshold: 0.3, minimumFrames: 8, gapFrames: 10, neighbourRadius: 1 },
    piano: { onsetThreshold: 0.4, frameThreshold: 0.25, minimumFrames: 2, gapFrames: 3, neighbourRadius: 0 },
    guitar: { onsetThreshold: 0.45, frameThreshold: 0.28, minimumFrames: 3, gapFrames: 4, neighbourRadius: 0 },
    other: { onsetThreshold: 0.45, frameThreshold: 0.28, minimumFrames: 3, gapFrames: 4, neighbourRadius: 0 },
} satisfies Record<string, PitchDecodeOptions>;
export const ANALYSIS_CONFIG_HASH = hashBytes(
    new TextEncoder().encode(
        JSON.stringify({
            version: 'timbre-evidence-v1',
            acoustic: ACOUSTIC_CONFIG_HASH,
            notes: ROLE_PITCH_OPTIONS,
        }),
    ),
);
