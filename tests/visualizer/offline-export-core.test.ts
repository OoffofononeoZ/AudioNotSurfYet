import { expect, test, vi } from 'vitest';
import { exportTimeline } from '../../src/visualizer/offlineExportTimeline';
import { exportAudioChunk, assertExportAudio } from '../../src/visualizer/offlineExportAudio';
import { getVisualizerExportPreset } from '../../src/visualizer/exportPresets';

const descriptor = (length = 48000, sampleRate = 48000, channelCount = 2) => ({
    trackId: 'offline', revision: 2, sampleRate, length, channelCount, durationSeconds: length / sampleRate,
});

test.each([30, 60] as const)('integer frame timestamps cover a non-frame-aligned end at %i fps', fps => {
    const d = descriptor(44100 * 2 + 111, 44100), timeline = exportTimeline(d, fps);
    const frames = Array.from({ length: timeline.totalFrames }, (_, i) => timeline.frame(i));
    expect(frames).toHaveLength(Math.ceil(d.length * fps / d.sampleRate));
    expect(frames[0]!.timestampUs).toBe(0);
    for (let i = 1; i < frames.length; i++) {
        expect(frames[i]!.timestampUs).toBe(frames[i - 1]!.timestampUs + frames[i - 1]!.durationUs);
        expect(frames[i]!.timeSeconds).toBe(i / fps);
    }
    expect(frames.at(-1)!.timestampUs + frames.at(-1)!.durationUs).toBe(Math.round(d.length / d.sampleRate * 1e6));
    expect(() => timeline.frame(timeline.totalFrames)).toThrow();
});

test.each([1, 2, 4, 6])('PCM export preserves speaker mixing and channel separation for %i channels', count => {
    const d = descriptor(10, 48000, count);
    const port = { getDecodedAudioDescriptor: () => d,
        copyDecodedChannelRange: vi.fn(({ channel, length }: { channel: number; length: number }) => new Float32Array(length).fill((channel + 1) / 10)) };
    const chunk = exportAudioChunk(port, d, 2, 4);
    expect(chunk.data).toHaveLength(8);
    expect(chunk.timestamp).toBe(.000042);
    const expectedLeft = count === 4 ? .2 : count === 6 ? .1 + Math.SQRT1_2 * .8 : .1;
    const expectedRight = count === 1 ? .1 : count === 4 ? .3 : count === 6 ? .2 + Math.SQRT1_2 * .9 : .2;
    expect(chunk.data[0]).toBeCloseTo(expectedLeft);
    expect(chunk.data[4]).toBeCloseTo(expectedRight);
    expect(port.copyDecodedChannelRange.mock.calls.every(([c]) => c.length === 4)).toBe(true);
    d.revision++; expect(() => assertExportAudio(port, { ...d, revision: 2 })).toThrow(/身份/);
});

test('PCM reads reject stale, oversized and truncated copies', () => {
    const d = descriptor();
    const port = { getDecodedAudioDescriptor: () => d, copyDecodedChannelRange: () => null };
    expect(() => exportAudioChunk(port, d, 0, 48000)).toThrow(/失效/);
    expect(() => exportAudioChunk(port, d, 0, 48001)).toThrow(/range/);
    expect(() => exportTimeline({ ...d, length: 0 }, 30)).toThrow();
});

test('all four output presets retain their dimensions and bitrate targets', () => {
    expect(['720p', '1080p'].flatMap(resolution => [30, 60].map(fps => getVisualizerExportPreset(resolution as '720p' | '1080p', fps as 30 | 60).videoBitsPerSecond)))
        .toEqual([6000000, 9000000, 10000000, 16000000]);
});
