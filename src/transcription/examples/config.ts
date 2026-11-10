export const EXAMPLE_SEARCH_CONFIG = {
    version: 'same-song-mfcc-banded-dtw-v1',
    descriptorWidth: 12,
    maximumSequenceFrames: 192,
    dtwBand: 0.2,
    durationRatios: [0.8, 1, 1.2],
    coarseFloor: 0.65,
    pointContextSeconds: 0.18,
} as const;
