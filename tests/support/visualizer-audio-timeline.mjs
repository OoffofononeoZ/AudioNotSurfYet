/** PTS is captured after the exact format conversion used for the raw PCM pipe. */
export function parseAudioTimeline(log) {
    const frames = [];
    for (const line of log.split(/\r?\n/)) {
        if (!line.includes('ashowinfo') || !line.includes('nb_samples:')) continue;
        const value = name => line.match(new RegExp(`\\b${name}:([^\\s]+)`))?.[1];
        const frame = { index: Number(value('n')), time: Number(value('pts_time')),
            rate: Number(value('rate')), count: Number(value('nb_samples')) };
        if (frame.index !== frames.length || !Number.isFinite(frame.time)
            || frame.rate !== 48000 || !Number.isSafeInteger(frame.count) || frame.count <= 0) {
            throw Error('Invalid decoded audio frame timeline.');
        }
        frames.push(frame);
    }
    if (!frames.length) throw Error('Missing decoded audio frame timestamps.');
    return frames;
}

export function measureAudioPcm(pcm, frames) {
    const count = frames.reduce((sum, frame) => sum + frame.count, 0);
    if (pcm.length !== count * 4) throw Error('PCM samples and timestamped frames differ.');
    let total = 0, peakRms = 0, peakTime = 0, sampleOffset = 0;
    const windows = [];
    for (const frame of frames) {
        // Never span a timestamp hole or overlap when constructing an RMS window.
        for (let offset = 0; offset < frame.count; offset += 480) {
            const length = Math.min(480, frame.count - offset);
            let sum = 0;
            for (let i = 0; i < length; i++) {
                const value = pcm.readFloatLE(4 * (sampleOffset + offset + i));
                if (!Number.isFinite(value)) throw Error('Non-finite decoded audio sample.');
                sum += value * value;
            }
            const rms = Math.sqrt(sum / length), center = offset + length / 2;
            const time = frame.time + center / frame.rate;
            windows.push({ rms, time, sampleTime: (sampleOffset + center) / frame.rate });
            total += sum;
            if (rms > peakRms) { peakRms = rms; peakTime = time; }
        }
        sampleOffset += frame.count;
    }
    return { rms: Math.sqrt(total / count), peakRms, peakTime, windows };
}
