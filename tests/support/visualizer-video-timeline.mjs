/** WebM timestamps have a millisecond time base; compare every decoded frame. */
export function measureOfflineVideoTimeline(times, duration, fps) {
    if (![30, 60].includes(fps) || !Number.isFinite(duration) || duration <= 0) throw Error('Invalid offline duration or frame rate.');
    const expectedFrames = Math.ceil(duration * fps), failures = [];
    if (times.length !== expectedFrames) failures.push(`Decoded frame count ${times.length} differs from ${expectedFrames}.`);
    const shifted = times.findIndex((time, index) => !Number.isFinite(time)
        || Math.abs(time - Math.round(index * 1e6 / fps) / 1e6) > .001001);
    if (shifted !== -1) failures.push(`Offline frame ${shifted} has a shifted timestamp.`);
    return { expectedFrames, decodedFrames: times.length, failures };
}
