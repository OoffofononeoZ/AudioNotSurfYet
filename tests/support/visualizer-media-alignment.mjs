/** Match decoded flashes and independent audio windows against song time. */
export function measureOutputSynchronization(
    expected,
    flashes,
    audioWindows,
    flashSeconds = 0,
    audioVideoOffsetSeconds = 0,
) {
    const audioDelay = Math.max(audioVideoOffsetSeconds, 0),
        videoDelay = Math.max(-audioVideoOffsetSeconds, 0);
    const failures = [];
    let lastFlash = -Infinity,
        lastAudioSample = -Infinity;
    const syncEvents = expected.map(time => {
        // Look beyond the acceptance budget so a late event is measured rather
        // than omitted from the drift range. The 100ms check still applies.
        const flash = flashes
            .filter(t => t > lastFlash && Math.abs(t - time - videoDelay) <= 1)
            .sort((a, b) => Math.abs(a - time - videoDelay) - Math.abs(b - time - videoDelay))[0];
        // Sample position identifies the source burst; PTS measures its presentation time.
        const peak = audioWindows
            .filter(
                w =>
                    w.sampleTime > lastAudioSample &&
                    Math.abs(w.sampleTime - (time + audioDelay + flashSeconds / 2)) <= 0.1,
            )
            .sort((a, b) => b.rms - a.rms)[0];
        if (flash !== undefined) lastFlash = flash;
        if (peak) lastAudioSample = peak.sampleTime;
        if (flash === undefined || Math.abs(flash - time - videoDelay) > 0.1)
            failures.push(`Missing or shifted flash at ${time}s.`);
        if (!(peak?.rms >= 0.1) || Math.abs(peak.time - time - audioDelay - flashSeconds / 2) > 0.1)
            failures.push(`Missing or shifted audio event at ${time}s.`);
        const offset = flash === undefined || !peak ? null : flash - peak.time;
        if (offset === null || Math.abs(offset + audioVideoOffsetSeconds) > 0.1)
            failures.push(`A/V event delta over 100ms at ${time}s.`);
        return {
            expectedTime: time,
            flashTime: flash ?? null,
            audioPeakTime: peak?.time ?? null,
            offset,
            flashSourceOffsetSeconds: flash === undefined ? null : flash - time - videoDelay,
            audioSourceOffsetSeconds: peak ? peak.time - time - audioDelay - flashSeconds / 2 : null,
        };
    });
    const offsets = syncEvents.flatMap(e => (e.offset === null ? [] : [e.offset]));
    const syncDriftSeconds = offsets.length ? Math.max(...offsets) - Math.min(...offsets) : null;
    if (syncDriftSeconds === null || syncDriftSeconds > 0.1) failures.push('A/V event drift over 100ms.');
    return { syncEvents, syncDriftSeconds, failures };
}
