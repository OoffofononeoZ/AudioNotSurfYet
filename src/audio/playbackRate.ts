export const MIN_PLAYBACK_RATE = 0.1;
export const MAX_PLAYBACK_RATE = 2;

export function assertPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate < MIN_PLAYBACK_RATE || rate > MAX_PLAYBACK_RATE) {
        throw new RangeError('Playback rate must be between 0.1 and 2.');
    }
}
