import { expect, test, vi } from 'vitest';
import { VisualizerWaveformSource } from '../../src/visualizer/waveformSource';
import { createAnalysisConfig } from '../../src/analysis/config';
import { createAnalysisFrame, analysisFrameCount } from '../../src/analysis/frames';
import { averageToMono } from '../../src/analysis/pcm';
import { exactM10Value } from '../../src/analysis/meydaAdapter';

function harness(length = 5000) {
    const channels = [Float32Array.from({ length }, (_, i) => Math.sin(i * .07) * .8),
        Float32Array.from({ length }, (_, i) => Math.cos(i * .04) * .4)];
    let descriptor = { trackId: 'song', revision: 1, length, sampleRate: 48000, durationSeconds: length / 48000, channelCount: 2 };
    const port = {
        getDecodedAudioDescriptor: () => descriptor,
        copyDecodedChannelRange: vi.fn(({ revision, channel, start, length }: { revision: number; channel: number; start: number; length: number }) =>
            revision === descriptor.revision ? channels[channel]!.slice(start, start + length) : null),
    };
    return { channels, port, source: new VisualizerWaveformSource(port), setDescriptor: (patch: Partial<typeof descriptor>) => { descriptor = { ...descriptor, ...patch }; } };
}

test('reads the same complete, mono, windowed frame as Analyzer exact Buffer at start, hop boundaries and song end', async () => {
    const h = harness(), config = await createAnalysisConfig(48000), pcm = averageToMono(h.channels);
    for (const [time, index] of [[0, 0], [511 / 48000, 0], [512 / 48000, 1], [5000 / 48000, analysisFrameCount(5000) - 1]]) {
        const expected = exactM10Value('buffer', createAnalysisFrame(pcm, index!, config), config) as number[];
        expect(h.source.read('song', time!)).toEqual(expected);
    }
    expect(h.port.copyDecodedChannelRange.mock.calls.every(([request]) => request.length <= 1024)).toBe(true);
    expect(h.source.read('song', 99)?.at(-1)).toBe(0);
});

test('zero pads audio shorter than one frame and is deterministic after backward seeks', async () => {
    const h = harness(100), config = await createAnalysisConfig(48000), frame = h.source.read('song', 0);
    expect(frame).toHaveLength(1024); expect(frame?.slice(100)).toEqual(Array(924).fill(0));
    expect(frame).toEqual(exactM10Value('buffer', createAnalysisFrame(averageToMono(h.channels), 0, config), config));
    expect(h.source.read('song', 2)).toEqual(frame); expect(h.source.read('song', -.5)).toEqual(frame);
});

test('shares cached frames across bindings, bounds the cache, and clears it on decoded revision, track changes and reset', () => {
    const h = harness(30000), first = h.source.read('song', 0);
    expect(h.source.read('song', 0)).toBe(first); expect(h.port.copyDecodedChannelRange).toHaveBeenCalledTimes(2);
    for (let i = 1; i < 20; i++) h.source.read('song', i * 512 / 48000);
    const count = h.port.copyDecodedChannelRange.mock.calls.length;
    expect(h.source.read('song', 0)).toEqual(first); expect(h.port.copyDecodedChannelRange).toHaveBeenCalledTimes(count + 2);
    h.setDescriptor({ revision: 2 }); expect(h.source.read('song', 0)).not.toBe(first);
    h.setDescriptor({ trackId: 'other' }); expect(h.source.read('song', 0)).toBeNull();
    h.setDescriptor({ trackId: 'song' }); const next = h.source.read('song', 0);
    h.source.reset(); expect(h.source.read('song', 0)).not.toBe(next);
});

test('does not publish a frame if decoded identity changes during a channel read', () => {
    const h = harness();
    h.port.copyDecodedChannelRange.mockImplementationOnce(() => { h.setDescriptor({ revision: 2 }); return h.channels[0]!.slice(0, 1024); });
    expect(h.source.read('song', 0)).toBeNull();
    const frame = h.source.read('song', 0); expect(frame).toHaveLength(1024);
    h.setDescriptor({ revision: 3 }); h.port.copyDecodedChannelRange.mockReturnValueOnce(new Float32Array(3));
    expect(() => h.source.read('song', 0)).toThrow(/长度/);
});
