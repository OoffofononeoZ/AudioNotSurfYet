import { expect, test, vi } from 'vitest';
import { exportTimeline } from '../../src/visualizer/offlineExportTimeline';
import { exportAudioChunk, assertExportAudio } from '../../src/visualizer/offlineExportAudio';
import { getVisualizerExportPreset } from '../../src/visualizer/exportPresets';

const descriptor = (length = 48000, sampleRate = 48000, channelCount = 2) => ({
    trackId: 'offline',
    revision: 2,
    sampleRate,
    length,
    channelCount,
    durationSeconds: length / sampleRate,
});

test.each([30, 60] as const)('integer frame timestamps cover a non-frame-aligned end at %i fps', fps => {
    const d = descriptor(44100 * 2 + 111, 44100),
        timeline = exportTimeline(d, fps);
    const frames = Array.from({ length: timeline.totalFrames }, (_, i) => timeline.frame(i));
    expect(frames).toHaveLength(Math.ceil((d.length * fps) / d.sampleRate));
    expect(frames[0]!.timestampUs).toBe(0);
    for (let i = 1; i < frames.length; i++) {
        expect(frames[i]!.timestampUs).toBe(frames[i - 1]!.timestampUs + frames[i - 1]!.durationUs);
        expect(frames[i]!.timeSeconds).toBe(i / fps);
    }
    expect(frames.at(-1)!.timestampUs + frames.at(-1)!.durationUs).toBe(Math.round((d.length / d.sampleRate) * 1e6));
    expect(() => timeline.frame(timeline.totalFrames)).toThrow();
});

test.each([1, 2, 4, 6])('PCM export preserves speaker mixing and channel separation for %i channels', count => {
    const d = descriptor(10, 48000, count);
    const port = {
        getDecodedAudioDescriptor: () => d,
        copyDecodedChannelRange: vi.fn(({ channel, length }: { channel: number; length: number }) =>
            new Float32Array(length).fill((channel + 1) / 10),
        ),
    };
    const chunk = exportAudioChunk(port, d, 2, 4);
    expect(chunk.data).toHaveLength(8);
    expect(chunk.timestamp).toBe(0.000042);
    const expectedLeft = count === 4 ? 0.2 : count === 6 ? 0.1 + Math.SQRT1_2 * 0.8 : 0.1;
    const expectedRight = count === 1 ? 0.1 : count === 4 ? 0.3 : count === 6 ? 0.2 + Math.SQRT1_2 * 0.9 : 0.2;
    expect(chunk.data[0]).toBeCloseTo(expectedLeft);
    expect(chunk.data[4]).toBeCloseTo(expectedRight);
    expect(port.copyDecodedChannelRange.mock.calls.every(([c]) => c.length === 4)).toBe(true);
    d.revision++;
    expect(() => assertExportAudio(port, { ...d, revision: 2 })).toThrow(/身份/);
});

test('PCM reads reject stale, oversized and truncated copies', () => {
    const d = descriptor();
    const port = { getDecodedAudioDescriptor: () => d, copyDecodedChannelRange: () => null };
    expect(() => exportAudioChunk(port, d, 0, 48000)).toThrow(/失效/);
    expect(() => exportAudioChunk(port, d, 0, 48001)).toThrow(/range/);
    expect(() => exportTimeline({ ...d, length: 0 }, 30)).toThrow();
});

test('all four output presets retain their dimensions and bitrate targets', () => {
    expect(
        ['720p', '1080p'].flatMap(resolution =>
            [30, 60].map(
                fps => getVisualizerExportPreset(resolution as '720p' | '1080p', fps as 30 | 60).videoBitsPerSecond,
            ),
        ),
    ).toEqual([6000000, 9000000, 10000000, 16000000]);
});

