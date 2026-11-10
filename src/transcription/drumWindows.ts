const RATE = 24000;
export interface DrumWindow {
    inputStartSample: number;
    coverageStartSample: number;
    coverageEndSample: number;
    attempt: 0 | 1;
}
export const DRUM_WINDOW_CONFIG = {
    sampleRate: RATE,
    inputSamples: 61440,
    strideSamples: 46080,
    contextSamples: 7680,
    retryRounds: 1,
} as const;

export function primaryDrumWindows(durationSeconds: number): DrumWindow[] {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw Error('Invalid drum source duration.');
    const frames = Math.ceil(durationSeconds * RATE),
        windows: DrumWindow[] = [];
    for (let start = 0; start < frames; start += DRUM_WINDOW_CONFIG.strideSamples)
        windows.push({
            inputStartSample: start - DRUM_WINDOW_CONFIG.contextSamples,
            coverageStartSample: start,
            coverageEndSample: Math.min(frames, start + DRUM_WINDOW_CONFIG.strideSamples),
            attempt: 0,
        });
    return windows;
}

export function retryDrumWindows(window: DrumWindow): DrumWindow[] {
    if (window.attempt !== 0) throw Error('Only one retry round is allowed.');
    const middle = Math.floor((window.coverageStartSample + window.coverageEndSample) / 2);
    return [
        [window.coverageStartSample, middle],
        [middle, window.coverageEndSample],
    ]
        .filter(([start, end]) => end! > start!)
        .map(([start, end]) => ({
            coverageStartSample: start!,
            coverageEndSample: end!,
            inputStartSample: Math.floor((start! + end!) / 2) - DRUM_WINDOW_CONFIG.inputSamples / 2,
            attempt: 1,
        }));
}

export function ownsDrumTime(window: DrumWindow, seconds: number): boolean {
    const time = Math.round(seconds * 1e6);
    return (
        time >= Math.round((window.coverageStartSample / RATE) * 1e6) &&
        time < Math.round((window.coverageEndSample / RATE) * 1e6)
    );
}