test.each([30, 60] as const)('compensation extends fixed-frame output and holds song boundaries at %i fps', fps => {
    const d = descriptor(44100 * 2 + 111, 44100);
    const lastSourceTime = exportTimeline(d, fps).frame(Math.ceil((d.length * fps) / d.sampleRate) - 1).timeSeconds;
    for (const offset of [-500, -120, -10, 0, 10, 120, 1000]) {
        const timeline = exportTimeline(d, fps, offset);
        const frames = Array.from({ length: timeline.totalFrames }, (_, i) => timeline.frame(i));
        expect(timeline.durationSeconds).toBeCloseTo(d.durationSeconds + Math.abs(offset) / 1000);
        expect(frames[0]!.timeSeconds).toBe(0);
        if (offset >= 0) expect(frames.at(-1)!.timeSeconds).toBe(lastSourceTime);
        else expect(frames.at(-1)!.timeSeconds).toBeGreaterThan(lastSourceTime - 1 / fps);
        expect(frames.at(-1)!.timestampUs + frames.at(-1)!.durationUs).toBe(Math.round(timeline.durationSeconds * 1e6));
        expect(
            frames.every((frame, i) => frame.timestampUs === Math.round((i * 1e6) / fps) && frame.durationUs > 0),
        ).toBe(true);
        expect(frames.every(frame => frame.timeSeconds >= 0 && frame.timeSeconds <= lastSourceTime)).toBe(true);
        if (offset < 0) {
            expect(
                frames
                    .filter(frame => frame.timestampUs / 1e6 < -offset / 1000)
                    .every(frame => frame.timeSeconds === 0),
            ).toBe(true);
            expect(timeline.frame(fps).timeSeconds).toBeCloseTo(1 + offset / 1000);
        }
    }
    expect(exportTimeline(descriptor(2400), fps, -500).frame(0).timeSeconds).toBe(0);
    expect(exportTimeline(descriptor(2400), fps, 1000).durationSeconds).toBe(1.05);
    expect(exportTimeline(descriptor(48000 * 2), fps, 120).totalFrames).toBe(fps === 30 ? 64 : 128);
    for (const offset of [-510, 1010, 11, Infinity]) expect(() => exportTimeline(d, fps, offset)).toThrow(/补偿/);
});

test.each([44100, 48000])('compensated %iHz PCM keeps every source sample across chunk boundaries', sampleRate => {
    // A short source exercises padding larger than the song as well as multi-chunk output.
    for (const length of [Math.round(sampleRate * 2.35), Math.round(sampleRate * 0.03)]) {
        const d = descriptor(length, sampleRate, 2);
        const reads: { channel: number; start: number; length: number }[] = [];
        const port = {
            getDecodedAudioDescriptor: () => d,
            copyDecodedChannelRange: (request: { channel: number; start: number; length: number }) => {
                reads.push(request);
                return Float32Array.from(
                    { length: request.length },
                    (_, i) => (request.start + i + 1) * (request.channel ? -1 : 1),
                );
            },
        };
        for (const offset of [-500, -120, -10, 0, 10, 120, 1000]) {
            reads.length = 0;
            const timeline = exportTimeline(d, 30, offset);
            const left = new Float32Array(timeline.totalAudioSamples),
                right = new Float32Array(left.length);
            for (let start = 0; start < left.length; start += sampleRate) {
                const count = Math.min(sampleRate, left.length - start);
                const chunk = exportAudioChunk(
                    port,
                    d,
                    start,
                    count,
                    timeline.audioStartSample,
                    timeline.totalAudioSamples,
                );
                left.set(chunk.data.subarray(0, count), start);
                right.set(chunk.data.subarray(count), start);
                expect(chunk.timestamp).toBe(start / sampleRate);
            }
            const begin = Math.round((Math.max(0, offset) * sampleRate) / 1000);
            const end = begin + length;
            expect(left.subarray(0, begin).every(value => value === 0)).toBe(true);
            expect(left.subarray(end).every(value => value === 0)).toBe(true);
            expect(right.subarray(0, begin).every(value => value === 0)).toBe(true);
            expect(right.subarray(end).every(value => value === 0)).toBe(true);
            expect(left.subarray(begin, end)).toEqual(Float32Array.from({ length }, (_, i) => i + 1));
            expect(right.subarray(begin, end)).toEqual(Float32Array.from({ length }, (_, i) => -i - 1));
            expect(reads.filter(r => r.channel === 0).reduce((n, r) => n + r.length, 0)).toBe(length);
            expect(reads.every(r => r.start >= 0 && r.start + r.length <= length && r.length <= sampleRate)).toBe(true);
        }
    }
});
